'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ComparadorTipo = 'acoes' | 'etfs'

interface ComparadorTabsProps {
  defaultTipo: ComparadorTipo
  acoes: React.ReactNode
  etfs: React.ReactNode
}

/** Abas "Ações | ETFs" do comparador. A aba ativa fica na URL (`?tipo=etfs`) sem recarregar a página. */
export function ComparadorTabs({ defaultTipo, acoes, etfs }: ComparadorTabsProps) {
  // A URL é a fonte da verdade: links internos para /comparador ou /comparador?tipo=etfs trocam a aba
  // mesmo com o hub já montado (navegação no cliente). history.replaceState é sincronizado pelo Next.
  const searchParams = useSearchParams()
  const urlTipo: ComparadorTipo | null = searchParams ? (searchParams.get('tipo') === 'etfs' ? 'etfs' : 'acoes') : null
  const tipo: ComparadorTipo = urlTipo ?? defaultTipo

  const handleChange = (value: string) => {
    const next: ComparadorTipo = value === 'etfs' ? 'etfs' : 'acoes'
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
