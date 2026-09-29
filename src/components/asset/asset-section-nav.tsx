'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface AssetSection {
  /** id do elemento da seção na página (sem #). */
  id: string
  label: string
}

interface AssetSectionNavProps {
  sections: AssetSection[]
  className?: string
}

/** Altura do header fixo + da própria barra, usada como scroll-margin das seções. */
const OFFSET_PX = 112

/**
 * Navegação interna por âncoras (tabs sublinhadas), fixa abaixo do header.
 * Rola na horizontal no mobile e destaca a seção visível via IntersectionObserver.
 */
export function AssetSectionNav({ sections, className }: AssetSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null)
    elements.forEach((el) => {
      el.style.scrollMarginTop = `${OFFSET_PX}px`
    })
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return

    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top)
          else visible.delete(entry.target.id)
        })
        if (visible.size > 0) {
          const [first] = [...visible.entries()].sort((a, b) => a[1] - b[1])
          setActiveId(first[0])
        }
      },
      { rootMargin: `-${OFFSET_PX}px 0px -55% 0px`, threshold: 0 }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  // Mantém o item ativo visível na faixa rolável
  useEffect(() => {
    if (!activeId || !listRef.current) return
    const link = listRef.current.querySelector<HTMLElement>(`[data-section="${activeId}"]`)
    link?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  return (
    <nav
      aria-label="Seções da página"
      className={cn('sticky top-14 z-30 -mx-4 border-b border-border bg-background px-4 lg:top-16', className)}
    >
      <ul ref={listRef} className="no-scrollbar flex snap-x gap-5 overflow-x-auto">
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <li key={section.id} className="shrink-0 snap-start">
              <a
                href={`#${section.id}`}
                data-section={section.id}
                aria-current={active ? 'true' : undefined}
                onClick={() => setActiveId(section.id)}
                className={cn(
                  'relative inline-flex h-11 items-center whitespace-nowrap text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full md:h-10',
                  active ? 'text-foreground after:bg-brand' : 'text-muted-foreground after:bg-transparent hover:text-foreground'
                )}
              >
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
