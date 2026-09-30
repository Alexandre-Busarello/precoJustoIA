'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEngagementPixel } from '@/hooks/use-engagement-pixel'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface FloatingCTAProps {
  text: string
  href: string
  /** id do hero: a barra aparece depois que ele sai da tela. */
  heroId?: string
  /** id do CTA final: a barra some quando ele entra na tela (ou já passou). */
  hideWhenVisibleId?: string
  /** Fallback sem `heroId`: pixels rolados antes de aparecer. */
  showAfterScroll?: number
  className?: string
}

/**
 * Barra fina de CTA no rodapé da tela, só no mobile.
 * Aparece quando o hero sai da viewport e some quando o CTA final aparece, para não duplicar ações.
 */
export function FloatingCTA({
  text,
  href,
  heroId,
  hideWhenVisibleId,
  showAfterScroll = 300,
  className,
}: FloatingCTAProps) {
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (isDismissed) return

    const update = () => {
      const viewportHeight = window.innerHeight
      const hero = heroId ? document.getElementById(heroId) : null
      const heroGone = hero ? hero.getBoundingClientRect().bottom <= 0 : window.scrollY > showAfterScroll
      const finalCta = hideWhenVisibleId ? document.getElementById(hideWhenVisibleId) : null
      const finalReached = finalCta ? finalCta.getBoundingClientRect().top < viewportHeight : false
      setIsVisible(heroGone && !finalReached)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [heroId, hideWhenVisibleId, showAfterScroll, isDismissed])

  if (isDismissed) return null

  return (
    <div
      aria-hidden={!isVisible}
      inert={!isVisible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 md:hidden',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Button className="flex-1" asChild>
          <Link href={href} onClick={() => !session && trackEngagement()}>
            {text}
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setIsDismissed(true)} aria-label="Fechar">
          <X className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  )
}
