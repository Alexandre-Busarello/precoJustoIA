/**
 * Sistema de inferência automática de prioridade para tickets
 * Baseado na categoria e palavras-chave na descrição
 */

export type TicketCategory = 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'ACCOUNT'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

// Palavras-chave que indicam alta prioridade
const HIGH_PRIORITY_KEYWORDS = [
  'urgente', 'crítico', 'bloqueado', 'não funciona', 'erro grave', 'falha crítica',
  'perdi acesso', 'não consigo acessar', 'sistema fora do ar', 'dados perdidos',
  'cobrança incorreta', 'cobrança duplicada', 'cancelar assinatura',
  'urgent', 'critical', 'blocked', 'not working', 'critical error'
]

// Palavras-chave que indicam prioridade média
const MEDIUM_PRIORITY_KEYWORDS = [
  'problema', 'erro', 'bug', 'falha', 'não carrega', 'lento', 'demora',
  'dúvida', 'como fazer', 'não entendo', 'ajuda', 'suporte',
  'problem', 'error', 'bug', 'issue', 'slow', 'help', 'support'
]

// Palavras-chave que indicam baixa prioridade
const LOW_PRIORITY_KEYWORDS = [
  'sugestão', 'melhoria', 'ideia', 'funcionalidade', 'recurso',
  'gostaria', 'seria bom', 'poderia ter', 'feedback',
  'suggestion', 'improvement', 'idea', 'feature', 'would like'
]

/**
 * Infere a prioridade do ticket baseado na categoria e descrição
 */
export function inferTicketPriority(category: TicketCategory, description: string): TicketPriority {
  const lowerDescription = description.toLowerCase()
  
  // 1. Prioridade baseada na categoria
  const categoryPriority = getCategoryBasePriority(category)
  
  // 2. Ajustar baseado em palavras-chave na descrição
  const keywordPriority = getKeywordPriority(lowerDescription)
  
  // 3. Combinar as duas análises (keyword tem precedência)
  if (keywordPriority) {
    return keywordPriority
  }
  
  return categoryPriority
}

/**
 * Prioridade base por categoria
 */
function getCategoryBasePriority(category: TicketCategory): TicketPriority {
  switch (category) {
    case 'BILLING':
      return 'HIGH' // Problemas de cobrança são sempre importantes
    
    case 'ACCOUNT':
      return 'HIGH' // Problemas de conta podem bloquear o usuário
    
    case 'BUG_REPORT':
      return 'MEDIUM' // Bugs precisam ser investigados
    
    case 'TECHNICAL':
      return 'MEDIUM' // Problemas técnicos geralmente são importantes
    
    case 'GENERAL':
      return 'MEDIUM' // Dúvidas gerais são prioridade média
    
    case 'FEATURE_REQUEST':
      return 'LOW' // Solicitações de funcionalidade são menos urgentes
    
    default:
      return 'MEDIUM'
  }
}

/**
 * Prioridade baseada em palavras-chave
 */
function getKeywordPriority(description: string): TicketPriority | null {
  // Verificar palavras de alta prioridade primeiro
  if (HIGH_PRIORITY_KEYWORDS.some(keyword => description.includes(keyword))) {
    return 'HIGH'
  }
  
  // Verificar palavras de baixa prioridade
  if (LOW_PRIORITY_KEYWORDS.some(keyword => description.includes(keyword))) {
    return 'LOW'
  }
  
  // Verificar palavras de prioridade média
  if (MEDIUM_PRIORITY_KEYWORDS.some(keyword => description.includes(keyword))) {
    return 'MEDIUM'
  }
  
  return null // Não encontrou palavras-chave específicas
}

/**
 * Explica por que uma prioridade foi atribuída
 */
export function explainPriorityReason(category: TicketCategory, description: string, priority: TicketPriority): string {
  const lowerDescription = description.toLowerCase()
  
  // Verificar se foi por palavra-chave
  if (HIGH_PRIORITY_KEYWORDS.some(keyword => lowerDescription.includes(keyword))) {
    return `Prioridade ${priority} atribuída devido a palavras-chave que indicam urgência na descrição.`
  }
  
  if (LOW_PRIORITY_KEYWORDS.some(keyword => lowerDescription.includes(keyword))) {
    return `Prioridade ${priority} atribuída devido ao tipo de solicitação (sugestão/melhoria).`
  }
  
  // Se não foi por palavra-chave, foi pela categoria
  switch (category) {
    case 'BILLING':
      return `Prioridade ${priority} atribuída automaticamente para questões de cobrança.`
    case 'ACCOUNT':
      return `Prioridade ${priority} atribuída automaticamente para problemas de conta.`
    case 'BUG_REPORT':
      return `Prioridade ${priority} atribuída automaticamente para relatórios de bug.`
    case 'TECHNICAL':
      return `Prioridade ${priority} atribuída automaticamente para problemas técnicos.`
    case 'FEATURE_REQUEST':
      return `Prioridade ${priority} atribuída automaticamente para solicitações de funcionalidade.`
    default:
      return `Prioridade ${priority} atribuída baseada na categoria e conteúdo do ticket.`
  }
}
