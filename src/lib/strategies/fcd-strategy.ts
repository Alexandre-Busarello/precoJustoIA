import {
  AbstractStrategy,
  CREDIT_SPREAD,
  CORPORATE_TAX_RATE,
  companySectorClass,
  costOfEquityBRL,
  costOfEquityUSD,
  bdrConversion,
  discountFraction,
  fcffFromComponents,
  formatCurrency,
  formatPercent,
  isImplausibleUpside,
  macroAssumptions,
  notApplicableAnalysis,
  projectDiscountedCashflows,
  toNumber,
  upsidePercent,
} from './base-strategy';
import { equityBridge } from '../finance/valuation';
import { formatBRLCompact, formatNumber, formatPct } from '../format';
import { FCDParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';

/**
 * g terminal nominal em BRL: entre 4% e 5% ao ano (IPCA de longo prazo ~3,5–4% + crescimento real de 0,5–1%), coerente
 * com a taxa de desconto nominal (Ke/WACC em BRL). Parâmetros fora da faixa são trazidos para dentro dela.
 */
export const FCD_TERMINAL_GROWTH_BRL = { min: 0.04, max: 0.05, default: 0.045 } as const;
/** g terminal nominal em USD (fluxos de BDRs em dólar). */
export const FCD_TERMINAL_GROWTH_USD = 0.025;
/** Teto do crescimento inicial (CAGR de 5 anos). */
export const FCD_MAX_INITIAL_GROWTH = 0.1;
/** Piso do crescimento inicial (receitas/lucros em queda). */
export const FCD_MIN_INITIAL_GROWTH = -0.05;
/** Dívida líquida/EBITDA acima disso reprova o critério de alavancagem. */
const MAX_NET_DEBT_EBITDA = 3;

const FINANCIAL_NOT_APPLICABLE = 'Modelo não se aplica a bancos e seguradoras; veja P/VP justo.';

type Row = Record<string, unknown>;

function rowTime(row: Row): number {
  const raw = row.endDate;
  const date = raw instanceof Date ? raw : typeof raw === 'string' ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

/** Demonstração anual mais recente (as listas já vêm em ordem decrescente, mas não dependemos disso). */
function latestRow(rows: Row[] | undefined): Row | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => rowTime(b) - rowTime(a))[0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface FcdCashflowBase {
  /** FCFF (descontado pelo WACC, gera EV) ou FCFE/fluxo alavancado (descontado pelo Ke, gera valor do acionista). */
  kind: 'fcff' | 'fcfe';
  value: number;
  /** Componentes do FCFF, quando calculado. */
  components?: { ebit: number; depreciation: number; capex: number; workingCapitalIncrease: number };
}

/**
 * Fluxo-base do FCD. Preferência: FCFF = EBIT × (1 − 34%) + D&A − Capex − ΔNCG, com EBIT da DRE (ou EV ÷ EV/EBIT),
 * D&A = EBITDA − EBIT, Capex aproximado pelo fluxo de investimento e ΔNCG pela variação de ativos e passivos da DFC.
 * Sem esses dados, usa o fluxo de caixa livre alavancado (pós-juros, próximo do FCFE). Nunca estima por fração do EBITDA.
 */
export function estimateCashflowBase(companyData: CompanyData): FcdCashflowBase | null {
  const { financials } = companyData;
  const income = latestRow(companyData.incomeStatements);
  const cashflow = latestRow(companyData.cashflowStatements);

  const enterpriseValue = toNumber(financials.enterpriseValue);
  const evEbit = toNumber(financials.evEbit);
  const ebitFromStatement = toNumber(income?.ebit) ?? toNumber(income?.operatingIncome);
  const ebitFromMultiple = enterpriseValue && evEbit && enterpriseValue > 0 && evEbit > 0 ? enterpriseValue / evEbit : null;
  const ebit = ebitFromStatement ?? ebitFromMultiple;

  const investment = toNumber(cashflow?.investmentCashFlow) ?? toNumber(financials.fluxoCaixaInvestimento);

  if (ebit !== null && Number.isFinite(ebit) && investment !== null && Number.isFinite(investment)) {
    const ebitda = toNumber(financials.ebitda);
    const depreciation = ebitda !== null && Number.isFinite(ebitda) && ebitda > ebit ? ebitda - ebit : 0;
    const capex = Math.max(0, -investment);
    const workingCapitalChange = toNumber(cashflow?.changesInAssetsAndLiabilities);
    // Na DFC, variação negativa de ativos e passivos = capital de giro consumiu caixa (ΔNCG positivo).
    const workingCapitalIncrease = workingCapitalChange !== null && Number.isFinite(workingCapitalChange) ? -workingCapitalChange : 0;
    const components = { ebit, depreciation, capex, workingCapitalIncrease };
    return { kind: 'fcff', value: fcffFromComponents(components), components };
  }

  const leveredFcf = toNumber(financials.fluxoCaixaLivre);
  if (leveredFcf !== null && Number.isFinite(leveredFcf)) return { kind: 'fcfe', value: leveredFcf };
  return null;
}

/** Crescimento inicial: menor CAGR de 5 anos disponível (receitas, lucros), entre −5% e 10%; sem CAGR, o g terminal. */
function initialGrowthRate(companyData: CompanyData, terminalGrowth: number): number {
  const cagrs = [toNumber(companyData.financials.cagrReceitas5a), toNumber(companyData.financials.cagrLucros5a)].filter(
    (v): v is number => v !== null && Number.isFinite(v)
  );
  if (cagrs.length === 0) return terminalGrowth;
  return clamp(Math.min(...cagrs), FCD_MIN_INITIAL_GROWTH, FCD_MAX_INITIAL_GROWTH);
}

export interface FcdDiscountRates {
  costOfEquity: number;
  /** WACC = E/(D+E) × Ke + D/(D+E) × Kd × (1 − 34%); igual ao Ke sem dívida informada. */
  wacc: number;
  costOfDebt: number | null;
  currency: 'BRL' | 'USD';
}

/** Ke pelas premissas macro (nunca abaixo da Selic em BRL) e WACC com Kd = Selic (ou UST 10y) + 2 p.p. */
export function fcdDiscountRates(companyData: CompanyData, currency: 'BRL' | 'USD'): FcdDiscountRates {
  const macro = macroAssumptions();
  const costOfEquity = currency === 'USD' ? costOfEquityUSD(1, macro) : costOfEquityBRL(1, macro);
  const debt = toNumber(companyData.financials.totalDivida);
  const equity = toNumber(companyData.financials.marketCap);
  if (!debt || debt <= 0 || !equity || equity <= 0) {
    return { costOfEquity, wacc: costOfEquity, costOfDebt: null, currency };
  }
  const costOfDebt = (currency === 'USD' ? macro.ust10y : macro.selic) + CREDIT_SPREAD;
  const weightEquity = equity / (equity + debt);
  const wacc = weightEquity * costOfEquity + (1 - weightEquity) * costOfDebt * (1 - CORPORATE_TAX_RATE);
  return { costOfEquity, wacc, costOfDebt, currency };
}

export class FCDStrategy extends AbstractStrategy<FCDParams> {
  readonly name = 'fcd';

  validateCompanyData(companyData: CompanyData): boolean {
    const shares = toNumber(companyData.financials.sharesOutstanding);
    return !!shares && shares > 0 && estimateCashflowBase(companyData) !== null;
  }

  runAnalysis(companyData: CompanyData, params: FCDParams = {}): StrategyAnalysis {
    const { financials, currentPrice, historicalFinancials, ticker } = companyData;

    if (companySectorClass(companyData) === 'financial') return notApplicableAnalysis(FINANCIAL_NOT_APPLICABLE);
    const bdrReason = this.bdrNotApplicableReason(companyData);
    if (bdrReason) return notApplicableAnalysis(bdrReason);

    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const isBDR = this.isBDRTicker(ticker);
    const currency = isBDR && bdrConversion(financials)?.currency === 'USD' ? 'USD' : 'BRL';
    const yearsProjection = params.yearsProjection || 5;
    const minMarginOfSafety = params.minMarginOfSafety ?? 0.13;

    const sharesOutstanding = toNumber(financials.sharesOutstanding);
    const ebitda = toNumber(financials.ebitda);
    const fluxoCaixaOperacional = toNumber(financials.fluxoCaixaOperacional);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const margemEbitda = this.getMargemEbitda(financials, use7YearAverages, historicalFinancials);
    const crescimentoReceitas = toNumber(financials.crescimentoReceitas);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
    const marketCap = toNumber(financials.marketCap);

    const terminalGrowth =
      currency === 'USD'
        ? FCD_TERMINAL_GROWTH_USD
        : clamp(params.growthRate ?? FCD_TERMINAL_GROWTH_BRL.default, FCD_TERMINAL_GROWTH_BRL.min, FCD_TERMINAL_GROWTH_BRL.max);
    const initialGrowth = initialGrowthRate(companyData, terminalGrowth);
    const rates = fcdDiscountRates(companyData, currency);
    const base = estimateCashflowBase(companyData);
    // A taxa informada pelo usuário só vale quando é mais conservadora (maior) que a calculada pelas premissas macro.
    const modelRate = base?.kind === 'fcfe' ? rates.costOfEquity : rates.wacc;
    const discountRate = Math.max(params.discountRate ?? 0, modelRate);

    let fairValue: number | null = null;
    let failure: string | null = null;
    let bridge: StrategyAnalysis['equityBridge'] = null;
    let terminalValueShare: number | null = null;
    let projection: ReturnType<typeof projectDiscountedCashflows> = null;

    if (!sharesOutstanding || sharesOutstanding <= 0) {
      failure = 'número de ações indisponível';
    } else if (!base) {
      failure = 'dados de fluxo de caixa insuficientes (EBIT, investimentos ou fluxo de caixa livre)';
    } else if (base.value <= 0) {
      failure = base.kind === 'fcff' ? 'fluxo de caixa livre da firma não positivo no último ano' : 'fluxo de caixa livre não positivo no último ano';
    } else {
      projection = projectDiscountedCashflows({ baseCashflow: base.value, initialGrowth, terminalGrowth, discountRate, years: yearsProjection });
      if (!projection) {
        failure = 'spread entre a taxa de desconto e o crescimento perpétuo abaixo de 4 p.p.';
      } else if (base.kind === 'fcff') {
        bridge = equityBridge({
          ev: projection.total,
          totalDebt: toNumber(financials.totalDivida),
          cash: toNumber(financials.totalCaixa),
          enterpriseValue: toNumber(financials.enterpriseValue),
          marketCap,
        });
        if (!bridge) failure = 'sem dados de dívida e caixa para passar do valor da firma ao valor do acionista';
        else if (bridge.equity <= 0) failure = 'a dívida líquida supera o valor estimado da firma';
        else fairValue = (bridge.equity / sharesOutstanding) * this.perReceiptFactor(companyData);
      } else {
        // Fluxo alavancado (pós-juros) descontado pelo Ke já é valor do acionista: não se subtrai a dívida.
        fairValue = (projection.total / sharesOutstanding) * this.perReceiptFactor(companyData);
      }
      if (projection) terminalValueShare = projection.terminalValueShare;
    }

    if (fairValue !== null && isImplausibleUpside(currentPrice, fairValue)) {
      fairValue = null;
      failure = 'estimativa fora da faixa plausível (potencial acima de 500%), provável inconsistência nos dados';
    }

    const upside = upsidePercent(currentPrice, fairValue);
    const discount = discountFraction(currentPrice, fairValue);
    const minROE = isBDR ? 0.15 : 0.12;
    const minMargemEbitda = isBDR ? 0.12 : 0.15;
    const minLiquidez = isBDR ? 1.0 : 1.2;
    const minMarketCap = isBDR ? 5_000_000_000 : 2_000_000_000;

    const criteria = [
      {
        label: `Margem de segurança ≥ ${formatPct(minMarginOfSafety, { digits: 0 })}`,
        value: discount !== null && discount >= minMarginOfSafety,
        description: `Margem: ${discount === null ? 'N/A' : formatPercent(discount)}`,
      },
      { label: 'EBITDA > 0', value: !!(ebitda && ebitda > 0), description: `EBITDA: ${formatBRLCompact(ebitda)}` },
      { label: 'FCO > 0', value: !fluxoCaixaOperacional || fluxoCaixaOperacional > 0, description: `FCO: ${formatBRLCompact(fluxoCaixaOperacional)}` },
      { label: `ROE ≥ ${formatPct(minROE, { digits: 0 })}${isBDR ? ' (BDR)' : ''}`, value: !roe || roe >= minROE, description: `ROE: ${formatPercent(roe)}` },
      {
        label: `Margem EBITDA ≥ ${formatPct(minMargemEbitda, { digits: 0 })}${isBDR ? ' (BDR)' : ''}`,
        value: !margemEbitda || margemEbitda >= minMargemEbitda,
        description: `Margem EBITDA: ${formatPercent(margemEbitda)}`,
      },
      { label: 'Crescimento das receitas ≥ −10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.1, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
      {
        label: `Liquidez corrente ≥ ${formatNumber(minLiquidez, { digits: 1 })}${isBDR ? ' (BDR)' : ''}`,
        value: !liquidezCorrente || liquidezCorrente >= minLiquidez,
        description: `LC: ${formatNumber(liquidezCorrente, { digits: 2 })}`,
      },
      {
        label: `Dív. líq./EBITDA ≤ ${formatNumber(MAX_NET_DEBT_EBITDA, { digits: 1 })}`,
        value: dividaLiquidaEbitda === null || dividaLiquidaEbitda <= MAX_NET_DEBT_EBITDA,
        description: `Dív. líq./EBITDA: ${formatNumber(dividaLiquidaEbitda, { digits: 2 })}`,
      },
      {
        label: `Market cap ≥ ${isBDR ? 'R$ 5 bi' : 'R$ 2 bi'}`,
        value: !marketCap || marketCap >= minMarketCap,
        description: `Market cap: ${formatBRLCompact(marketCap)}`,
      },
    ];

    const passedCriteria = criteria.filter((c) => c.value).length;
    const isEligible = passedCriteria >= criteria.length - 2 && fairValue !== null && discount !== null && discount >= minMarginOfSafety;
    const score = (passedCriteria / criteria.length) * 100;

    // Score de qualidade (0–100): rentabilidade, margem, crescimento, liquidez e até 5 pontos pela margem de segurança.
    const qualityWithoutMargin =
      Math.min(roe || 0, 0.4) * 100 +
      Math.min(margemEbitda || 0, 0.5) * 80 +
      Math.max(0, (crescimentoReceitas || 0) + 0.2) * 50 +
      Math.min(liquidezCorrente || 0, 3) * 5;
    const fcdQualityScore = Math.min(
      100,
      discount !== null && discount > 0 ? qualityWithoutMargin + Math.min(discount / 0.5, 1) * 5 : qualityWithoutMargin * (100 / 95)
    );

    const rateLabel = base?.kind === 'fcfe' ? 'Ke' : rates.wacc === rates.costOfEquity ? 'Ke (sem dívida informada)' : 'WACC';
    const baseLabel = base?.kind === 'fcfe' ? 'fluxo de caixa livre alavancado (FCFE)' : 'fluxo de caixa livre da firma (FCFF)';
    const assumptions = base
      ? `Base: ${baseLabel} de ${formatBRLCompact(base.value)}; crescimento de ${formatPercent(initialGrowth)} no ano 1 convergindo para ${formatPercent(terminalGrowth)} (perpétuo) em ${yearsProjection} anos; desconto a ${formatPercent(discountRate)} (${rateLabel}; Ke ${formatPercent(rates.costOfEquity)}).`
      : '';
    const currencyNote = currency === 'USD' ? ' Estimativa em USD convertida para reais por recibo.' : '';
    const bridgeNote = bridge
      ? ` Valor da firma ${formatBRLCompact(bridge.ev)} − dívida líquida ${formatBRLCompact(bridge.netDebt)} = valor para o acionista ${formatBRLCompact(bridge.equity)}.`
      : '';
    const terminalNote = terminalValueShare !== null ? ` O valor terminal responde por ${formatPercent(terminalValueShare)} do total.` : '';

    let verdict: string;
    if (fairValue === null) verdict = `Não foi possível estimar o preço justo: ${failure ?? 'dados insuficientes'}.`;
    else if (isEligible) verdict = `Preço justo estimado em ${formatCurrency(fairValue)} vs ${formatCurrency(currentPrice)}, margem de segurança de ${formatPercent(discount)} (potencial de ${formatPercent((upside ?? 0) / 100)}).`;
    else if (discount === null || discount < minMarginOfSafety) verdict = `Preço justo estimado em ${formatCurrency(fairValue)}; margem de segurança de ${formatPercent(discount)}, abaixo do mínimo de ${formatPercent(minMarginOfSafety)}.`;
    else verdict = `Preço justo estimado em ${formatCurrency(fairValue)}, mas apenas ${passedCriteria} de ${criteria.length} critérios de qualidade atendidos.`;

    const bdrNote = this.bdrConversionNote(companyData);
    const reasoning = `${verdict} ${assumptions}${bridgeNote}${terminalNote}${currencyNote}${bdrNote ? ` ${bdrNote}` : ''}`.replace(/\s+/g, ' ').trim();

    return {
      isEligible,
      score,
      fairValue,
      upside,
      discount,
      terminalValueShare,
      equityBridge: bridge,
      reasoning,
      criteria,
      key_metrics: {
        fairValue,
        fcdQualityScore: Number(fcdQualityScore.toFixed(1)),
        cashflowBase: base?.value ?? null,
        cashflowIsFcff: base ? (base.kind === 'fcff' ? 1 : 0) : null,
        ebit: base?.components?.ebit ?? null,
        depreciation: base?.components?.depreciation ?? null,
        capex: base?.components?.capex ?? null,
        workingCapitalIncrease: base?.components?.workingCapitalIncrease ?? null,
        enterpriseValue: bridge?.ev ?? null,
        netDebt: bridge?.netDebt ?? null,
        equityValue: bridge?.equity ?? (base?.kind === 'fcfe' ? projection?.total ?? null : null),
        presentValueCashflows: projection?.presentValueCashflows ?? null,
        presentValueTerminal: projection?.presentValueTerminal ?? null,
        terminalValueContribution: terminalValueShare !== null ? Number((terminalValueShare * 100).toFixed(1)) : null,
        impliedWACC: discountRate,
        costOfEquity: rates.costOfEquity,
        costOfDebt: rates.costOfDebt,
        impliedGrowth: terminalGrowth,
        initialGrowth,
        projectionYears: yearsProjection,
        ebitda,
        roe,
        margemEbitda,
        crescimentoReceitas,
        liquidezCorrente,
        dividaLiquidaEbitda,
        marketCapBi: marketCap ? Number((marketCap / 1_000_000_000).toFixed(1)) : null,
      },
    };
  }

  runRanking(companies: CompanyData[], params: FCDParams): RankBuilderResult[] {
    const { minMarginOfSafety = 0.13, limit = 10 } = params;
    const results: RankBuilderResult[] = [];

    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company)) continue;

      // Mesmo cálculo da página do ativo: o ranking só filtra e ordena.
      const analysis = this.runAnalysis(company, params);
      const marketCap = toNumber(company.financials.marketCap);
      const minMarketCap = this.isBDRTicker(company.ticker) ? 5_000_000_000 : 2_000_000_000;
      const leverage = toNumber(company.financials.dividaLiquidaEbitda);
      if (analysis.fairValue === null || analysis.discount === null || analysis.discount === undefined) continue;
      if (analysis.discount < minMarginOfSafety) continue;
      if (!marketCap || marketCap < minMarketCap) continue;
      // Empresas muito alavancadas não entram: o FCD as favorece só pelo efeito da dívida na ponte EV → patrimônio.
      if (leverage !== null && leverage > MAX_NET_DEBT_EBITDA) continue;
      // Exclusão por qualidade (lucros consistentes e overall score) por último, por ser a verificação mais cara.
      if (this.shouldExcludeCompany(company)) continue;

      results.push(this.convertToRankingResult(company, analysis));
    }

    const sortedResults = results.sort((a, b) => (b.marginOfSafety ?? 0) - (a.marginOfSafety ?? 0));
    const uniqueResults = this.removeDuplicateCompanies(sortedResults);
    return this.applyTechnicalPrioritization(uniqueResults.slice(0, limit), companies, params.useTechnicalAnalysis);
  }

  generateRational(params: FCDParams): string {
    const terminal = clamp(params.growthRate ?? FCD_TERMINAL_GROWTH_BRL.default, FCD_TERMINAL_GROWTH_BRL.min, FCD_TERMINAL_GROWTH_BRL.max);
    const years = params.yearsProjection || 5;
    const minMargin = params.minMarginOfSafety ?? 0.13;
    const macro = macroAssumptions();
    const ke = costOfEquityBRL(1, macro);

    return `# Modelo de fluxo de caixa descontado (FCD)

**Ideia**: o valor intrínseco é o valor presente do caixa que a empresa deve gerar. É uma estimativa sensível às premissas, não uma previsão.

## Metodologia

- **Fluxo-base (FCFF)**: EBIT × (1 − 34%) + depreciação e amortização − capex − variação do capital de giro, com dados da DRE e da DFC. Sem esses dados, usa o fluxo de caixa livre alavancado descontado pelo Ke (sem subtrair a dívida).
- **Crescimento**: menor CAGR de 5 anos entre receitas e lucros (limitado a 10% ao ano), convergindo linearmente para o crescimento perpétuo em ${years} anos.
- **Crescimento perpétuo**: ${formatPercent(terminal)} nominal em reais (faixa de 4% a 5%: inflação de longo prazo mais crescimento real modesto).
- **Taxa de desconto**: Ke = NTN-B longa + IPCA 12 meses + prêmio de risco (hoje ${formatPercent(ke)}, nunca abaixo da Selic). O FCFF usa o WACC, com custo da dívida igual à Selic + 2 p.p. após IR de 34%. Uma taxa informada só vale quando é maior que a calculada.
- **Do valor da firma ao acionista**: valor da firma − (dívida total − caixa), dividido pelo número de ações.
- **Margem de segurança mínima**: ${formatPercent(minMargin)} (1 − preço ÷ preço justo).

## Fora do modelo

- Bancos e seguradoras (o fluxo de caixa não separa operação e financiamento; use o P/VP justo).
- BDRs sem paridade e câmbio na base de dados.
- No ranking, empresas com dívida líquida/EBITDA acima de ${MAX_NET_DEBT_EBITDA}x.

## Filtros de qualidade

- EBITDA e fluxo de caixa operacional positivos
- ROE ≥ 12% e margem EBITDA ≥ 15%
- Crescimento das receitas ≥ −10%
- Liquidez corrente ≥ 1,2
- Market cap ≥ R$ 2 bilhões${params.useTechnicalAnalysis ? '\n\n**Ordenação**: por margem de segurança, com priorização técnica (sobrevenda) dentro de faixas de resultados semelhantes.' : '\n\n**Ordenação**: por margem de segurança.'}`;
  }
}
