'use client'

/**
 * FAB do Ben: botão flutuante que abre o chat. Montado uma vez no layout raiz.
 * Só aparece com sessão e some em checkout, login, cadastro, oferta e admin.
 *
 * Regra: o botão nunca fica parado sobre conteúdo.
 * - Some (fade + deslize curto; só fade com `prefers-reduced-motion`) enquanto a página rola para baixo
 *   e volta ao rolar para cima ou após 1,2 s sem rolagem.
 * - Em repouso, se a posição padrão cair sobre um elemento interativo, uma tabela (`table`,
 *   `[role=grid]`), um número (`tabular-nums`, `[data-num]`) ou o rótulo colado a ele (bloco de KPI), um título, uma linha de abas, a navegação
 *   de seções do ativo, o elemento focado ou qualquer coisa marcada com `data-ben-fab-avoid`, o botão
 *   sobe até a primeira faixa livre (sempre acima da bottom nav e da safe area). Sem faixa livre, vira
 *   uma aba de 44 × 48 px colada à borda direita (procurando até o topo da tela); se nem a aba cabe,
 *   fica escondido até a próxima parada.
 * - No desktop a partir de `xl`, quando a calha à direita do conteúdo (`max-w-7xl`) comporta o botão,
 *   ele fica centralizado nessa calha e não some ao rolar.
 * O foco pelo teclado sempre o mostra. Com o chat aberto, nada é observado.
 * Monta o painel único do Ben (`BenPanel`, carregado na primeira abertura), que qualquer ponto da app abre
 * com `openBenPanel`. Pelo botão, o painel continua a conversa atual só se ela for desta tela.
 */

import { useEffect, useRef, useState, type RefObject } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { contextKey } from './ben/ben-chat-utils'
import { openBenPanel, useBenPanel } from './ben/panel-store'
import { useBenPageContext } from './ben/use-ben-page-context'
import { isAppChromeHidden } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const BenPanel = dynamic(() => import('./ben/ben-panel').then((m) => m.BenPanel), { ssr: false })

/** Deslocamento mínimo (px) para considerar mudança de direção da rolagem. */
const SCROLL_DELTA = 8
/** Perto do topo o botão não some ao rolar. */
const TOP_ZONE = 64
/** Tempo sem rolagem até o botão voltar (ms). */
const IDLE_REVEAL_MS = 1200
/** Espera após a última rolagem (ou foco, resize) para recalcular a posição (ms). */
const SETTLE_MS = 150
/** Intervalo mínimo entre recálculos disparados por mudanças no DOM (páginas com conteúdo animado). */
const MUTATION_THROTTLE_MS = 500

/** Números exibidos (valores, variações). */
const NUMERIC_SELECTOR = '[data-num], .tabular-nums'
/** Contrato com as páginas: abas, navegação de seções do ativo e conteúdo marcado. */
const AVOID_SELECTOR = '[role="tablist"], nav[aria-label="Seções da página"], [data-ben-fab-avoid]'
/** Não pode ser coberto em nenhum ponto da caixa: alvos de toque, tabelas, conteúdo marcado. */
const BLOCKING_SELECTOR = [
  AVOID_SELECTOR,
  'table',
  '[role="grid"]',
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="combobox"]',
].join(', ')
/** Também bloqueados na caixa inteira: títulos, números e KPIs. */
const TEXT_SELECTOR = ['h1', 'h2', 'h3', 'h4', 'dt', 'dd', '[data-slot="stat"]', NUMERIC_SELECTOR].join(', ')
/**
 * Um rótulo curto colado a um número (KPI, "Margem de segurança" acima do valor) faz parte do número:
 * o botão evita o texto do bloco (rótulo e valor). Sobe no máximo estes níveis e só considera blocos baixos.
 */
const STAT_GROUP_DEPTH = 3
const STAT_GROUP_MAX_HEIGHT = 120

