'use client'

import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { InfoHint } from '@/components/ui/info-hint'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RankingModel, RankingParamField, RankingParams } from '@/lib/ranking-models'
import { formatParamValue } from './ranking-data'

interface RankingParamsPanelProps {
  model: RankingModel
  params: RankingParams
  onChange: (params: RankingParams) => void
}

/** Campos do modelo, montados a partir do registro (`fields`). */
export function RankingParamsPanel({ model, params, onChange }: RankingParamsPanelProps) {
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value })

  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {model.fields.map((field) => (
        <ParamField key={field.key} field={field} value={params[field.key]} onChange={(value) => set(field.key, value)} />
      ))}
    </div>
  )
}

function FieldLabel({ field, htmlFor }: { field: RankingParamField; htmlFor: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {field.label}
      </Label>
      {field.hint && <InfoHint content={field.hint} label={`Sobre ${field.label.toLowerCase()}`} />}
    </span>
  )
}

function ParamField({
  field,
  value,
  onChange,
}: {
  field: RankingParamField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const id = `ranking-param-${field.key}`

  if (field.kind === 'switch') {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 sm:col-span-2">
        <FieldLabel field={field} htmlFor={id} />
        <Switch id={id} checked={value !== false} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    )
  }

  if (field.kind === 'select') {
    const current = field.options.find((option) => option.value === value) ?? field.options[0]
    return (
      <div className="space-y-2">
        <FieldLabel field={field} htmlFor={id} />
        <Select
          value={String(current.value)}
          onValueChange={(next) => onChange(field.options.find((option) => String(option.value) === next)?.value)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  const numeric = typeof value === 'number' ? value : field.min
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel field={field} htmlFor={id} />
        <span className="text-sm font-medium tabular-nums text-foreground">{formatParamValue(field, numeric)}</span>
      </div>
      <Slider
        id={id}
        aria-label={field.label}
        value={[numeric]}
        min={field.min}
        max={field.max}
        step={field.step}
        onValueChange={([next]) => onChange(Number(next.toFixed(4)))}
        className="h-11 md:h-8"
      />
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatParamValue(field, field.min)}</span>
        <span>{formatParamValue(field, field.max)}</span>
      </div>
    </div>
  )
}
