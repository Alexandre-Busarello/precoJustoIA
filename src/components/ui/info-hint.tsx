"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface InfoHintProps {
  /** Texto de ajuda exibido no popover. */
  content: React.ReactNode
  /** Rótulo acessível do botão. */
  label?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
  contentClassName?: string
}

/**
 * Ajuda contextual que funciona com toque e mouse (Popover, não tooltip de hover).
 * Ícone de 16 px com área de toque de 44 × 44 px, sem deslocar o layout:
 * com mouse, um pseudo-elemento estende a área; em telas de toque, o próprio botão tem 44 px
 * e a margem negativa mantém o espaço ocupado em 20 px.
 */
export function InfoHint({
  content,
  label = "Mais informações",
  side = "top",
  align = "center",
  className,
  contentClassName,
}: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "relative inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none before:absolute before:-inset-3 before:content-[''] pointer-coarse:-m-3 pointer-coarse:size-11 pointer-coarse:before:content-none",
            className
          )}
        >
          <Info className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className={cn("w-64 p-3 text-sm leading-6", contentClassName)}>
        {content}
      </PopoverContent>
    </Popover>
  )
}