const LG_QUERY = '(min-width: 1024px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const BUTTON_SIZE = 48
/** Largura da aba recolhida na borda (altura igual à do botão): alvo de toque de 44 px. */
const TAB_WIDTH = 44
/** Largura máxima do conteúdo (`max-w-7xl`), para achar a calha no desktop. */
const CONTENT_MAX = 1280
/** Folga mínima entre o botão e o conteúdo testado (px). */
const CLEARANCE = 4
/** Passo da varredura vertical (px). */
const STEP = 4
/** Teto da subida: nunca acima disto do topo da viewport (header fixo). */
const MIN_TOP = 72
/** Subida máxima a partir da posição padrão (px). */
const MAX_LIFT = 320
/** Deslocamento para baixo quando escondido pela rolagem (px). */
const HIDDEN_SHIFT = 16

type FabMode = 'button' | 'tab' | 'blocked'

interface FabPlacement {
  mode: FabMode
  /** Quanto o botão sobe a partir da posição padrão (px). */
  lift: number
  /** Distância da borda direita (px); `null` usa as classes padrão. */
  right: number | null
  /** Está na calha do desktop (não precisa sumir ao rolar). */
  gutter: boolean
}

const DEFAULT_PLACEMENT: FabPlacement = { mode: 'button', lift: 0, right: null, gutter: false }

/** Cache por cálculo (uma varredura): grupos de KPI e áreas pintadas já medidas. */
interface PlacementCache {
  statGroup: WeakMap<Element, Element | null>
  paint: WeakMap<Element, DOMRect[]>
}

function createPlacementCache(): PlacementCache {
  return { statGroup: new WeakMap(), paint: new WeakMap() }
}

/** Bloco baixo que contém um número e o elemento (o rótulo de um KPI, por exemplo), ou `null`. */
function statGroupOf(el: Element, cache: PlacementCache): Element | null {
  const cached = cache.statGroup.get(el)
  if (cached !== undefined) return cached
  let result: Element | null = null
  let node: Element | null = el
  for (let depth = 0; node && node !== document.body && depth <= STAT_GROUP_DEPTH; depth++) {
    if (node.getBoundingClientRect().height > STAT_GROUP_MAX_HEIGHT) break
    if (node.matches(NUMERIC_SELECTOR) || node.querySelector(NUMERIC_SELECTOR)) {
      result = node
      break
    }
    node = node.parentElement
  }
  cache.statGroup.set(el, result)
  return result
}

/** Retângulos pintados de um bloco: cada linha de texto e cada ícone/imagem. */
function paintedRects(el: Element, cache: PlacementCache): DOMRect[] {
  const cached = cache.paint.get(el)
  if (cached) return cached
  const rects: DOMRect[] = []
  const range = document.createRange()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) rects.push(rect)
  }
  for (const media of el.querySelectorAll('svg, img')) {
    const rect = media.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) rects.push(rect)
  }
  cache.paint.set(el, rects)
  return rects
}

/** O ponto (x, y) está sobre conteúdo que o botão não pode cobrir? Ignora o próprio botão. */
function isBlockedPoint(x: number, y: number, button: HTMLElement, cache: PlacementCache): boolean {
  for (const el of document.elementsFromPoint(x, y)) {
    if (button.contains(el)) continue
    if (el.closest(BLOCKING_SELECTOR) || el.closest(TEXT_SELECTOR)) return true
    // Rótulo de um KPI: a caixa do bloco pode ser larga, então só a área pintada (rótulo + valor) conta
    const group = statGroupOf(el, cache)
    if (!group) return false
    return paintedRects(group, cache).some(
      (rect) =>
        x >= rect.left - CLEARANCE && x <= rect.right + CLEARANCE && y >= rect.top - CLEARANCE && y <= rect.bottom + CLEARANCE
    )
  }
  return false
}

/**
 * Menor subida (múltipla de `STEP`, até `maxLift`) em que a faixa [left, right] × altura do botão fica
 * livre, ou `null`. As linhas são amostradas uma vez (5 pontos por linha) e reaproveitadas.
 */
