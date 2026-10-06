import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

export type RadarStatus = 'green' | 'yellow' | 'red'

interface RadarStatusIndicatorProps {
  status: RadarStatus
  /** Valor já formatado (ex.: "72", "Positivo"); números são formatados com 1 casa. */
  value: string | number
  /** Rótulo acima do valor (opcional; em tabela o cabeçalho já nomeia a coluna). */
  label?: string
  /** Texto do nível para leitores de tela (padrão: alto/médio/baixo). */
  levelLabel?: string
  className?: string
}

const LEVEL: Record<RadarStatus, { fill: string; text: string }> = {
  green: { fill: 'w-full', text: 'alto' },
  yellow: { fill: 'w-1/2', text: 'médio' },
  red: { fill: 'w-0', text: 'baixo' },
}

/** Valores que significam "sem dado" (o ponto fica vazio e o leitor de tela ouve "sem dado"). */
const EMPTY_VALUES = new Set(['', '—', '-', 'N/A'])

/**
 * Status neutro: ponto cheio (alto), meio cheio (médio) ou vazio (baixo) ao lado do valor em texto.
 * Sem verde/vermelho: o texto carrega o significado e o ponto é só um apoio visual.
 * Sem dado (`—`): traço discreto no lugar do ponto, sem nível.
 */
export function RadarStatusIndicator({ status, value, label, levelLabel, className }: RadarStatusIndicatorProps) {
  const level = LEVEL[status]
  const isEmpty = typeof value === 'string' && EMPTY_VALUES.has(value.trim())
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {isEmpty ? (
        <span aria-hidden="true" className="inline-flex size-2 shrink-0 items-center justify-center">
          <span className="h-px w-2 bg-border" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="relative inline-flex size-2 shrink-0 overflow-hidden rounded-full border border-muted-foreground"
        >
          <span className={cn('h-full bg-muted-foreground', level.fill)} />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        {label && <span className="truncate text-xs text-muted-foreground">{label}</span>}
        <span
          className={cn(
            'truncate text-sm font-medium tabular-nums',
            isEmpty ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {isEmpty ? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">sem dado</span>
            </>
          ) : (
            <>
              {typeof value === 'number' ? formatNumber(value, { digits: 1 }) : value}
              <span className="sr-only"> (nível {levelLabel ?? level.text})</span>
            </>
          )}
        </span>
      </span>
    </div>
  )
}
