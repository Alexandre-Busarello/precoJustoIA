import type { ExtendedScreeningParams } from './strategies/screening-strategy';

/** Presets de filtros fundamentalistas, exibidos pela página de estratégia padrão (`ScreeningConversionPage`). */
export type FilterPresetSlug =
  | 'as-acoes-mais-baratas-segundo-graham'
  | 'top-vacas-leiteiras-dividendos'
  | 'small-caps-crescimento-explosivo'
  | 'oportunidades-desconto-excessivo'
  | 'ranking-formula-magica-b3';

/** Presets com sinais de preço: página própria, que mostra o motivo de cada ativo e quantos ficaram sem dados. */
export type SignalPresetSlug = 'queda-com-fundamentos-intactos';

export type ScreeningPresetSlug = FilterPresetSlug | SignalPresetSlug;

/** Sem argumento de tipo, cobre os presets de filtros (os que a página de estratégia padrão sabe exibir). */
export interface ScreeningPreset<S extends ScreeningPresetSlug = FilterPresetSlug> {
  slug: S;
  /** Nome descritivo (H1 e título da página SEO). */
  title: string;
  /** Nome curto para chips e listas. */
  shortTitle: string;
  /** Resumo neutro dos critérios, exibido abaixo do título. */
  hook: string;
  params: ExtendedScreeningParams & { sortBy?: string };
  description: string;
  keywords: string[];
}

