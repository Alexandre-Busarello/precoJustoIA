import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SocialProofProps {
  /** Números verificáveis (ex.: quantidade de empresas cobertas). Nunca estatísticas sem fonte. */
  stats?: Array<{
    value: string | number
    label: string
    /** @deprecated Ícones não são mais exibidos. */
    iconName?: string
    /** @deprecated Ícones não são mais exibidos. */
    icon?: ReactNode
  }>
  /** Depoimentos reais, identificados e com permissão de uso. Sem nota em estrelas. */
  testimonials?: Array<{
    name: string
    role?: string
    content: string
  }>
  /** Fatos curtos exibidos como texto. */
  badges?: Array<{
    text: string
    /** @deprecated Ícones não são mais exibidos. */
    iconName?: string
    /** @deprecated Ícones não são mais exibidos. */
    icon?: ReactNode
  }>
  className?: string
}

/** Prova social sóbria: números verificáveis, fatos em texto e depoimentos reais identificados. */
export function SocialProof({ stats, testimonials, badges, className }: SocialProofProps) {
  return (
    <section className={cn("border-y border-border bg-surface py-12 sm:py-16", className)}>
      <div className="container mx-auto space-y-10 px-4 sm:px-6 lg:px-8">
        {stats && stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {badges && badges.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {badges.map((badge) => (
              <li key={badge.text} className="flex items-center">
                {badge.text}
              </li>
            ))}
          </ul>
        )}

        {testimonials && testimonials.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <figure key={testimonial.name} className="rounded-lg border border-border bg-card p-5">
                <blockquote className="text-sm leading-6 text-foreground">&ldquo;{testimonial.content}&rdquo;</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-medium text-foreground">{testimonial.name}</span>
                  {testimonial.role && <span className="block text-muted-foreground">{testimonial.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
