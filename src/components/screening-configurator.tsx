"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, X } from "lucide-react"
import type { ScreeningFilter, ScreeningParams } from "@/lib/strategies/types"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InfoHint } from "@/components/ui/info-hint"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { NumberField } from "@/components/screening/number-field"
import {
  isFilterActive,
  type StockAssetType,
  type StockRangeFilterKey,
} from "@/components/screening/screening-metrics"

interface RangeFilterDefinition {
  key: StockRangeFilterKey
  label: string
  /** Valor salvo = valor digitado × factor (ex.: 0,01 para percentuais guardados como fração). */
  factor: number
  suffix?: string
  premium: boolean
  hint?: string
}

interface FilterGroupDefinition {
  id: string
  title: string
  filters: RangeFilterDefinition[]
}

const PCT = 0.01

const FILTER_GROUPS: FilterGroupDefinition[] = [
  {
    id: "valuation",
    title: "Valuation",
    filters: [
      { key: "plFilter", label: "P/L", factor: 1, premium: false },
      { key: "pvpFilter", label: "P/VP", factor: 1, premium: false },
      { key: "evEbitdaFilter", label: "EV/EBITDA", factor: 1, premium: false },
      { key: "psrFilter", label: "PSR (preço/receita)", factor: 1, premium: false },
    ],
  },
  {
    id: "desconto",
    title: "Desconto e qualidade",
    filters: [
      {
        key: "grahamUpsideFilter",
        label: "Upside Graham",
        factor: 1,
        suffix: "%",
        premium: false,
        hint: "Diferença entre o preço justo pela fórmula de Graham (√(22,5 × LPA × VPA)) e o preço atual. É uma estimativa e não é recomendação.",
      },
      {
        key: "overallScoreFilter",
        label: "Score geral",
        factor: 1,
        premium: true,
        hint: "Nota de 0 a 100 que combina os modelos de valuation e a qualidade dos demonstrativos da empresa.",
      },
    ],
  },
  {
    id: "rentabilidade",
    title: "Rentabilidade",
    filters: [
      { key: "roeFilter", label: "ROE", factor: PCT, suffix: "%", premium: true },
      { key: "roicFilter", label: "ROIC", factor: PCT, suffix: "%", premium: true },
      { key: "roaFilter", label: "ROA", factor: PCT, suffix: "%", premium: true },
      { key: "margemLiquidaFilter", label: "Margem líquida", factor: PCT, suffix: "%", premium: true },
      { key: "margemEbitdaFilter", label: "Margem EBITDA", factor: PCT, suffix: "%", premium: true },
    ],
  },
  {
    id: "crescimento",
    title: "Crescimento",
    filters: [
      { key: "cagrLucros5aFilter", label: "CAGR de lucros (5 anos)", factor: PCT, suffix: "%", premium: true },
      { key: "cagrReceitas5aFilter", label: "CAGR de receitas (5 anos)", factor: PCT, suffix: "%", premium: true },
    ],
  },
  {
    id: "dividendos",
    title: "Dividendos",
    filters: [
      { key: "dyFilter", label: "Dividend yield", factor: PCT, suffix: "%", premium: true },
      { key: "payoutFilter", label: "Payout", factor: PCT, suffix: "%", premium: true },
    ],
  },
  {
    id: "endividamento",
    title: "Endividamento e liquidez",
    filters: [
      { key: "dividaLiquidaPlFilter", label: "Dívida líquida/PL", factor: PCT, suffix: "%", premium: true },
      { key: "dividaLiquidaEbitdaFilter", label: "Dívida líquida/EBITDA", factor: 1, premium: true },
      { key: "liquidezCorrenteFilter", label: "Liquidez corrente", factor: 1, premium: true },
    ],
  },
  {
    id: "tamanho",
    title: "Valor de mercado",
    filters: [{ key: "marketCapFilter", label: "Valor de mercado (R$)", factor: 1e9, suffix: "bi", premium: true }],
  },
]

const COMPANY_SIZE_OPTIONS: { value: NonNullable<ScreeningParams["companySize"]>; label: string }[] = [
  { value: "all", label: "Todos os tamanhos" },
  { value: "small_caps", label: "Small caps (até R$ 2 bi)" },
  { value: "mid_caps", label: "Mid caps (R$ 2 a 10 bi)" },
  { value: "blue_chips", label: "Large caps (acima de R$ 10 bi)" },
]

const ASSET_TYPE_OPTIONS: { value: StockAssetType; label: string }[] = [
  { value: "both", label: "B3 e BDRs" },
  { value: "b3", label: "Apenas B3" },
  { value: "bdr", label: "Apenas BDRs" },
]

