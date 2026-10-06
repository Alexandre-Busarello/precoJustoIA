'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  oneTickerPerStock: boolean
  onOneTickerPerStockChange: (value: boolean) => void
  sectors: string[]
  isLoggedIn: boolean
  className?: string
}

function SwitchField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="col-span-2 flex min-h-11 items-center gap-2.5 sm:col-span-1 md:min-h-9">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-foreground">
        {label}
      </Label>
    </div>
  )
}

/** Filtros do radar de dividendos: busca, período, setor e alternâncias. */
export function DividendRadarControls({
  search,
  onSearchChange,
  sector,
  onSectorChange,
  period,
  onPeriodChange,
  myAssets,
  onMyAssetsChange,
  oneTickerPerStock,
  onOneTickerPerStockChange,
  sectors,
  isLoggedIn,
  className,
}: DividendRadarControlsProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Buscar empresa ou ticker"
          aria-label="Buscar empresa ou ticker"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4">
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Período do calendário">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Próximos 3 meses</SelectItem>
            <SelectItem value="6">Próximos 6 meses</SelectItem>
            <SelectItem value="12">12 meses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sector || 'all'} onValueChange={(value) => onSectorChange(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Setor">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Setores</SelectItem>
            {sectors
              .filter((s) => s && s.trim() !== '')
              .map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <SwitchField
          id="one-ticker-toggle"
          label="Um ticker por empresa"
          checked={oneTickerPerStock}
          onCheckedChange={onOneTickerPerStockChange}
        />

        {isLoggedIn && (
          <SwitchField id="my-assets-toggle" label="Só meus ativos" checked={myAssets} onCheckedChange={onMyAssetsChange} />
        )}
      </div>
    </div>
  )
}
