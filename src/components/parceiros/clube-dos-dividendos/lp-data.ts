export const LP_META = {
  title: 'Preço Justo AI para o Clube dos Dividendos | Análise de Ações B3',
  description:
    'Ferramenta de análise fundamentalista usada pelo Clube dos Dividendos. 8 modelos de valuation, radar de dividendos com projeção de 12 meses, screening avançado e IA para investidores da B3.',
  ogTitle: 'Análise Fundamentalista com o Clube dos Dividendos | Preço Justo AI',
  ogDescription:
    'Descubra o preço justo de qualquer ação da B3. A plataforma que o Clube dos Dividendos usa para encontrar as melhores pagadoras de dividendos com base em dados reais.',
  canonical: '/parceiros/clube-dos-dividendos',
}

export const BRUNO_ENDORSEMENT = {
  name: 'Bruno Mazzoni',
  role: 'Fundador do Clube dos Dividendos',
  quote:
    'O Preço Justo AI é a ferramenta que uso para avaliar cada ativo antes de recomendar para os membros do clube. 8 modelos de valuation lado a lado, radar de dividendos com projeção real — nada mais prático.',
  initials: 'BM',
}

export const HERO = {
  badge: 'Parceria Exclusiva · Clube dos Dividendos',
  headline: 'A ferramenta que o Clube dos Dividendos usa para analisar ações',
  subheadline:
    'Recomendada por Bruno Mazzoni. Calcule o preço justo, encontre as melhores pagadoras de dividendos e tome decisões com dados reais — não com achismo.',
  ctaPrimary: { label: 'Quero acesso Premium', href: '#planos' },
  ctaSecondary: { label: 'Testar grátis por 1 dia', href: '/register' },
  trust: ['Desconto exclusivo do clube', 'Cancele quando quiser', 'Dados atualizados diariamente'],
}

export const STATS = [
  { value: '500+', label: 'Ativos analisados' },
  { value: '8', label: 'Modelos de valuation' },
  { value: '12 meses', label: 'Projeção de dividendos' },
  { value: '100%', label: 'Baseado em dados reais' },
]

export const VALUATION_MODELS = [
  {
    id: 'graham',
    name: 'Graham',
    description:
      'Modelo clássico de Benjamin Graham. Ideal para encontrar ações com margem de segurança. Compra quando o preço está abaixo do valor intrínseco calculado pelo P/L e P/VPA.',
    formula: '√(22,5 × LPA × VPA)',
    example: 'TAEE11: LPA R$3,20 · VPA R$18,50 → Preço Justo: R$36,44',
    tag: 'FREE',
  },
  {
    id: 'bazin',
    name: 'Bazin',
    description:
      'Criado por Décio Bazin. Foca em empresas que pagam dividendos acima de 6% ao ano. Excelente para investidores de renda passiva que buscam fluxo constante.',
    formula: 'Preço Justo = Dividendo Anual ÷ 0,06',
    example: 'ITUB4: DPA R$1,80 → Preço Justo Bazin: R$30,00',
    tag: 'PREMIUM',
  },
  {
    id: 'pl-justo',
    name: 'P/L Justo',
    description:
      'Compara o P/L atual com a média histórica do setor. Identifica empresas sendo negociadas com desconto ou prêmio em relação ao histórico.',
    formula: 'P/L Justo = LPA × P/L médio histórico do setor',
    example: 'BBAS3: LPA R$9,20 × P/L médio 7x → Preço Justo: R$64,40',
    tag: 'PREMIUM',
  },
  {
    id: 'gordon',
    name: 'Gordon (DDM)',
    description:
      'Dividend Discount Model de Myron Gordon. Valua a empresa com base no fluxo futuro de dividendos descontado. Perfeito para empresas maduras e consistentes.',
    formula: 'Preço = DPA ÷ (Ke − g)',
    example: 'WEGE3: DPA R$0,50 · Ke 12% · g 8% → Preço Justo: R$12,50',
    tag: 'PREMIUM',
  },
  {
    id: 'dcf',
    name: 'DCF Simplificado',
    description:
      'Fluxo de Caixa Descontado adaptado para pequenos investidores. Projeta o fluxo de caixa livre nos próximos 5 anos e desconta pela taxa mínima de atratividade.',
    formula: 'VP = Σ FCL_t ÷ (1+i)^t + VT',
    example: 'LREN3: FCL R$2,1/ação · crescimento 10% · TMA 13% → Preço Justo: R$23,80',
    tag: 'PREMIUM',
  },
  {
    id: 'ev-ebitda',
    name: 'EV/EBITDA',
    description:
      'Compara o valor de mercado total (incluindo dívida) com o EBITDA. Amplamente usado para comparar empresas do mesmo setor ignorando diferenças de alavancagem.',
    formula: 'Preço Justo = EV/EBITDA setor × EBITDA/ação − Dívida Líquida/ação',
    example: 'VALE3: EV/EBITDA 5x · EBITDA/ação R$18,40 → Preço Justo: R$74,20',
    tag: 'PREMIUM',
  },
  {
    id: 'roe',
    name: 'ROE + P/VPA',
    description:
      'Relaciona o retorno sobre o patrimônio (ROE) com o múltiplo P/VPA para identificar empresas que entregam alto retorno sendo negociadas a prêmio justo.',
    formula: 'P/VPA Justo = ROE ÷ Ke',
    example: 'ITSA4: ROE 18% · Ke 12% → P/VPA Justo 1,5x · Preço Justo: R$12,90',
    tag: 'PREMIUM',
  },
  {
    id: 'nav',
    name: 'NAV (Ativos Líquidos)',
    description:
      'Net Asset Value — avalia o quanto vale o patrimônio líquido da empresa por ação. Especialmente útil para FIIs, holdings e empresas com ativos tangíveis relevantes.',
    formula: 'NAV = (Ativo Total − Passivo Total) ÷ Ações em Circulação',
    example: 'BRCR11: Patrimônio R$1,2B · 120M cotas → NAV: R$100/cota',
    tag: 'PREMIUM',
  },
]

