// Configuração centralizada para parâmetros das estratégias de investimento
// Isso garante consistência entre páginas individuais e de comparação
//
// Margem de segurança = desconto vs valor intrínseco = 1 − preço ÷ preço justo (fração).
// Os filtros antigos chamados "margem" usavam o potencial (preço justo ÷ preço − 1). Para manter a mesma seleção,
// um potencial mínimo u vira um desconto mínimo de 1 − 1 ÷ (1 + u): 20% de potencial = 16,67% de desconto;
// 15% de potencial = 13,04% de desconto.
//
// Priorização técnica (RSI/estocástico) desligada por padrão em todos os modelos: os rankings são fundamentalistas.

export const STRATEGY_CONFIG = {
  // Número de Graham (preço máximo defensivo)
  graham: {
    marginOfSafety: 0.1667,     // Desconto mínimo de 16,67% (= antigo potencial mínimo de 20%: 1 − 1/1,20)
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // Estratégia de Dividend Yield (anti-armadilha)
  dividendYield: {
    minYield: 0.04,             // Mínimo 4% de dividend yield
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // P/L baixo com qualidade (P/L fixo, não relativo ao setor)
  lowPE: {
    maxPE: 15,                  // P/L máximo de 15
    minROE: 0.12,               // ROE mínimo de 12%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // Fórmula Mágica de Joel Greenblatt (EBIT/EV + ROIC, soma das posições)
  magicFormula: {
    limit: 10,                  // Top 10 empresas
    minROIC: 0.15,              // ROIC mínimo de 15%
    minEY: 0.08,                // Earnings yield (EBIT/EV) mínimo de 8%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // Fluxo de Caixa Descontado (FCD). A taxa de desconto vem das premissas macro (Ke/WACC); não há taxa fixa.
  fcd: {
    growthRate: 0.045,          // Crescimento perpétuo nominal em BRL (faixa aceita: 4% a 5%)
    yearsProjection: 5,         // Projeção de 5 anos
    minMarginOfSafety: 0.13,    // Desconto mínimo de 13% (≈ antigo potencial mínimo de 15%: 1 − 1/1,15 = 13,04%)
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // Modelo de Gordon (desconto de dividendos). k = Ke macro com beta setorial; g = min(teto, ROE × (1 − payout), 6%).
  gordon: {
    discountRate: 0,            // Piso manual de k; 0 = usa só o Ke das premissas macro (nunca abaixo da Selic)
    dividendGrowthRate: 0.05,   // Teto nominal do crescimento dos dividendos (o g efetivo pode ser menor)
    useSectoralAdjustment: true, // Beta por classe setorial (utilidade pública 0,8; commodities 1,2; demais 1,0)
    sectoralWaccAdjustment: 0,  // Ajuste manual adicional sobre o Ke (0% por padrão)
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // Estratégia Fundamentalista 3+1
  fundamentalist: {
    minROE: 0.15,               // ROE mínimo de 15%
    minROIC: 0.15,              // ROIC mínimo de 15%
    maxDebtToEbitda: 3.0,       // Dívida/EBITDA máximo de 3x
    minPayout: 0.40,            // Payout mínimo de 40%
    maxPayout: 0.80,            // Payout máximo de 80%
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    use7YearAverages: true      // Médias de 7 anos habilitadas por padrão
  },

  // Screening Customizável de Ações
  screening: {
    limit: 20,                  // Máximo de 20 resultados
    companySize: 'all',         // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false, // Priorização técnica desligada por padrão
    // Todos os filtros desativados por padrão (usuário configura)
    plFilter: { enabled: false, min: undefined, max: undefined },
    pvpFilter: { enabled: false, min: undefined, max: undefined },
    evEbitdaFilter: { enabled: false, min: undefined, max: undefined },
    psrFilter: { enabled: false, min: undefined, max: undefined },
    roeFilter: { enabled: false, min: undefined, max: undefined },
    roicFilter: { enabled: false, min: undefined, max: undefined },
    roaFilter: { enabled: false, min: undefined, max: undefined },
    margemLiquidaFilter: { enabled: false, min: undefined, max: undefined },
    margemEbitdaFilter: { enabled: false, min: undefined, max: undefined },
    cagrLucros5aFilter: { enabled: false, min: undefined, max: undefined },
    cagrReceitas5aFilter: { enabled: false, min: undefined, max: undefined },
    dyFilter: { enabled: false, min: undefined, max: undefined },
    payoutFilter: { enabled: false, min: undefined, max: undefined },
    dividaLiquidaPlFilter: { enabled: false, min: undefined, max: undefined },
    liquidezCorrenteFilter: { enabled: false, min: undefined, max: undefined },
    dividaLiquidaEbitdaFilter: { enabled: false, min: undefined, max: undefined },
    marketCapFilter: { enabled: false, min: undefined, max: undefined }
  },

  // Método Barsi - Buy and Hold de Dividendos
  barsi: {
    targetDividendYield: 0.06,      // Meta de 6% de dividend yield
    maxPriceToPayMultiplier: 1.0,   // Preço teto exato (sem margem adicional)
    minConsecutiveDividends: 3,     // Mínimo de 3 anos consecutivos pagando dividendos
    maxDebtToEquity: 2.0,           // Máximo de 200% de Dívida líquida/PL
    minROE: 0.10,                   // ROE mínimo de 10%
    focusOnBEST: false,             // Não restringe aos setores B.E.S.T. (bancos, energia, saneamento, seguros, telecom)
    companySize: 'all',             // Filtro de tamanho: todas as empresas
    useTechnicalAnalysis: false,    // Priorização técnica desligada por padrão
    use7YearAverages: true          // Médias de 7 anos habilitadas por padrão
  }
} as const;

// Função helper para executar todas as estratégias com configuração padrão
export function getDefaultStrategyConfig() {
  return STRATEGY_CONFIG;
}
