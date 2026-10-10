/**
 * Conteúdo da página /metodologia: um documento por modelo, agrupado por universo (Ações e BDRs, FIIs, ETFs).
 *
 * Textos alinhados a src/lib/strategies/* (runRanking, runAnalysis, generateRational e constantes de cada estratégia),
 * src/lib/fii-listing-valuation.ts, src/lib/strategies/fii-overall-score.ts, src/lib/etf-scoring.ts e aos padrões
 * do registro de rankings (src/lib/ranking-models.ts). Os ids são as âncoras usadas pelo "Como funciona" do ranking
 * (src/lib/ranking-methodology.ts); o teste em src/lib/__tests__/ranking-methodology.test.ts garante que existem.
 *
 * Módulo puro (sem banco): a página injeta os números ao vivo (premissas macro) onde `live` indica.
 */

import { LIQUIDITY_DEFAULTS } from '@/lib/finance/liquidity-rules'
import { FII_PILLAR_LABELS } from '@/lib/strategies/fii-overall-score'
import { formatLiquidityLimit } from '@/lib/ranking-methodology'

export interface MethodologyDoc {
  id: string
  name: string
  idea: string
  formula?: string
  /** Título da lista de critérios (padrão "Critérios"). */
  criteriaTitle?: string
  criteria?: string[]
  limitations?: string[]
  notApplicable?: string[]
  /** Bloco com números ao vivo que a página insere depois da fórmula. */
  live?: 'fiiTargetDY'
}

export interface MethodologyGroup {
  id: string
  title: string
  /** Rótulo curto no índice. */
  tocLabel: string
  intro: string[]
  docs: MethodologyDoc[]
}

const STOCK_LIQUIDITY = formatLiquidityLimit(LIQUIDITY_DEFAULTS.stock)
const BDR_LIQUIDITY = formatLiquidityLimit(LIQUIDITY_DEFAULTS.bdr)

