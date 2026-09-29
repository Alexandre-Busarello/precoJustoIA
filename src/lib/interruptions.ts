/**
 * Política de interrupções: no máximo UM elemento exibido automaticamente (modal, card de saída,
 * onboarding, notificação) por visualização de página.
 *
 * Uso:
 *   if (claimModalSlot('exit-intent')) show()   // false se outro componente já ocupou o slot
 *   releaseModalSlot('exit-intent')             // ao fechar; o slot segue usado até a próxima página
 *
 * Uma "visualização de página" termina quando a rota muda (o ShellProvider chama `startPageView`)
 * ou quando o documento é recarregado. O estado vive no módulo e é espelhado em sessionStorage
 * apenas para sobreviver à reavaliação do módulo no mesmo documento (ex.: HMR); um recarregamento
 * gera outro documento e, portanto, uma nova visualização.
 */

const STORAGE_KEY = 'pja-modal-slot'

interface SlotState {
  id: string
  path: string
  /** Identifica o documento (performance.timeOrigin); muda a cada carregamento completo. */
  doc: number
}

let current: SlotState | null = null

function currentPath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname
}

function documentId(): number {
  try {
    return Math.round(performance.timeOrigin)
  } catch {
    return 0
  }
}

function readStored(): SlotState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as SlotState
    return state.doc === documentId() ? state : null
  } catch {
    return null
  }
}

function writeStored(state: SlotState | null) {
  try {
    if (state) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage indisponível (modo privado, bloqueado): o estado do módulo basta
  }
}

function activeSlot(): SlotState | null {
  const path = currentPath()
  if (!current) current = readStored()
  return current && current.path === path ? current : null
}

/**
 * Marca o início de uma visualização de página. Chamado pelo shell a cada troca de pathname:
 * libera o slot ocupado em outra rota (voltar para uma rota já visitada conta como nova visualização).
 */
export function startPageView(path: string): void {
  if (typeof window === 'undefined') return
  if (!current) current = readStored()
  if (current && current.path !== path) {
    current = null
    writeStored(null)
  }
}

/** Tenta ocupar o slot de interrupção desta página. Retorna true se `id` pode ser exibido. */
export function claimModalSlot(id: string): boolean {
  if (typeof window === 'undefined') return false
  const active = activeSlot()
  if (active) return active.id === id
  current = { id, path: currentPath(), doc: documentId() }
  writeStored(current)
  return true
}

/**
 * Libera o slot ocupado por `id`. O slot continua marcado como usado nesta visualização
 * (uma interrupção por página), e outro `id` só entra na próxima visualização.
 */
export function releaseModalSlot(id: string): void {
  if (typeof window === 'undefined') return
  const active = activeSlot()
  if (active && active.id === id) {
    current = { ...active, id: `${id}:done` }
    writeStored(current)
  }
}

/** true se algum componente já usou o slot nesta visualização. */
export function isModalSlotTaken(): boolean {
  if (typeof window === 'undefined') return false
  return activeSlot() !== null
}
