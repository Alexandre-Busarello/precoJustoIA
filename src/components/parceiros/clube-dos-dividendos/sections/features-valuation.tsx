'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'
import { VALUATION_MODELS } from '../lp-data'

export function FeaturesValuationSection() {
  const [active, setActive] = useState(VALUATION_MODELS[0].id)
  const model = VALUATION_MODELS.find((m) => m.id === active)!

  return (
    <section className="bg-slate-950 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            8 Modelos de Valuation
          </Badge>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            Calcule o preço justo com múltiplos métodos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Não dependa de um único critério. Compare os 8 modelos lado a lado e identifique o consenso.
          </p>
        </div>

        <PreviewShell path="/acao/taee11">
        <div className="flex flex-col gap-6 lg:flex-row rounded-2xl border border-slate-800 bg-slate-900 p-5">
          {/* Model selector — scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:w-56 lg:flex-col lg:overflow-visible lg:pb-0">
            {VALUATION_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`flex min-h-[44px] shrink-0 items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors lg:w-full ${
                  active === m.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>{m.name}</span>
                {m.tag === 'FREE' && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">FREE</span>
                )}
              </button>
            ))}
          </div>

          {/* Model detail */}
          <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{model.name}</h3>
              <Badge
                className={
                  model.tag === 'FREE'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }
              >
                {model.tag}
              </Badge>
            </div>
            <p className="text-slate-300">{model.description}</p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-slate-800 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Fórmula</p>
                <code className="text-sm text-emerald-400">{model.formula}</code>
              </div>
              <div className="rounded-xl bg-slate-800 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Exemplo ilustrativo
                </p>
                <p className="text-sm text-slate-200">{model.example}</p>
              </div>
            </div>
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