const STOCK_DOCS: MethodologyDoc[] = [
  {
    id: 'graham',
    name: 'Número de Graham',
    idea:
      'Preço máximo que o investidor defensivo de Benjamin Graham aceitaria pagar (P/L 15 × P/VP 1,5). É um teto conservador, não uma estimativa de valor justo.',
    formula:
      'Número de Graham = √(22,5 × LPA × VPA)\n\nLPA = média dos últimos 5 anos (mínimo de 3 anos;\n      cíclicas de commodities usam a média com 2 anos ou mais)\nVPA = valor patrimonial por ação',
    criteria: [
      'LPA e VPA positivos',
      'No ranking: margem de segurança (1 − preço ÷ número de Graham) a partir do mínimo escolhido (padrão 20% em ações e 15% em BDRs) e valor de mercado ≥ R$ 2 bi (R$ 5 bi em BDRs)',
      'No ranking, a ordem vem do score de qualidade: até 60 pontos pela margem de segurança e até 20 por ROE, liquidez corrente, margem líquida e crescimento dos lucros',
      'Na página do ativo: potencial ≥ 10% e no máximo 2 destes critérios não atendidos: ROE ≥ 10% (12% em BDRs), margem líquida positiva, crescimento dos lucros ≥ −15%, liquidez corrente ≥ 1,0 e dívida líquida/PL ≤ 150% (os dois últimos não se aplicam a bancos e seguradoras)',
    ],
    limitations: [
      'A constante 22,5 foi calibrada para os juros dos EUA dos anos 1970; com a Selic alta, o resultado tende a ser otimista.',
      'Ignora crescimento, qualidade dos lucros e geração de caixa.',
    ],
    notApplicable: ['Empresas com prejuízo ou patrimônio negativo.', 'BDRs sem paridade e câmbio na base de dados.'],
  },
  {
    id: 'bazin',
    name: 'Método Bazin',
    idea:
      'Décio Bazin propôs um preço-teto para ações pagadoras de dividendos: o preço que entrega um dividend yield mínimo sobre os proventos que a empresa costuma distribuir.',
    formula:
      'Preço-teto = média anual dos proventos ÷ DY alvo\n\nMédia = últimos 5 anos-calendário completos\n        (dividendos + JCP brutos, sem extraordinários;\n         o ano corrente não entra)\nDY alvo padrão = 6% (ajustável no ranking)',
    criteria: [
      'Pelo menos 3 anos completos de histórico de proventos',
      'Proventos extraordinários (acima de 2× a mediana e sem repetição na mesma época de outros anos) ficam fora da média, porque não devem se repetir',
      'DY médio sobre o preço atual ≥ DY alvo (equivale a preço ≤ preço-teto)',
      'Dívida líquida/PL informada e ≤ 0,5x (ajustável no ranking); bancos e seguradoras usam ROE médio de 5 anos ≥ 12% e payout entre 25% e 80%',
      'Lucros consistentes, pela mesma regra dos outros modelos: no máximo 2 anos de prejuízo em 8',
      'No ranking, a ordem é o maior DY médio sobre o preço atual',
    ],
    limitations: [
      'Olha só para proventos passados, que podem não se repetir.',
      'Um DY alvo fixo não acompanha a Selic: com juros altos, 6% pode ser pouco.',
    ],
    notApplicable: ['Empresas que não distribuem proventos de forma regular.', 'Empresas em crescimento que reinvestem o lucro.'],
  },
  {
    id: 'barsi',
    name: 'Método Barsi',
    idea:
      'Inspirado na estratégia de Luiz Barsi de acumular ações pagadoras de dividendos em setores perenes. Usa o mesmo preço-teto do método Bazin e acrescenta o filtro de setores perenes.',
    formula:
      'Preço-teto = média anual dos proventos brutos ÷ DY alvo × multiplicador\n\nMédia = últimos 5 anos-calendário completos (sem extraordinários)\nDY alvo padrão = 6% (3% em BDRs); multiplicador padrão = 1,0\n\nScore Barsi = 40% desconto até o preço-teto\n            + 35% qualidade dos dividendos\n            + 25% saúde financeira',
    criteria: [
      'Setores perenes (B.E.S.T.): bancos, energia elétrica, saneamento e gás canalizado, seguros e telecomunicações, identificados pela classificação de setor e indústria (petróleo e gás ficam de fora). No ranking, o filtro vem ligado e pode ser desligado',
      'ROE ≥ 10% e dívida líquida/PL ≤ 1,0x (12% e 1,5x em BDRs); os dois são ajustáveis',
      'Dividendos (DY acima de 1%) em 80% dos anos da janela escolhida, arredondado para baixo (no padrão de 3 anos, 2 de 3). Com histórico menor que a janela, basta DY atual acima de 3%',
      'Valor de mercado ≥ R$ 1 bi',
      'Entram no ranking só as empresas com preço igual ou abaixo do preço-teto; margem líquida e liquidez corrente pesam no score',
    ],
    limitations: [
      'Depende de proventos passados e de um DY alvo escolhido pelo usuário.',
      'Concentra a análise em poucos setores.',
    ],
    notApplicable: ['Empresas fora dos setores perenes (quando o filtro B.E.S.T. está ativo).', 'Empresas sem histórico de proventos.'],
  },
  {
    id: 'gordon',
    name: 'Modelo de Gordon',
    idea:
      'O preço justo é o valor presente dos dividendos futuros, crescendo a uma taxa constante. É muito sensível à diferença entre a taxa de desconto e o crescimento.',
    formula:
      'Preço justo = D1 ÷ (k − g)\n\nD1 = D0 × (1 + g)\nD0 = proventos dos últimos 12 meses, sem extraordinários\nk  = Ke com beta setorial, nunca abaixo da Selic\n     (a taxa informada só vale se for maior)\ng  = menor entre o teto escolhido, ROE × (1 − payout) e 6%\n     (teto padrão: 5% na página do ativo; 4% no ranking)',
    criteria: [
      'k − g de pelo menos 4 p.p.; abaixo disso o modelo não se aplica',
      'Margem de segurança ≥ 10% (cerca de 11% de potencial)',
      'No máximo 2 destes critérios não atendidos: DY ≥ 4%, DY 12 meses ≥ 3%, payout ≤ 80%, ROE ≥ 12%, crescimento dos lucros ≥ −20%, liquidez corrente ≥ 1,2 e dívida líquida/PL ≤ 100% (utilidade pública usa dívida líquida/EBITDA ≤ 3,5; bancos e seguradoras não usam os dois últimos)',
      'Beta setorial: 0,8 para utilidade pública, 1,2 para commodities cíclicas e 1,0 para os demais',
      'No ranking, a ordem vem de um score composto: potencial, dividend yield, ROE, payout e crescimento',
    ],
    limitations: [
      'Pequenas mudanças em k ou g mudam muito o resultado.',
      'Supõe dividendos crescendo para sempre a uma taxa constante.',
    ],
    notApplicable: ['Empresas que pagam pouco ou nada de dividendos.', 'BDRs sem paridade e câmbio na base de dados.'],
  },
  {
    id: 'fcd',
    name: 'Fluxo de caixa descontado (FCD)',
    idea:
      'O valor intrínseco é o valor presente do caixa que a empresa deve gerar. É uma estimativa sensível às premissas, não uma previsão.',
    formula:
      'FCFF = EBIT × (1 − 34%) + D&A − capex − ΔNCG\n\nValor da firma = Σ FCFFₜ ÷ (1 + WACC)ᵗ + valor terminal\nValor por ação = (valor da firma − dívida líquida) ÷ ações\n\nCrescimento inicial = menor CAGR 5a (receitas, lucros),\n                      entre −5% e 10%, convergindo em 5 anos\nCrescimento perpétuo = 4% a 5% nominal (padrão 4,5% na\n                       página do ativo e 4% no ranking;\n                       2,5% em BDRs com balanço em dólar)\nWACC = Ke e Kd (Selic + 2 p.p., após IR de 34%)',
    criteria: [
      'Margem de segurança mínima de 13% na página do ativo; no ranking, ajustável (padrão 15% em ações e 10% em BDRs)',
      'No ranking: valor de mercado ≥ R$ 2 bi (R$ 5 bi em BDRs) e dívida líquida/EBITDA ≤ 3x; a ordem é a maior margem de segurança',
      'Na página do ativo, no máximo 2 destes critérios não atendidos: EBITDA e fluxo de caixa operacional positivos, ROE ≥ 12%, margem EBITDA ≥ 15%, crescimento das receitas ≥ −10%, liquidez corrente ≥ 1,2, dívida líquida/EBITDA ≤ 3x e valor de mercado ≥ R$ 2 bi',
    ],
    limitations: [
      'O valor terminal costuma responder pela maior parte do resultado.',
      'Sem dados de DFC, usa o fluxo de caixa livre alavancado, descontado pelo Ke.',
    ],
    notApplicable: [
      'Bancos e seguradoras: o fluxo de caixa não separa operação e financiamento (veja P/VP justo).',
      'BDRs sem paridade e câmbio na base de dados.',
    ],
  },
  {
    id: 'pvp-justo',
    name: 'P/VP justo (bancos e seguradoras)',
    idea:
      'Em bancos, dívida é matéria-prima, não financiamento. O P/VP justo compara o retorno sobre o patrimônio com o custo de capital (lucro residual em perpetuidade). Aparece na página de bancos e seguradoras; não é um modelo de ranking.',
    formula: 'P/VP justo = (ROE − g) ÷ (Ke − g)\nValor estimado = VPA × P/VP justo\n\nROE = média dos últimos 5 anos\ng   = ROE × (1 − payout), limitado a 6%',
    criteria: [
      'ROE médio de 5 anos ≥ 12%',
      'Ke − g de pelo menos 4 p.p.; abaixo disso o resultado fica instável',
      'Preço abaixo do valor estimado',
    ],
    limitations: ['Supõe que o ROE médio dos últimos 5 anos se mantém.', 'Não capta risco de crédito nem mudanças regulatórias.'],
    notApplicable: ['Empresas não financeiras.', 'Bancos sem histórico de ROE, sem payout ou com patrimônio negativo.'],
  },
  {
    id: 'lynch',
    name: 'Peter Lynch (PEG)',
    idea:
      'Peter Lynch comparava o P/L com o crescimento dos lucros: uma empresa que cresce mais rápido pode valer um P/L maior. É um indicador relativo: não calcula preço-alvo, porque LPA × P/L de referência exagera o potencial de empresas com P/L baixo.',
    formula:
      'g = CAGR dos lucros em 5 anos, limitado a 25% a.a.\n    (acima de 100% o dado é descartado)\n\nPEG = P/L ÷ (g × 100)\nP/L de referência = g + dividend yield (em p.p.)',
    criteria: [
      'PEG ≤ 1,0 (ajustável no ranking). Faixas de Lynch: abaixo de 0,5 muito barato; de 0,5 a 1 barato; acima de 1 caro',
      'P/L abaixo do P/L de referência',
      'No ranking, a ordem é o menor PEG',
    ],
    limitations: ['O crescimento passado pode não se repetir.', 'O teto de 25% evita valores extremos, mas ainda favorece quem cresceu muito.'],
    notApplicable: [
      'Bancos e seguradoras: o lucro cresce com alavancagem e o PEG distorce (veja P/VP justo).',
      'Empresas com LPA negativo ou sem crescimento de lucros em 5 anos.',
      'Commodities cíclicas (petróleo, mineração, siderurgia, papel e celulose): o lucro de pico distorce o P/L.',
    ],
  },
  {
    id: 'formula-magica',
    name: 'Fórmula Mágica (Greenblatt)',
    idea:
      'Encontrar bons negócios a preços razoáveis, combinando retorno sobre o capital com preço baixo em relação ao lucro operacional. Gera uma ordem, não um preço justo.',
    formula: 'Earnings yield = EBIT ÷ EV\nROIC = retorno sobre o capital investido\n\nPosição final = posição(ROIC) + posição(EY)\n(menor soma vem primeiro)',
    criteria: [
      'No ranking: ROIC e earnings yield positivos; mostra até 50 empresas',
      'Na página do ativo: ROIC ≥ 15% e earnings yield ≥ 8% obrigatórios, e pelo menos 6 de 8 critérios (ROE, crescimento das receitas, margem líquida, liquidez corrente, dívida líquida/PL e valor de mercado ≥ R$ 1 bi, ou R$ 3 bi em BDRs)',
    ],
    limitations: ['Não estima preço justo, só ordena empresas.', 'Usa um único ano de EBIT e ROIC.'],
    notApplicable: ['Bancos, seguradoras e utilidade pública, como no método original.'],
  },
  {
    id: 'dividendos',
    name: 'Anti-armadilha de dividendos',
    idea:
      'Filtra empresas com dividend yield alto e sustentável, evitando as que parecem pagar muito só porque o preço caiu ou porque o lucro não sustenta os proventos.',
    formula: 'Entrada: DY ≥ mínimo escolhido (padrão 4%; 2,5% em BDRs)\nOrdem: score de sustentabilidade (DY e saúde financeira)',
    criteria: [
      'Empresas em geral: ROE ≥ 10%, margem líquida ≥ 5%, liquidez corrente ≥ 1,2, dívida líquida/PL ≤ 100%, P/L entre 4 e 25, valor de mercado ≥ R$ 1 bi (limites mais largos em BDRs)',
      'Utilidade pública: dívida líquida/EBITDA ≤ 3,5 no lugar de dívida líquida/PL',
      'Bancos e seguradoras: ROE médio de 5 anos ≥ 12%, payout entre 25% e 80% e lucros consistentes',
      'O DY mínimo é obrigatório; dos demais critérios, no máximo 2 podem falhar. No ranking, ROE e P/L precisam existir',
    ],
    limitations: ['É um filtro, não um preço justo.', 'DY passado não indica proventos futuros.'],
    notApplicable: ['Empresas sem distribuição recorrente de proventos.'],
  },
  {
    id: 'pl-baixo',
    name: 'P/L baixo com qualidade',
    idea:
      'Value investing clássico: empresas com P/L baixo que mantêm rentabilidade, filtrando armadilhas de valor (ações baratas por um motivo).',
    formula: 'Entrada: 3 < P/L ≤ teto escolhido (padrão 12; 25 em BDRs)\n         ROE ≥ mínimo escolhido (padrão 12%)\nOrdem: score de valor (P/L baixo e qualidade)',
    criteria: [
      'O score de valor premia P/L baixo, ROE, ROA, margem líquida, crescimento das receitas e ROIC',
      'Na página do ativo, no máximo 2 destes critérios não atendidos: ROA ≥ 5%, margem líquida ≥ 3%, crescimento das receitas ≥ −10%, liquidez corrente ≥ 1,0 e dívida líquida/PL ≤ 200% (os dois últimos não se aplicam a bancos e seguradoras) e valor de mercado ≥ R$ 500 mi',
    ],
    limitations: ['O teto de P/L é fixo e não compara com a média do setor.', 'Lucros não recorrentes podem deixar o P/L artificialmente baixo.'],
    notApplicable: ['Empresas com prejuízo (P/L negativo).'],
  },
  {
    id: 'fundamentalista',
    name: 'Fundamentalista 3+1',
    idea: 'Análise simplificada com três indicadores essenciais, escolhidos conforme o perfil da empresa, mais um bônus para dividendos. Gera uma nota de 0 a 100.',
    formula:
      'Sem dívida relevante: ROE + P/L vs. CAGR de lucros 5a + endividamento\nCom dívida relevante: ROIC + EV/EBITDA + endividamento\nBancos e seguradoras: ROE + P/L\nBônus: payout + dividend yield\n\nNota = qualidade (até 35) + preço (até 30)\n     + dívida (até 20) + dividendos (até 15)',
    criteria: [
      'ROE ou ROIC mínimo escolhido (padrão 15%) dá a nota máxima de qualidade; abaixo de 5%, a empresa sai',
      'Sai também quem não tem P/L ou EV/EBITDA positivo, ou passa da dívida líquida/EBITDA máxima escolhida (padrão 3x; 4x em BDRs)',
      'Dividendos: nota máxima com payout dentro da faixa escolhida (padrão 40% a 80%) e DY ≥ 4%',
      'No ranking, a ordem é a maior nota; mostra até 10 empresas',
    ],
    limitations: ['Gera um score, não um preço justo.', 'Simplifica empresas com contabilidade complexa.'],
    notApplicable: ['Empresas sem ROE nem ROIC na base de dados.'],
  },
  {
    id: 'ia',
    name: 'Síntese dos modelos com IA',
    idea:
      'A IA resume os resultados dos modelos acima. Preço justo e potencial vêm sempre dos modelos determinísticos; a IA atribui a nota e a ordem, mas não calcula preços.',
    formula: 'Preço justo de referência = mediana dos preços justos\n                            de Graham e FCD e do preço-teto de Barsi\nTexto = síntese gerada por IA (pode variar entre execuções)',
    criteria: [
      'Remove empresas sem lucro (ROE ≤ 0 ou margem líquida ≤ 0)',
      'A IA escolhe até 15 candidatas entre as 50 de maior nota geral',
      'Nota e nível de confiança atribuídos pela IA ao ler os resultados dos modelos (sem IA disponível, vêm da convergência entre eles); mostra 10 empresas',
    ],
    limitations: ['O texto é uma estimativa gerada por IA e pode conter erros.', 'Não substitui a leitura dos números de cada modelo.'],
    notApplicable: ['Empresas sem dados suficientes para os modelos quantitativos.'],
  },
]

