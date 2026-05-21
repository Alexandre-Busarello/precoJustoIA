'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { FAQ_ITEMS } from '../lp-data'

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-slate-200 text-slate-600">Dúvidas frequentes</Badge>
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Perguntas frequentes
          </h2>
        </div>

        {/* Accordion */}
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                    {item.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
