// Sistema de Dicas Dinâmicas para Dashboard
// Baseado no comportamento e experiência do usuário

export interface DashboardTip {
  id: string
  title: string
  description: string
  cta: string
  ctaLink: string
  icon: '💡' | '🚀' | '📊' | '🎯' | '⚡' | '🔥' | '✨' | '📈' | '🎓' | '💰'
  color: 'violet' | 'blue' | 'green' | 'orange' | 'red' | 'emerald'
  priority: number // Maior = mais prioritário
  condition: (stats: DashboardTipContext) => boolean
}

export interface DashboardTipContext {
  totalRankings: number
  hasUsedBacktest: boolean
  hasUsedComparator: boolean
  isPremium: boolean
  daysSinceLastRanking?: number
  hasCreatedPortfolio: boolean
}

export const DASHBOARD_TIPS: DashboardTip[] = [
  // NOVOS USUÁRIOS (0 rankings)
  {
    id: 'first-ranking',
    title: '🎓 Comece sua jornada!',
    description: 'Crie seu primeiro ranking usando a Fórmula de Graham e descubra ações subvalorizadas na B3.',
    cta: 'Criar Primeiro Ranking',
    ctaLink: '/ranking',
    icon: '🚀',
    color: 'blue',
    priority: 100,
    condition: (ctx) => ctx.totalRankings === 0
  },
  {
    id: 'explore-metodologia',
    title: '📚 Entenda as metodologias',
    description: 'Conheça os 8 modelos de análise disponíveis e escolha o que melhor se encaixa no seu perfil.',
    cta: 'Ver Metodologias',
    ctaLink: '/metodologia',
    icon: '🎓',
    color: 'violet',
    priority: 90,
    condition: (ctx) => ctx.totalRankings === 0
  },

  // USUÁRIOS INICIANTES (1-3 rankings)
  {
    id: 'try-different-model',
    title: '⚡ Experimente outros modelos',
    description: 'Você já usou Graham! Que tal testar o Greenblatt ou Bazin para ter uma visão complementar?',
    cta: 'Explorar Modelos',
    ctaLink: '/ranking',
    icon: '⚡',
    color: 'orange',
    priority: 80,
    condition: (ctx) => ctx.totalRankings >= 1 && ctx.totalRankings <= 3
  },
  {
    id: 'use-comparator',
    title: '🔥 Compare ações lado a lado',
    description: 'Use o Comparador para analisar até 6 ações simultaneamente e tomar decisões mais informadas.',
    cta: 'Ir para Comparador',
    ctaLink: '/comparador',
    icon: '📊',
    color: 'blue',
    priority: 75,
    condition: (ctx) => ctx.totalRankings >= 1 && !ctx.hasUsedComparator
  },

  // USUÁRIOS INTERMEDIÁRIOS (4-10 rankings)
  {
    id: 'backtest-strategy',
    title: '📈 Teste suas estratégias',
    description: 'Valide suas escolhas! Use o Backtesting para simular como sua carteira teria performado historicamente.',
    cta: 'Fazer Backtest',
    ctaLink: '/backtest',
    icon: '📈',
    color: 'emerald',
    priority: 70,
    condition: (ctx) => ctx.totalRankings >= 4 && !ctx.hasUsedBacktest
  },
  {
    id: 'sector-analysis',
    title: 'Análise Setorial',
    description: 'Compare as melhores empresas de cada setor da B3 e descubra as maiores oportunidades.',
    cta: 'Ver Análise Setorial',
    ctaLink: '/analise-setorial',
    icon: '📊',
    color: 'blue',
    priority: 65,
    condition: (ctx) => ctx.totalRankings >= 5 && ctx.totalRankings < 7
  },
  {
    id: 'screening-acoes',
    title: '🎯 Screening Customizável',
    description: 'Crie filtros personalizados e encontre ações que atendem exatamente seus critérios de investimento.',
    cta: 'Fazer Screening',
    ctaLink: '/screening-acoes',
    icon: '🎯',
    color: 'emerald',
    priority: 68,
    condition: (ctx) => ctx.totalRankings >= 6 && ctx.totalRankings < 10
  },

  // USUÁRIOS AVANÇADOS (10+ rankings)
  {
    id: 'premium-upgrade',
    title: '💰 Desbloqueie todo potencial',
    description: 'Acesse 8 modelos de análise, IA preditiva, alertas em tempo real e muito mais!',
    cta: 'Conhecer Premium',
    ctaLink: '/planos',
    icon: '✨',
    color: 'violet',
    priority: 60,
    condition: (ctx) => ctx.totalRankings >= 10 && !ctx.isPremium
  },
  {
    id: 'advanced-strategies',
    title: '🔥 Estratégias avançadas',
    description: 'Combine múltiplos modelos para criar sua própria metodologia de análise fundamentalista.',
    cta: 'Explorar Avançado',
    ctaLink: '/screening-acoes',
    icon: '🔥',
    color: 'red',
    priority: 55,
    condition: (ctx) => ctx.totalRankings >= 20 && ctx.isPremium
  },

  // USUÁRIOS INATIVOS
  {
    id: 'return-engagement',
    title: '💡 Que tal uma nova análise?',
    description: 'Faz tempo que você não cria um ranking! O mercado mudou, descubra novas oportunidades.',
    cta: 'Criar Novo Ranking',
    ctaLink: '/ranking',
    icon: '💡',
    color: 'orange',
    priority: 85,
    condition: (ctx) => {
      if (!ctx.daysSinceLastRanking) return false
      return ctx.daysSinceLastRanking >= 7 && ctx.totalRankings > 0
    }
  },

  // PREMIUM FEATURES
  {
    id: 'ai-analysis',
    title: '✨ Análise com IA',
    description: 'Use a inteligência artificial para análise preditiva e insights personalizados sobre ações.',
    cta: 'Testar IA',
    ctaLink: '/ranking',
    icon: '✨',
    color: 'violet',
    priority: 50,
    condition: (ctx) => ctx.isPremium && ctx.totalRankings >= 3
  },

  // FALLBACK - Se nenhuma condição for atendida
  {
    id: 'general-tip',
    title: '📊 Diversifique suas análises',
    description: 'Use diferentes modelos de valuation para ter uma visão completa do mercado de ações.',
    cta: 'Ver Todos os Modelos',
    ctaLink: '/metodologia',
    icon: '📊',
    color: 'blue',
    priority: 1,
    condition: () => true // Sempre disponível como fallback
  }
]

/**
 * Seleciona a melhor dica baseada no contexto do usuário
 */
export function getBestTip(context: DashboardTipContext): DashboardTip {
  const applicableTips = DASHBOARD_TIPS
    .filter(tip => tip.condition(context))
    .sort((a, b) => b.priority - a.priority)
  
  return applicableTips[0] || DASHBOARD_TIPS[DASHBOARD_TIPS.length - 1]
}

/**
 * Retorna múltiplas dicas relevantes
 */
export function getTopTips(context: DashboardTipContext, count: number = 3): DashboardTip[] {
  const applicableTips = DASHBOARD_TIPS
    .filter(tip => tip.condition(context))
    .sort((a, b) => b.priority - a.priority)
  
  return applicableTips.slice(0, count)
}

