// Tipos base para as estratégias
export interface StrategyParams {
  // Parâmetros comuns a todas as estratégias
  limit?: number;
  companySize?: 'all' | 'small_caps' | 'mid_caps' | 'blue_chips';
  useTechnicalAnalysis?: boolean; // Priorizar ativos em sobrevenda (padrão: false)
}

export interface GrahamParams extends StrategyParams {
  marginOfSafety: number; // Ex: 0.3 para 30%
}

export interface DividendYieldParams extends StrategyParams {
  minYield: number; // Ex: 0.06 para 6%
}

export interface LowPEParams extends StrategyParams {
  maxPE: number; // Ex: 15 para P/L máximo de 15
  minROE?: number; // Ex: 0.15 para ROE mínimo de 15%
}

export interface MagicFormulaParams extends StrategyParams {
  minROIC?: number; // ROIC mínimo (padrão 0)
  minEY?: number; // Earnings Yield mínimo (padrão 0)
  limit?: number; // Número de resultados (padrão 10)
}

export interface FCDParams extends StrategyParams {
  growthRate?: number; // Taxa de crescimento perpetuo (padrão 2.5%)
  discountRate?: number; // Taxa de desconto/WACC (padrão 10%)
  yearsProjection?: number; // Anos de projeção (padrão 5)
  minMarginOfSafety?: number; // Margem de segurança mínima (padrão 20%)
  limit?: number; // Número de resultados (padrão 10)
}

export interface GordonParams extends StrategyParams {
  discountRate: number; // Taxa de desconto/retorno esperado (ex: 0.12 para 12%)
  dividendGrowthRate: number; // Taxa de crescimento dos dividendos (ex: 0.05 para 5%)
  useSectoralAdjustment?: boolean; // Se deve usar ajuste setorial automático (padrão: true)
  sectoralWaccAdjustment?: number; // Ajuste manual do WACC setorial (-0.02 a +0.05)
}

export interface AIParams extends StrategyParams {
  riskTolerance?: 'Conservador' | 'Moderado' | 'Agressivo'; // Tolerância ao risco
  timeHorizon?: 'Curto Prazo' | 'Médio Prazo' | 'Longo Prazo'; // Horizonte de investimento
  focus?: 'Valor' | 'Crescimento' | 'Dividendos' | 'Crescimento e Valor'; // Foco da análise
}

export type ModelParams = GrahamParams | DividendYieldParams | LowPEParams | MagicFormulaParams | FCDParams | GordonParams | AIParams;

// Dados financeiros padronizados (aceita qualquer tipo que será convertido por toNumber)
export interface CompanyFinancialData {
  // Dados básicos
  lpa?: unknown;
  vpa?: unknown;
  pl?: unknown;
  pvp?: unknown;
  dy?: unknown;
  
  // Dados de dividendos
  dividendYield12m?: unknown;
  ultimoDividendo?: unknown;
  payout?: unknown;
  
  // Rentabilidade
  roe?: unknown;
  roa?: unknown;
  roic?: unknown;
  margemLiquida?: unknown;
  margemEbitda?: unknown;
  
  // Endividamento e Liquidez
  liquidezCorrente?: unknown;
  dividaLiquidaPl?: unknown;
  dividaLiquidaEbitda?: unknown;
  passivoAtivos?: unknown;
  
  // Crescimento
  crescimentoLucros?: unknown;
  crescimentoReceitas?: unknown;
  
  // Dados de mercado
  marketCap?: unknown;
  receitaTotal?: unknown;
  evEbitda?: unknown;
  
  // Dados para FCD
  ebitda?: unknown;
  fluxoCaixaLivre?: unknown;
  fluxoCaixaOperacional?: unknown;
  sharesOutstanding?: unknown;
  
  // Outros campos do Prisma (aceita Decimal, number, etc.)
  earningsYield?: unknown;
  
  // Outros
  [key: string]: unknown;
}

// Dados de análise técnica
export interface TechnicalAnalysisData {
  rsi?: number; // Valor atual do RSI (0-100)
  stochasticK?: number; // Valor atual do %K (0-100)
  stochasticD?: number; // Valor atual do %D (0-100)
  overallSignal?: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'; // Sinal geral
}

// Dados básicos da empresa
export interface CompanyData {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  logoUrl?: string | null;
  financials: CompanyFinancialData;
  technicalAnalysis?: TechnicalAnalysisData; // Dados de análise técnica opcionais
}

// Resultado de análise individual
export interface StrategyAnalysis {
  isEligible: boolean;
  score: number;
  fairValue: number | null;
  upside: number | null;
  reasoning: string;
  criteria: { label: string; value: boolean; description: string }[];
  key_metrics?: Record<string, number | null>;
}

// Resultado para ranking
export interface RankBuilderResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  logoUrl?: string | null;
  fairValue: number | null;
  upside: number | null; // Potencial de alta em %
  marginOfSafety: number | null; // Margem de segurança em %
  rational: string; // Explicação detalhada da estratégia e critérios aplicados
  key_metrics?: Record<string, number | null>; // Métricas relevantes para o modelo
}

// Interface base para todas as estratégias
export interface BaseStrategy<T extends StrategyParams> {
  name: string;
  
  // Para análise individual de empresa
  runAnalysis(companyData: CompanyData, params: T): StrategyAnalysis;
  
  // Para ranking de múltiplas empresas (pode ser assíncrono para IA)
  runRanking(companies: CompanyData[], params: T): RankBuilderResult[] | Promise<RankBuilderResult[]>;
  
  // Gerar racional da estratégia
  generateRational(params: T): string;
  
  // Validar dados mínimos necessários
  validateCompanyData(companyData: CompanyData, params: T): boolean;
}
