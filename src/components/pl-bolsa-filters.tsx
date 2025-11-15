'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Filter, X } from 'lucide-react'

export interface PLBolsaFiltersState {
  startDate: string
  endDate: string
  sector: string | undefined
  minScore: number | undefined
  excludeUnprofitable: boolean
}

interface PLBolsaFiltersProps {
  sectors: string[]
  onFiltersChange: (filters: PLBolsaFiltersState) => void
  initialFilters?: Partial<PLBolsaFiltersState>
}

export function PLBolsaFilters({
  sectors,
  onFiltersChange,
  initialFilters,
}: PLBolsaFiltersProps) {
  const [startDate, setStartDate] = useState(
    initialFilters?.startDate || '2001-01-01'
  )
  const [endDate, setEndDate] = useState(
    initialFilters?.endDate || new Date().toISOString().split('T')[0]
  )
  const [sector, setSector] = useState<string | undefined>(
    initialFilters?.sector
  )
  const [minScore, setMinScore] = useState<number | undefined>(
    initialFilters?.minScore
  )
  const [excludeUnprofitable, setExcludeUnprofitable] = useState(
    initialFilters?.excludeUnprofitable || false
  )

  // Aplicar filtros quando mudarem
  useEffect(() => {
    onFiltersChange({
      startDate,
      endDate,
      sector,
      minScore,
      excludeUnprofitable,
    })
  }, [startDate, endDate, sector, minScore, excludeUnprofitable, onFiltersChange])

  const hasActiveFilters =
    sector !== undefined ||
    minScore !== undefined ||
    excludeUnprofitable ||
    startDate !== '2001-01-01' ||
    endDate !== new Date().toISOString().split('T')[0]

  const resetFilters = () => {
    setStartDate('2001-01-01')
    setEndDate(new Date().toISOString().split('T')[0])
    setSector(undefined)
    setMinScore(undefined)
    setExcludeUnprofitable(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Período - Data Inicial */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Data Inicial</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
            />
          </div>

          {/* Período - Data Final */}
          <div className="space-y-2">
            <Label htmlFor="endDate">Data Final</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Setor */}
          <div className="space-y-2">
            <Label htmlFor="sector">Setor</Label>
            <Select value={sector || 'all'} onValueChange={(value) => setSector(value === 'all' ? undefined : value)}>
              <SelectTrigger id="sector">
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

          {/* Score Mínimo */}
          <div className="space-y-2">
            <Label htmlFor="minScore">
              Score Mínimo: {minScore !== undefined ? minScore : 'Sem filtro'}
            </Label>
            <div className="space-y-2">
              <Slider
                id="minScore"
                min={0}
                max={100}
                step={1}
                value={minScore !== undefined ? [minScore] : [0]}
                onValueChange={(value) =>
                  setMinScore(value[0] === 0 ? undefined : value[0])
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Excluir Não Lucrativas */}
          <div className="flex items-center space-x-2 pt-8">
            <Checkbox
              id="excludeUnprofitable"
              checked={excludeUnprofitable}
              onCheckedChange={(checked) =>
                setExcludeUnprofitable(checked === true)
              }
            />
            <Label
              htmlFor="excludeUnprofitable"
              className="text-sm font-normal cursor-pointer"
            >
              Excluir empresas não lucrativas
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

