'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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
  const { data: session } = useSession()
  const isLoggedIn = !!session
  
  // Limitar data final para não logados
  const currentYear = new Date().getFullYear()
  const lastYearEnd = new Date(currentYear - 1, 11, 31)
  const maxEndDate = isLoggedIn 
    ? new Date().toISOString().split('T')[0]
    : lastYearEnd.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(
    initialFilters?.startDate || '2001-01-01'
  )
  const [endDate, setEndDate] = useState(
    initialFilters?.endDate || maxEndDate
  )
  const [sector, setSector] = useState<string | undefined>(
    initialFilters?.sector
  )
  const [minScore, setMinScore] = useState<number | undefined>(
    initialFilters?.minScore
  )
  const [minScoreInput, setMinScoreInput] = useState<string>(
    initialFilters?.minScore?.toString() || ''
  )
  const [excludeUnprofitable, setExcludeUnprofitable] = useState(
    initialFilters?.excludeUnprofitable || false
  )

  // Limitar endDate quando usuário não está logado
  useEffect(() => {
    if (!isLoggedIn && endDate > maxEndDate) {
      setEndDate(maxEndDate)
    }
  }, [isLoggedIn, endDate, maxEndDate])

  // Aplicar filtros quando mudarem
  useEffect(() => {
    const finalEndDate = !isLoggedIn && endDate > maxEndDate ? maxEndDate : endDate
    onFiltersChange({
      startDate,
      endDate: finalEndDate,
      sector,
      minScore,
      excludeUnprofitable,
    })
  }, [startDate, endDate, sector, minScore, excludeUnprofitable, isLoggedIn, maxEndDate, onFiltersChange])

  const hasActiveFilters =
    sector !== undefined ||
    minScore !== undefined ||
    excludeUnprofitable ||
    startDate !== '2001-01-01' ||
    endDate !== maxEndDate

  const resetFilters = () => {
    setStartDate('2001-01-01')
    setEndDate(maxEndDate)
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
              max={maxEndDate}
            />
            {!isLoggedIn && (
              <p className="text-xs text-muted-foreground">
                Faça login para ver dados do ano atual
              </p>
            )}
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
            <Label htmlFor="minScore">Score Mínimo (0-100)</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="minScore"
                type="number"
                min={0}
                max={100}
                placeholder="Sem filtro"
                value={minScoreInput}
                onChange={(e) => {
                  const value = e.target.value
                  setMinScoreInput(value)
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (value === '') {
                    setMinScore(undefined)
                    setMinScoreInput('')
                  } else {
                    const numValue = parseInt(value, 10)
                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                      setMinScore(numValue === 0 ? undefined : numValue)
                      setMinScoreInput(numValue === 0 ? '' : value)
                    } else {
                      // Valor inválido, restaurar valor anterior
                      setMinScoreInput(minScore?.toString() || '')
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full"
              />
              {minScoreInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMinScore(undefined)
                    setMinScoreInput('')
                  }}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para não filtrar por score
            </p>
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