function toDisplay(stored: number | undefined, factor: number): number | undefined {
  return stored === undefined ? undefined : Number((stored / factor).toPrecision(12))
}

interface ScreeningConfiguratorProps {
  params: ScreeningParams
  onParamsChange: (params: ScreeningParams) => void
  /** Premium logado: libera filtros além de valuation (o backend aplica a mesma regra). */
  canUsePremiumFilters: boolean
  isLoggedIn: boolean
  sectors: string[]
  industriesBySector: Record<string, string[]>
  sectorsLoading?: boolean
}

export function ScreeningConfigurator({
  params,
  onParamsChange,
  canUsePremiumFilters,
  isLoggedIn,
  sectors,
  industriesBySector,
  sectorsLoading = false,
}: ScreeningConfiguratorProps) {
  const updateFilter = (key: StockRangeFilterKey, filter: ScreeningFilter | undefined) => {
    onParamsChange({ ...params, [key]: filter })
  }

  const lockedNote = (
    <p className="text-xs text-muted-foreground">
      Disponível no Premium.{" "}
      <Link href={isLoggedIn ? "/planos" : "/register"} className="font-medium text-brand hover:underline">
        {isLoggedIn ? "Ver planos" : "Criar conta grátis"}
      </Link>
    </p>
  )

  const assetType: StockAssetType =
    params.assetTypeFilter && params.assetTypeFilter !== "fii" ? params.assetTypeFilter : "both"

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="screening-asset-type">Tipo de ativo</Label>
          <Select
            value={assetType}
            onValueChange={(value) => onParamsChange({ ...params, assetTypeFilter: value as StockAssetType })}
          >
            <SelectTrigger id="screening-asset-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="screening-company-size">Tamanho da empresa</Label>
          <Select
            value={params.companySize || "all"}
            onValueChange={(value) =>
              onParamsChange({ ...params, companySize: value as NonNullable<ScreeningParams["companySize"]> })
            }
          >
            <SelectTrigger id="screening-company-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canUsePremiumFilters && (
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Label htmlFor="screening-technical" className="font-normal leading-snug">
                Priorizar sobrevenda
              </Label>
              <InfoHint content="Quando ativo, ativos em sobrevenda pelo RSI e pelo estocástico aparecem primeiro. A ordem não é recomendação de investimento." />
            </div>
            <Switch
              id="screening-technical"
              // Área de toque de 44 px de altura sem mudar o tamanho visual do switch.
              className="relative before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']"
              checked={params.useTechnicalAnalysis !== false}
              onCheckedChange={(checked) => onParamsChange({ ...params, useTechnicalAnalysis: checked })}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border">
        {FILTER_GROUPS.map((group) => {
          const locked = !canUsePremiumFilters && group.filters.every((f) => f.premium)
          const activeCount = group.filters.filter((f) => isFilterActive(params[f.key])).length
          return (
            <FilterGroup
              key={group.id}
              title={group.title}
              activeCount={activeCount}
              locked={locked}
              defaultOpen={group.id === "valuation" || activeCount > 0}
            >
              {locked && lockedNote}
              {group.filters.map((definition) => {
                const rowLocked = definition.premium && !canUsePremiumFilters
                return (
                  <RangeFilterRow
                    key={definition.key}
                    definition={definition}
                    filter={params[definition.key]}
                    onChange={(filter) => updateFilter(definition.key, filter)}
                    locked={rowLocked}
                    showPremiumBadge={rowLocked && !locked}
                  />
                )
              })}
            </FilterGroup>
          )
        })}
        <SectorFilterGroup
          params={params}
          onParamsChange={onParamsChange}
          locked={!canUsePremiumFilters}
          lockedNote={lockedNote}
          sectors={sectors}
          industriesBySector={industriesBySector}
          loading={sectorsLoading}
        />
      </div>
    </div>
  )
}

