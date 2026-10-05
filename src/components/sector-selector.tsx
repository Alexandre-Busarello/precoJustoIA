'use client'

/**
 * Seleção de setores ainda não carregados (Premium): chips alternáveis + botão para carregar.
 */

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'

interface SectorSelectorProps {
  availableSectors: string[]
  onSelectSectors: (sectors: string[]) => Promise<void>
  loadingSectors: string[]
}

export function SectorSelector({ availableSectors, onSelectSectors, loadingSectors }: SectorSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const isLoading = loadingSectors.length > 0

  const toggle = (sector: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sector)) next.delete(sector)
      else next.add(sector)
      return next
    })
  }

  const allSelected = availableSectors.every((s) => selected.has(s))

  const handleLoad = async () => {
    if (selected.size === 0) return
    await onSelectSectors(Array.from(selected))
    setSelected(new Set())
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader
        as="h3"
        title="Outros setores"
        description="Escolha os setores que quer adicionar à análise. Cada setor leva alguns segundos para calcular."
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => setSelected(allSelected ? new Set() : new Set(availableSectors))}
          >
            {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {availableSectors.map((sector) => {
          const active = selected.has(sector)
          const loading = loadingSectors.includes(sector)
          return (
            <button
              key={sector}
              type="button"
              aria-pressed={active}
              disabled={isLoading}
              onClick={() => toggle(sector)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60 md:min-h-9',
                active
                  ? 'border-brand bg-brand-subtle text-brand'
                  : 'border-border text-foreground hover:bg-muted'
              )}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                active && <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              {sector}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleLoad} disabled={selected.size === 0 || isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
          {isLoading
            ? 'Calculando setores'
            : selected.size > 0
              ? `Adicionar ${selected.size} ${selected.size === 1 ? 'setor' : 'setores'}`
              : 'Adicionar setores'}
        </Button>
        {selected.size > 0 && !isLoading && (
          <span className="text-sm text-muted-foreground tabular-nums">Cerca de {selected.size * 3} s</span>
        )}
      </div>
    </section>
  )
}
