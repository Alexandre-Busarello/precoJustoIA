'use client'

import { Button } from "@/components/ui/button"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface LandingHeroProps {
  headline: string | ReactNode
  subheadline: string | ReactNode
  primaryCTA?: {
    text: string
    href: string
    /** @deprecated Ícones decorativos não são mais exibidos no hero. */
    iconName?: string
    /** @deprecated Ícones decorativos não são mais exibidos no hero. */
    icon?: ReactNode
  }
  secondaryCTA?: {
    text: string
    href: string
  }
  /** @deprecated O hero não exibe mais a pílula acima do título. */
  badge?: {
    text: string
    iconName?: string
    icon?: ReactNode
  }
  /** Fatos curtos exibidos como texto abaixo do subtítulo (sem ícones). */
  socialProof?: Array<{
    /** @deprecated Ícones não são mais exibidos. */
    iconName?: string
    /** @deprecated Ícones não são mais exibidos. */
    icon?: ReactNode
    text: string
  }>
  showQuickAccess?: boolean
  /** Linha pequena com o preço de entrada do plano pago. */
  pricingNote?: string
  /** Substitui os botões padrão (ex.: campo de busca na home). */
  actions?: ReactNode
  /** Coluna da direita no desktop (ex.: screenshot do produto). */
  media?: ReactNode
  id?: string
}

/**
 * Hero de páginas de marketing: alinhado à esquerda, H1 sólido, um subtítulo, até duas ações.
 * Títulos antigos que ainda passam trechos com gradiente/cor são neutralizados para `text-foreground`.
 */
export function LandingHero({
  headline,
  subheadline,
  primaryCTA,
  secondaryCTA,
  socialProof,
  showQuickAccess = true,
  pricingNote,
  actions,
  media,
  id,
}: LandingHeroProps) {
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()

  const handleCTAClick = () => {
    if (!session) {
      trackEngagement()
    }
  }

  const hasDefaultActions = !actions && (primaryCTA || secondaryCTA)

  return (
    <section id={id} className="w-full border-b border-border bg-background">
      <div
        className={cn(
          "container mx-auto grid gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20",
          media && "lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-12"
        )}
      >
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground text-balance sm:text-5xl [&_*]:bg-none! [&_*]:text-foreground!">
            {headline}
          </h1>

          <div className="mt-4 max-w-[60ch] text-base leading-7 text-muted-foreground sm:text-lg [&_strong]:font-normal">
            {subheadline}
          </div>

          {socialProof && socialProof.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {socialProof.map((item) => (
                <li key={item.text} className="flex items-center">
                  {item.text}
                </li>
              ))}
            </ul>
          )}

          {actions && <div className="mt-8">{actions}</div>}

          {hasDefaultActions && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {primaryCTA && (
                <Button size="lg" asChild>
                  <Link href={primaryCTA.href} onClick={handleCTAClick}>
                    {primaryCTA.text}
                  </Link>
                </Button>
              )}
              {secondaryCTA && (
                <Button size="lg" variant="outline" asChild>
                  <Link href={secondaryCTA.href} onClick={handleCTAClick}>
                    {secondaryCTA.text}
                  </Link>
                </Button>
              )}
            </div>
          )}

          {showQuickAccess && (
            <p className="mt-4 text-sm text-muted-foreground">Plano gratuito · Sem cartão de crédito</p>
          )}

          {pricingNote && <p className="mt-1 text-sm text-muted-foreground">{pricingNote}</p>}
        </div>

        {media && <div className="min-w-0">{media}</div>}
      </div>
    </section>
  )
}
