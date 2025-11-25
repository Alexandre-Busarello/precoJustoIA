'use client'

import { cn } from '@/lib/utils'

interface RadarStatusIndicatorProps {
  status: 'green' | 'yellow' | 'red'
  label: string
  value?: string | number
  className?: string
}

export function RadarStatusIndicator({
  status,
  label,
  value,
  className,
}: RadarStatusIndicatorProps) {
  const statusColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'w-3 h-3 rounded-full shrink-0',
          statusColors[status]
        )}
        aria-label={`Status: ${status}`}
      />
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        {value !== undefined && (
          <span className="text-sm font-medium truncate">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
        )}
      </div>
    </div>
  )
}