export const SCREENING_PRESETS: { [S in ScreeningPresetSlug]: ScreeningPreset<S> } = {
  'as-acoes-mais-baratas-segundo-graham': {
    slug: 'as-acoes-mais-baratas-segundo-graham',
    title: 'Ações com P/L e P/VP baixos pelos critérios de Graham',
    shortTitle: 'Critérios de Graham',
    hook: 'Benjamin Graham defendia pagar pouco por lucro e patrimônio. Este filtro aplica P/L até 15, P/VP até 1,5, margem líquida acima de 5% e score geral mínimo de 60 às ações da B3.',
    description: 'Ações da B3 filtradas pelos critérios de Benjamin Graham, mentor de Warren Buffett: P/L até 15, P/VP até 1,5, margem líquida acima de 5% e score geral mínimo de 60.',
    keywords: ['ações baratas', 'graham', 'value investing', 'ações seguras', 'P/L baixo', 'P/VP baixo'],
    params: {
      plFilter: { enabled: true, max: 15 },
      pvpFilter: { enabled: true, max: 1.5 },
      margemLiquidaFilter: { enabled: true, min: 0.05 },
      overallScoreFilter: { enabled: true, min: 60 }, // Score geral mínimo para excluir empresas com fundamentos fracos
      assetTypeFilter: 'b3',
      sortBy: 'pl_asc', // Menor P/L primeiro
    },
  },
  'top-vacas-leiteiras-dividendos': {
    slug: 'top-vacas-leiteiras-dividendos',
    title: 'Ações com dividend yield acima de 8% a.a.',
    shortTitle: 'DY acima de 8%',
    hook: 'Empresas da B3 com dividend yield de pelo menos 8% nos últimos 12 meses (proventos reais, brutos), payout entre 25% e 90% (distribuição compatível com o lucro) e score geral mínimo de 60.',
    description: 'Ações da B3 com dividend yield de pelo menos 8%, payout entre 25% e 90% e score geral mínimo de 60. Filtro para quem busca renda com dividendos.',
    keywords: ['dividendos', 'dividend yield', 'renda passiva', 'vacas leiteiras', 'barsi', 'dividendos altos'],
    params: {
      dyFilter: { enabled: true, min: 0.08 },
      payoutFilter: { enabled: true, min: 0.25, max: 0.90 },
      overallScoreFilter: { enabled: true, min: 60 }, // Score geral mínimo para excluir empresas com fundamentos fracos
      assetTypeFilter: 'b3',
      sortBy: 'dy_desc', // Maior DY primeiro
    },
  },
  'small-caps-crescimento-explosivo': {
    slug: 'small-caps-crescimento-explosivo',
    title: 'Small caps com crescimento de receita acima de 20% a.a.',
    shortTitle: 'Small caps em crescimento',
    hook: 'Empresas com valor de mercado de até R$ 3 bi, receita crescendo acima de 20% ao ano nos últimos 5 anos, dívida líquida/EBITDA até 2,5x e score geral mínimo de 50.',
    description: 'Small caps da B3 com valor de mercado de até R$ 3 bi, CAGR de receita acima de 20% em 5 anos e dívida líquida/EBITDA até 2,5x.',
    keywords: ['small caps', 'crescimento', 'CAGR', 'pequenas empresas', 'crescimento explosivo', 'ações de crescimento'],
    params: {
      marketCapFilter: { enabled: true, max: 3_000_000_000 }, // R$ 3 bilhões
      cagrReceitas5aFilter: { enabled: true, min: 0.20 },
      dividaLiquidaEbitdaFilter: { enabled: true, max: 2.5 },
      overallScoreFilter: { enabled: true, min: 50 }, // Score geral mínimo para excluir empresas com fundamentos fracos
      assetTypeFilter: 'b3',
      sortBy: 'upside_desc', // Maior Upside primeiro (empresas com maior potencial de valorização)
    },
  },
  'oportunidades-desconto-excessivo': {
    slug: 'oportunidades-desconto-excessivo',
    title: 'Desconto vs. preço justo de Graham',
    shortTitle: 'Desconto vs. preço justo',
    hook: 'Ações com upside de pelo menos 40% até o preço justo estimado pela fórmula de Graham, P/VP abaixo de 0,8, ROE acima de 10% e score geral mínimo de 60. O preço justo é uma estimativa.',
    description: 'Ações da B3 negociadas com desconto em relação ao preço justo de Graham: upside de pelo menos 40%, P/VP abaixo de 0,8 e ROE acima de 10%.',
    keywords: ['deep value', 'desconto', 'valor justo', 'upside', 'oportunidades', 'ações baratas'],
    params: {
      grahamUpsideFilter: { enabled: true, min: 40 }, // Upside > 40%
      pvpFilter: { enabled: true, max: 0.80 },
      roeFilter: { enabled: true, min: 0.10 },
      overallScoreFilter: { enabled: true, min: 60 }, // Score geral mínimo para excluir empresas com fundamentos fracos
      assetTypeFilter: 'b3',
      sortBy: 'upside_desc', // Maior Upside primeiro
    },
  },
  'ranking-formula-magica-b3': {
    slug: 'ranking-formula-magica-b3',
    title: 'Fórmula Mágica de Greenblatt na B3',
    shortTitle: 'Fórmula Mágica',
    hook: 'A Fórmula Mágica de Joel Greenblatt ordena as empresas combinando retorno sobre o capital (ROIC) e earnings yield, para destacar negócios rentáveis a preços razoáveis.',
    description: 'Ranking da Fórmula Mágica de Joel Greenblatt aplicado às ações da B3: combina ROIC alto e earnings yield alto (EV/EBIT baixo).',
    keywords: ['fórmula mágica', 'greenblatt', 'ROE', 'EV/EBIT', 'ações boas e baratas', 'magic formula'],
    params: {
      overallScoreFilter: { enabled: true, min: 60 }, // Score geral mínimo para excluir empresas com fundamentos fracos
      assetTypeFilter: 'b3',
      sortBy: 'magic_score_desc', // Maior score da fórmula mágica primeiro
      // Nota: Esta estratégia usa o modelo magicFormula, não screening
    },
  },
  'queda-com-fundamentos-intactos': {
    slug: 'queda-com-fundamentos-intactos',
    title: 'Queda com fundamentos intactos',
    shortTitle: 'Queda com fundamentos intactos',
    hook: 'Ações da B3 com preço abaixo da média móvel de 200 pregões ou pelo menos 20% abaixo da máxima de 52 semanas, cujo lucro, ROE, margem e endividamento não pioraram no último período de 12 meses.',
    description: 'Ações da B3 em queda de preço (abaixo da média de 200 pregões ou 20% abaixo da máxima de 52 semanas) com lucro, ROE, margem e endividamento preservados nos últimos 12 meses. Filtro quantitativo, não é recomendação.',
    keywords: ['ações em queda', 'média móvel 200', 'máxima de 52 semanas', 'fundamentos', 'correção de preço', 'screening de ações'],
    params: {
      dipWithIntactFundamentals: true,
      assetTypeFilter: 'b3',
      sortBy: 'drawdown_asc', // Maior queda desde a máxima de 52 semanas primeiro
    },
  },
};

export function getPresetBySlug(slug: string): ScreeningPreset<ScreeningPresetSlug> | null {
  return SCREENING_PRESETS[slug as ScreeningPresetSlug] || null;
}

/** Preset de filtros fundamentalistas (página de estratégia padrão), e não de sinais de preço. */
export function isFilterPreset(preset: ScreeningPreset<ScreeningPresetSlug>): preset is ScreeningPreset<FilterPresetSlug> {
  return preset.slug !== 'queda-com-fundamentos-intactos';
}

export function getAllPresetSlugs(): ScreeningPresetSlug[] {
  return Object.keys(SCREENING_PRESETS) as ScreeningPresetSlug[];
}

