import { NextRequest, NextResponse } from "next/server";
import { prisma, safeQueryWithParams, safeWrite } from "@/lib/prisma-wrapper";
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
  FiiScreeningParams,
  FiiDividendYieldParams,
  FiiRankingParams,
  RankBuilderResult,
  CompanyData,
  toNumber,
} from "@/lib/strategies";
import { STRATEGY_CONFIG } from "@/lib/strategies/strategy-config";
import {
  TechnicalIndicators,
  type PriceData,
} from "@/lib/technical-indicators";
import { DividendService } from "@/lib/dividend-service";

const FII_RANK_BUILDER_MODELS = new Set([
  "fiiScreening",
  "fiiDividendYield",
  "fiiRanking",
]);

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
    | "fiiScreening"
    | "fiiDividendYield"
    | "fiiRanking";
  params: ModelParams;
}

/** FIIs para rank-builder (fiiData + cotação + dividendos recentes) */
async function getCompaniesDataFii(): Promise<CompanyData[]> {
  const companies = await safeQueryWithParams(
    "all-fii-companies-data",
    () =>
      prisma.company.findMany({
        where: {
          assetType: "FII",
          fiiData: { isNot: null },
        },
        include: {
          fiiData: true,
          dailyQuotes: {
            orderBy: { date: "desc" },
            take: 1,
          },
          dividendHistory: {
            orderBy: { exDate: "desc" },
            take: 12,
          },
        },
      }),
    { type: "fii-companies" }
  );

  return companies.map((company) => {
    const fd = company.fiiData!;
    const quotePx = toNumber(company.dailyQuotes[0]?.price);
    const cot = toNumber(fd.cotacao);
    const currentPrice = quotePx && quotePx > 0 ? quotePx : cot || 0;
    const lastDivFromFii = toNumber(fd.lastDividendValue);

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      assetType: "FII",
      currentPrice,
      logoUrl: company.logoUrl,
      /** Alinha com a página do FII (`fiiData.lastDividendValue`), evitando usar só o 1º pagamento do histórico (mensal). */
      ...(lastDivFromFii !== null && lastDivFromFii > 0 ? { ultimoDividendo: lastDivFromFii } : {}),
      dividendHistory: company.dividendHistory.map((d) => ({
        amount: d.amount,
        exDate: d.exDate,
      })),
      financials: {
        dy: fd.dividendYield,
        pvp: fd.pvp,
        vpa: fd.valorPatrimonial,
        marketCap: fd.valorMercado,
        fiiLiquidez: fd.liquidez,
        fiiQtdImoveis: fd.qtdImoveis,
        fiiVacanciaMedia: fd.vacanciaMedia,
        fiiCapRate: fd.capRate,
        fiiFfoYield: fd.ffoYield,
        fiiSegment: fd.segment,
        fiiIsPapel: fd.isPapel,
        fiiCotacao: fd.cotacao,
        precoM2: fd.precoM2,
        aluguelM2: fd.aluguelM2,
        patrimonioLiquido: fd.patrimonioLiquido,
        ...(lastDivFromFii !== null && lastDivFromFii > 0
          ? { fiiLastDividendValue: fd.lastDividendValue }
          : {}),
      },
    };
  });
}