const FII_DOCS: MethodologyDoc[] = [
  {
    id: 'fii-score',
    name: 'Score PJ-FII (pilares)',
    idea:
      'Nota de 0 a 100 que resume cinco pilares do fundo. Os pesos mudam entre FIIs de tijolo (imóveis físicos) e de papel (CRIs e outros títulos). A nota descreve os dados do fundo; não diz o que fazer com ele.',
    formula: `Score = ${FII_PILLAR_LABELS.dividendos} 30% (35% em papel)\n      + ${FII_PILLAR_LABELS.valuation} 25%\n      + ${FII_PILLAR_LABELS.qualidadePortfolio} 20% (15% em papel)\n      + ${FII_PILLAR_LABELS.liquidez} 15%\n      + ${FII_PILLAR_LABELS.gestao} 10%`,
    criteriaTitle: 'Como cada pilar é calculado',
    criteria: [
      `${FII_PILLAR_LABELS.dividendos}: dividend yield (40%) dentro da faixa típica (nota máxima de 8% a 12% em tijolo e de 10% a 15% em papel; acima disso perde nota), meses com pagamento (30%), estabilidade dos rendimentos (20%) e DY ÷ FFO yield (10%)`,
      `${FII_PILLAR_LABELS.valuation}: P/VP (50%, nota máxima entre 0,85 e 1,05), cap rate em tijolo ou FFO yield em papel (30%, nota máxima de 8% a 12%) e distância entre cotação e valor patrimonial (20%)`,
      `${FII_PILLAR_LABELS.qualidadePortfolio}: em tijolo, número de imóveis (45%), vacância (40%) e aluguel ÷ preço do m² (15%); em papel, segmento (50%, high grade pontua mais), meses com pagamento (30%) e P/VP perto de 1 (20%)`,
      `${FII_PILLAR_LABELS.liquidez}: volume médio diário (60%, nota máxima acima de R$ 5 mi), valor de mercado (30%, nota máxima acima de R$ 1 bi) e uma parcela fixa (10%)`,
      `${FII_PILLAR_LABELS.gestao}: metade é a resiliência do segmento (shopping, logística, lajes corporativas e multiestratégia pontuam mais; hospital e varejo, depois; residencial e hotel, menos; desenvolvimento e outros, menos ainda) e metade é uma parcela quase fixa, por isso o pilar varia pouco. Não mede a qualidade da gestão`,
      'Alertas de possível armadilha de dividendos: DY acima de 14% com P/VP abaixo de 0,85 e vacância acima de 12% reduz o pilar de dividendos em 20%; DY acima de 18% com P/VP abaixo de 0,8 e vacância acima de 15% tira 20 pontos da nota. Liquidez abaixo de R$ 100 mil por dia limita a nota a 40',
    ],
    limitations: [
      'Os pesos e as faixas são escolhas do modelo e não se ajustam ao ciclo de juros.',
      'Dados de vacância e de imóveis dependem dos relatórios dos fundos e podem estar defasados.',
    ],
  },
  {
    id: 'fii-preco-teto',
    name: 'Preço-teto e DY-alvo de FIIs',
    idea:
      'O preço-teto é o preço que entrega o DY-alvo sobre os rendimentos dos últimos 12 meses. O DY-alvo parte da NTN-B, o título público atrelado à inflação, mais um prêmio pelo risco do fundo.',
    formula:
      'Preço-teto = rendimento anual por cota ÷ DY-alvo\n\nRendimento anual = média dos últimos 12 rendimentos\n                   × pagamentos por ano (em fundo mensal,\n                   a soma dos últimos 12)\n                   (sem histórico: DY 12 meses × cotação)\nDY-alvo = NTN-B longa (taxa real) + IPCA 12 meses + spread\nSpread  = 2,5 p.p. em tijolo · 2 p.p. em papel\n          (2,5 p.p. quando o tipo não é conhecido)',
    live: 'fiiTargetDY',
    criteria: [
      'O histórico só vale se o último rendimento tiver data-com nos últimos 400 dias; um fundo que parou de pagar não usa rendimentos antigos',
      'Sem rendimento, a referência passa a ser o valor patrimonial por cota (VPA, ou cotação ÷ P/VP)',
      'Margem de segurança = 1 − preço ÷ preço-teto',
      'Papel tem spread menor porque os CRIs já repassam a correção (IPCA ou CDI) aos rendimentos',
    ],
    limitations: [
      'Rendimentos passados podem não se repetir, principalmente em papel, que acompanha a inflação e o CDI do período.',
      'O DY-alvo é uma soma simples das premissas, não uma taxa exigida por cada investidor.',
    ],
  },
  {
    id: 'fii-ranking',
    name: 'Ranking PJ-FII',
    idea: 'Ordena os FIIs pelo Score PJ-FII e mostra o preço-teto de referência de cada um.',
    criteria: [
      'Score a partir do mínimo escolhido (padrão 55)',
      'Liquidez diária a partir do mínimo escolhido (padrão R$ 1 mi); sem dado de liquidez, o FII fica de fora',
      'Tipo de fundo: tijolo, papel ou os dois',
      'Ordem: maior score; no empate, maior dividend yield. Mostra até 30 FIIs',
    ],
    limitations: ['O score resume os dados disponíveis; leia os pilares de cada fundo antes de tirar conclusões.'],
  },
  {
    id: 'fii-dividend-yield',
    name: 'Maior dividend yield (FIIs)',
    idea: 'Ordena FIIs pelo dividend yield, com limites de P/VP e de liquidez para reduzir armadilhas.',
    criteria: [
      'Dividend yield a partir do mínimo escolhido (padrão 8%)',
      'P/VP até o máximo escolhido (padrão 1,1)',
      `Liquidez diária a partir do mínimo escolhido (padrão ${formatLiquidityLimit(LIQUIDITY_DEFAULTS.fii)}); sem dado de liquidez, o FII fica de fora`,
      'Tipo de fundo: tijolo, papel ou os dois',
      'Ordem: maior dividend yield. Mostra até 50 FIIs. Não calcula preço-teto nem score',
    ],
    limitations: ['Um DY alto pode refletir queda da cota por problemas de crédito ou vacância.'],
  },
  {
    id: 'fii-screening',
    name: 'Screening de FIIs',
    idea:
      'Filtro livre de FIIs (na página de screening): o usuário escolhe os limites e vê, para cada fundo, o Score PJ-FII e o preço-teto de referência.',
    criteria: [
      `Filtros opcionais: dividend yield mínimo, P/VP máximo, número mínimo de imóveis, vacância máxima, segmento e tipo (tijolo ou papel). A liquidez diária mínima vale sempre: sem valor escolhido, ${formatLiquidityLimit(LIQUIDITY_DEFAULTS.fii)}; sem dado de liquidez, o fundo sai`,
      'Sem dado de DY, P/VP ou imóveis, o fundo sai quando o filtro correspondente está ativo; sem dado de vacância, fica',
      'No plano gratuito, mostra 3 resultados',
    ],
    limitations: ['Não ordena por nota: é um filtro, e a leitura fica com o usuário.'],
  },
]

