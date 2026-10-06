/**
 * "Como funciona" de cada modelo de ranking (`/ranking`), em linguagem simples.
 *
 * Fica fora de `ranking-models.ts` para o registro continuar legível. Cada entrada é derivada do código que calcula o
 * ranking (`runRanking`/`runAnalysis`, padrões do registro e `generateRational` de `src/lib/strategies/*`, além de
 * `src/lib/fii-listing-valuation.ts`, `src/lib/etf-scoring.ts` e `src/lib/strategies/etf-ranking-strategy.ts`).
 * Ao mudar um limite no código, atualize o texto aqui e a seção correspondente em `src/lib/metodologia-content.ts`.
 *
 * `anchor` é o id da seção em /metodologia (o teste garante que ela existe).
 */

import { LIQUIDITY_DEFAULTS } from '@/lib/finance/liquidity-rules'
import { formatNumber } from '@/lib/format'

export interface RankingMethodology {
  /** Uma frase: o que o modelo faz. */
  summary: string
  /** De 3 a 5 passos: fórmula ou preço justo, critérios, ordenação e o que fica de fora. */
  steps: string[]
  /** Id da seção em /metodologia. */
  anchor: string
}

/** Limites de liquidez sempre na mesma unidade compacta: `R$ 1 mi`, `R$ 500 mil`. */
export function formatLiquidityLimit(value: number): string {
  if (value >= 1_000_000) return `R$ ${formatNumber(value / 1_000_000, { digits: 1 }).replace(/,0$/, '')} mi`
  return `R$ ${formatNumber(value / 1_000, { digits: 0 })} mil`
}

const STOCK_LIQUIDITY = formatLiquidityLimit(LIQUIDITY_DEFAULTS.stock)

/** Exclusões comuns aos modelos de ações que passam pela nota geral e pela checagem de lucros. */
const QUALITY_EXCLUSIONS = `nota geral da empresa de 50 ou menos, prejuízos recorrentes ou liquidez abaixo de ${STOCK_LIQUIDITY} por dia`

const ETF_FREE_LIMIT = 'No plano gratuito aparecem os 10 primeiros; no Premium, a lista completa.'

