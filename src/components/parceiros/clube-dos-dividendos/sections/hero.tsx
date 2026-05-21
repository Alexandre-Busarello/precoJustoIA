import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { BRUNO_ENDORSEMENT, HERO, STATS } from '../lp-data'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 pb-16 pt-16 md:pb-24 md:pt-20">
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.15),transparent)]"
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-16 lg:text-left">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            {/* Partner badge */}
            <div className="mb-5 flex justify-center lg:justify-start">
              <Badge className="border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
                {HERO.badge}
              </Badge>
            </div>

            {/* Headline */}
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {HERO.headline}
            </h1>

            {/* Subheadline */}
            <p className="mt-5 text-base text-slate-300 md:text-lg">
              {HERO.subheadline}
            </p>

            {/* Bruno Mazzoni endorsement */}
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                {BRUNO_ENDORSEMENT.initials}
              </div>
              <div>
                <p className="text-xs leading-relaxed text-slate-300 italic">
                  &ldquo;{BRUNO_ENDORSEMENT.quote}&rdquo;
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  — {BRUNO_ENDORSEMENT.name},{' '}
                  <span className="text-emerald-400">{BRUNO_ENDORSEMENT.role}</span>
                </p>
              </div>
            </div>

            {/* CTAs — PREMIUM first */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href={HERO.ctaPrimary.href}
                className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-emerald-500 px-8 text-base font-bold text-white transition hover:bg-emerald-400 sm:w-auto"
              >
                {HERO.ctaPrimary.label} →
              </a>
              <Link
                href={HERO.ctaSecondary.href}
                className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-slate-700 px-8 text-sm font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-300 sm:w-auto"
              >
                {HERO.ctaSecondary.label}
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO.trust.map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-emerald-500" aria-hidden="true">✓</span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right — partner image */}
          <div className="flex w-full max-w-[220px] shrink-0 flex-col items-center gap-3 lg:w-52 lg:max-w-none lg:pt-2">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-xl">
              <Image
                src="/clubedosdividendos.webp"
                alt="Clube dos Dividendos do Bruno Mazzoni — parceria com Preço Justo AI"
                width={200}
                height={200}
                className="mx-auto rounded-xl object-contain"
                priority
              />
            </div>
            <p className="text-center text-xs text-slate-500">
              Clube dos Dividendos<br />
              <span className="font-semibold text-slate-400">por Bruno Mazzoni</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-extrabold text-emerald-400 md:text-3xl">{stat.value}</div>
                <div className="mt-0.5 text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
