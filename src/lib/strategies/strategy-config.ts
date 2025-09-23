// Configuração centralizada para parâmetros das estratégias de investimento
// Isso garante consistência entre páginas individuais e de comparação

export const STRATEGY_CONFIG = {
  // Análise Benjamin Graham
  graham: {
    marginOfSafety: 0.20,       // 20% de margem de segurança
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  },
  
  // Estratégia de Dividend Yield
  dividendYield: {
    minYield: 0.04,             // Mínimo 4% de dividend yield
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  },
  
  // Estratégia Low P/E (Value Investing)
  lowPE: {
    maxPE: 15,                  // P/L máximo de 15
    minROE: 0.12,               // ROE mínimo de 12%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  },
  
  // Fórmula Mágica de Joel Greenblatt
  magicFormula: {
    limit: 10,                  // Top 10 empresas
    minROIC: 0.15,              // ROIC mínimo de 15%
    minEY: 0.08,                // Earnings Yield mínimo de 8%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  },
  
  // Fluxo de Caixa Descontado (FCD)
  fcd: {
    growthRate: 0.025,          // Taxa de crescimento de 2.5%
    discountRate: 0.10,         // Taxa de desconto de 10%
    yearsProjection: 5,         // Projeção de 5 anos
    minMarginOfSafety: 0.15,    // Margem de segurança mínima de 15%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  },
  
  // Modelo de Gordon (Crescimento de Dividendos) - Calibrado por Setor
  gordon: {
    discountRate: 0.11,         // Taxa de desconto base de 11% (ajustada para mercado brasileiro)
    dividendGrowthRate: 0.04,   // Taxa de crescimento base de 4% (conservadora)
    useSectoralAdjustment: true, // Ativar ajuste automático por setor
    sectoralWaccAdjustment: 0,  // Ajuste manual adicional (0% por padrão)
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  },
  
  // Estratégia Fundamentalista 3+1
  fundamentalist: {
    minROE: 0.15,               // ROE mínimo de 15%
    minROIC: 0.15,              // ROIC mínimo de 15%
    maxDebtToEbitda: 3.0,       // Dívida/EBITDA máximo de 3x
    minPayout: 0.40,            // Payout mínimo de 40%
    maxPayout: 0.80,            // Payout máximo de 80%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: true  // Análise técnica ativada por padrão
  }
} as const;

// Função helper para executar todas as estratégias com configuração padrão
export function getDefaultStrategyConfig() {
  return STRATEGY_CONFIG;
}
