'use client'

/**
 * FAB do Ben: botão flutuante que abre o chat. Montado uma vez no layout raiz.
 * Só aparece com sessão e some em checkout, login, cadastro, oferta e admin.
 * No mobile (abaixo de `lg`): círculo de 48 px acima da bottom nav (com safe area), que se esconde
 * ao rolar para baixo, volta ao rolar para cima ou ao receber foco pelo teclado, e sai do caminho
 * quando uma linha de abas (`role="tablist"`), a navegação de seções do ativo ou um elemento com
 * `data-ben-fab-avoid` passa por baixo dele.
 * Também some com o chat aberto; enquanto o chat está aberto, a rolagem e as mudanças no DOM não são observadas.
 * O contexto da página (ticker etc.) é lido do pathname pelo próprio chat.
 */

import { useEffect, useRef, useState, type RefObject } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BenChatSidebar } from './ben-chat-sidebar'
import { isAppChromeHidden } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** Deslocamento mínimo (px) para considerar mudança de direção da rolagem. */
const SCROLL_DELTA = 8
/** Perto do topo o botão fica visível (salvo colisão). */
const TOP_ZONE = 64
/** Linhas de abas, a navegação fixa de seções das páginas de ativo e conteúdo marcado. */
const AVOID_SELECTOR = '[role="tablist"], nav[aria-label="Seções da página"], [data-ben-fab-avoid]'
const MOBILE_QUERY = '(max-width: 1023.98px)'

/** Deslocamento (px) do botão quando escondido; igual a `translate-y-4`. */
const HIDDEN_SHIFT = 16

/**
 * Há abas ou conteúdo marcado sob o botão? A área testada é fixa, calculada a partir da posição de
 * repouso do botão (viewport, `bottom`/`right` computados e tamanho sem transform), e vai de 16 px
 * acima dele até 16 px abaixo. Assim o teste não depende do deslocamento atual do botão e não oscila
 * entre visível e escondido quando uma borda fica nessa faixa.
 */
function overlapsAvoidedContent(button: HTMLElement): boolean {
  const style = window.getComputedStyle(button)
  const viewportW = document.documentElement.clientWidth
  const viewportH = window.innerHeight
  const right = viewportW - (parseFloat(style.right) || 0)
  const left = right - button.offsetWidth
  const bottom = viewportH - (parseFloat(style.bottom) || 0)
  const top = bottom - button.offsetHeight
  const zoneTop = top - HIDDEN_SHIFT
  const zoneBottom = bottom + HIDDEN_SHIFT
  for (const el of document.querySelectorAll(AVOID_SELECTOR)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.right > left && r.left < right && r.bottom > zoneTop && r.top < zoneBottom) return true
  }
  return false
}

interface FabVisibility {
  /** Escondido pela rolagem para baixo (só no mobile). */
  scrolledAway: boolean
  /** Há abas ou conteúdo marcado sob o botão (só no mobile). */
  blocked: boolean
  /** Mostra de novo (foco pelo teclado). */
  reveal: () => void
}

function useFabVisibility(
  buttonRef: RefObject<HTMLButtonElement | null>,
  pathname: string | null,
  paused: boolean
): FabVisibility {
  const [scrolledAway, setScrolledAway] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    setScrolledAway(false)
    // Chat aberto: o botão fica invisível, então não há o que observar.
    if (paused) return
    const mobile = window.matchMedia(MOBILE_QUERY)
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      frame = 0
      const button = buttonRef.current
      setBlocked(mobile.matches && button !== null && overlapsAvoidedContent(button))

      const y = window.scrollY
      if (!mobile.matches || y < TOP_ZONE) setScrolledAway(false)
      else if (y - lastY > SCROLL_DELTA) setScrolledAway(true)
      else if (lastY - y > SCROLL_DELTA) setScrolledAway(false)
      else return
      lastY = y
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Conteúdo carregado depois (abas, blocos marcados) também muda a visibilidade
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [buttonRef, pathname, paused])

  return { scrolledAway, blocked, reveal: () => setScrolledAway(false) }
}

export function BenChatFAB() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { scrolledAway, blocked, reveal } = useFabVisibility(buttonRef, pathname, isOpen)

  if (!session || isAppChromeHidden(pathname)) {
    return null
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        onFocus={reveal}
        aria-label="Abrir chat do Ben"
        className={cn(
          'fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 size-12 touch-manipulation overflow-hidden rounded-full border border-border bg-background shadow-md transition-[translate,opacity,scale] duration-200 hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-95 motion-reduce:transition-none lg:right-6 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]',
          // Fora do caminho, mas ainda alcançável pelo teclado (o foco o mostra de novo)
          (scrolledAway || blocked) && 'pointer-events-none translate-y-4 opacity-0 focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100',
          // Mantido montado com o chat aberto para o foco voltar a ele ao fechar
          isOpen && 'invisible'
        )}
      >
        <Image src="/ben.png" alt="" width={48} height={48} className="size-full object-cover" />
      </button>

      <BenChatSidebar open={isOpen} onOpenChange={setIsOpen} returnFocusRef={buttonRef} />
    </>
  )
}