function findFreeLift(
  button: HTMLElement,
  left: number,
  right: number,
  restBottom: number,
  maxLift: number,
  focusRect: DOMRect | null
): number | null {
  const xs = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(left + 1 + f * (right - left - 2)))
  const top = restBottom - BUTTON_SIZE - maxLift - CLEARANCE
  const bottom = restBottom + CLEARANCE
  const rowCount = Math.floor((bottom - top) / STEP) + 1
  const focusHits = focusRect !== null && focusRect.right > left && focusRect.left < right
  const blocked: boolean[] = []
  const cache = createPlacementCache()
  for (let i = 0; i < rowCount; i++) {
    const y = top + i * STEP
    blocked.push(
      (focusHits && y >= focusRect.top && y <= focusRect.bottom) || xs.some((x) => isBlockedPoint(x, y, button, cache))
    )
  }
  for (let lift = 0; lift <= maxLift; lift += STEP) {
    const from = Math.floor((restBottom - lift - BUTTON_SIZE - CLEARANCE - top) / STEP)
    const to = Math.ceil((restBottom - lift + CLEARANCE - top) / STEP)
    let free = true
    for (let i = Math.max(0, from); i <= Math.min(rowCount - 1, to); i++) {
      if (blocked[i]) {
        free = false
        break
      }
    }
    if (free) return lift
  }
  return null
}

/** Calcula onde o botão pode ficar parado sem cobrir conteúdo. */
function computePlacement(button: HTMLElement): FabPlacement {
  const viewportW = document.documentElement.clientWidth
  const viewportH = window.innerHeight
  const desktop = window.matchMedia(LG_QUERY).matches
  // `bottom` computado já inclui a altura da bottom nav e a safe area
  const restBottom = viewportH - (parseFloat(window.getComputedStyle(button).bottom) || 0)

  const gutterW = (viewportW - CONTENT_MAX) / 2
  const gutter = gutterW >= BUTTON_SIZE + 32
  const right = gutter ? Math.floor((gutterW - BUTTON_SIZE) / 2) : desktop ? 24 : 16
  const maxLift = Math.max(0, Math.min(MAX_LIFT, restBottom - BUTTON_SIZE - MIN_TOP))

  const active = document.activeElement
  const focusRect =
    active instanceof HTMLElement && active !== document.body && !button.contains(active)
      ? active.getBoundingClientRect()
      : null

  const buttonLift = findFreeLift(button, viewportW - right - BUTTON_SIZE, viewportW - right, restBottom, maxLift, focusRect)
  if (buttonLift !== null) return { mode: 'button', lift: buttonLift, right, gutter }

  const tabLift = findFreeLift(button, viewportW - TAB_WIDTH, viewportW, restBottom, maxLift, focusRect)
  if (tabLift !== null) return { mode: 'tab', lift: tabLift, right: 0, gutter }

  // Páginas densas (cards com KPIs na coluna direita): procura uma faixa livre até o topo antes de esconder
  const fullLift = Math.max(0, restBottom - BUTTON_SIZE - MIN_TOP)
  if (fullLift > maxLift) {
    const farLift = findFreeLift(button, viewportW - TAB_WIDTH, viewportW, restBottom, fullLift, focusRect)
    if (farLift !== null) return { mode: 'tab', lift: farLift, right: 0, gutter }
  }

  return { mode: 'blocked', lift: 0, right, gutter }
}

function samePlacement(a: FabPlacement, b: FabPlacement): boolean {
  return a.mode === b.mode && a.lift === b.lift && a.right === b.right && a.gutter === b.gutter
}

interface FabState {
  /** Escondido pela rolagem para baixo. */
  scrolledAway: boolean
  placement: FabPlacement
  reducedMotion: boolean
}