export const FAQ_ITEMS = [
  {
    question: 'O Preço Justo AI é confiável para tomar decisões de investimento?',
    answer:
      'A plataforma apresenta rankings e cálculos como benchmarks quantitativos, não como recomendações de investimento. Seguimos as diretrizes da CVM. Os dados são atualizados diariamente a partir de fontes como BRAPI, Fundamentus e Yahoo Finance. Use como ferramenta de análise complementar à sua própria due diligence.',
  },
  {
    question: 'Quais ativos estão disponíveis na plataforma?',
    answer:
      'Analisamos ações (B3), FIIs (fundos imobiliários), BDRs, ETFs e índices como Ibovespa, IFIX e S&P500. No total, mais de 500 ativos com dados fundamentalistas atualizados.',
  },
  {
    question: 'O que está incluído na conta gratuita?',
    answer:
      'No plano gratuito você tem acesso ao modelo Graham de valuation, top 10 do ranking de ações, comparação básica entre ativos e calculadoras de Dividend Yield. Suficiente para começar a analisar ações fundamentalistas.',
  },
  {
    question: 'Quais vantagens tem o plano Premium para quem investe em dividendos?',
    answer:
      'No Premium você acessa: radar de dividendos ilimitado com projeção de 12 meses, score de sustentabilidade dos dividendos, calendário de pagamentos por ativo, todos os 8 modelos de valuation (incluindo Bazin e Gordon focados em dividendos), screening avançado com filtros de DY mínimo, e análise por IA para cada empresa.',
  },
  {
    question: 'Como funciona o desconto exclusivo do Clube dos Dividendos?',
    answer:
      'Membros do Clube dos Dividendos têm acesso a um checkout exclusivo com condições especiais de assinatura. Basta clicar no botão "Ver planos com desconto" nessa página para acessar a oferta do clube.',
  },
  {
    question: 'O score de sustentabilidade de dividendos é calculado como?',
    answer:
      'Analisamos 4 critérios: (1) payout ratio — empresa não distribui mais do que ganha; (2) cobertura de lucro — lucro líquido cobre os dividendos pagos; (3) nível de endividamento — dívida não compromete a capacidade de pagar; (4) tendência de crescimento do lucro nos últimos 3 anos. O score final vai de 0 a 100.',
  },
  {
    question: 'Posso cancelar o Premium a qualquer momento?',
    answer:
      'Sim, sem fidelidade e sem taxa de cancelamento. O acesso permanece até o fim do período pago. O cancelamento é feito diretamente pelo painel de configurações da sua conta.',
  },
]

export const TESTIMONIALS = [
  {
    name: 'Rodrigo M.',
    role: 'Investidor · 5 anos de B3',
    text: 'Uso o Preço Justo toda semana antes de qualquer aporte. Os 8 modelos de valuation lado a lado me poupam horas de planilha. Vale muito pelo preço.',
    initials: 'RM',
  },
  {
    name: 'Carla F.',
    role: 'Membro do Clube dos Dividendos',
    text: 'O radar de dividendos com projeção de 12 meses é exatamente o que eu precisava. Consigo montar minha carteira de renda passiva com dados concretos.',
    initials: 'CF',
  },
  {
    name: 'Paulo H.',
    role: 'Analista autônomo',
    text: 'O screening avançado me permitiu filtrar ações por DY mínimo, payout e ROE em segundos. Antes levava horas fazendo isso manualmente.',
    initials: 'PH',
  },
]

