'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { registerPageContext, resolvePageContext } from '@/lib/ben-context/store'
import { contextFromPath } from '@/lib/ben-context/builders'
import type { BenPageContext } from '@/lib/ben-context/types'

/**
 * Registra o contexto da tela para o Ben (o painel e o botão flutuante o usam). Completa o que a rota e outros
 * pontos da página já registraram, sem apagar: a carteira junta nome e retorno às posições da tabela.
 * O tipo do contexto deve ser o da rota (ativo em /acao/…, carteira em /carteira/…); fora dela, não registra.
 */
export function BenPageContextRegistrar({ context }: { context: Partial<BenPageContext> }) {
  const pathname = usePathname() ?? '/'
  const contextJson = JSON.stringify(context)

  useEffect(() => {
    const provided = JSON.parse(contextJson) as Partial<BenPageContext>
    // Durante a troca de rota a tela antiga ainda pode rodar o efeito com o pathname novo: um contexto de ativo
    // registrado em /ranking (sem o ticker, que vinha da URL) viraria "Vendo: undefined". Só vale para a própria rota.
    if (provided.kind && provided.kind !== contextFromPath(pathname).kind) return
    registerPageContext(pathname, resolvePageContext(pathname, provided))
  }, [pathname, contextJson])

  return null
}