function useFabState(buttonRef: RefObject<HTMLButtonElement | null>, pathname: string | null, paused: boolean): FabState {
  const [scrolledAway, setScrolledAway] = useState(false)
  const [placement, setPlacement] = useState<FabPlacement>(DEFAULT_PLACEMENT)
  const [reducedMotion, setReducedMotion] = useState(false)
  const gutterRef = useRef(false)

  useEffect(() => {
    setScrolledAway(false)
    // Chat aberto: o botão fica invisível, então não há o que observar.
    if (paused) return
    setReducedMotion(window.matchMedia(REDUCED_MOTION_QUERY).matches)
    let lastY = window.scrollY
    let settleTimer = 0
    let idleTimer = 0

    const place = () => {
      settleTimer = 0
      const button = buttonRef.current
      if (!button) return
      const next = computePlacement(button)
      gutterRef.current = next.gutter
      setPlacement((current) => (samePlacement(current, next) ? current : next))
    }
    const schedulePlace = (delay = SETTLE_MS) => {
      if (!settleTimer) settleTimer = window.setTimeout(place, delay)
    }
    const onSettle = () => schedulePlace()

    const onScroll = () => {
      const y = window.scrollY
      if (gutterRef.current || y < TOP_ZONE) {
        setScrolledAway(false)
        lastY = y
      } else if (y - lastY > SCROLL_DELTA) {
        setScrolledAway(true)
        lastY = y
      } else if (lastY - y > SCROLL_DELTA) {
        setScrolledAway(false)
        lastY = y
      }
      // A posição só vale com a página parada: recalcula ao fim de cada rolagem
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(place, SETTLE_MS)
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => setScrolledAway(false), IDLE_REVEAL_MS)
    }

    place()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onSettle)
    document.addEventListener('focusin', onSettle)
    document.addEventListener('focusout', onSettle)
    // Conteúdo carregado depois (tabelas, abas, blocos marcados) também muda a posição livre
    const observer = new MutationObserver(() => schedulePlace(MUTATION_THROTTLE_MS))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onSettle)
      document.removeEventListener('focusin', onSettle)
      document.removeEventListener('focusout', onSettle)
      observer.disconnect()
      window.clearTimeout(settleTimer)
      window.clearTimeout(idleTimer)
    }
  }, [buttonRef, pathname, paused])

  return { scrolledAway, placement, reducedMotion }
}

export function BenChatFAB() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { open: isOpen } = useBenPanel()
  const { context } = useBenPageContext()
  // O painel (e o markdown do chat) só carrega quando alguém abre o Ben
  const [panelLoaded, setPanelLoaded] = useState(false)
  const [focused, setFocused] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { scrolledAway, placement, reducedMotion } = useFabState(buttonRef, pathname, isOpen)

  useEffect(() => {
    if (isOpen) setPanelLoaded(true)
  }, [isOpen])

  if (!session || isAppChromeHidden(pathname)) {
    return null
  }

  const tab = placement.mode === 'tab'
  // Fora do caminho, mas ainda alcançável pelo teclado (o foco o mostra de novo)
  const away = !focused && (scrolledAway || placement.mode === 'blocked')
  const shift = away && !reducedMotion ? HIDDEN_SHIFT : 0

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => openBenPanel({ pageKey: contextKey(context), returnFocus: buttonRef.current })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Abrir chat do Ben"
        style={{
          right: placement.right ?? undefined,
          translate: `0 ${shift - placement.lift}px`,
        }}
        className={cn(
          'fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 touch-manipulation border border-border bg-background shadow-md transition-[translate,opacity,scale] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none lg:right-6 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]',
          tab
            ? 'flex h-12 w-11 items-center justify-center rounded-l-lg border-r-0'
            : 'size-12 overflow-hidden rounded-full hover:scale-105 active:scale-95',
          away && 'pointer-events-none opacity-0',
          // Mantido montado com o chat aberto para o foco voltar a ele ao fechar
          isOpen && 'invisible'
        )}
      >
        <Image
          src="/ben.png"
          alt=""
          width={48}
          height={48}
          className={tab ? 'size-7 rounded-full object-cover' : 'size-full object-cover'}
        />
      </button>

      {panelLoaded && <BenPanel />}
    </>
  )
}