export const RADAR_TABS = [
  {
    id: 'radar',
    label: 'Radar de Dividendos',
    title: 'Encontre as melhores pagadoras de dividendos',
    description:
      'Ranking completo das ações e FIIs com maior Dividend Yield projetado para os próximos 12 meses. Filtre por tipo de ativo, setor e frequência de pagamento.',
    preview: [
      { ticker: 'TAEE11', dy: '12,4%', tipo: 'Ação', sustentabilidade: 'Alta' },
      { ticker: 'BBSE3', dy: '9,8%', tipo: 'Ação', sustentabilidade: 'Alta' },
      { ticker: 'ITSA4', dy: '7,2%', tipo: 'Ação', sustentabilidade: 'Média' },
      { ticker: 'HGLG11', dy: '11,1%', tipo: 'FII', sustentabilidade: 'Alta' },
    ],
    badge: 'PREMIUM',
    note: 'Dados ilustrativos',
  },
  {
    id: 'projecao',
    label: 'Projeção 12 meses',
    title: 'Calendário de dividendos com projeções mensais',
    description:
      'Veja quando cada empresa costuma pagar dividendos e quanto você pode esperar receber por ação ao longo do próximo ano com base no histórico de pagamentos.',
    months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    note: 'Dados ilustrativos',
    badge: 'PREMIUM',
  },
]

export const RANKING_PREVIEW = [
  { pos: 1, ticker: 'BBAS3', modelo: 'Graham', desconto: '−32%', dy: '9,1%', score: 94 },
  { pos: 2, ticker: 'ITSA4', modelo: 'Bazin', desconto: '−28%', dy: '7,4%', score: 91 },
  { pos: 3, ticker: 'TAEE11', modelo: 'Gordon', desconto: '−25%', dy: '12,4%', score: 88 },
  { pos: 4, ticker: 'BBSE3', modelo: 'P/L Justo', desconto: '−22%', dy: '9,8%', score: 85 },
  { pos: 5, ticker: 'SAPR11', modelo: 'Graham', desconto: '−19%', dy: '8,3%', score: 82 },
]

export const SCREENING_FILTERS = [
  { label: 'DY mínimo', example: '≥ 6%' },
  { label: 'P/L máximo', example: '≤ 12x' },
  { label: 'Payout máximo', example: '≤ 80%' },
  { label: 'ROE mínimo', example: '≥ 15%' },
  { label: 'Setor', example: 'Financeiro, Energia...' },
  { label: 'Tipo de ativo', example: 'Ação, FII, BDR' },
]

export const MONITORING_EXAMPLE = {
  ticker: 'TAEE11',
  alert: 'Preço abaixo do Justo',
  detail: 'TAEE11 está sendo negociada a R$34,20 — 18% abaixo do preço justo Graham (R$41,70). Meta de compra atingida.',
  time: 'há 2 horas',
}

export const AI_EXAMPLE = {
  ticker: 'BBAS3',
  summary:
    'Banco do Brasil demonstra fundamentos sólidos com ROE de 20,3% e payout de 40%. O P/L atual de 5,4x está 31% abaixo da média histórica do setor bancário (7,8x), indicando potencial de valorização. Risco principal: concentração em crédito agro e exposição a inadimplência em cenário de alta de juros.',
  verdict: 'Potencial de compra',
  score: 87,
}

export const SUSTAINABILITY_LEVELS = [
  {
    label: 'Alta Sustentabilidade',
    color: 'emerald',
    criteria: 'Payout ≤ 60% · Lucro cobre dividendos · Dívida controlada · Lucro em crescimento',
    example: 'TAEE11 · Score 91',
  },
  {
    label: 'Sustentabilidade Média',
    color: 'amber',
    criteria: 'Payout entre 60–80% · Lucro estável · Dívida aceitável',
    example: 'SAPR11 · Score 64',
  },
  {
    label: 'Baixa Sustentabilidade',
    color: 'red',
    criteria: 'Payout > 80% · Lucro cadente ou instável · Alta alavancagem',
    example: 'Evitar dividendos que não se sustentam',
  },
]

export const PRICING_FEATURES_FREE = [
  '1 dia para explorar a plataforma',
  'Modelo Graham de valuation',
  'Top 10 do ranking de ações',
  'Calculadora de Dividend Yield',
  'Comparação básica de ativos',
]

export const FREE_TRIAL_NOTE = 'Após o período de teste, acesso básico permanece. Upgrade a qualquer momento — sua vinculação ao Clube dos Dividendos é mantida.'

export const PRICING_FEATURES_PREMIUM = [
  'Todos os 8 modelos de valuation',
  'Radar de dividendos ilimitado',
  'Projeção de dividendos 12 meses',
  'Score de sustentabilidade',
  'Screening avançado com 20+ filtros',
  'Ranking ilimitado (500+ ativos)',
  'Análise setorial comparativa',
  'Gestão de carteira virtual',
  'Backtesting de estratégias',
  'Análise por IA (Gemini)',
  'Monitoramento e alertas de preço',
  'Suporte prioritário',
]
