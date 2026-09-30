'use client'

import { Button } from "@/components/ui/button"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface CTASectionProps {
  title: string | ReactNode
  description?: string | ReactNode
  primaryCTA: {
    text: string
    href: string
    /** @deprecated Ícones decorativos não são mais exibidos. */
    iconName?: string
    /** @deprecated Ícones decorativos não são mais exibidos. */
    icon?: ReactNode
  }
  secondaryCTA?: {
    text: string
    href: string
    /** @deprecated Ícones decorativos não são mais exibidos. */
    iconName?: string
    /** @deprecated Ícones decorativos não são mais exibidos. */
    icon?: ReactNode
  }
  /** @deprecated Todas as variantes usam a mesma faixa `bg-surface`. */
  variant?: 'default' | 'gradient' | 'minimal'
  className?: string
  /** Fatos curtos exibidos como texto abaixo da descrição. */
  benefits?: string[]
  id?: string
}

/** Faixa de chamada final: título, uma frase, um botão primário e um secundário neutro. */
export function CTASection({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  className,
  benefits,
  id,
}: CTASectionProps) {
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()

  const handleCTAClick = () => {
    if (!session) {
      trackEngagement()
    }
  }

  return (
    <section id={id} className={cn("border-t border-border bg-surface py-16 sm:py-20", className)}>
      <div className="container mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl [&_*]:bg-none! [&_*]:text-foreground!">
          {title}
        </h2>
        {description && (
          <p className="mx-auto mt-3 max-w-[60ch] text-base text-muted-foreground [&_strong]:font-normal">{description}</p>
        )}

        {benefits && benefits.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center">
                {benefit}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href={primaryCTA.href} onClick={handleCTAClick}>
              {primaryCTA.text}
            </Link>
          </Button>
          {secondaryCTA && (
            <Button size="lg" variant="outline" asChild>
              <Link href={secondaryCTA.href} onClick={handleCTAClick}>
                {secondaryCTA.text}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