export const RANKING_METHODOLOGY: Record<string, RankingMethodology> = {
  graham: {
    summary:
      'Compara o preço com o Número de Graham, o preço máximo que um investidor conservador pagaria pelo lucro e pelo patrimônio da empresa.',
    steps: [
      'Preço justo = √(22,5 × LPA × VPA). O LPA é a média de até 5 anos (sempre a média em commodities cíclicas). LPA e VPA precisam ser positivos.',
      'Entra quem tem margem de segurança (1 − preço ÷ preço justo) a partir do mínimo, ajustável nos parâmetros (padrão 20% em ações e 15% em BDRs).',
      `Ficam de fora empresas com valor de mercado abaixo de R$ 2 bi (R$ 5 bi em BDRs), ${QUALITY_EXCLUSIONS}.`,
      'Ordem: score de qualidade, com até 60 pontos pela margem de segurança e até 20 por ROE, liquidez corrente, margem líquida e crescimento dos lucros.',
    ],
    anchor: 'graham',
  },
  dividendYield: {
    summary:
      'Procura dividend yield alto que o lucro e o balanço sustentam, para evitar o yield inflado só pela queda do preço.',
    steps: [
      'Entrada: dividend yield a partir do mínimo, ajustável nos parâmetros (padrão 4% em ações e 2,5% em BDRs). Esse critério é obrigatório.',
      'Em geral: ROE ≥ 10%, margem líquida ≥ 5%, liquidez corrente ≥ 1,2, dívida líquida/PL ≤ 100%, P/L entre 4 e 25 e valor de mercado ≥ R$ 1 bi (limites mais largos em BDRs).',
      'Utilidade pública usa dívida líquida/EBITDA ≤ 3,5. Bancos e seguradoras usam ROE médio de 5 anos ≥ 12%, payout de 25% a 80% e lucros consistentes. Pode falhar em até 2 critérios.',
      `Ficam de fora empresas com ${QUALITY_EXCLUSIONS}.`,
      'Ordem: score de sustentabilidade (rentabilidade, margem, DY e saúde financeira). Não calcula preço justo.',
    ],
    anchor: 'dividendos',
  },
  lowPE: {
    summary: 'Procura ações com P/L baixo que mantêm rentabilidade, para evitar as que estão baratas por um bom motivo.',
    steps: [
      'P/L acima de 3 e até o teto, ajustável nos parâmetros (padrão 12 em ações e 25 em BDRs).',
      'ROE a partir do mínimo, ajustável nos parâmetros (padrão 12%, nunca abaixo de 12% em BDRs).',
      `Ficam de fora empresas com ${QUALITY_EXCLUSIONS}.`,
      'Ordem: score de valor, que premia P/L baixo, ROE, ROA, margem líquida, crescimento das receitas e ROIC. Não calcula preço justo.',
    ],
    anchor: 'pl-baixo',
  },
  magicFormula: {
    summary:
      'Método de Joel Greenblatt: ordena empresas que unem alto retorno sobre o capital (ROIC) e preço baixo em relação ao lucro operacional.',
    steps: [
      'Earnings yield = EBIT ÷ EV (valor da empresa, somando a dívida). ROIC e earnings yield precisam ser positivos.',
      'Cada empresa ganha uma posição por ROIC e outra por earnings yield. Vem primeiro a menor soma das duas posições.',
      `Ficam de fora bancos, seguradoras e utilidade pública, como no método original, e empresas com ${QUALITY_EXCLUSIONS}.`,
      'Mostra até 50 empresas. Gera uma ordem, não um preço justo.',
    ],
    anchor: 'formula-magica',
  },
  fcd: {
    summary: 'Estima o valor intrínseco trazendo a valor presente o caixa que a empresa deve gerar nos próximos anos.',
    steps: [
      'Fluxo de caixa livre da firma = EBIT × (1 − 34%) + depreciação − investimentos − variação do capital de giro, descontado pelo WACC das premissas macro. A taxa dos parâmetros só vale se for maior.',
      'Crescimento inicial = menor CAGR de 5 anos entre receitas e lucros (de −5% a 10%), convergindo nos anos de projeção (ajustável, padrão 5) para o crescimento perpétuo, entre 4% e 5% (2,5% fixo em BDRs com balanço em dólar).',
      'Entra quem tem margem de segurança a partir do mínimo, ajustável (padrão 15% em ações e 10% em BDRs), valor de mercado ≥ R$ 2 bi (R$ 5 bi em BDRs) e dívida líquida/EBITDA ≤ 3x.',
      `Ficam de fora bancos e seguradoras (para eles, veja o P/VP justo) e empresas com ${QUALITY_EXCLUSIONS}.`,
      'Ordem: maior margem de segurança. Mostra até 10 empresas.',
    ],
    anchor: 'fcd',
  },
  gordon: {
    summary: 'Calcula o preço justo como o valor presente dos dividendos futuros, crescendo a uma taxa constante.',
    steps: [
      'Preço justo = D1 ÷ (k − g). D1 = proventos dos últimos 12 meses, sem os extraordinários, × (1 + g).',
      'k = custo de capital das premissas macro, com beta por setor (ajuste setorial ligado por padrão) e nunca abaixo da Selic; a taxa dos parâmetros só vale se for maior. g = menor entre o teto ajustável (padrão 4% em ações e 5% em BDRs), ROE × (1 − payout) e 6%.',
      'Exige k − g de pelo menos 4 p.p. e margem de segurança ≥ 10%. Nos demais critérios (DY, DY 12 meses, payout, ROE, crescimento dos lucros, liquidez corrente e endividamento) pode falhar em até 2.',
      `Ficam de fora empresas com ${QUALITY_EXCLUSIONS}.`,
      'Ordem: score composto de potencial, dividend yield, ROE, payout e crescimento.',
    ],
    anchor: 'gordon',
  },
  fundamentalist: {
    summary:
      'Dá uma nota de 0 a 100 com três indicadores escolhidos conforme o perfil da empresa, mais um bônus para dividendos.',
    steps: [
      'Sem dívida relevante: ROE, P/L comparado ao crescimento dos lucros em 5 anos e endividamento. Com dívida: ROIC, EV/EBITDA e endividamento. Bancos e seguradoras: ROE e P/L.',
      'Pontos: qualidade até 35, preço até 30, dívida até 20 e dividendos até 15 (nota máxima com payout na faixa ajustável e DY ≥ 4%).',
      'ROE e ROIC mínimos (ajustáveis, padrão 15%) dão a nota máxima de qualidade. Sai quem tem ROE ou ROIC abaixo de 5%, P/L ou EV/EBITDA não positivo, ou dívida líquida/EBITDA acima do máximo (ajustável, padrão 3x em ações e 4x em BDRs).',
      `Ficam de fora empresas com ${QUALITY_EXCLUSIONS}.`,
      'Ordem: maior nota. Mostra até 10 empresas. Não calcula preço justo.',
    ],
    anchor: 'fundamentalista',
  },
  barsi: {
    summary:
      'Busca pagadoras de dividendos em setores perenes com preço abaixo do preço-teto, calculado como no método Bazin.',
    steps: [
      'Preço-teto = média anual dos proventos brutos (dividendos + JCP) dos últimos 5 anos completos, sem extraordinários, ÷ DY alvo (ajustável, padrão 6% em ações e 3% em BDRs) × multiplicador (padrão 1,0).',
      'Setores perenes (B.E.S.T.): bancos e serviços financeiros, energia, saneamento e utilidade pública, seguros, telecomunicações e gás, pelo nome do setor. O filtro vem ligado e pode ser desligado.',
      'Critérios: preço igual ou abaixo do teto, ROE ≥ 10% (12% em BDRs), dívida líquida/PL ≤ 1,0x (1,5x em BDRs), dividendos em 80% dos anos da janela, arredondado para baixo (janela ajustável; no padrão de 3 anos, 2 de 3) e valor de mercado ≥ R$ 1 bi.',
      `Ficam de fora empresas com ${QUALITY_EXCLUSIONS}.`,
      'Ordem: Score Barsi, com 40% de desconto até o preço-teto, 35% de dividendos e 25% de saúde financeira.',
    ],
    anchor: 'barsi',
  },
  bazin: {
    summary: 'Calcula o preço-teto que entrega o dividend yield alvo sobre os proventos que a empresa costuma pagar.',
    steps: [
      'Preço-teto = média anual dos proventos brutos (dividendos + JCP) dos últimos 5 anos completos ÷ DY alvo (ajustável, padrão 6%). O ano corrente não entra.',
      'Proventos extraordinários (acima de 2× a mediana e sem repetição na mesma época de outros anos) ficam fora da média.',
      'Critérios: pelo menos 3 anos completos de proventos, preço igual ou abaixo do teto, dívida líquida/PL informada e até o máximo (ajustável, padrão 0,5x) e no máximo 2 anos de prejuízo em 8. Bancos e seguradoras usam ROE médio de 5 anos ≥ 12% e payout de 25% a 80%.',
      `Ficam de fora ações com liquidez abaixo de ${STOCK_LIQUIDITY} por dia.`,
      'Ordem: maior DY médio sobre o preço atual, o que equivale ao maior desconto até o preço-teto.',
    ],
    anchor: 'bazin',
  },
  lynch: {
    summary: 'Compara o P/L com o crescimento dos lucros (PEG). É um indicador relativo: não calcula preço-alvo.',
    steps: [
      'Crescimento (g) = CAGR dos lucros em 5 anos, limitado a 25% ao ano (acima de 100% o dado é descartado). PEG = P/L ÷ (g × 100).',
      'Entra quem tem PEG até o máximo, ajustável (padrão 1,0), e P/L abaixo do P/L de referência (crescimento + dividend yield, em pontos percentuais).',
      `Ficam de fora bancos e seguradoras (para eles, veja o P/VP justo), commodities cíclicas, empresas com prejuízo ou sem crescimento de lucros e ações com liquidez abaixo de ${STOCK_LIQUIDITY} por dia.`,
      'Ordem: menor PEG. Faixas de Lynch: abaixo de 0,5 muito barato, de 0,5 a 1 barato e acima de 1 caro.',
    ],
    anchor: 'lynch',
  },
  ai: {
    summary: 'A IA resume o que os modelos quantitativos dizem de cada empresa. Preço justo e potencial vêm dos modelos; a ordem é atribuída pela IA.',
    steps: [
      `Pré-filtro: saem empresas sem lucro (ROE ou margem líquida não positivos) e com ${QUALITY_EXCLUSIONS}.`,
      'A IA escolhe até 15 candidatas entre as 50 de maior nota geral, e cada uma passa pelos modelos quantitativos.',
      'Preço justo de referência = mediana dos preços justos de Graham e FCD e do preço-teto de Barsi.',
      'Ordem: nota e nível de confiança atribuídos pela IA ao ler os resultados dos modelos. Mostra 10 empresas. O texto e a ordem podem variar entre execuções.',
    ],
    anchor: 'ia',
  },
  fiiDividendYield: {
    summary: 'Ordena FIIs pelo dividend yield, com limites de P/VP e de liquidez para reduzir armadilhas.',
    steps: [
      'Entra o FII com dividend yield a partir do mínimo, ajustável nos parâmetros (padrão 8%).',
      'P/VP até o máximo, ajustável (padrão 1,1), e liquidez diária a partir do mínimo, ajustável (padrão R$ 500 mil). Sem dado de liquidez, o FII fica de fora.',
      'Tipo de fundo: tijolo, papel ou os dois.',
      'Ordem: maior dividend yield. Mostra até 50 FIIs. Não calcula preço-teto nem score.',
    ],
    anchor: 'fii-dividend-yield',
  },
  fiiRanking: {
    summary:
      'Ordena FIIs pelo Score PJ-FII, uma nota de 0 a 100 com cinco pilares: dividendos, valuation, qualidade do portfólio, liquidez e segmento e resiliência.',
    steps: [
      'Pesos: dividendos 30% (35% em papel), valuation 25%, qualidade do portfólio 20% (15% em papel), liquidez 15% e segmento e resiliência 10%.',
      'Entra o FII com score a partir do mínimo (ajustável, padrão 55) e liquidez diária a partir do mínimo (ajustável, padrão R$ 1 mi). Tipo: tijolo, papel ou os dois.',
      'Preço-teto de referência = rendimento anual por cota (últimos 12 rendimentos) ÷ DY-alvo. DY-alvo = NTN-B longa + IPCA + 2,5 p.p. em tijolo ou 2 p.p. em papel.',
      'Ordem: maior score; no empate, maior dividend yield. Mostra até 30 FIIs.',
    ],
    anchor: 'fii-ranking',
  },
  'etfs-melhor-score-geral': {
    summary: 'Ordena ETFs pelo Score PJ-ETF, uma nota de 0 a 100 sobre custo, retorno, liquidez, patrimônio, carteira e análise qualitativa.',
    steps: [
      'Pesos: taxa de administração 18%, retorno em 12 meses 22% (comparado com ETFs do mesmo índice), liquidez 18%, patrimônio 12%, qualidade da carteira 18% e análise com IA 12%.',
      'Carteira concentrada (5 maiores posições acima de 65%) perde até 20 pontos.',
      'Entra o ETF com taxa de administração e retorno conhecidos. Ordem: maior score.',
      ETF_FREE_LIMIT,
    ],
    anchor: 'etf-maior-score',
  },
  'etfs-menor-taxa-administracao': {
    summary: 'Ordena ETFs pela menor taxa de administração, entre os que têm Score PJ-ETF a partir de 40.',
    steps: [
      'Entram ETFs com Score PJ-ETF ≥ 40 e taxa de administração informada.',
      'Ordem: menor taxa de administração ao ano.',
      'Taxa menor reduz o custo, mas não diz nada sobre o índice seguido: compare também o retorno e a carteira.',
      ETF_FREE_LIMIT,
    ],
    anchor: 'etf-menor-taxa',
  },
  'etfs-maior-retorno-1a': {
    summary: 'Ordena ETFs pelo retorno dos últimos 12 meses.',
    steps: [
      'Usa o retorno em 12 meses. Sem esse histórico, usa o retorno de 6 meses anualizado, (1 + retorno 6m)² − 1, marcado como estimado.',
      'Entram ETFs com Score PJ-ETF calculado.',
      'Ordem: maior retorno. Retorno passado não indica retorno futuro.',
      ETF_FREE_LIMIT,
    ],
    anchor: 'etf-maior-retorno',
  },
  'etfs-renda-fixa': {
    summary: 'Mostra ETFs de renda fixa: os que seguem índices de Selic, IPCA, IRF-M ou IMA.',
    steps: [
      'Entram ETFs cujo índice de referência cita Selic, IPCA, IRF-M ou IMA e que têm Score PJ-ETF calculado.',
      'Ordem: maior Score PJ-ETF.',
      ETF_FREE_LIMIT,
    ],
    anchor: 'etf-renda-fixa',
  },
}

export function getRankingMethodology(modelKey: string | null | undefined): RankingMethodology | undefined {
  if (!modelKey) return undefined
  return RANKING_METHODOLOGY[modelKey]
}

/** Link para a seção do modelo em /metodologia (ou para o topo, se o modelo não tiver entrada). */
export function methodologyHref(modelKey: string | null | undefined): string {
  const anchor = getRankingMethodology(modelKey)?.anchor
  return anchor ? `/metodologia#${anchor}` : '/metodologia'
}
