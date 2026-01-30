/**
 * Ben Quick Actions - Gera ações rápidas baseadas na memória do usuário
 */

interface BenMemory {
  id: string
  category: string
  key: string
  content: string
  metadata: any
  importance: number
}

export interface QuickAction {
  label: string
  prompt: string
  icon: string
}

/**
 * Gera Quick Actions baseadas na memória do usuário
 */
export function generateQuickActions(memories: BenMemory[]): QuickAction[] {
  const actions: QuickAction[] = []

  // Empresas favoritas
  const favoriteCompanies = memories.filter(m => 
    m.category === 'COMPANY_INTEREST' && m.importance > 70
  )
  favoriteCompanies.forEach(mem => {
    const ticker = mem.metadata?.ticker
    if (ticker) {
      actions.push({
        label: `Score da ${ticker}`,
        prompt: `Qual é o score atual da ${ticker}?`,
        icon: 'TrendingUp'
      })
    }
  })

  // Setores estudados
  const sectors = memories.filter(m => 
    m.category === 'LEARNING' && m.metadata?.sector
  )
  sectors.slice(0, 2).forEach(mem => {
    const sector = mem.metadata?.sector
    if (sector) {
      actions.push({
        label: `Resumo sobre ${sector}`,
        prompt: `Resuma meu último estudo sobre o setor ${sector}`,
        icon: 'BookOpen'
      })
    }
  })

  // Objetivos de investimento
  const goals = memories.filter(m => 
    m.category === 'INVESTMENT_GOAL' && m.importance > 60
  )
  goals.slice(0, 1).forEach(mem => {
    actions.push({
      label: `Estratégia de ${mem.key}`,
      prompt: `Relembre minha estratégia de ${mem.content}`,
      icon: 'Target'
    })
  })

  return actions.slice(0, 5) // Limitar a 5 ações
}

