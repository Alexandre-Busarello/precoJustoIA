'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DividendRadarControlsProps {
  search: string
  onSearchChange: (value: string) => void
  sector: string
  onSectorChange: (value: string) => void
  period: string
  onPeriodChange: (value: string) => void
  myAssets: boolean
  onMyAssetsChange: (value: boolean) => void
  dateType: 'exDate' | 'paymentDate' // Sempre 'exDate' (paymentDate não disponível no banco)
  oneTickerPerStock: boolean
  onOneTickerPerStockChange: (value: boolean) => void
  sectors: string[]
  isLoggedIn: boolean
  className?: string
}

export function DividendRadarControls({
  search,
  onSearchChange,
  sector,
  onSectorChange,
  period,
  onPeriodChange,
  myAssets,
  onMyAssetsChange,
  dateType,
  oneTickerPerStock,
  onOneTickerPerStockChange,
  sectors,
  isLoggedIn,
  className,
}: DividendRadarControlsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Linha 1: Toggle e Dropdowns */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Toggle "Um ticker por ação" */}
        <div className="flex items-center gap-2">
          <Label htmlFor="one-ticker-toggle" className="text-sm whitespace-nowrap">
            Um ticker por ação
          </Label>
          <button
            id="one-ticker-toggle"
            type="button"
            onClick={() => onOneTickerPerStockChange(!oneTickerPerStock)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              oneTickerPerStock ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                oneTickerPerStock ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {/* Dropdown Meus ativos */}
        {isLoggedIn && (
          <Select
            value={myAssets ? 'true' : 'false'}
            onValueChange={(value) => onMyAssetsChange(value === 'true')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Meus ativos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Todos</SelectItem>
              <SelectItem value="true">Meus ativos</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Dropdown Período */}
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 meses</SelectItem>
            <SelectItem value="6">6 meses</SelectItem>
            <SelectItem value="12">12 meses</SelectItem>
          </SelectContent>
        </Select>

        {/* Dropdown Setores */}
        <Select value={sector || 'all'} onValueChange={(value) => onSectorChange(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {sectors
              .filter((s) => s && s.trim() !== '') // Filtrar valores vazios ou nulos
              .map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Tab Data Com (apenas ExDate disponível, paymentDate sempre NULL no banco) */}
        <div className="px-3 py-2 text-sm font-medium text-muted-foreground border rounded-md bg-muted/50">
          Data Com (Ex-Dividendo)
        </div>
      </div>

      {/* Linha 2: Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar empresas ou ativos"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  )
}