const ETF_DOCS: MethodologyDoc[] = [
  {
    id: 'etf-score',
    name: 'Score PJ-ETF',
    idea:
      'Nota de 0 a 100 que resume custo, retorno, liquidez, porte e qualidade da carteira de cada ETF. Só recebe nota o ETF com taxa de administração e retorno conhecidos.',
    formula:
      'Score = taxa de administração 18%\n      + retorno em 12 meses 22%\n      + liquidez 18%\n      + patrimônio 12%\n      + qualidade da carteira 18%\n      + análise com IA 12%\n      − penalidade de concentração (até 20 pontos)',
    criteriaTitle: 'Como cada parte é calculada',
    criteria: [
      'Taxa de administração: nota 100 com taxa de até 0,10% ao ano e 0 a partir de 1,50%',
      'Retorno: comparado com o de ETFs que seguem o mesmo índice; sem 12 meses de histórico, usa o retorno de 6 meses anualizado',
      'Liquidez (volume do último pregão) e patrimônio: comparados com os demais ETFs em escala logarítmica; sem o dado, a parte vale 0',
      'Qualidade da carteira: média da nota geral dos ativos da carteira, ponderada pelo peso de cada um',
      'Análise com IA: nota qualitativa gerada a partir dos dados do ETF (índice, custo, retorno, volatilidade e carteira); vale 50, neutra, enquanto não há análise',
      'Concentração: se as 5 maiores posições passam de 65% da carteira, o ETF perde até 20 pontos (a análise pode isentar fundos de fundos)',
    ],
    limitations: ['Retorno passado não indica retorno futuro.', 'A parte de IA é uma estimativa e pode variar entre revisões.'],
  },
  {
    id: 'etf-maior-score',
    name: 'Maior score (ETFs)',
    idea: 'Lista os ETFs com Score PJ-ETF calculado, do maior para o menor score.',
    criteria: ['Plano gratuito: 10 primeiros; Premium: lista completa'],
  },
  {
    id: 'etf-menor-taxa',
    name: 'Menor taxa de administração',
    idea: 'Lista os ETFs com Score PJ-ETF a partir de 40 e taxa informada, da menor para a maior taxa de administração.',
    criteria: [
      'Taxa menor reduz o custo, mas não diz nada sobre o índice seguido: compare também retorno e carteira',
      'Plano gratuito: 10 primeiros; Premium: lista completa',
    ],
  },
  {
    id: 'etf-maior-retorno',
    name: 'Maior retorno em 12 meses',
    idea: 'Lista os ETFs com Score PJ-ETF calculado, do maior para o menor retorno em 12 meses.',
    formula: 'Sem 12 meses de histórico: retorno 12m ≈ (1 + retorno 6m)² − 1\n(marcado como estimado)',
    criteria: ['Plano gratuito: 10 primeiros; Premium: lista completa'],
    limitations: ['Retorno passado não indica retorno futuro.'],
  },
  {
    id: 'etf-renda-fixa',
    name: 'Renda fixa (Selic e IPCA)',
    idea: 'Lista os ETFs cujo índice de referência cita Selic, IPCA, IRF-M ou IMA, do maior para o menor Score PJ-ETF.',
    criteria: ['Plano gratuito: 10 primeiros; Premium: lista completa'],
  },
]

