import * as React from "react"
import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDeltaPct } from "@/lib/format"
import { InfoHint } from "@/components/ui/info-hint"

export interface StatProps {
  label: React.ReactNode
  /** Valor já formatado (use @/lib/format). */
  value: React.ReactNode
  /** Variação como fração (0,012 = +1,2%), exibida com sinal e cor semântica. */
  delta?: number | null
  /** Texto curto após a variação (ex.: "hoje", "12m"). */
  deltaLabel?: string
  /** Ajuda contextual (InfoHint ao lado do rótulo). */
  hint?: React.ReactNode
  /** Linha auxiliar abaixo do valor (ex.: "Graham", "Bom"). */
  caption?: React.ReactNode
  /** Cor do valor: só use positive/negative para resultado/variação, nunca para preço estático. */
  tone?: "default" | "positive" | "negative"
  size?: "sm" | "md"
  /** Premium bloqueado: mostra um valor fictício borrado + cadeado (o valor real não vai para o DOM). */
  locked?: boolean
  lockedLabel?: string
  className?: string
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
}

/** KPI: rótulo (xs, muted), valor (tabular-nums), variação opcional e ajuda opcional. Sem ícone decorativo. */
export function Stat({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  caption,
  tone = "default",
  size = "md",
  locked = false,
  lockedLabel = "Disponível no Premium",
  className,
}: StatProps) {
  const deltaValue = typeof delta === "number" && Number.isFinite(delta) ? delta : null
  const hasDelta = deltaValue !== null
  // A cor segue o valor exibido (1 casa): um delta que arredonda para 0,0% fica neutro.
  // Mesmo arredondamento de formatDeltaPct (meio para longe do zero): −0,0005 aparece como −0,1% e fica negativo.
  const deltaSign = deltaValue === null ? 0 : Math.sign(deltaValue) * Math.sign(Math.round(Math.abs(deltaValue) * 1000))

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {hint && <InfoHint content={hint} />}
      </div>
      {locked ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "select-none font-semibold tabular-nums text-foreground blur-sm",
              size === "md" ? "text-xl sm:text-2xl" : "text-lg"
            )}
          >
            00,00
          </span>
          <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{lockedLabel}</span>
        </div>
      ) : (
        <div
          data-num
          className={cn(
            "mt-1 truncate font-semibold tabular-nums tracking-tight",
            size === "md" ? "text-xl sm:text-2xl" : "text-lg",
            TONE[tone]
          )}
        >
          {value}
        </div>
      )}
      {(hasDelta || caption) && !locked && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {deltaValue !== null && (
            <span
              data-num
              className={cn(
                "font-medium tabular-nums",
                deltaSign > 0 ? "text-positive" : deltaSign < 0 ? "text-negative" : "text-muted-foreground"
              )}
            >
              {formatDeltaPct(deltaValue)}
            </span>
          )}
          {hasDelta && deltaLabel && <span>{deltaLabel}</span>}
          {caption && <span className="truncate">{caption}</span>}
        </div>
      )}
    </div>
  )
}
