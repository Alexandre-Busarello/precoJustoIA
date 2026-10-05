'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'
import { VALUATION_MODELS } from '../lp-data'

export function FeaturesValuationSection() {
  const [active, setActive] = useState(VALUATION_MODELS[0].id)
  const model = VALUATION_MODELS.find((m) => m.id === active)!

  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-brand/40 bg-brand-subtle text-brand">
            Modelos de valuation
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Calcule o preço justo com múltiplos métodos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Não dependa de um único critério. Compare os modelos lado a lado e identifique o consenso.
          </p>
        </div>

        <PreviewShell path="/acao/taee11">
        <div className="flex flex-col gap-6 lg:flex-row rounded-lg border border-border bg-card p-5">
          {/* Model selector — scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:w-56 lg:flex-col lg:overflow-visible lg:pb-0">
            {VALUATION_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`flex min-h-[44px] shrink-0 items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors lg:w-full ${
                  active === m.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{m.name}</span>
                {m.tag === 'Grátis' && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      active === m.id
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-brand-subtle text-brand'
                    }`}
                  >
                    Grátis
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Model detail */}
          <div className="flex-1 rounded-lg border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">{model.name}</h3>
              <Badge
                className={
                  model.tag === 'Grátis'
                    ? 'bg-brand-subtle text-brand'
                    : 'bg-warning-subtle text-warning'
                }
              >
                {model.tag}
              </Badge>
            </div>
            <p className="text-muted-foreground">{model.description}</p>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Fórmula</p>
                <code className="text-sm text-brand">{model.formula}</code>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  Exemplo ilustrativo
                </p>
                <p className="text-sm text-foreground">{model.example}</p>
              </div>
            </div>
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
