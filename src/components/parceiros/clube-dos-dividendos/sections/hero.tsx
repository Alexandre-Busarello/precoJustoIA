import Image from 'next/image'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BRUNO_ENDORSEMENT, HERO, STATS } from '../lp-data'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-surface pb-16 pt-16 md:pb-24 md:pt-20">

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-16 lg:text-left">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            {/* Partner badge */}
            <div className="mb-5 flex justify-center lg:justify-start">
              <Badge className="border-brand/40 bg-brand-subtle px-4 py-1.5 text-xs font-semibold text-brand">
                {HERO.badge}
              </Badge>
            </div>

            {/* Headline */}
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {HERO.headline}
            </h1>

            {/* Subheadline */}
            <p className="mt-5 text-base text-muted-foreground md:text-lg">
              {HERO.subheadline}
            </p>

            {/* Bruno Mazzoni endorsement */}
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand">
                {BRUNO_ENDORSEMENT.initials}
              </div>
              <div>
                <p className="text-xs leading-relaxed text-muted-foreground italic">
                  &ldquo;{BRUNO_ENDORSEMENT.quote}&rdquo;
                </p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  — {BRUNO_ENDORSEMENT.name},{' '}
                  <span className="text-brand">{BRUNO_ENDORSEMENT.role}</span>
                </p>
              </div>
            </div>

            {/* CTAs — Premium first */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href={HERO.ctaPrimary.href}
                className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
              >
                {HERO.ctaPrimary.label} →
              </a>
              <Link
                href={HERO.ctaSecondary.href}
                className="flex min-h-[52px] w-full items-center justify-center rounded-lg border border-border px-8 text-sm font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-muted-foreground sm:w-auto"
              >
                {HERO.ctaSecondary.label}
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO.trust.map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="size-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right — partner image */}
          <div className="flex w-full max-w-[220px] shrink-0 flex-col items-center gap-3 lg:w-52 lg:max-w-none lg:pt-2">
            <div className="overflow-hidden rounded-lg border border-border bg-card p-3">
              <Image
                src="/clubedosdividendos.webp"
                alt="Clube dos Dividendos do Bruno Mazzoni — parceria com Preço Justo AI"
                width={200}
                height={200}
                className="mx-auto rounded-lg object-contain"
                priority
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Clube dos Dividendos<br />
              <span className="font-semibold text-muted-foreground">por Bruno Mazzoni</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-5 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-semibold text-brand md:text-3xl">{stat.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
