import { NextRequest, NextResponse } from "next/server";
import { prisma, safeWrite } from "@/lib/prisma-wrapper";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUser } from "@/lib/user-service";
import {
  StrategyFactory,
  GrahamParams,
  DividendYieldParams,
  LowPEParams,
  MagicFormulaParams,
  FCDParams,
  GordonParams,
  FundamentalistParams,
  AIParams,
  ScreeningParams,
  BarsiParams,
  BazinParams,
  LynchParams,
  FiiScreeningParams,
  FiiDividendYieldParams,
  FiiRankingParams,
  RankBuilderResult,
  CompanyData,
} from "@/lib/strategies";
import { STRATEGY_CONFIG } from "@/lib/strategies/strategy-config";
import { getCompaniesData, getCompaniesDataFii } from "@/lib/rank-builder-service";
import { applyLiquidityRules, getRankingModel, isRankingUniverse } from "@/lib/ranking-models";
import { warmMacroAssumptions } from "@/lib/finance/macro";
import { formatBRLCompact } from "@/lib/format";

const FII_RANK_BUILDER_MODELS = new Set([
  "fiiScreening",
  "fiiDividendYield",
  "fiiRanking",
]);

/** Modelos premium com nome fixo na mensagem de bloqueio. */
const LEGACY_PREMIUM_MODELS: Record<string, string> = {
  fcd: "FCD",
  gordon: "Fórmula de Gordon",
  fundamentalist: "Fundamentalista 3+1",
  ai: "Síntese com IA",
  barsi: "Método Barsi",
  fiiRanking: "Ranking PJ-FII",
};

/** Modelos novos: o plano vem do registro (`ranking-models.ts`), então o dono pode liberar um deles no gratuito. */
const REGISTRY_GATED_MODELS = new Set(["bazin", "lynch"]);

/** Modelos com preço justo próprio: o enriquecimento não troca o preço justo deles pelo de Graham/FCD/Gordon. */
const MODELS_WITH_FAIR_VALUE = new Set(["graham", "fcd", "gordon", "barsi", "bazin", "lynch"]);

/** Nome do modelo para a mensagem de bloqueio, ou `null` quando o modelo é gratuito. */
function premiumModelName(model: string): string | null {
  if (LEGACY_PREMIUM_MODELS[model]) return LEGACY_PREMIUM_MODELS[model];
  if (REGISTRY_GATED_MODELS.has(model)) {
    const entry = getRankingModel(model);
    return !entry || entry.plan === "premium" ? entry?.label ?? model : null;
  }
  return null;
}

type ModelParams =
  | GrahamParams
  | DividendYieldParams
  | LowPEParams
  | MagicFormulaParams
  | FCDParams
  | GordonParams
  | FundamentalistParams
  | AIParams
  | ScreeningParams
  | BarsiParams
  | BazinParams
  | LynchParams
  | FiiScreeningParams
  | FiiDividendYieldParams
  | FiiRankingParams;

interface RankBuilderRequest {
  model:
    | "graham"
    | "dividendYield"
    | "lowPE"
    | "magicFormula"
    | "fcd"
    | "gordon"
    | "fundamentalist"
    | "ai"
    | "screening"
    | "barsi"
    | "bazin"
    | "lynch"
    | "fiiScreening"
    | "fiiDividendYield"
    | "fiiRanking";
  params: ModelParams;
}

/** `minLiquidity` válido: número finito ≥ 0, `null` (incluir ilíquidos) ou `undefined` (limite padrão). */
/**
 * Completa parâmetros ausentes (`undefined`) dos modelos de ações com os padrões do registro, como o painel faz.
 * Ex.: dividendYield sem `minYield` usava `undefined` e não retornava nada. `null` explícito é preservado.
 * Screening fica de fora: seus filtros são opcionais por definição e o plano gratuito já recebe params restritos.
 */
function withRegistryDefaults(model: string, params: ModelParams): ModelParams {
  const registryModel = getRankingModel(model);
  if (!registryModel || registryModel.assetType !== "stock" || model === "screening") return params;
  const raw = (params as { assetTypeFilter?: unknown }).assetTypeFilter;
  const universe = isRankingUniverse(raw) ? raw : "b3";
  const filled: Record<string, unknown> = { ...(params as Record<string, unknown>) };
  for (const [key, value] of Object.entries(registryModel.defaults(universe))) {
    if (filled[key] === undefined) filled[key] = value;
  }
  return filled as ModelParams;
}

