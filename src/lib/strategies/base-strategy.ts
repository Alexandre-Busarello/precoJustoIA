import { 
  BaseStrategy, 
  StrategyParams, 
  CompanyData, 
  StrategyAnalysis, 
  RankBuilderResult,
  TechnicalAnalysisData
} from './types';
import { BDRDataService } from '../bdr-data-service';

// Funções utilitárias
export function isFIITicker(ticker: string | undefined | null): boolean {
  if (!ticker) return false;
  return /^[A-Z]{4}11$/.test(ticker.trim().toUpperCase());
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return parseFloat(String(value));
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercent(value: unknown): string {
  const numValue = toNumber(value);
  if (numValue === null || numValue === undefined) return 'N/A';
  return `${(numValue * 100).toFixed(2)}%`;
}

/**
 * Valida e normaliza o CAGR de lucros de 5 anos para evitar distorções
 * CAGR deve ser mais conservador que crescimento anual por ser uma média de longo prazo
 */
export function validateCAGR5Years(cagrLucros5a: number | null): number | null {
  if (cagrLucros5a === null || cagrLucros5a === undefined) {
    return null;
  }

  // Converter para número se necessário
  const cagr = typeof cagrLucros5a === 'number' ? cagrLucros5a : parseFloat(String(cagrLucros5a));
  
  if (isNaN(cagr)) {
    return null;
  }

  // CAGR extremos são ainda mais suspeitos que crescimento anual
  // Pois representam média de 5 anos, não deveria ter valores tão extremos
  if (Math.abs(cagr) > 1.0) { // CAGR > 100% ou < -100% é muito suspeito
    // console.warn(`⚠️ CAGR 5 anos extremo detectado: ${(cagr * 100).toFixed(1)}%. Considerando como não confiável.`);
    return null; // Tratar como dado não disponível
  }

  // Limitar CAGR a faixas ainda mais conservadoras
  // CAGR sustentável raramente excede 50% por 5 anos consecutivos
  if (cagr > 0.5) { // Limitar CAGR máximo a 50%
    return 0.5;
  }
  
  if (cagr < -0.5) { // Limitar declínio máximo a -50%
    return -0.5;
  }

  return cagr;
}

/**
 * Calcula média histórica de um indicador financeiro usando dados disponíveis
 * Tenta usar até 7 anos de dados, mas usa o máximo disponível se for menor
 */
export function calculateHistoricalAverage(
  currentValue: unknown,
  historicalValues?: unknown[]
): number | null {
  const current = toNumber(currentValue);
  
  // Se não há valor atual, retorna null
  if (current === null) return null;
  
  // Se não há dados históricos ou array vazio, retorna valor atual
  if (!historicalValues || historicalValues.length === 0) {
    return current;
  }
  
  // Converter valores históricos para números válidos
  const validHistoricalValues = historicalValues
    .map(val => toNumber(val))
    .filter(val => val !== null && !isNaN(val as number)) as number[];
  
  // Se não há valores históricos válidos, retorna valor atual
  if (validHistoricalValues.length === 0) {
    return current;
  }
  
  // Combinar valor atual com históricos (máximo 7 anos total)
  const allValues = [current, ...validHistoricalValues].slice(0, 7);
  
  // Calcular média
  const sum = allValues.reduce((acc, val) => acc + val, 0);
  return sum / allValues.length;
}

/**
 * Extrai valores históricos de um campo específico dos dados históricos
 */
export function extractHistoricalValues(
  historicalData: any[],
  fieldName: string
): unknown[] {
  if (!historicalData || historicalData.length === 0) return [];
  
  return historicalData
    .sort((a, b) => (b.year || 0) - (a.year || 0)) // Ordenar por ano (mais recente primeiro)
    .slice(0, 7) // Máximo 7 anos
    .map(data => data[fieldName])
    .filter(val => val !== null && val !== undefined);
}

/**
 * Aplica média histórica de 7 anos a um indicador se habilitado
 * Fallback para valor atual se médias não estão disponíveis ou desabilitadas
 */
export function applyHistoricalAverageIfEnabled(
  currentValue: unknown,
  use7YearAverages: boolean = false,
  historicalValues?: unknown[]
): number | null {
  if (!use7YearAverages) {
    return toNumber(currentValue);
  }
  
  return calculateHistoricalAverage(currentValue, historicalValues);
}

// Classe base abstrata para todas as estratégias
export abstract class AbstractStrategy<T extends StrategyParams> implements BaseStrategy<T> {
  abstract readonly name: string;
  
  abstract runAnalysis(companyData: CompanyData, params: T): StrategyAnalysis | Promise<StrategyAnalysis>;
  abstract runRanking(companies: CompanyData[], params: T): RankBuilderResult[] | Promise<RankBuilderResult[]>;
  abstract generateRational(params: T): string;
  abstract validateCompanyData(companyData: CompanyData, params: T): boolean;
  
  // Métodos utilitários comuns
  protected calculateGrahamFairValue(lpa: number | null, vpa: number | null): number | null {
    if (!lpa || !vpa || lpa <= 0 || vpa <= 0) return null;
    return Math.sqrt(22.5 * lpa * vpa);
  }

  /**
   * Obtém valor de indicador aplicando média histórica se habilitado
   * Evita repetição de código para mesmos indicadores entre estratégias
   */
  protected getIndicatorValue(
    financialData: any,
    fieldName: string,
    use7YearAverages: boolean = false,
    historicalFinancials?: any[]
  ): number | null {
    const currentValue = financialData[fieldName];
    
    if (!use7YearAverages) {
      return toNumber(currentValue);
    }
    
    // Extrair valores históricos do campo específico
    const historicalValues = extractHistoricalValues(historicalFinancials || [], fieldName);
    
    return calculateHistoricalAverage(currentValue, historicalValues);
  }

  /**
   * Métodos específicos para indicadores mais comuns
   * Evita repetição e centraliza lógica de médias históricas
   */
  protected getROE(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'roe', use7YearAverages, historicalFinancials);
  }

  protected getROIC(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'roic', use7YearAverages, historicalFinancials);
  }

  protected getDividendYield(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'dy', use7YearAverages, historicalFinancials);
  }

  protected getPL(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'pl', use7YearAverages, historicalFinancials);
  }

  protected getPVP(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'pvp', use7YearAverages, historicalFinancials);
  }

  protected getMargemLiquida(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'margemLiquida', use7YearAverages, historicalFinancials);
  }

  protected getMargemEbitda(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'margemEbitda', use7YearAverages, historicalFinancials);
  }

  protected getLiquidezCorrente(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'liquidezCorrente', use7YearAverages, historicalFinancials);
  }

  protected getDividaLiquidaPl(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'dividaLiquidaPl', use7YearAverages, historicalFinancials);
  }

  protected getDividaLiquidaEbitda(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'dividaLiquidaEbitda', use7YearAverages, historicalFinancials);
  }
  
  protected calculateFCDFairValue(
    ebitda: number | null, 
    fluxoCaixaLivre: number | null, 
    sharesOutstanding: number | null,
    growthRate: number = 0.025,      // 2.5% padrão
    discountRate: number = 0.10,     // 10% padrão  
    yearsProjection: number = 5      // 5 anos padrão
  ): number | null {
    if (!ebitda || !sharesOutstanding || ebitda <= 0 || sharesOutstanding <= 0) return null;
    
    // 1. Fluxo de Caixa Base
    let fcffBase: number;
    if (fluxoCaixaLivre && fluxoCaixaLivre > 0) {
      fcffBase = fluxoCaixaLivre;
    } else {
      // Estimativa conservadora: EBITDA * 0.6
      fcffBase = ebitda * 0.6;
    }
    
    if (fcffBase <= 0) return null;
    
    // 2. Projetar Fluxos de Caixa Futuros
    const projectedCashflows: number[] = [];
    let currentCashflow = fcffBase;
    
    for (let year = 1; year <= yearsProjection; year++) {
      // Taxa de crescimento decrescente
      const yearlyGrowth = growthRate + (0.05 * Math.exp(-year * 0.5));
      currentCashflow = currentCashflow * (1 + yearlyGrowth);
      projectedCashflows.push(currentCashflow);
    }
    
    // 3. Calcular Valor Presente dos Fluxos
    let presentValueCashflows = 0;
    for (let year = 0; year < projectedCashflows.length; year++) {
      const pv = projectedCashflows[year] / Math.pow(1 + discountRate, year + 1);
      presentValueCashflows += pv;
    }
    
    // 4. Calcular Valor Terminal e seu Valor Presente
    const terminalCashflow = projectedCashflows[projectedCashflows.length - 1] * (1 + growthRate);
    const terminalValue = terminalCashflow / (discountRate - growthRate);
    const presentValueTerminal = terminalValue / Math.pow(1 + discountRate, yearsProjection);
    
    // 5. Valor Total da Empresa (Enterprise Value)
    // IMPORTANTE: No modelo DCF, o Enterprise Value calculado já representa o valor total da empresa.
    // A dívida já está implícita no cálculo porque:
    // - Os fluxos de caixa livre (FCFF) já são calculados após pagamento de juros
    // - A taxa de desconto (WACC) já considera o custo da dívida
    // Portanto, NÃO devemos subtrair a dívida líquida novamente (seria dupla contagem)
    const enterpriseValue = presentValueCashflows + presentValueTerminal;
    
    // 6. Preço Justo por Ação = Enterprise Value / Número de Ações
    const pricePerShare = enterpriseValue / sharesOutstanding;
    return pricePerShare;
  }
  
  // Filtrar empresas por tamanho (Market Cap)
  protected filterCompaniesBySize(companies: CompanyData[], sizeFilter: string): CompanyData[] {
    if (sizeFilter === 'all') return companies;
    
    return companies.filter(company => {
      const marketCap = toNumber(company.financials.marketCap);
      if (!marketCap) return false;
      
      // Valores em bilhões de reais
      const marketCapBillions = marketCap / 1_000_000_000;
      
      switch (sizeFilter) {
        case 'small_caps':
          return marketCapBillions < 2; // Menos de R$ 2 bilhões
        case 'mid_caps':
          return marketCapBillions >= 2 && marketCapBillions < 10; // R$ 2-10 bilhões
        case 'blue_chips':
          return marketCapBillions >= 10; // Mais de R$ 10 bilhões
        default:
          return true;
      }
    });
  }

  // Verificar se um ticker é BDR
  protected isBDRTicker(ticker?: string | null): boolean {
    if (!ticker) return false;
    return BDRDataService.isBDR(ticker);
  }

  // Filtrar empresas por inclusão/exclusão de BDRs
  protected filterBDRs(companies: CompanyData[], includeBDRs: boolean = true): CompanyData[] {
    if (includeBDRs) return companies;
    
    return companies.filter(company => !this.isBDRTicker(company.ticker));
  }

  // Filtrar empresas por tipo de ativo (b3, bdr, both, fii)
  protected filterByAssetType(
    companies: CompanyData[],
    assetTypeFilter?: 'b3' | 'bdr' | 'both' | 'fii'
  ): CompanyData[] {
    if (assetTypeFilter === 'fii') {
      return companies.filter((company) => company.assetType === 'FII');
    }

    if (!assetTypeFilter || assetTypeFilter === 'both') {
      return companies; // Incluir todos
    }

    if (assetTypeFilter === 'b3') {
      // Apenas ações B3 (excluir BDRs)
      return companies.filter((company) => !this.isBDRTicker(company.ticker));
    }

    if (assetTypeFilter === 'bdr') {
      // Apenas BDRs
      return companies.filter((company) => this.isBDRTicker(company.ticker));
    }

    return companies;
  }

  /**
   * Filtra empresas cujo ticker termina em 5, 6, 7, 8 ou 9
   * Esses tickers geralmente representam classes de ações com menor liquidez ou direitos diferentes
   */
  protected filterTickerEndingDigits(companies: CompanyData[]): CompanyData[] {
    return companies.filter(company => {
      const ticker = company.ticker?.trim().toUpperCase();
      if (!ticker) return true; // Manter se não tem ticker válido
      
      // Pegar o último caractere do ticker
      const lastChar = ticker[ticker.length - 1];
      
      // Excluir se termina em 5, 6, 7, 8 ou 9
      return !['5', '6', '7', '8', '9'].includes(lastChar);
    });
  }

  // Converter StrategyAnalysis para RankBuilderResult
  protected convertToRankingResult(
    companyData: CompanyData, 
    analysis: StrategyAnalysis
  ): RankBuilderResult {
    return {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice: companyData.currentPrice,
      logoUrl: companyData.logoUrl, // Incluir logo por padrão
      fairValue: analysis.fairValue,
      upside: analysis.upside,
      marginOfSafety: analysis.fairValue && companyData.currentPrice > 0 
        ? ((analysis.fairValue - companyData.currentPrice) / companyData.currentPrice) * 100 
        : null,
      rational: analysis.reasoning,
      key_metrics: analysis.key_metrics
    };
  }

  // Calcular score de análise técnica para priorização (sobrevenda = oportunidade)
  protected calculateTechnicalScore(technicalData?: TechnicalAnalysisData): number {
    if (!technicalData) return 0;

    let score = 0;

    // RSI: Priorizar sobrevenda como oportunidade de entrada
    if (technicalData.rsi !== undefined) {
      if (technicalData.rsi <= 25) {
        score += 5; // Sobrevenda extrema - excelente oportunidade
      } else if (technicalData.rsi <= 30) {
        score += 4; // Forte sobrevenda - boa oportunidade
      } else if (technicalData.rsi <= 40) {
        score += 2; // Sobrevenda moderada - oportunidade razoável
      } else if (technicalData.rsi <= 50) {
        score += 1; // Neutro baixo - leve oportunidade
      } else if (technicalData.rsi >= 75) {
        score -= 3; // Sobrecompra forte - evitar
      } else if (technicalData.rsi >= 70) {
        score -= 1; // Sobrecompra moderada - cautela
      }
    }

    // Oscilador Estocástico: Confirmar sinais de sobrevenda
    if (technicalData.stochasticK !== undefined && technicalData.stochasticD !== undefined) {
      const avgStochastic = (technicalData.stochasticK + technicalData.stochasticD) / 2;
      if (avgStochastic <= 15) {
        score += 4; // Sobrevenda extrema
      } else if (avgStochastic <= 20) {
        score += 3; // Forte sobrevenda
      } else if (avgStochastic <= 30) {
        score += 2; // Sobrevenda moderada
      } else if (avgStochastic >= 85) {
        score -= 3; // Sobrecompra forte
      } else if (avgStochastic >= 80) {
        score -= 1; // Sobrecompra moderada
      }
    }

    // Sinal geral: Peso maior para confirmação
    if (technicalData.overallSignal === 'SOBREVENDA') {
      score += 3; // Confirmação de oportunidade
    } else if (technicalData.overallSignal === 'SOBRECOMPRA') {
      score -= 2; // Confirmação de cautela
    }

    return score;
  }

  /**
   * Verifica se a empresa teve lucros consistentes nos últimos 8 anos disponíveis
   * Exclui empresas que tiveram mais de 2 anos de prejuízo nos últimos 8 anos
   * (historicalFinancials contém atual + 7 anos históricos = 8 anos total)
   */
  protected hasConsistentProfits(companyData: CompanyData): boolean {
    const { financials, historicalFinancials } = companyData;
    
    // Verificar lucro atual
    const currentProfit = toNumber(financials.lucroLiquido);
    
    // Se não tem dados históricos, usar apenas o lucro atual
    if (!historicalFinancials || historicalFinancials.length === 0) {
      // Se não tem lucro atual ou é negativo, excluir
      return currentProfit !== null && currentProfit > 0;
    }
    
    // Coletar dados de lucro dos últimos anos (incluindo atual)
    const profitData: { year: number; profit: number | null }[] = [];
    
    // Adicionar lucro atual (ano mais recente)
    const currentYear = new Date().getFullYear();
    if (currentProfit !== null) {
      profitData.push({ year: currentYear, profit: currentProfit });
    }
    
    // Adicionar dados históricos (máximo 7 anos históricos)
    historicalFinancials.forEach(data => {
      const profit = toNumber(data.lucroLiquido);
      if (profit !== null && data.year) {
        profitData.push({ year: data.year, profit });
      }
    });
    
    // Se não tem dados suficientes (menos de 3 anos), ser mais rigoroso
    if (profitData.length < 3) {
      // Todos os anos disponíveis devem ter lucro
      return profitData.every(data => data.profit !== null && data.profit > 0);
    }
    
    // Contar anos com prejuízo
    const lossYears = profitData.filter(data => data.profit !== null && data.profit <= 0).length;
    const totalYears = profitData.length;
    
    // Para 8 anos de dados: máximo 2 anos de prejuízo (25%)
    // Para menos anos: proporcionalmente mais rigoroso
    let maxLossYears: number;
    if (totalYears >= 8) {
      maxLossYears = 2; // Máximo 2 anos de prejuízo em 8 anos
    } else if (totalYears >= 5) {
      maxLossYears = 1; // Máximo 1 ano de prejuízo em 5-7 anos
    } else {
      maxLossYears = 0; // Nenhum prejuízo permitido para menos de 5 anos
    }
    
    return lossYears <= maxLossYears;
  }

  /**
   * Calcula o Overall Score executando todas as estratégias
   * INCLUINDO análise das demonstrações financeiras (igual à tela da empresa)
   */
  protected calculateOverallScore(companyData: CompanyData): number {
    const { financials, currentPrice, incomeStatements, balanceSheets, cashflowStatements } = companyData;
    
    // Preparar dados financeiros no formato esperado
    const financialData = {
      roe: toNumber(financials.roe),
      liquidezCorrente: toNumber(financials.liquidezCorrente),
      dividaLiquidaPl: toNumber(financials.dividaLiquidaPl),
      margemLiquida: toNumber(financials.margemLiquida)
    };
    
    // Preparar dados das demonstrações financeiras se disponíveis
    const statementsData = (incomeStatements && balanceSheets && cashflowStatements) ? {
      incomeStatements,
      balanceSheets,
      cashflowStatements,
      company: {
        ticker: companyData.ticker,
        name: companyData.name,
        sector: companyData.sector,
        marketCap: toNumber(financials.marketCap)
      }
    } : undefined;
    
    try {
      // Importar estratégias e factory
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { StrategyFactory } = require('./strategy-factory');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { STRATEGY_CONFIG } = require('./strategy-config');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calculateOverallScore } = require('./overall-score');
      
      // Executar todas as estratégias
      const strategies = {
        graham: StrategyFactory.runGrahamAnalysis(companyData, STRATEGY_CONFIG.graham),
        dividendYield: StrategyFactory.runDividendYieldAnalysis(companyData, STRATEGY_CONFIG.dividendYield),
        lowPE: StrategyFactory.runLowPEAnalysis(companyData, STRATEGY_CONFIG.lowPE),
        magicFormula: StrategyFactory.runMagicFormulaAnalysis(companyData, STRATEGY_CONFIG.magicFormula),
        fcd: StrategyFactory.runFCDAnalysis(companyData, STRATEGY_CONFIG.fcd),
        gordon: StrategyFactory.runGordonAnalysis(companyData, STRATEGY_CONFIG.gordon),
        fundamentalist: StrategyFactory.runFundamentalistAnalysis(companyData, STRATEGY_CONFIG.fundamentalist)
      };
      
      // Calcular o score usando a função real COM demonstrações financeiras
      // Não incluir breakdown aqui (só precisamos do score numérico)
      const result = calculateOverallScore(strategies, financialData, currentPrice, statementsData, false);
      return result.score;
      
    } catch (error) {
      // Fallback conservador
      console.warn(`[${companyData.ticker}] Erro ao calcular Overall Score:`, error);
      return 30; // Score baixo para excluir por segurança
    }
  }

  /**
   * Verifica se a empresa deve ser excluída do ranking
   * Critérios de exclusão:
   * 1. Não teve lucros consistentes nos últimos 8 anos disponíveis
   * 2. Overall Score inferior a 50 (incluindo demonstrações financeiras)
   */
  protected shouldExcludeCompany(companyData: CompanyData): boolean {
    // Critério 1: Verificar lucros consistentes
    if (!this.hasConsistentProfits(companyData)) {
      return true;
    }
    
    // Critério 2: Verificar Overall Score (com demonstrações financeiras)
    const overallScore = this.calculateOverallScore(companyData);
    if (overallScore < 50) {
      return true;
    }
    
    return false;
  }

  /**
   * Remove tickers duplicados da mesma empresa, mantendo apenas o primeiro
   * Ex: Se RAPT3 aparece antes de RAPT4, remove RAPT4 do ranking
   */
  protected removeDuplicateCompanies(results: RankBuilderResult[]): RankBuilderResult[] {
    const seenCompanyPrefixes = new Set<string>();
    const filteredResults: RankBuilderResult[] = [];
    
    for (const result of results) {
      // Extrair prefixo da empresa (remove números e letras finais)
      const companyPrefix = this.extractCompanyPrefix(result.ticker);
      
      // Se ainda não vimos essa empresa, adicionar ao resultado
      if (!seenCompanyPrefixes.has(companyPrefix)) {
        seenCompanyPrefixes.add(companyPrefix);
        filteredResults.push(result);
      }
      // Se já vimos, pular (manter apenas o primeiro)
    }
    
    return filteredResults;
  }
  
  /**
   * Extrai o prefixo da empresa do ticker
   * Ex: RAPT3 -> RAPT, VALE3 -> VALE, PETR4 -> PETR
   */
  private extractCompanyPrefix(ticker: string): string {
    // Remove números e letras finais (3, 4, 11, F, etc.)
    return ticker.replace(/[0-9]+[A-Z]*$/, '').toUpperCase();
  }

  /**
   * Aplicar priorização técnica no ranking (complementar à análise fundamentalista)
   * 
   * ESTRATÉGIA:
   * 1. Preserva a ordem fundamentalista como critério principal
   * 2. Agrupa ativos em faixas de qualidade similar (~20% cada)
   * 3. Dentro de cada grupo, prioriza oportunidades técnicas (sobrevenda)
   * 4. Mantém a qualidade fundamentalista como base, usando técnica para timing
   */
  protected applyTechnicalPrioritization(
    results: RankBuilderResult[], 
    companies: CompanyData[], 
    useTechnicalAnalysis: boolean = false
  ): RankBuilderResult[] {
    if (!useTechnicalAnalysis) return results;

    // Criar mapa de dados técnicos por ticker
    const technicalMap = new Map<string, TechnicalAnalysisData>();
    companies.forEach(company => {
      if (company.technicalAnalysis) {
        technicalMap.set(company.ticker, company.technicalAnalysis);
      }
    });

    // Adicionar score técnico aos resultados (preservando ordem fundamentalista)
    const resultsWithTechnicalScore = results.map((result, originalIndex) => {
      const technicalData = technicalMap.get(result.ticker);
      const technicalScore = this.calculateTechnicalScore(technicalData);
      
      return {
        ...result,
        technicalScore,
        originalIndex, // Preservar posição original baseada na análise fundamentalista
        // Adicionar informação técnica ao rational se disponível
        rational: technicalData ? 
          `${result.rational}\n\n📊 **Análise Técnica**: ${this.getTechnicalSummary(technicalData)}` : 
          result.rational
      };
    });

    // Agrupar por faixas de qualidade fundamentalista e ordenar tecnicamente dentro de cada grupo
    const groupSize = Math.max(3, Math.floor(results.length / 5)); // Grupos de ~20% ou mínimo 3
    const reorderedResults: typeof resultsWithTechnicalScore = [];

    for (let i = 0; i < resultsWithTechnicalScore.length; i += groupSize) {
      const group = resultsWithTechnicalScore.slice(i, i + groupSize);
      
      // Dentro de cada grupo, priorizar por análise técnica (sobrevenda = melhor oportunidade)
      const sortedGroup = group.sort((a, b) => {
        // Primeiro critério: score técnico (maior = melhor oportunidade de entrada)
        if (b.technicalScore !== a.technicalScore) {
          return b.technicalScore - a.technicalScore;
        }
        // Segundo critério: manter ordem fundamentalista original
        return a.originalIndex - b.originalIndex;
      });
      
      reorderedResults.push(...sortedGroup);
    }

    return reorderedResults.map(({ ...result }) => result);
  }

  // Gerar resumo da análise técnica
  private getTechnicalSummary(technicalData: TechnicalAnalysisData): string {
    const parts: string[] = [];

    if (technicalData.rsi !== undefined) {
      let rsiStatus = '';
      if (technicalData.rsi <= 30) rsiStatus = 'forte sobrevenda';
      else if (technicalData.rsi <= 40) rsiStatus = 'sobrevenda';
      else if (technicalData.rsi >= 70) rsiStatus = 'sobrecompra';
      else rsiStatus = 'neutro';
      
      parts.push(`RSI ${technicalData.rsi.toFixed(1)} (${rsiStatus})`);
    }

    if (technicalData.stochasticK !== undefined && technicalData.stochasticD !== undefined) {
      const avgStochastic = (technicalData.stochasticK + technicalData.stochasticD) / 2;
      let stochStatus = '';
      if (avgStochastic <= 20) stochStatus = 'forte sobrevenda';
      else if (avgStochastic <= 30) stochStatus = 'sobrevenda';
      else if (avgStochastic >= 80) stochStatus = 'sobrecompra';
      else stochStatus = 'neutro';
      
      parts.push(`Estocástico ${avgStochastic.toFixed(1)} (${stochStatus})`);
    }

    if (technicalData.overallSignal) {
      const signalText = technicalData.overallSignal === 'SOBREVENDA' ? 'Oportunidade de entrada' :
                        technicalData.overallSignal === 'SOBRECOMPRA' ? 'Possível saída' : 'Neutro';
      parts.push(`Sinal: ${signalText}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Dados técnicos não disponíveis';
  }

  /**
   * Filtra empresas com overall_score > 50 (empresas de qualidade)
   * Remove automaticamente empresas ruins/problemáticas do ranking
   * 
   * @param companies Array de empresas a serem filtradas
   * @param minScore Score mínimo aceitável (padrão: 50)
   * @returns Array filtrado com apenas empresas de qualidade
   */
  protected filterCompaniesByOverallScore(companies: CompanyData[], minScore: number = 50): CompanyData[] {
    const filteredCompanies = companies.filter(company => {
      // Se não tem overall_score, incluir (benefício da dúvida)
      if (company.overallScore === null || company.overallScore === undefined) {
        return true;
      }
      
      // Filtrar apenas empresas com score acima do mínimo
      return company.overallScore > minScore;
    });
    
    const removedCount = companies.length - filteredCompanies.length;
    if (removedCount > 0) {
      console.log(`🎯 Filtro de Qualidade: ${removedCount} empresas removidas por overall_score ≤ ${minScore}`);
    }
    
    return filteredCompanies;
  }
}