export const METHODOLOGY_GROUPS: MethodologyGroup[] = [
  {
    id: 'modelos-acoes',
    title: 'Modelos de ações e BDRs',
    tocLabel: 'Ações e BDRs',
    intro: [
      `Em todos os rankings de ações, ações com volume médio abaixo de ${STOCK_LIQUIDITY} por dia ficam de fora (dá para incluí-las no ranking) e BDRs abaixo de ${BDR_LIQUIDITY} por dia continuam, com aviso. Quando há mais de uma classe da mesma empresa, fica a mais negociada.`,
      'Exceto Bazin e Peter Lynch, os rankings também deixam de fora empresas com nota geral até 50. Exceto Peter Lynch, todos deixam de fora prejuízos recorrentes (mais de 2 anos de prejuízo em 8; mais de 1 em 5 a 7 anos; qualquer prejuízo com menos de 5 anos de histórico).',
    ],
    docs: STOCK_DOCS,
  },
  {
    id: 'modelos-fiis',
    title: 'Modelos de FIIs',
    tocLabel: 'FIIs',
    intro: [
      'Os rankings de FIIs têm o próprio seletor de liquidez mínima. O preço de referência dos FIIs é o preço-teto pelo DY-alvo, explicado abaixo.',
    ],
    docs: FII_DOCS,
  },
  {
    id: 'modelos-etfs',
    title: 'Modelos de ETFs',
    tocLabel: 'ETFs',
    intro: ['Os rankings de ETFs são listas prontas, sem parâmetros, todas a partir do Score PJ-ETF. Não calculam preço justo.'],
    docs: ETF_DOCS,
  },
]

/** Seções fixas da página, fora dos grupos de modelos. */
export const METODOLOGIA_INTRO_SECTIONS = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'definicoes', label: 'Definições' },
  { id: 'premissas', label: 'Premissas atuais' },
  { id: 'liquidez', label: 'Liquidez mínima' },
] as const

export const METODOLOGIA_OUTRO_SECTIONS = [
  { id: 'onde-aportar', label: 'Onde aportar' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'limitacoes', label: 'Limitações gerais' },
] as const

/** Todos os ids de seção da página (âncoras válidas em `/metodologia#…`). */
export function metodologiaSectionIds(): string[] {
  return [
    ...METODOLOGIA_INTRO_SECTIONS.map((s) => s.id),
    ...METHODOLOGY_GROUPS.flatMap((group) => [group.id, ...group.docs.map((doc) => doc.id)]),
    ...METODOLOGIA_OUTRO_SECTIONS.map((s) => s.id),
  ]
}
