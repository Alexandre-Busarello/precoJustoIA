'use client'

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ComparadorTipo = 'acoes' | 'etfs'

interface ComparadorTabsProps {
  defaultTipo: ComparadorTipo
  acoes: React.ReactNode
  etfs: React.ReactNode
}

/** Abas "Ações | ETFs" do comparador. A aba ativa fica na URL (`?tipo=etfs`) sem recarregar a página. */
export function ComparadorTabs({ defaultTipo, acoes, etfs }: ComparadorTabsProps) {
  const [tipo, setTipo] = React.useState<ComparadorTipo>(defaultTipo)

  const handleChange = (value: string) => {
    const next: ComparadorTipo = value === 'etfs' ? 'etfs' : 'acoes'
    setTipo(next)
    window.history.replaceState(null, '', next === 'etfs' ? '/comparador?tipo=etfs' : '/comparador')
  }

  return (
    <Tabs value={tipo} onValueChange={handleChange} className="gap-6">
      <TabsList variant="underline" aria-label="Tipo de ativo">
        <TabsTrigger value="acoes" className="min-w-11">Ações</TabsTrigger>
        <TabsTrigger value="etfs" className="min-w-11">ETFs</TabsTrigger>
      </TabsList>
      <TabsContent value="acoes" className="min-w-0">
        {acoes}
      </TabsContent>
      <TabsContent value="etfs" className="min-w-0">
        {etfs}
      </TabsContent>
    </Tabs>
  )
}