// Função para buscar dados de todas as empresas
async function getCompaniesData(assetTypeFilter?: 'b3' | 'bdr' | 'both'): Promise<CompanyData[]> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4; // Últimos 5 anos para demonstrações

  // Determinar quais assetTypes incluir baseado no filtro
  let assetTypes: ("STOCK" | "BDR")[] = [];
  if (assetTypeFilter === 'b3') {
    assetTypes = ["STOCK"];
  } else if (assetTypeFilter === 'bdr') {
    assetTypes = ["BDR"];
  } else {
    // 'both' ou undefined - incluir ambos
    assetTypes = ["STOCK", "BDR"];
  }

  const companies = await safeQueryWithParams(
    "all-companies-data",
    () =>
      prisma.company.findMany({
        include: {
          financialData: {
            orderBy: { year: "desc" },
            take: 8, // Dados atuais + até 7 anos históricos
          },
          dailyQuotes: {
            orderBy: { date: "desc" },
            take: 1, // Cotação mais recente
          },
          dividendHistory: {
            orderBy: { exDate: "desc" },
            take: 10, // Últimos 10 dividendos para análise de consistência
          },
          historicalPrices: {
            where: {
              interval: "1mo",
              date: {
                gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // Últimos 2 anos
              },
            },
            orderBy: { date: "asc" },
            select: {
              date: true,
              open: true,
              high: true,
              low: true,
              close: true,
              volume: true,
            },
          },
          // Incluir demonstrações financeiras para cálculo do Overall Score
          incomeStatements: {
            where: {
              period: "YEARLY",
              endDate: { gte: new Date(`${startYear}-01-01`) },
            },
            orderBy: { endDate: "desc" },
            take: 7,
          },
          balanceSheets: {
            where: {
              period: "YEARLY",
              endDate: { gte: new Date(`${startYear}-01-01`) },
            },
            orderBy: { endDate: "desc" },
            take: 7,
          },
          cashflowStatements: {
            where: {
              period: "YEARLY",
              endDate: { gte: new Date(`${startYear}-01-01`) },
            },
            orderBy: { endDate: "desc" },
            take: 7,
          },
          // Incluir snapshots para filtrar por overall_score
          snapshots: {
            select: {
              overallScore: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        where: {
          assetType: { in: assetTypes }, // Filtrar por tipo de ativo baseado no filtro
          financialData: {
            some: {
              // Filtros básicos para ter dados mínimos necessários
              lpa: { not: null },
              vpa: { not: null },
            },
          },
          dailyQuotes: {
            some: {},
          },
        },
      }),
    {
      type: "all-companies",
      startYear,
      currentYear,
      assetTypeFilter, // Incluir no cache key para diferenciar
    }
  );

  // Debug: verificar quantas empresas têm dados históricos
  const companiesWithHistoricalData = companies.filter(
    (c) => c.historicalPrices && c.historicalPrices.length >= 20
  );
  console.log(
    `📈 Empresas com dados históricos suficientes: ${companiesWithHistoricalData.length}/${companies.length}`
  );



  // Converter para o formato CompanyData e calcular indicadores técnicos
  return Promise.all(
    companies.map(async (company) => {
      let technicalAnalysis = undefined;

      // Calcular indicadores técnicos se houver dados históricos suficientes
      if (company.historicalPrices && company.historicalPrices.length >= 20) {
        // Filtrar dados válidos (sem valores zero)
        const validHistoricalData = company.historicalPrices.filter(
          (data) =>
            Number(data.high) > 0 &&
            Number(data.low) > 0 &&
            Number(data.close) > 0 &&
            Number(data.open) > 0
        );

        if (validHistoricalData.length >= 20) {
          const priceData: PriceData[] = validHistoricalData.map(
            (data: any) => ({
              date: data.date,
              open: Number(data.open),
              high: Number(data.high),
              low: Number(data.low),
              close: Number(data.close),
              volume: Number(data.volume),
            })
          );

          try {
            const technicalResult =
              TechnicalIndicators.calculateTechnicalAnalysis(priceData);

            // Verificar se os dados técnicos são válidos
            if (
              technicalResult.currentRSI &&
              technicalResult.currentStochastic
            ) {
              technicalAnalysis = {
                rsi: technicalResult.currentRSI.rsi,
                stochasticK: technicalResult.currentStochastic.k,
                stochasticD: technicalResult.currentStochastic.d,
                overallSignal: technicalResult.overallSignal,
              };
            }
          } catch (error) {
            console.warn(
              `Erro ao calcular indicadores técnicos para ${company.ticker}:`,
              error
            );
          }
        }
      }

      // Usar dados de dividendos já disponíveis (enriquecidos pela busca sequencial se necessário)
      let ultimoDividendo: any = company.ultimoDividendo;
      let dataUltimoDividendo: any = company.dataUltimoDividendo;

      // Se não temos ultimoDividendo na company, usar o mais recente do histórico
      if (!ultimoDividendo && company.dividendHistory.length > 0) {
        const latestDividend = company.dividendHistory[0];
        ultimoDividendo = Number(latestDividend.amount);
        dataUltimoDividendo = latestDividend.exDate;
      }

      // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
      const historicalFinancials = company.financialData
        .slice(1)
        .map((data: any) => ({
          year: data.year,
          roe: data.roe,
          roic: data.roic,
          pl: data.pl,
          pvp: data.pvp,
          dy: data.dy,
          margemLiquida: data.margemLiquida,
          margemEbitda: data.margemEbitda,
          margemBruta: data.margemBruta,
          liquidezCorrente: data.liquidezCorrente,
          liquidezRapida: data.liquidezRapida,
          dividaLiquidaPl: data.dividaLiquidaPl,
          dividaLiquidaEbitda: data.dividaLiquidaEbitda,
          lpa: data.lpa,
          vpa: data.vpa,
          marketCap: data.marketCap,
          earningsYield: data.earningsYield,
          evEbitda: data.evEbitda,
          roa: data.roa,
          passivoAtivos: data.passivoAtivos,
        }));

      // Enriquecer dados financeiros com dividendos atualizados
      const enrichedFinancials = {
        ...(company.financialData[0] || {}),
        // Manter os tipos originais dos campos do Prisma
        ...(ultimoDividendo !== undefined && { ultimoDividendo }),
        ...(dataUltimoDividendo !== undefined && { dataUltimoDividendo }),
      };

      return {
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        industry: company.industry,
        assetType: company.assetType,
        currentPrice: toNumber(company.dailyQuotes[0]?.price) || 0,
        logoUrl: company.logoUrl,
        financials: enrichedFinancials,
        historicalFinancials:
          historicalFinancials.length > 0 ? historicalFinancials : undefined,
        technicalAnalysis,
        // Incluir demonstrações financeiras para cálculo do Overall Score
        incomeStatements:
          company.incomeStatements?.length > 0
            ? company.incomeStatements
            : undefined,
        balanceSheets:
          company.balanceSheets?.length > 0 ? company.balanceSheets : undefined,
        cashflowStatements:
          company.cashflowStatements?.length > 0
            ? company.cashflowStatements
            : undefined,
        // Overall Score do snapshot mais recente
        overallScore:
          company.snapshots && company.snapshots.length > 0
            ? toNumber(company.snapshots[0].overallScore)
            : null,
      };
    })
  );
}

// Função para gerar o racional de cada modelo usando StrategyFactory
function generateRational(model: string, params: ModelParams): string {
  switch (model) {
    case "graham":
      return StrategyFactory.generateRational("graham", params as GrahamParams);
    case "dividendYield":
      return StrategyFactory.generateRational(
        "dividendYield",
        params as DividendYieldParams
      );
    case "lowPE":
      return StrategyFactory.generateRational("lowPE", params as LowPEParams);
    case "magicFormula":
      return StrategyFactory.generateRational(
        "magicFormula",
        params as MagicFormulaParams
      );
    case "fcd":
      return StrategyFactory.generateRational("fcd", params as FCDParams);
    case "gordon":
      return StrategyFactory.generateRational("gordon", params as GordonParams);
    case "fundamentalist":
      return StrategyFactory.generateRational(
        "fundamentalist",
        params as FundamentalistParams
      );
    case "ai":
      return StrategyFactory.generateRational("ai", params as AIParams);
    case "screening":
      return StrategyFactory.generateRational(
        "screening",
        params as ScreeningParams
      );
    case "barsi":
      return StrategyFactory.generateRational("barsi", params as BarsiParams);
    case "fiiScreening":
      return StrategyFactory.generateRational(
        "fiiScreening",
        params as FiiScreeningParams
      );
    case "fiiDividendYield":
      return StrategyFactory.generateRational(
        "fiiDividendYield",
        params as FiiDividendYieldParams
      );
    case "fiiRanking":
      return StrategyFactory.generateRational("fiiRanking", params as FiiRankingParams);
    default:
      return "Modelo não encontrado.";
  }
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
    if (
      model === "fcd" ||
      model === "gordon" ||
      model === "fundamentalist" ||
      model === "ai" ||
      model === "barsi" ||
      model === "fiiRanking"
    ) {
      if (!session?.user?.id) {
        const modelName =
          model === "fcd"
            ? "FCD"
            : model === "gordon"
            ? "Fórmula de Gordon"
            : model === "fundamentalist"
            ? "Fundamentalista 3+1"
            : model === "barsi"
            ? "Método Barsi"
            : model === "fiiRanking"
            ? "Ranking PJ-FII"
            : "Análise com IA";
        return NextResponse.json(
          {
            error: `Modelo ${modelName} exclusivo para usuários logados. Faça login para acessar.`,
          },
          { status: 401 }
        );
      }

      // Buscar dados do usuário para verificar se é Premium - ÚNICA FONTE DA VERDADE
      const user = await getCurrentUser();

      if (!user?.isPremium) {
        const modelName =
          model === "fcd"
            ? "FCD"
            : model === "gordon"
            ? "Fórmula de Gordon"
            : model === "fundamentalist"
            ? "Fundamentalista 3+1"
            : model === "barsi"
            ? "Método Barsi"
            : model === "fiiRanking"
            ? "Ranking PJ-FII"
            : "Análise com IA";
        return NextResponse.json(
          {
            error: `Modelo ${modelName} exclusivo para usuários Premium. Faça upgrade para acessar análises avançadas.`,
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
    const finalParams = (body.params || params) as any;
    const assetTypeFilter = finalParams.assetTypeFilter as
      | "b3"
      | "bdr"
      | "both"
      | "fii"
      | undefined;
    const companies =
      assetTypeFilter === "fii"
        ? await getCompaniesDataFii()
        : await getCompaniesData(assetTypeFilter);

    // Debug: verificar quantas empresas têm dados técnicos
    const companiesWithTechnical = companies.filter((c) => c.technicalAnalysis);
    console.log(
      `📊 Empresas carregadas: ${companies.length}, com dados técnicos: ${companiesWithTechnical.length}`
    );

    // OTIMIZAÇÃO BARSI: Buscar dividendos sequencialmente para empresas que precisam
    // if (model === 'barsi') {
    //   // Identificar empresas que precisam de dados de dividendos
    //   const companiesNeedingDividends: string[] = [];
      
    //   for (const company of companies) {
    //     const hasUltimoDividendo = company.financials.ultimoDividendo && Number(company.financials.ultimoDividendo) > 0;
    //     // Para verificar dividendHistory, preciso acessar os dados brutos do Prisma
    //     // Como estou trabalhando com CompanyData já processado, vou usar uma abordagem diferente
        
    //     if (!hasUltimoDividendo) {
    //       companiesNeedingDividends.push(company.ticker);
    //     }
    //   }
      
    //   if (companiesNeedingDividends.length > 0) {
    //     console.log(`📊 [BARSI OPTIMIZATION] ${companiesNeedingDividends.length} empresas precisam de dados de dividendos`);
    //     console.log(`📊 [BARSI OPTIMIZATION] Iniciando busca sequencial: ${companiesNeedingDividends.join(', ')}`);
        
    //     // Buscar dividendos sequencialmente para evitar sobrecarga
    //     // IMPORTANTE: Este método também SALVA os dividendos no banco (Company + FinancialData)
    //     const dividendResults = await DividendService.fetchLatestDividendsSequential(
    //       companiesNeedingDividends,
    //       400 // 400ms entre cada busca
    //     );
        
    //     const successCount = Array.from(dividendResults.values()).filter(r => r.success).length;
    //     console.log(`✅ [BARSI OPTIMIZATION] Busca concluída: ${successCount}/${companiesNeedingDividends.length} sucessos`);
        
    //     // Enriquecer dados das empresas com dividendos encontrados
    //     for (const company of companies) {
    //       if (dividendResults.has(company.ticker)) {
    //         const dividendResult = dividendResults.get(company.ticker);
    //         if (dividendResult?.success && dividendResult.latestDividend) {
    //           // Adicionar o dividendo encontrado aos dados financeiros da empresa
    //           company.financials.ultimoDividendo = dividendResult.latestDividend.amount;
    //           company.financials.dataUltimoDividendo = dividendResult.latestDividend.date;
    //           console.log(`📊 [BARSI] Enriquecido ${company.ticker} com dividendo: R$ ${dividendResult.latestDividend.amount}`);
    //         }
    //       }
    //     }
    //   } else {
    //     console.log(`✅ [BARSI OPTIMIZATION] Todas as empresas já possuem dados de dividendos`);
    //   }
    // }

    let results: RankBuilderResult[] = [];
    
    // Usar body.params se foi modificado (para screening não-Premium), senão usar params original
    const executionParams = body.params || params;

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
      case "magicFormula":
        // Verificar status Premium do usuário (pode ser null se deslogado)
        const magicFormulaUser = session?.user?.id ? await getCurrentUser() : null;
        const magicFormulaIsPremium = magicFormulaUser?.isPremium || false;
        
        // Calcular total ANTES de aplicar limite (para mostrar blur nas rotas de marketing)
        const magicFormulaParamsWithoutLimit: MagicFormulaParams = {
          ...(executionParams as MagicFormulaParams),
          limit: undefined // Sem limite para contar total
        };
        const allMagicFormulaResults = StrategyFactory.runMagicFormulaRanking(
          companies,
          magicFormulaParamsWithoutLimit
        );
        const magicFormulaTotalCount = allMagicFormulaResults.length;
        
        // Backend SEMPRE aplica o limite correto baseado no status Premium
        // Não confiar no limite enviado pelo frontend
        const finalMagicFormulaParams: MagicFormulaParams = {
          ...(executionParams as MagicFormulaParams),
          // Premium: sem limite (undefined). Não-Premium (incluindo deslogados): sempre 3
          limit: magicFormulaIsPremium ? undefined : 3
        };
        
        console.log(`[MAGIC_FORMULA] Premium: ${magicFormulaIsPremium}, Limit aplicado: ${finalMagicFormulaParams.limit}, Total encontrado: ${magicFormulaTotalCount}, User: ${magicFormulaUser?.email || 'deslogado'}`);
        
        results = StrategyFactory.runMagicFormulaRanking(
          companies,
          finalMagicFormulaParams
        );
        
        // Armazenar totalCount em variável separada para retornar na resposta
        (results as any).__magicFormulaTotalCount = magicFormulaTotalCount;
        break;
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
      case "screening":
        const screeningParams = executionParams as ScreeningParams;
        
        // Verificar status Premium do usuário (pode ser null se deslogado)
        const screeningUser = session?.user?.id ? await getCurrentUser() : null;
        const screeningIsPremium = screeningUser?.isPremium || false;
        
        // Calcular total ANTES de aplicar limite (para mostrar blur nas rotas de marketing)
        const paramsWithoutLimit: ScreeningParams = {
          ...screeningParams,
          limit: undefined // Sem limite para contar total
        };
        const allResults = StrategyFactory.runScreeningRanking(
          companies,
          paramsWithoutLimit
        );
        const totalCount = allResults.length;
        
        // Backend SEMPRE aplica o limite correto baseado no status Premium
        // Não confiar no limite enviado pelo frontend
        const finalScreeningParams: ScreeningParams = {
          ...screeningParams,
          // Premium: sem limite (undefined = usa default de 1000). Não-Premium (incluindo deslogados): sempre 3
          limit: screeningIsPremium ? undefined : 3
        };
        
        console.log(`[SCREENING] Premium: ${screeningIsPremium}, Limit aplicado: ${finalScreeningParams.limit}, Total encontrado: ${totalCount}, User: ${screeningUser?.email || 'deslogado'}`);
        console.log(`[SCREENING] Params recebidos:`, JSON.stringify(finalScreeningParams, null, 2));
        
        results = StrategyFactory.runScreeningRanking(
          companies,
          finalScreeningParams
        );
        
        console.log(`[SCREENING] Resultados retornados: ${results.length}`);
        
        // Armazenar totalCount em variável separada para retornar na resposta
        (results as any).__screeningTotalCount = totalCount;
        break;
      case "barsi":
        results = await StrategyFactory.runBarsiRanking(
          companies,
          executionParams as BarsiParams
        );
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

    // Enriquecer resultados com múltiplos upsides (Graham, FCD, Gordon)
    // Isso permite que o usuário veja diferentes perspectivas de valor justo
    // Calcular preço justo para TODOS os usuários (Graham sempre disponível, mesmo deslogados)
    if (results.length > 0 && !FII_RANK_BUILDER_MODELS.has(model)) {
      try {
        // Buscar status Premium do usuário (pode ser null se deslogado)
        const currentUser = session?.user?.id ? await getCurrentUser() : null;
        const userIsPremium = currentUser?.isPremium || false;

        results = results.map((result) => {
          // Encontrar a empresa original
          const company = companies.find((c) => c.ticker === result.ticker);
          if (!company) return result;

          const enrichedKeyMetrics = { ...(result.key_metrics || {}) };
          let mainUpside = result.upside;
          let mainFairValue = result.fairValue;
          let fairValueModel: string | null = null;

          // Para estratégias sem preço justo (como screening), calcular o maior upside entre Graham, FCD e Gordon
          // Para screening, sempre calcular preço justo (Graham para todos, FCD/Gordon para Premium)
          const strategiesWithFairValue = ["graham", "fcd", "gordon"];
          const shouldCalculateFairValue = 
            !strategiesWithFairValue.includes(model) || // Screening não tem preço justo próprio
            (mainUpside === null || mainUpside === undefined || mainFairValue === null || mainFairValue === undefined);
          
          if (shouldCalculateFairValue) {
            const valuations: Array<{ upside: number; fairValue: number; model: string }> = [];

            // Graham (sempre disponível)
            try {
              const grahamAnalysis = StrategyFactory.runGrahamAnalysis(
                company,
                STRATEGY_CONFIG.graham
              );
              if (
                grahamAnalysis.upside !== null &&
                grahamAnalysis.upside !== undefined &&
                grahamAnalysis.fairValue !== null &&
                grahamAnalysis.fairValue !== undefined
              ) {
                valuations.push({
                  upside: grahamAnalysis.upside,
                  fairValue: grahamAnalysis.fairValue,
                  model: "Graham"
                });
                enrichedKeyMetrics.grahamUpside = grahamAnalysis.upside;
              }
            } catch (_) {
              // Ignorar erro
            }

            // FCD (se Premium)
            if (userIsPremium) {
              try {
                const fcdAnalysis = StrategyFactory.runFCDAnalysis(
                  company,
                  STRATEGY_CONFIG.fcd
                );
                if (
                  fcdAnalysis.upside !== null &&
                  fcdAnalysis.upside !== undefined &&
                  fcdAnalysis.fairValue !== null &&
                  fcdAnalysis.fairValue !== undefined
                ) {
                  valuations.push({
                    upside: fcdAnalysis.upside,
                    fairValue: fcdAnalysis.fairValue,
                    model: "FCD"
                  });
                  enrichedKeyMetrics.fcdUpside = fcdAnalysis.upside;
                }
              } catch (_) {
                // Ignorar erro
              }
            }

            // Gordon (se Premium)
            if (userIsPremium) {
              try {
                const gordonAnalysis = StrategyFactory.runGordonAnalysis(
                  company,
                  STRATEGY_CONFIG.gordon
                );
                if (
                  gordonAnalysis.upside !== null &&
                  gordonAnalysis.upside !== undefined &&
                  gordonAnalysis.fairValue !== null &&
                  gordonAnalysis.fairValue !== undefined
                ) {
                  valuations.push({
                    upside: gordonAnalysis.upside,
                    fairValue: gordonAnalysis.fairValue,
                    model: "Gordon"
                  });
                  enrichedKeyMetrics.gordonUpside = gordonAnalysis.upside;
                }
              } catch (_) {
                // Ignorar erro
              }
            }

            // Usar o maior upside encontrado (maior margem de segurança)
            if (valuations.length > 0) {
              const bestValuation = valuations.reduce((best, current) => 
                current.upside > best.upside ? current : best
              );
              mainUpside = bestValuation.upside;
              mainFairValue = bestValuation.fairValue;
              fairValueModel = bestValuation.model;
            }
          } else {
            // Para estratégias com preço justo OU screening que já calculou upside, enriquecer os upsides adicionais
            // Mas para screening, ainda precisamos garantir que fairValue e upside estão atualizados

            // Para screening, sempre calcular fairValue mesmo se já tiver upside
            if (model === "screening" && (mainFairValue === null || mainFairValue === undefined)) {
              const valuations: Array<{ upside: number; fairValue: number; model: string }> = [];

              // Graham (sempre disponível)
              try {
                const grahamAnalysis = StrategyFactory.runGrahamAnalysis(
                  company,
                  STRATEGY_CONFIG.graham
                );
                if (
                  grahamAnalysis.upside !== null &&
                  grahamAnalysis.upside !== undefined &&
                  grahamAnalysis.fairValue !== null &&
                  grahamAnalysis.fairValue !== undefined
                ) {
                  valuations.push({
                    upside: grahamAnalysis.upside,
                    fairValue: grahamAnalysis.fairValue,
                    model: "Graham"
                  });
                  enrichedKeyMetrics.grahamUpside = grahamAnalysis.upside;
                }
              } catch (_) {
                // Ignorar erro
              }

              // FCD (se Premium)
              if (userIsPremium) {
                try {
                  const fcdAnalysis = StrategyFactory.runFCDAnalysis(
                    company,
                    STRATEGY_CONFIG.fcd
                  );
                  if (
                    fcdAnalysis.upside !== null &&
                    fcdAnalysis.upside !== undefined &&
                    fcdAnalysis.fairValue !== null &&
                    fcdAnalysis.fairValue !== undefined
                  ) {
                    valuations.push({
                      upside: fcdAnalysis.upside,
                      fairValue: fcdAnalysis.fairValue,
                      model: "FCD"
                    });
                    enrichedKeyMetrics.fcdUpside = fcdAnalysis.upside;
                  }
                } catch (_) {
                  // Ignorar erro
                }
              }

              // Gordon (se Premium)
              if (userIsPremium) {
                try {
                  const gordonAnalysis = StrategyFactory.runGordonAnalysis(
                    company,
                    STRATEGY_CONFIG.gordon
                  );
                  if (
                    gordonAnalysis.upside !== null &&
                    gordonAnalysis.upside !== undefined &&
                    gordonAnalysis.fairValue !== null &&
                    gordonAnalysis.fairValue !== undefined
                  ) {
                    valuations.push({
                      upside: gordonAnalysis.upside,
                      fairValue: gordonAnalysis.fairValue,
                      model: "Gordon"
                    });
                    enrichedKeyMetrics.gordonUpside = gordonAnalysis.upside;
                  }
                } catch (_) {
                  // Ignorar erro
                }
              }

              // Usar o maior upside encontrado (maior margem de segurança)
              if (valuations.length > 0) {
                const bestValuation = valuations.reduce((best, current) => 
                  current.upside > best.upside ? current : best
                );
                mainUpside = bestValuation.upside;
                mainFairValue = bestValuation.fairValue;
                fairValueModel = bestValuation.model;
              }
            }

            // Calcular upside de Graham se ainda não tiver (disponível para todos)
            if (
              model !== "graham" &&
              (!enrichedKeyMetrics.grahamUpside ||
                enrichedKeyMetrics.grahamUpside === null)
            ) {
              try {
                const grahamAnalysis = StrategyFactory.runGrahamAnalysis(
                  company,
                  STRATEGY_CONFIG.graham
                );
                if (
                  grahamAnalysis.upside !== null &&
                  grahamAnalysis.upside !== undefined
                ) {
                  enrichedKeyMetrics.grahamUpside = grahamAnalysis.upside;
                }
              } catch (_) {
                // Silenciosamente ignorar erros
              }
            }

            // Calcular upside de FCD se Premium e ainda não tiver
            if (
              model !== "fcd" &&
              userIsPremium &&
              (!enrichedKeyMetrics.fcdUpside ||
                enrichedKeyMetrics.fcdUpside === null)
            ) {
              try {
                const fcdAnalysis = StrategyFactory.runFCDAnalysis(
                  company,
                  STRATEGY_CONFIG.fcd
                );
                if (
                  fcdAnalysis.upside !== null &&
                  fcdAnalysis.upside !== undefined
                ) {
                  enrichedKeyMetrics.fcdUpside = fcdAnalysis.upside;
                }
              } catch (_) {
                // Silenciosamente ignorar erros
              }
            }

            // Calcular upside de Gordon se Premium e ainda não tiver
            if (
              model !== "gordon" &&
              userIsPremium &&
              (!enrichedKeyMetrics.gordonUpside ||
                enrichedKeyMetrics.gordonUpside === null)
            ) {
              try {
                const gordonAnalysis = StrategyFactory.runGordonAnalysis(
                  company,
                  STRATEGY_CONFIG.gordon
                );
                if (
                  gordonAnalysis.upside !== null &&
                  gordonAnalysis.upside !== undefined
                ) {
                  enrichedKeyMetrics.gordonUpside = gordonAnalysis.upside;
                }
              } catch (_) {
                // Silenciosamente ignorar erros
              }
            }
          }

          return {
            ...result,
            upside: mainUpside, // Atualizar upside principal se necessário
            fairValue: mainFairValue, // Atualizar preço justo principal se necessário
            fairValueModel: fairValueModel || result.fairValueModel || null, // Indicar qual modelo foi usado
            key_metrics: enrichedKeyMetrics,
          };
        });
      } catch (error) {
        console.warn(
          "Erro ao enriquecer resultados com múltiplos upsides:",
          error
        );
        // Continuar com resultados originais se houver erro
      }
    }

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

    // Extrair totalCount se foi armazenado (para screening ou magicFormula)
    let totalCount = results.length;
    if ((results as any).__screeningTotalCount !== undefined) {
      totalCount = (results as any).__screeningTotalCount;
      // Remover propriedade temporária
      delete (results as any).__screeningTotalCount;
    } else if ((results as any).__magicFormulaTotalCount !== undefined) {
      totalCount = (results as any).__magicFormulaTotalCount;
      // Remover propriedade temporária
      delete (results as any).__magicFormulaTotalCount;
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
