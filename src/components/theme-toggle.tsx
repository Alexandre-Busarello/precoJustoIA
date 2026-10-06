'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_TOGGLE_ENABLED, type ThemePreference } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

interface ThemeToggleProps {
  /** `icon`: botão com menu (header). `list`: três opções em linha (menu mobile, menu do avatar). */
  variant?: 'icon' | 'list'
  className?: string
}

/** Seletor Claro / Escuro / Sistema. Não renderiza nada enquanto THEME_TOGGLE_ENABLED for false. */
export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!THEME_TOGGLE_ENABLED) return null

  const current = (mounted ? theme : undefined) ?? 'system'

  if (variant === 'list') {
    return (
      <div role="radiogroup" aria-label="Tema" className={cn('grid grid-cols-3 gap-1 rounded-lg bg-muted p-1', className)}>
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = current === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:min-h-8',
                selected && 'bg-card text-foreground ring-1 ring-border'
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    )
  }

  const ActiveIcon = mounted && resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Alterar tema" className={className}>
          <ActiveIcon className="size-5 text-muted-foreground" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={current} onValueChange={setTheme}>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
