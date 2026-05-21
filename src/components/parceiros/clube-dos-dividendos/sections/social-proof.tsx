import { Badge } from '@/components/ui/badge'
import { STATS, TESTIMONIALS } from '../lp-data'

export function SocialProofSection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-16 text-center">
          <Badge className="mb-3 bg-slate-100 text-slate-600">Plataforma</Badge>
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Confiado por investidores fundamentalistas
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-emerald-600 md:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div>
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
            O que dizem nossos usuários
          </p>

          {/* Mobile: horizontal scroll snap | Desktop: grid */}
          <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0"
               style={{ scrollSnapType: 'x mandatory' }}>
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="flex min-w-[280px] shrink-0 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 md:min-w-0"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* Quote */}
                <p className="text-sm leading-relaxed text-slate-600">&ldquo;{t.text}&rdquo;</p>

                {/* Author */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
