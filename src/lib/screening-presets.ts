import { ScreeningParams } from './strategies/types';

export type ScreeningPresetSlug = 
  | 'as-acoes-mais-baratas-segundo-graham'
  | 'top-vacas-leiteiras-dividendos'
  | 'small-caps-crescimento-explosivo'
  | 'oportunidades-desconto-excessivo'
  | 'ranking-formula-magica-b3';

export interface ScreeningPreset {
  slug: ScreeningPresetSlug;
  title: string;
  hook: string;
  params: ScreeningParams & { sortBy?: string };
  description: string;
  keywords: string[];
}

export const SCREENING_PRESETS: Record<ScreeningPresetSlug, ScreeningPreset> = {
  'as-acoes-mais-baratas-segundo-graham': {
    slug: 'as-acoes-mais-baratas-segundo-graham',
    title: '🛡️ As Ações Mais Baratas e Seguras da Bolsa (Graham)',
    hook: 'O mentor do Warren Buffett tinha uma regra: nunca pagar caro. A IA aplicou a regra dele na B3 hoje e encontrou apenas 3 empresas que passam no teste.',
    description: 'Encontre as ações mais baratas e seguras da B3 usando os critérios de Benjamin Graham, mentor de Warren Buffett. Filtros: P/L ≤ 15, P/VP ≤ 1.5, Margem Líquida > 5%.',
    keywords: ['ações baratas', 'graham', 'value investing', 'ações seguras', 'P/L baixo', 'P/VP baixo'],
    params: {
      plFilter: { enabled: true, max: 15 },
      pvpFilter: { enabled: true, max: 1.5 },
      margemLiquidaFilter: { enabled: true, min: 0.05 },
      overallScoreFilter: { enabled: true, min: 60 }, // Score mínimo de 50 para eliminar empresas ruins
      assetTypeFilter: 'b3',
      sortBy: 'pl_asc', // Menor P/L primeiro
    },
  },
  'top-vacas-leiteiras-dividendos': {
    slug: 'top-vacas-leiteiras-dividendos',
    title: '🐮 Top "Vacas Leiteiras": Dividendos Acima da Selic',
    hook: 'Esqueça a poupança. Estas 3 empresas são as verdadeiras "Vacas Leiteiras" da bolsa agora, pagando dividendos gordos. Veja o Yield da primeira da lista...',
    description: 'Descubra as ações que pagam os maiores dividendos da B3. Filtros: Dividend Yield ≥ 8%, Payout entre 25% e 90%, Liquidez Diária > R$ 500k.',
    keywords: ['dividendos', 'dividend yield', 'renda passiva', 'vacas leiteiras', 'barsi', 'dividendos altos'],
    params: {
      dyFilter: { enabled: true, min: 0.08 },
      payoutFilter: { enabled: true, min: 0.25, max: 0.90 },
      overallScoreFilter: { enabled: true, min: 60 }, // Score mínimo de 50 para eliminar empresas ruins
      // Nota: Liquidez diária será filtrada no backend se necessário
      assetTypeFilter: 'b3',
      sortBy: 'dy_desc', // Maior DY primeiro
    },
  },
  'small-caps-crescimento-explosivo': {
    slug: 'small-caps-crescimento-explosivo',
    title: '🚀 Small Caps com Crescimento Explosivo (>20% aa)',
    hook: 'As gigantes já cresceram. O dinheiro grosso está nas pequenas. A IA filtrou empresas desconhecidas que estão crescendo a receita a mais de 20% ao ano. Essa aqui pode ser a próxima WEG...',
    description: 'Encontre small caps com crescimento explosivo na B3. Filtros: Market Cap < R$ 3B, CAGR Receita > 20%, Dívida Líq/EBITDA < 2.5.',
    keywords: ['small caps', 'crescimento', 'CAGR', 'pequenas empresas', 'crescimento explosivo', 'ações de crescimento'],
    params: {
      marketCapFilter: { enabled: true, max: 3_000_000_000 }, // R$ 3 bilhões
      cagrReceitas5aFilter: { enabled: true, min: 0.20 },
      dividaLiquidaEbitdaFilter: { enabled: true, max: 2.5 },
      overallScoreFilter: { enabled: true, min: 50 }, // Score mínimo de 50 para eliminar empresas ruins
      assetTypeFilter: 'b3',
      sortBy: 'upside_desc', // Maior Upside primeiro (empresas com maior potencial de valorização)
    },
  },
  'oportunidades-desconto-excessivo': {
    slug: 'oportunidades-desconto-excessivo',
    title: '📉 Oportunidades de Ouro: Desconto Excessivo vs Valor Justo',
    hook: 'O mercado bateu demais nessas ações e errou a mão. A inteligência artificial encontrou empresas com desconto excessivo em relação ao valor justo. Veja o potencial de valorização da primeira da lista...',
    description: 'Encontre ações com desconto excessivo em relação ao valor justo. Filtros: Upside > 40%, P/VP < 0.80, EBIT > 0, ROE > 10%.',
    keywords: ['deep value', 'desconto', 'valor justo', 'upside', 'oportunidades', 'ações baratas'],
    params: {
      grahamUpsideFilter: { enabled: true, min: 40 }, // Upside > 40%
      pvpFilter: { enabled: true, max: 0.80 },
      roeFilter: { enabled: true, min: 0.10 },
      overallScoreFilter: { enabled: true, min: 60 }, // Score mínimo de 50 para eliminar empresas ruins
      // Nota: EBIT > 0 será verificado no backend
      assetTypeFilter: 'b3',
      sortBy: 'upside_desc', // Maior Upside primeiro
    },
  },
  'ranking-formula-magica-b3': {
    slug: 'ranking-formula-magica-b3',
    title: '🧙‍♂️ Ranking Oficial: Ações Boas e Baratas (Fórmula Mágica)',
    hook: 'Existe uma fórmula matemática que bateu o mercado por 20 anos seguidos. Ela cruza qualidade com preço baixo. Hoje, o Ranking da Fórmula Mágica na B3 tem um novo líder...',
    description: 'Ranking oficial da Fórmula Mágica de Joel Greenblatt aplicada na B3. Combina maior ROE com menor EV/EBIT para encontrar ações boas e baratas.',
    keywords: ['fórmula mágica', 'greenblatt', 'ROE', 'EV/EBIT', 'ações boas e baratas', 'magic formula'],
    params: {
      overallScoreFilter: { enabled: true, min: 60 }, // Score mínimo de 50 para eliminar empresas ruins
      assetTypeFilter: 'b3',
      sortBy: 'magic_score_desc', // Maior score da fórmula mágica primeiro
      // Nota: Esta estratégia usa o modelo magicFormula, não screening
    },
  },
};

export function getPresetBySlug(slug: string): ScreeningPreset | null {
  return SCREENING_PRESETS[slug as ScreeningPresetSlug] || null;
}

export function getAllPresetSlugs(): ScreeningPresetSlug[] {
  return Object.keys(SCREENING_PRESETS) as ScreeningPresetSlug[];
}