function parseMinLiquidity(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

// Função para gerar o racional de cada modelo usando StrategyFactory
function generateRational(model: string, params: ModelParams): string {
  switch (model) {
    case "graham":
      return StrategyFactory.generateRational("graham", params as GrahamParams);
    case "dividendYield":
      return StrategyFactory.generateRational("dividendYield", params as DividendYieldParams);
    case "lowPE":
      return StrategyFactory.generateRational("lowPE", params as LowPEParams);
    case "magicFormula":
      return StrategyFactory.generateRational("magicFormula", params as MagicFormulaParams);
    case "fcd":
      return StrategyFactory.generateRational("fcd", params as FCDParams);
    case "gordon":
      return StrategyFactory.generateRational("gordon", params as GordonParams);
    case "fundamentalist":
      return StrategyFactory.generateRational("fundamentalist", params as FundamentalistParams);
    case "ai":
      return StrategyFactory.generateRational("ai", params as AIParams);
    case "screening":
      return StrategyFactory.generateRational("screening", params as ScreeningParams);
    case "barsi":
      return StrategyFactory.generateRational("barsi", params as BarsiParams);
    case "bazin":
      return StrategyFactory.generateRational("bazin", params as BazinParams);
    case "lynch":
      return StrategyFactory.generateRational("lynch", params as LynchParams);
    case "fiiScreening":
      return StrategyFactory.generateRational("fiiScreening", params as FiiScreeningParams);
    case "fiiDividendYield":
      return StrategyFactory.generateRational("fiiDividendYield", params as FiiDividendYieldParams);
    case "fiiRanking":
      return StrategyFactory.generateRational("fiiRanking", params as FiiRankingParams);
    default:
      return "Modelo não encontrado.";
  }
}

interface ModelValuation {
  upside: number;
  fairValue: number;
  model: string;
}

/**
 * Preços justos de Graham (todos) e de FCD e Gordon (Premium) para a empresa. Grava o upside de cada um em
 * `keyMetrics` (grahamUpside, fcdUpside, gordonUpside) e devolve os que têm preço justo.
 */
function modelValuations(
  company: CompanyData,
  userIsPremium: boolean,
  keyMetrics: Record<string, number | null>
): ModelValuation[] {
  const runs: Array<{ model: string; key: string; run: () => { upside: number | null; fairValue: number | null } }> = [
    { model: "Graham", key: "grahamUpside", run: () => StrategyFactory.runGrahamAnalysis(company, STRATEGY_CONFIG.graham) },
  ];
  if (userIsPremium) {
    runs.push(
      { model: "FCD", key: "fcdUpside", run: () => StrategyFactory.runFCDAnalysis(company, STRATEGY_CONFIG.fcd) },
      { model: "Gordon", key: "gordonUpside", run: () => StrategyFactory.runGordonAnalysis(company, STRATEGY_CONFIG.gordon) }
    );
  }

  const valuations: ModelValuation[] = [];
  for (const { model, key, run } of runs) {
    try {
      const analysis = run();
      if (analysis.upside === null || analysis.upside === undefined) continue;
      keyMetrics[key] = analysis.upside;
      if (analysis.fairValue !== null && analysis.fairValue !== undefined) {
        valuations.push({ upside: analysis.upside, fairValue: analysis.fairValue, model });
      }
    } catch {
      // Modelo sem dados suficientes para esta empresa: segue com os demais.
    }
  }
  return valuations;
}

export async function POST(request: NextRequest) {
  try {
    const body: RankBuilderRequest = await request.json();
    const { model, params } = body;

    // Validação básica
    if (!model || !params) {
      return NextResponse.json(
        { error: "Model e params são obrigatórios" },
        { status: 400 }
      );
    }

    const pAssetEarly = (params as { assetTypeFilter?: string }).assetTypeFilter;
    if (FII_RANK_BUILDER_MODELS.has(model) && pAssetEarly !== "fii") {
      return NextResponse.json(
        { error: 'Modelos FII exigem params.assetTypeFilter = "fii"' },
        { status: 400 }
      );
    }
    if (pAssetEarly === "fii" && !FII_RANK_BUILDER_MODELS.has(model)) {
      return NextResponse.json(
        { error: "Modelo incompatível com assetTypeFilter fii" },
        { status: 400 }
      );
    }

    // Verificar se o usuário está autenticado para salvar histórico
    const session = await getServerSession(authOptions);

    // Verificar se é modelo Premium e se usuário tem acesso
    const premiumName = premiumModelName(model);
    if (premiumName) {
      if (!session?.user?.id) {
        return NextResponse.json(
          {
            error: `Modelo ${premiumName} exclusivo para usuários logados. Faça login para acessar.`,
          },
          { status: 401 }
        );
      }

      // Buscar dados do usuário para verificar se é Premium - ÚNICA FONTE DA VERDADE
      const user = await getCurrentUser();

      if (!user?.isPremium) {
        return NextResponse.json(
          {
            error: `Modelo ${premiumName} exclusivo para usuários Premium. Faça upgrade para acessar análises avançadas.`,
          },
          { status: 403 }
        );
      }
    }

    // Verificar restrições para o modelo Screening
    if (model === "screening") {
      const user = session?.user?.id ? await getCurrentUser() : null;
      const isPremium = user?.isPremium || false;

      // Se não for Premium (incluindo deslogados), limitar filtros
      if (!isPremium) {
        const screeningParams = params as ScreeningParams;

        // Verificar se é uma rota de marketing (preset) - identificada pela presença de sortBy
        // Rotas de marketing têm sortBy definido e devem permitir todos os filtros necessários
        const isMarketingRoute = !!screeningParams.sortBy;

        if (isMarketingRoute) {
          // Rotas de marketing: permitir todos os filtros necessários para funcionar corretamente
          // Backend sempre aplica limite de 3 para não-Premium (não confiar no frontend)
          body.params = {
            ...screeningParams,
            limit: 3,
            useTechnicalAnalysis: false, // Desabilitar análise técnica para não-Premium
          };
        } else {
          // Modo ferramenta normal: limitar apenas aos parâmetros de Valuation
          const restrictedParams: ScreeningParams = {
            // Permitir apenas filtros de Valuation
            plFilter: screeningParams.plFilter,
            pvpFilter: screeningParams.pvpFilter,
            evEbitdaFilter: screeningParams.evEbitdaFilter,
            psrFilter: screeningParams.psrFilter,

            // Permitir Graham Upside (estratégia Graham é gratuita)
            grahamUpsideFilter: screeningParams.grahamUpsideFilter,

            // Manter parâmetros básicos
            // Backend sempre aplica limite de 3 para não-Premium (não confiar no frontend)
            limit: 3,
            companySize: screeningParams.companySize || "all",
            useTechnicalAnalysis: false, // Desabilitar análise técnica para não-Premium
            assetTypeFilter: screeningParams.assetTypeFilter,
            // Liquidez: o usuário pode incluir ativos com baixa liquidez (null) também no plano gratuito
            minLiquidity: screeningParams.minLiquidity,

            // Remover todos os outros filtros (ficam undefined)
            roeFilter: undefined,
            roicFilter: undefined,
            roaFilter: undefined,
            margemLiquidaFilter: undefined,
            margemEbitdaFilter: undefined,
            cagrLucros5aFilter: undefined,
            cagrReceitas5aFilter: undefined,
            dyFilter: undefined,
            payoutFilter: undefined,
            dividaLiquidaPlFilter: undefined,
            liquidezCorrenteFilter: undefined,
            dividaLiquidaEbitdaFilter: undefined,
            marketCapFilter: undefined,
            overallScoreFilter: undefined,
            selectedSectors: undefined,
            selectedIndustries: undefined,
          };

          // Substituir params com os parâmetros restritos
          body.params = restrictedParams;
        }
      } else {
        // Para Premium, garantir que não há limite (remover se vier do frontend)
        const screeningParams = params as ScreeningParams;
        body.params = {
          ...screeningParams,
          limit: undefined // Premium sempre sem limite
        };
      }
    }

    // Screening de FIIs: limite para não-Premium (marketing / trial)
    if (model === "fiiScreening") {
      const fiiScrUser = session?.user?.id ? await getCurrentUser() : null;
      const fiiScrPremium = fiiScrUser?.isPremium || false;
      const fiiScrParams = params as FiiScreeningParams;
      if (!fiiScrPremium) {
        body.params = {
          ...fiiScrParams,
          limit: 3,
          useTechnicalAnalysis: false,
        };
      } else {
        body.params = {
          ...fiiScrParams,
          limit: undefined,
        };
      }
    }

    // Buscar dados de todas as empresas (com filtro de tipo de ativo se fornecido)
    // Usar body.params se foi modificado, senão usar params original
    const finalParams = (body.params || params) as ModelParams;
    const assetTypeFilter = finalParams.assetTypeFilter;
    const minLiquidity = parseMinLiquidity(finalParams.minLiquidity);
    const [loadedCompanies] = await Promise.all([
      assetTypeFilter === "fii" ? getCompaniesDataFii() : getCompaniesData(assetTypeFilter),
      // FCD, Gordon e P/VP justo usam Ke das premissas macro (snapshot síncrono).
      warmMacroAssumptions(),
    ]);
    // Liquidez: exclui ações/FIIs abaixo do volume mínimo (salvo `minLiquidity: null`), marca BDRs ilíquidos
    // e mantém só a classe mais líquida de cada empresa.
    const companies = applyLiquidityRules(loadedCompanies, minLiquidity);
    const companiesByTicker = new Map(companies.map((company) => [company.ticker, company]));

    console.log(
      `📊 Empresas carregadas: ${loadedCompanies.length}, após liquidez: ${companies.length}`
    );

    let results: RankBuilderResult[] = [];

    // Usar body.params se foi modificado (para screening não-Premium), senão usar params original
    const executionParams = withRegistryDefaults(model, (body.params || params) as ModelParams);

    switch (model) {
      case "graham":
        results = StrategyFactory.runGrahamRanking(
          companies,
          executionParams as GrahamParams
        );
        break;
      case "dividendYield":
        results = StrategyFactory.runDividendYieldRanking(
          companies,
          executionParams as DividendYieldParams
        );
        break;
      case "lowPE":
        results = StrategyFactory.runLowPERanking(
          companies,
          executionParams as LowPEParams
        );
        break;
      case "magicFormula": {
        // Verificar status Premium do usuário (pode ser null se deslogado)
        const magicFormulaUser = session?.user?.id ? await getCurrentUser() : null;
        const magicFormulaIsPremium = magicFormulaUser?.isPremium || false;

        // Calcular total ANTES de aplicar limite (para mostrar blur nas rotas de marketing)
        const allMagicFormulaResults = StrategyFactory.runMagicFormulaRanking(companies, {
          ...(executionParams as MagicFormulaParams),
          limit: undefined,
        });
        const magicFormulaTotalCount = allMagicFormulaResults.length;

        // Backend SEMPRE aplica o limite correto baseado no status Premium (não confiar no frontend):
        // Premium sem limite; não-Premium (incluindo deslogados) sempre 3.
        results = StrategyFactory.runMagicFormulaRanking(companies, {
          ...(executionParams as MagicFormulaParams),
          limit: magicFormulaIsPremium ? undefined : 3,
        });

        (results as any).__magicFormulaTotalCount = magicFormulaTotalCount;
        break;
      }
      case "fcd":
        results = StrategyFactory.runFCDRanking(companies, executionParams as FCDParams);
        break;
      case "gordon":
        results = StrategyFactory.runGordonRanking(
          companies,
          executionParams as GordonParams
        );
        break;
      case "fundamentalist":
        results = StrategyFactory.runFundamentalistRanking(
          companies,
          executionParams as FundamentalistParams
        );
        break;
      case "ai":
        results = await StrategyFactory.runAIRanking(
          companies,
          executionParams as AIParams
        );
        break;
      case "screening": {
        const screeningParams = executionParams as ScreeningParams;

        // Verificar status Premium do usuário (pode ser null se deslogado)
        const screeningUser = session?.user?.id ? await getCurrentUser() : null;
        const screeningIsPremium = screeningUser?.isPremium || false;

        // Calcular total ANTES de aplicar limite (para mostrar blur nas rotas de marketing)
        const totalCount = StrategyFactory.runScreeningRanking(companies, {
          ...screeningParams,
          limit: undefined,
        }).length;

        // Backend SEMPRE aplica o limite correto baseado no status Premium (não confiar no frontend):
        // Premium sem limite (usa o padrão da estratégia); não-Premium (incluindo deslogados) sempre 3.
        results = StrategyFactory.runScreeningRanking(companies, {
          ...screeningParams,
          limit: screeningIsPremium ? undefined : 3,
        });

        (results as any).__screeningTotalCount = totalCount;
        break;
      }
      case "barsi":
        results = await StrategyFactory.runBarsiRanking(
          companies,
          executionParams as BarsiParams
        );
        break;
      case "bazin":
        results = StrategyFactory.runBazinRanking(companies, executionParams as BazinParams);
        break;
      case "lynch":
        results = StrategyFactory.runLynchRanking(companies, executionParams as LynchParams);
        break;
      case "fiiScreening":
        results = StrategyFactory.runFiiScreeningRanking(
          companies,
          executionParams as FiiScreeningParams
        );
        break;
      case "fiiDividendYield":
        results = StrategyFactory.runFiiDividendYieldRanking(
          companies,
          executionParams as FiiDividendYieldParams
        );
        break;
      case "fiiRanking":
        results = StrategyFactory.runFiiRankingRanking(
          companies,
          executionParams as FiiRankingParams
        );
        break;
      default:
        return NextResponse.json(
          { error: `Modelo '${model}' não suportado` },
          { status: 400 }
        );
    }

    // Total real (antes do limite) guardado como propriedade do array pelo screening / Magic Formula:
    // lido aqui porque os .map() abaixo criam arrays novos e perderiam a propriedade.
    const rawResults = results as RankBuilderResult[] & {
      __screeningTotalCount?: number;
      __magicFormulaTotalCount?: number;
    };
    const totalCount =
      rawResults.__screeningTotalCount ?? rawResults.__magicFormulaTotalCount ?? results.length;
    delete rawResults.__screeningTotalCount;
    delete rawResults.__magicFormulaTotalCount;

    // Enriquecer resultados com os upsides de Graham (todos), FCD e Gordon (Premium). Modelos sem preço justo
    // próprio (screening, dividendos, P/L baixo…) passam a mostrar o maior deles, com o modelo de origem.
    if (results.length > 0 && !FII_RANK_BUILDER_MODELS.has(model)) {
      try {
        const currentUser = session?.user?.id ? await getCurrentUser() : null;
        const userIsPremium = currentUser?.isPremium || false;
        const hasOwnFairValue = MODELS_WITH_FAIR_VALUE.has(model);

        results = results.map((result) => {
          const company = companiesByTicker.get(result.ticker);
          if (!company) return result;

          const enrichedKeyMetrics = { ...(result.key_metrics || {}) };
          const valuations = modelValuations(company, userIsPremium, enrichedKeyMetrics);
          const missingOwnValue =
            result.upside === null || result.upside === undefined || result.fairValue === null || result.fairValue === undefined;

          if ((!hasOwnFairValue || missingOwnValue) && valuations.length > 0) {
            const best = valuations.reduce((acc, current) => (current.upside > acc.upside ? current : acc));
            return {
              ...result,
              upside: best.upside,
              fairValue: best.fairValue,
              fairValueModel: best.model,
              key_metrics: enrichedKeyMetrics,
            };
          }
          return { ...result, fairValueModel: result.fairValueModel ?? null, key_metrics: enrichedKeyMetrics };
        });
      } catch (error) {
        console.warn("Erro ao enriquecer resultados com múltiplos upsides:", error);
      }
    }

    // Liquidez em cada linha: volume médio diário (R$/dia) e aviso para ativos abaixo do limite mantidos no ranking.
    results = results.map((result) => {
      const company = companiesByTicker.get(result.ticker);
      const value = company?.averageDailyTradedValue;
      if (value === undefined) return result;
      const keyMetrics = { ...(result.key_metrics || {}) };
      if (keyMetrics.liquidez === undefined) keyMetrics.liquidez = value;
      const lowLiquidity = company?.lowLiquidity === true;
      return {
        ...result,
        averageDailyTradedValue: value,
        lowLiquidity,
        key_metrics: keyMetrics,
        rational: lowLiquidity
          ? `${result.rational}\n\nBaixa liquidez: ${
              value === null ? "sem dado de volume negociado recente" : `volume médio diário de ${formatBRLCompact(value)}`
            }.`
          : result.rational,
      };
    });

    // Gerar racional para o modelo usado (usar executionParams que pode ter sido modificado)
    const rational = generateRational(model, executionParams);

    // Salvar no histórico se o usuário estiver logado (COM transação pois é INSERT)
    if (session?.user?.id) {
      try {
        // Usar o serviço centralizado para obter o usuário válido
        const currentUser = await getCurrentUser();

        if (currentUser?.id) {
          await safeWrite(
            "save-ranking-history",
            () =>
              prisma.rankingHistory.create({
                data: {
                  userId: currentUser.id,
                  model,
                  params: JSON.parse(JSON.stringify(executionParams)), // Conversão para Json type (usar params executados)
                  results: JSON.parse(JSON.stringify(results)), // Cache dos resultados como Json
                  resultCount: results.length,
                },
              }),
            ["ranking_history", "users"]
          );
        } else {
          console.warn("Usuário não encontrado pelo serviço centralizado");
        }
      } catch (historyError) {
        // Não falhar a request se não conseguir salvar no histórico
        console.error("Erro ao salvar histórico:", historyError);
      }
    }

    return NextResponse.json({
      model,
      params: executionParams, // Retornar os params usados (pode ter sido modificado para não-Premium)
      rational,
      results,
      count: totalCount, // Total real de empresas encontradas (antes do limite)
    });
  } catch (error) {
    console.error("Erro na API rank-builder:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
