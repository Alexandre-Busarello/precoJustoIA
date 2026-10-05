import { AbstractStrategy, notApplicableAnalysis, toNumber } from './base-strategy';
import { dividendEventsOf, resolveTargetYield, upsidePoints } from './bazin-strategy';
import { BarsiParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';
import { prisma } from '@/lib/prisma';
import { fullYearTotals, removeExtraordinary, toDividendEvents } from '@/lib/finance/dividends';
import { formatBRL, formatMultiple, formatPct } from '@/lib/format';
import { marginOfSafety } from '@/lib/valuation-metrics';

/** Anos-calendário completos na média de proventos (N−1 … N−5). */
const BARSI_FULL_YEARS = 5;
/** Janela buscada no banco quando o histórico não vem no `CompanyData` (folga para detectar o primeiro ano parcial). */
const BARSI_HISTORY_YEARS = 7;

export class BarsiStrategy extends AbstractStrategy<BarsiParams> {
  readonly name = 'barsi';

  // Setores "perenes" do método B.E.S.T. + Gás
  private readonly PERENNIAL_SECTORS = [
    'Bancos',
    'Energia Elétrica', 
    'Saneamento',
    'Seguros',
    'Telecomunicações',
    'Gás',
    'Água e Saneamento',
    'Energia',
    'Serviços Financeiros',
    'Utilities',
    'Utilidade Pública'
  ];

  /**
   * Média anual dos proventos brutos (dividendos + JCP) nos últimos 5 anos-calendário completos (N−1 … N−5).
   * O ano corrente e o primeiro ano parcial de cobertura não entram. Usa o histórico já carregado no `CompanyData`
   * e, sem ele, busca os últimos 7 anos no banco. `null` sem nenhum ano completo.
   */
  private async calculateAverageDividend(companyData: CompanyData): Promise<{ average: number | null; years: number }> {
    try {
      let events = dividendEventsOf(companyData);
      if (!companyData.dividendHistory) {
        const since = new Date(Date.UTC(new Date().getUTCFullYear() - BARSI_HISTORY_YEARS, 0, 1));
        const rows = await prisma.dividendHistory.findMany({
          where: { company: { ticker: companyData.ticker }, exDate: { gte: since } },
          select: { exDate: true, paymentDate: true, amount: true, type: true },
          orderBy: { exDate: 'desc' },
        });
        events = toDividendEvents(rows);
      }
      // Mesma base do preço-teto Bazin: proventos extraordinários não entram na média.
      const totals = fullYearTotals(removeExtraordinary(events), { years: BARSI_FULL_YEARS });
      if (totals.length === 0) return { average: null, years: 0 };
      return { average: totals.reduce((acc, t) => acc + t.total, 0) / totals.length, years: totals.length };
    } catch (error) {
      console.error(`Erro ao calcular média de dividendos para ${companyData.ticker}:`, error);
      return { average: null, years: 0 };
    }
  }

  validateCompanyData(companyData: CompanyData): boolean {
    const { ultimoDividendo, financials } = companyData;
    // Dados essenciais para o método Barsi
    return !!(
      financials.dy && toNumber(financials.dy)! > 0 &&
      financials.ultimoDividendo && toNumber(ultimoDividendo || financials.ultimoDividendo)! > 0 &&
      companyData.currentPrice > 0
    );
  }

  /**
   * Verifica se a empresa está em setor "perene" (B.E.S.T.)
   */
  private isPerennialSector(sector: string | null): boolean {
    if (!sector) return false;
    
    return this.PERENNIAL_SECTORS.some(perennialSector => 
      sector.toLowerCase().includes(perennialSector.toLowerCase()) ||
      perennialSector.toLowerCase().includes(sector.toLowerCase())
    );
  }

  /**
   * Calcula o "preço teto" baseado na meta de DY do Barsi
   * Preço Teto = Dividendo por Ação / DY Desejado
   */
  private calculateCeilingPrice(
    dividendPerShare: number, 
    targetDY: number, 
    multiplier: number = 1.0
  ): number {
    return (dividendPerShare / targetDY) * multiplier;
  }

  /**
   * Verifica histórico de dividendos consistentes
   * Analisa se a empresa pagou dividendos nos últimos anos
   */
  private hasConsistentDividendHistory(
    companyData: CompanyData, 
    minYears: number = 5
  ): boolean {
    const { historicalFinancials } = companyData;
    
    if (!historicalFinancials || historicalFinancials.length < minYears) {
      // Se não temos dados históricos suficientes, dar benefício da dúvida
      // se o DY atual for > 3% (indica empresa pagadora)
      const currentDY = toNumber(companyData.financials.dy);
      return !!(currentDY && currentDY > 0.03);
    }

    // Contar quantos anos dos últimos N anos pagaram dividendos
    const recentYears = historicalFinancials
      .slice(0, minYears)
      .filter(year => {
        const dy = toNumber(year.dy);
        return dy && dy > 0.01; // Pelo menos 1% de DY
      });

    return recentYears.length >= Math.floor(minYears * 0.8); // 80% dos anos
  }

  /** Barsi Score (0–100): 40% desconto até o preço-teto, 35% qualidade dos dividendos, 25% saúde financeira. */
  private barsiScore(
    discountFromCeiling: number | null,
    dy: number | null,
    hasConsistentDividends: boolean,
    roe: number | null,
    liquidezCorrente: number | null,
    margemLiquida: number | null
  ): number {
    let score = 0;
    if (discountFromCeiling !== null && discountFromCeiling > 0) {
      score += Math.min((discountFromCeiling / 30) * 40, 40); // até 30% de desconto = 40 pontos
    }
    score += Math.min((dy || 0) * 200 + (hasConsistentDividends ? 15 : 0), 35);
    score += Math.min(
      Math.min(roe || 0, 0.25) * 40 + Math.min(liquidezCorrente || 0, 2.5) * 4 + Math.min(margemLiquida || 0, 0.15) * 33,
      25
    );
    return Math.min(score, 100);
  }

  async runAnalysis(companyData: CompanyData, params: BarsiParams): Promise<StrategyAnalysis> {
    const bdrReason = this.bdrNotApplicableReason(companyData);
    if (bdrReason) return notApplicableAnalysis(bdrReason);
    const { financials, currentPrice, sector, historicalFinancials, ticker } = companyData;
    const isBDR = this.isBDRTicker(ticker);
    const {
      targetDividendYield: rawTargetDividendYield,
      maxPriceToPayMultiplier = 1.0,
      minConsecutiveDividends = 5,
      maxDebtToEquity = 2.0,
      minROE = 0.10,
      focusOnBEST = false
    } = params;
    const targetDividendYield = resolveTargetYield(rawTargetDividendYield);

    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;

    const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials);
    const { average: averageDividend, years: fullYears } = await this.calculateAverageDividend(companyData);
    const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
    const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
    const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
    const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
    const payout = toNumber(financials.payout);
    const marketCap = toNumber(financials.marketCap);

    const ceilingPrice = averageDividend
      ? this.calculateCeilingPrice(averageDividend, targetDividendYield, maxPriceToPayMultiplier)
      : null;
    const discount = marginOfSafety(currentPrice, ceilingPrice);
    const discountFromCeiling = discount === null ? null : discount * 100;
    const isUnderCeiling = discount !== null && discount >= 0;

    const isPerennialSector = this.isPerennialSector(sector);
    const hasConsistentDividends = this.hasConsistentDividendHistory(companyData, minConsecutiveDividends);
    const hasGoodProfitability = !!(roe && roe >= minROE);
    const hasLowDebt = !dividaLiquidaPl || dividaLiquidaPl <= maxDebtToEquity;
    const hasPositiveMargin = !margemLiquida || margemLiquida > 0;
    const hasReasonablePayout = !payout || (payout > 0.20 && payout < 0.95);
    const minMarketCap = isBDR ? 2_000_000_000 : 1_000_000_000;
    const hasMinimumSize = !marketCap || marketCap >= minMarketCap;

    const criteria = [
      {
        label: focusOnBEST ? 'Setor perene (B.E.S.T.)' : 'Setor perene (opcional)',
        value: !focusOnBEST || isPerennialSector,
        description: `Setor: ${sector || '—'}${isPerennialSector ? ' (perene)' : ' (não perene)'}`
      },
      {
        label: `Preço ≤ preço-teto (DY alvo ${formatPct(targetDividendYield)})`,
        value: isUnderCeiling,
        description: `Preço: ${formatBRL(currentPrice)} · Preço-teto: ${formatBRL(ceilingPrice)}${discount !== null && discount > 0 ? ` (${formatPct(discount)} abaixo)` : ''} · Média de proventos brutos (${fullYears} anos completos): ${formatBRL(averageDividend)}`
      },
      {
        label: `Dividendos consistentes (${minConsecutiveDividends} anos)`,
        value: hasConsistentDividends,
        description: `Histórico: ${hasConsistentDividends ? 'consistente' : 'inconsistente'} · DY atual: ${formatPct(dy)}`
      },
      {
        label: `ROE ≥ ${formatPct(minROE, { digits: 0 })}`,
        value: hasGoodProfitability,
        description: `ROE: ${formatPct(roe)}`
      },
      {
        label: `Dív. líq./PL ≤ ${formatMultiple(maxDebtToEquity)}`,
        value: hasLowDebt,
        description: `Dív. líq./PL: ${formatMultiple(dividaLiquidaPl)}`
      },
      {
        label: 'Margem líquida positiva',
        value: hasPositiveMargin,
        description: `Margem: ${formatPct(margemLiquida)}`
      },
      {
        label: 'Payout sustentável (20% a 95%)',
        value: hasReasonablePayout,
        description: `Payout: ${formatPct(payout)}`
      },
      {
        label: `Valor de mercado ≥ ${isBDR ? 'R$ 2 bi (BDR)' : 'R$ 1 bi'}`,
        value: hasMinimumSize,
        description: `Valor de mercado: ${formatBRL(marketCap, { digits: 0 })}`
      }
    ];

    const passedCriteria = criteria.filter(c => c.value).length;
    const totalCriteria = criteria.length;
    const essentialCriteria = [isUnderCeiling, hasConsistentDividends, hasGoodProfitability, hasLowDebt];
    const isEligible = essentialCriteria.every(Boolean) && passedCriteria >= 6;
    const score = (passedCriteria / totalCriteria) * 100;
    const barsiScore = this.barsiScore(discountFromCeiling, dy, hasConsistentDividends, roe, liquidezCorrente, margemLiquida);

    let reasoning: string;
    if (ceilingPrice === null) {
      reasoning = 'Sem proventos em anos completos recentes para calcular o preço-teto pelo método Barsi.';
    } else if (isEligible) {
      reasoning = `Atende ao método Barsi: preço de ${formatBRL(currentPrice)} ${formatPct(discount)} abaixo do preço-teto de ${formatBRL(ceilingPrice)} (média de proventos brutos de ${formatBRL(averageDividend)} em ${fullYears} anos completos ÷ DY alvo de ${formatPct(targetDividendYield)}). Score Barsi: ${barsiScore.toFixed(0)}/100.`;
    } else {
      const failedEssential = [];
      if (!isUnderCeiling) failedEssential.push('preço acima do preço-teto');
      if (!hasConsistentDividends) failedEssential.push('dividendos inconsistentes');
      if (!hasGoodProfitability) failedEssential.push('ROE insuficiente');
      if (!hasLowDebt) failedEssential.push('endividamento alto');
      reasoning = `Não atende ao método Barsi${failedEssential.length ? `: ${failedEssential.join(', ')}` : ''}. Critérios atendidos: ${passedCriteria} de ${totalCriteria}. Preço-teto de ${formatBRL(ceilingPrice)}.`;
    }

    return {
      isEligible,
      score,
      fairValue: ceilingPrice,
      upside: upsidePoints(currentPrice, ceilingPrice),
      discount,
      reasoning,
      criteria,
      key_metrics: {
        ceilingPrice,
        discountFromCeiling,
        barsiScore: Number(barsiScore.toFixed(1)),
        dividendYield: dy,
        averageDividend,
        roe,
        payout
      }
    };
  }

  async runRanking(companies: CompanyData[], params: BarsiParams): Promise<RankBuilderResult[]> {
    const {
      targetDividendYield: rawTargetDividendYield,
      maxPriceToPayMultiplier = 1.0,
      minConsecutiveDividends = 3,
      maxDebtToEquity = 1.0,
      minROE = 0.10,
      focusOnBEST = true
    } = params;
    const targetDividendYield = resolveTargetYield(rawTargetDividendYield);

    const results: RankBuilderResult[] = [];

    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    filteredCompanies = this.filterByAssetType(filteredCompanies, params.assetTypeFilter);
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');

    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company)) continue;
      if (this.shouldExcludeCompany(company)) continue;

      const { financials, currentPrice, sector, historicalFinancials } = company;
      const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;

      if (focusOnBEST && !this.isPerennialSector(sector)) continue;

      const dy = this.getDividendYield(financials, use7YearAverages, historicalFinancials);
      const { average: averageDividend, years: fullYears } = await this.calculateAverageDividend(company);
      const roe = this.getROE(financials, use7YearAverages, historicalFinancials);
      const dividaLiquidaPl = this.getDividaLiquidaPl(financials, use7YearAverages, historicalFinancials);
      const liquidezCorrente = this.getLiquidezCorrente(financials, false, historicalFinancials);
      const margemLiquida = this.getMargemLiquida(financials, use7YearAverages, historicalFinancials);
      const marketCap = toNumber(financials.marketCap);

      if (!averageDividend || averageDividend <= 0) continue;
      if (!roe || roe < minROE) continue;
      if (dividaLiquidaPl && dividaLiquidaPl > maxDebtToEquity) continue;
      if (!this.hasConsistentDividendHistory(company, minConsecutiveDividends)) continue;
      if (marketCap && marketCap < 1_000_000_000) continue;

      const ceilingPrice = this.calculateCeilingPrice(averageDividend, targetDividendYield, maxPriceToPayMultiplier);
      if (currentPrice > ceilingPrice) continue;

      const discount = marginOfSafety(currentPrice, ceilingPrice) ?? 0;
      const discountFromCeiling = discount * 100;
      const barsiScore = this.barsiScore(discountFromCeiling, dy, true, roe, liquidezCorrente, margemLiquida);

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        logoUrl: company.logoUrl,
        fairValue: Number(ceilingPrice.toFixed(2)),
        upside: upsidePoints(currentPrice, ceilingPrice),
        marginOfSafety: Number(discountFromCeiling.toFixed(2)),
        rational: `Setor ${sector || 'não informado'}. Preço de ${formatBRL(currentPrice)}, ${formatPct(discount)} abaixo do preço-teto de ${formatBRL(ceilingPrice)} (DY alvo de ${formatPct(targetDividendYield)}). Média de proventos brutos em ${fullYears} anos completos: ${formatBRL(averageDividend)} por ação. ROE de ${formatPct(roe)} e Dív. líq./PL de ${formatMultiple(dividaLiquidaPl)}. Score Barsi: ${barsiScore.toFixed(0)}/100.`,
        key_metrics: {
          ceilingPrice: Number(ceilingPrice.toFixed(2)),
          discountFromCeiling: Number(discountFromCeiling.toFixed(2)),
          barsiScore: Number(barsiScore.toFixed(1)),
          dividendYield: dy,
          averageDividend,
          roe,
          dividaLiquidaPl,
          liquidezCorrente,
          margemLiquida
        }
      });
    }

    const sortedResults = results.sort((a, b) => (b.key_metrics?.barsiScore || 0) - (a.key_metrics?.barsiScore || 0));
    const limitedResults = this.removeDuplicateCompanies(sortedResults).slice(0, 50);
    return this.applyTechnicalPrioritization(limitedResults, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: BarsiParams): string {
    const {
      targetDividendYield: rawTargetDividendYield,
      maxPriceToPayMultiplier = 1.0,
      minConsecutiveDividends = 5,
      maxDebtToEquity = 1.0,
      minROE = 0.10,
      focusOnBEST = true
    } = params;
    const targetDividendYield = resolveTargetYield(rawTargetDividendYield);

    return `# Método Barsi

Inspirado na estratégia de Luiz Barsi de acumular ações pagadoras de dividendos em setores perenes, comparando o preço com um preço-teto calculado pelo dividend yield alvo.

## Setores perenes (B.E.S.T.)

${focusOnBEST ? 'Filtro ativo' : 'Filtro opcional (desligado)'}: bancos, energia elétrica, saneamento, seguros, telecomunicações e gás.

## Qualidade

- ROE ≥ ${formatPct(minROE, { digits: 0 })}
- Dív. líq./PL ≤ ${formatMultiple(maxDebtToEquity)}
- Margem líquida positiva
- Dividendos pagos de forma consistente em ${minConsecutiveDividends} anos

## Preço-teto

**Preço-teto = média anual dos proventos brutos ÷ DY alvo (${formatPct(targetDividendYield)})**

- Média dos últimos ${BARSI_FULL_YEARS} anos-calendário completos (dividendos + JCP brutos). O ano corrente, parcial, não entra.
- Multiplicador do preço-teto: ${formatMultiple(maxPriceToPayMultiplier)}.
- Entram no ranking só as empresas com preço igual ou abaixo do preço-teto.

## Score Barsi

- 40% desconto até o preço-teto
- 35% qualidade dos dividendos (DY e consistência)
- 25% saúde financeira (ROE, liquidez corrente e margem)

**Ordenação**: Score Barsi${params.useTechnicalAnalysis ? ', com priorização técnica dentro de faixas semelhantes' : ''}.

Estimativa baseada em proventos passados, que podem não se repetir. Não é recomendação de investimento.`;
  }
}
