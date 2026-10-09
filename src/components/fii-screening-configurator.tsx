"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NumberField } from "@/components/screening/number-field"
import { LiquidityFilter } from "@/components/screening/liquidity-filter"
import type { FiiScreeningFormParams } from "@/components/screening/screening-metrics"

export type { FiiScreeningFormParams } from "@/components/screening/screening-metrics"

const ALL_SEGMENTS = "__all__"

interface Props {
  params: FiiScreeningFormParams
  onChange: (params: FiiScreeningFormParams) => void
  /** Segmentos vindos de /api/sectors-industries (indústrias do setor "Fundos Imobiliários"). */
  segments: string[]
  segmentsLoading?: boolean
}

/** Percentual digitado (8) ↔ fração salva (0,08). */
function pctToDisplay(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Number((value * 100).toPrecision(12))
}

function pctToStored(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value / 100
}

export function FiiScreeningConfigurator({ params, onChange, segments, segmentsLoading = false }: Props) {
  const set = (partial: Partial<FiiScreeningFormParams>) => onChange({ ...params, ...partial })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fii-tipo">Tipo</Label>
        <Select value={params.tipoFii} onValueChange={(value) => set({ tipoFii: value as FiiScreeningFormParams["tipoFii"] })}>
          <SelectTrigger id="fii-tipo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">Tijolo e papel</SelectItem>
            <SelectItem value="tijolo">Tijolo</SelectItem>
            <SelectItem value="papel">Papel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fii-segmento">Segmento</Label>
        {segments.length > 0 || segmentsLoading ? (
          <Select
            value={params.segmento ?? ALL_SEGMENTS}
            onValueChange={(value) => set({ segmento: value === ALL_SEGMENTS ? undefined : value })}
            disabled={segmentsLoading}
          >
            <SelectTrigger id="fii-segmento" className="w-full">
              <SelectValue placeholder={segmentsLoading ? "Carregando segmentos…" : "Todos os segmentos"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SEGMENTS}>Todos os segmentos</SelectItem>
              {segments.map((segment) => (
                <SelectItem key={segment} value={segment}>
                  {segment}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="fii-segmento"
            placeholder="Ex.: Logística, Shoppings"
            value={params.segmento ?? ""}
            onChange={(event) => set({ segmento: event.target.value || undefined })}
          />
        )}
      </div>

      <div className="border-y border-border py-3">
        <LiquidityFilter
          idPrefix="fii"
          kind="fii"
          value={params.minLiquidity}
          onChange={(minLiquidity) => set({ minLiquidity })}
        />
      </div>

      <FiiField label="DY 12m mínimo (proventos reais, bruto)">
        <NumberField
          value={pctToDisplay(params.minDY)}
          onChange={(value) => set({ minDY: pctToStored(value) })}
          placeholder="Ex.: 8"
          ariaLabel="DY 12m mínimo"
          suffix="%"
        />
      </FiiField>
      <FiiField label="P/VP máximo">
        <NumberField
          value={params.maxPVP}
          onChange={(value) => set({ maxPVP: value })}
          placeholder="Ex.: 1,1"
          ariaLabel="P/VP máximo"
        />
      </FiiField>
      <FiiField label="Quantidade mínima de imóveis">
        <NumberField
          value={params.minQtdImoveis}
          onChange={(value) => set({ minQtdImoveis: value === undefined ? undefined : Math.round(value) })}
          placeholder="Ex.: 5"
          ariaLabel="Quantidade mínima de imóveis"
        />
      </FiiField>
      <FiiField label="Vacância máxima">
        <NumberField
          value={pctToDisplay(params.maxVacancia)}
          onChange={(value) => set({ maxVacancia: pctToStored(value) })}
          placeholder="Ex.: 15"
          ariaLabel="Vacância máxima"
          suffix="%"
        />
      </FiiField>
    </div>
  )
}

function FiiField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  )
}