function FilterGroup({
  title,
  activeCount,
  locked,
  defaultOpen,
  children,
}: {
  title: string
  activeCount: number
  locked: boolean
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border">
      <CollapsibleTrigger className="min-h-11 gap-2 rounded-none py-2 text-left text-sm font-medium text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {activeCount > 0 && (
            <Badge variant="brand" aria-label={`${activeCount} ativo${activeCount > 1 ? "s" : ""}`}>
              {activeCount}
            </Badge>
          )}
          {locked && <Badge variant="neutral">Premium</Badge>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 pt-1 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function RangeFilterRow({
  definition,
  filter,
  onChange,
  locked,
  showPremiumBadge,
}: {
  definition: RangeFilterDefinition
  filter: ScreeningFilter | undefined
  onChange: (filter: ScreeningFilter | undefined) => void
  locked: boolean
  showPremiumBadge: boolean
}) {
  const { factor } = definition
  const active = isFilterActive(filter)
  const min = active ? toDisplay(filter?.min, factor) : undefined
  const max = active ? toDisplay(filter?.max, factor) : undefined

  const update = (bound: "min" | "max", display: number | undefined) => {
    const next = {
      min: active ? filter?.min : undefined,
      max: active ? filter?.max : undefined,
      [bound]: display === undefined ? undefined : display * factor,
    }
    onChange(next.min === undefined && next.max === undefined ? undefined : { enabled: true, ...next })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center gap-1 text-sm text-foreground">
        <span className={locked ? "text-muted-foreground" : undefined}>{definition.label}</span>
        {definition.hint && <InfoHint content={definition.hint} />}
        {showPremiumBadge && (
          <Badge variant="neutral" className="ml-auto">
            Premium
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          value={min}
          onChange={(value) => update("min", value)}
          placeholder="Mín."
          ariaLabel={`${definition.label} mínimo`}
          suffix={definition.suffix}
          disabled={locked}
        />
        <NumberField
          value={max}
          onChange={(value) => update("max", value)}
          placeholder="Máx."
          ariaLabel={`${definition.label} máximo`}
          suffix={definition.suffix}
          disabled={locked}
        />
      </div>
    </div>
  )
}

function SectorFilterGroup({
  params,
  onParamsChange,
  locked,
  lockedNote,
  sectors,
  industriesBySector,
  loading,
}: {
  params: ScreeningParams
  onParamsChange: (params: ScreeningParams) => void
  locked: boolean
  lockedNote: React.ReactNode
  sectors: string[]
  industriesBySector: Record<string, string[]>
  loading: boolean
}) {
  const selectedSectors = useMemo(() => params.selectedSectors ?? [], [params.selectedSectors])

  const availableIndustries = useMemo(() => {
    const source =
      selectedSectors.length > 0
        ? selectedSectors.flatMap((sector) => industriesBySector[sector] ?? [])
        : Object.values(industriesBySector).flat()
    return Array.from(new Set(source.filter((industry) => industry.trim()))).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [selectedSectors, industriesBySector])

  const selectedIndustries = (params.selectedIndustries ?? []).filter((industry) => availableIndustries.includes(industry))
  const activeCount = (selectedSectors.length > 0 ? 1 : 0) + (selectedIndustries.length > 0 ? 1 : 0)

  const setSectors = (next: string[]) => {
    const allowed = new Set(next.flatMap((sector) => industriesBySector[sector] ?? []))
    onParamsChange({
      ...params,
      selectedSectors: next,
      selectedIndustries:
        next.length > 0 ? (params.selectedIndustries ?? []).filter((industry) => allowed.has(industry)) : params.selectedIndustries,
    })
  }
  const setIndustries = (next: string[]) => onParamsChange({ ...params, selectedIndustries: next })

  return (
    <FilterGroup title="Setores e indústrias" activeCount={activeCount} locked={locked} defaultOpen={activeCount > 0}>
      {locked && lockedNote}
      <MultiSelectField
        id="screening-sectors"
        label="Setores"
        placeholder={loading ? "Carregando setores…" : "Adicionar setor"}
        options={sectors.filter((sector) => sector.trim())}
        selected={selectedSectors}
        onChange={setSectors}
        disabled={locked || loading}
      />
      <MultiSelectField
        id="screening-industries"
        label="Indústrias"
        placeholder={loading ? "Carregando indústrias…" : "Adicionar indústria"}
        options={availableIndustries}
        selected={selectedIndustries}
        onChange={setIndustries}
        disabled={locked || loading}
      />
    </FilterGroup>
  )
}

function MultiSelectField({
  id,
  label,
  placeholder,
  options,
  selected,
  onChange,
  disabled,
}: {
  id: string
  label: string
  placeholder: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}) {
  const remaining = options.filter((option) => !selected.includes(option))
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={disabled ? "text-muted-foreground" : undefined}>
        {label}
      </Label>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <li key={value}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(selected.filter((item) => item !== value))}
                aria-label={`Remover ${value}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-sm md:min-h-8 border border-border bg-muted px-2 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
              >
                {value}
                <X className="size-3 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Select
        value=""
        disabled={disabled || remaining.length === 0}
        onValueChange={(value) => {
          if (value && !selected.includes(value)) onChange([...selected, value])
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {remaining.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
