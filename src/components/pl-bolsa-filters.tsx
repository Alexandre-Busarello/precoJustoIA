'use client'

/**
 * Filtros do P/L da bolsa em linha, logo acima do gráfico (sem card próprio).
 * Visitantes sem login veem dados só até o fim do ano anterior.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface PLBolsaFiltersState {
  startDate: string
  endDate: string
  sector: string | undefined
  minScore: number | undefined
}

interface PLBolsaFiltersProps {
  sectors: string[]
  /** Data máxima permitida (`YYYY-MM-DD`). */
  maxEndDate: string
  value: PLBolsaFiltersState
  onChange: (filters: PLBolsaFiltersState) => void
}

export const PL_BOLSA_START_DATE = '2010-01-01'

export function PLBolsaFilters({ sectors, maxEndDate, value, onChange }: PLBolsaFiltersProps) {
  const [minScoreInput, setMinScoreInput] = useState(value.minScore?.toString() ?? '')

  useEffect(() => {
    setMinScoreInput(value.minScore?.toString() ?? '')
  }, [value.minScore])

  const update = (patch: Partial<PLBolsaFiltersState>) => onChange({ ...value, ...patch })

  const commitMinScore = () => {
    const raw = minScoreInput.trim()
    if (raw === '') return update({ minScore: undefined })
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setMinScoreInput(value.minScore?.toString() ?? '')
      return
    }
    update({ minScore: parsed === 0 ? undefined : parsed })
  }

  const hasActiveFilters =
    value.sector !== undefined ||
    value.minScore !== undefined ||
    value.startDate !== PL_BOLSA_START_DATE ||
    value.endDate !== maxEndDate

  return (
    <div role="group" aria-label="Filtros do gráfico" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="pl-start" className="text-xs font-normal text-muted-foreground">
          De
        </Label>
        <Input
          id="pl-start"
          type="date"
          value={value.startDate}
          min={PL_BOLSA_START_DATE}
          max={value.endDate}
          onChange={(e) => e.target.value && update({ startDate: e.target.value })}
          className="sm:w-40"
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="pl-end" className="text-xs font-normal text-muted-foreground">
          Até
        </Label>
        <Input
          id="pl-end"
          type="date"
          value={value.endDate}
          min={value.startDate}
          max={maxEndDate}
          onChange={(e) => e.target.value && update({ endDate: e.target.value > maxEndDate ? maxEndDate : e.target.value })}
          className="sm:w-40"
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="pl-sector" className="text-xs font-normal text-muted-foreground">
          Setor
        </Label>
        <Select value={value.sector ?? 'all'} onValueChange={(v) => update({ sector: v === 'all' ? undefined : v })}>
          <SelectTrigger id="pl-sector" className="w-full sm:w-56">
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="pl-score" className="text-xs font-normal text-muted-foreground">
          Score mínimo
        </Label>
        <Input
          id="pl-score"
          type="number"
          inputMode="numeric"
          enterKeyHint="done"
          min={0}
          max={100}
          placeholder="0 a 100"
          value={minScoreInput}
          onChange={(e) => setMinScoreInput(e.target.value)}
          onBlur={commitMinScore}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="sm:w-28"
        />
      </div>
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          className="col-span-2 justify-self-start"
          onClick={() =>
            onChange({ startDate: PL_BOLSA_START_DATE, endDate: maxEndDate, sector: undefined, minScore: undefined })
          }
        >
          <X className="size-4" strokeWidth={1.75} />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
