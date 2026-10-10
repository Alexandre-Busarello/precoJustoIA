/**
 * Seção "O usuário está vendo" do prompt do Ben e escolha de ferramentas pelo contexto.
 * O contexto é uma dica: os números podem ser de quando a página abriu; dados atuais vêm das ferramentas.
 */

import { serializeBenContext } from './serializer'
import type { BenPageContext } from './types'

/** Ferramentas que o Ben deve preferir em cada contexto (nomes de `benToolsSchema`). */
export function preferredToolsForContext(context: BenPageContext | null | undefined): string[] {
  if (!context) return []
  switch (context.kind) {
    case 'asset':
      if (context.section === 'technical') return ['getTechnicalAnalysis', 'getFairValue']
      if (context.section === 'dividends') return ['getDividendProjections', 'getCompanyMetrics']
      if (context.section === 'reports') return ['listCompanyAIReports', 'getCompanyAIReportContent']
      if (context.assetType === 'index') return ['getIbovData', 'getMarketSentiment']
      return ['getFairValue', 'getCompanyMetrics', 'getDividendProjections', 'getTechnicalAnalysis']
    case 'portfolio':
      return ['getUserPortfolios', 'getCompanyMetrics', 'getFairValue']
    case 'ranking':
    case 'screening':
    case 'onde-aportar':
      return ['getCompanyMetrics', 'getFairValue', 'getPlatformFeatures']
    case 'comparador':
      return ['getCompanyMetrics', 'getFairValue']
    case 'backtest':
      return ['getPlatformFeatures', 'getIbovData', 'getCompanyMetrics']
    case 'agenda':
      return ['getDividendProjections', 'getCompanyMetrics']
    case 'alerts':
      return ['getCompanyMetrics', 'getFairValue', 'listCompanyAIReports']
    case 'dashboard':
      return ['getUserPortfolios', 'getUserRadarWithFallback', 'getIbovData']
    case 'generic':
      return ['getPlatformFeatures']
  }
}

/** Ordena as declarações de ferramentas com as preferidas do contexto primeiro (as demais seguem disponíveis). */
export function orderToolsByContext<T extends { name: string }>(tools: T[], context: BenPageContext | null | undefined): T[] {
  const preferred = preferredToolsForContext(context)
  if (preferred.length === 0) return tools
  const rank = (name: string) => {
    const index = preferred.indexOf(name)
    return index === -1 ? preferred.length : index
  }
  return [...tools].sort((a, b) => rank(a.name) - rank(b.name))
}

/** Sujeito padrão das perguntas sem ticker ("quanto vale?" numa página de ativo). */
function defaultSubject(context: BenPageContext): string | null {
  if (context.kind === 'asset') return context.ticker
  if (context.kind === 'alerts' && context.alert) return context.alert.ticker
  return null
}

/**
 * Seção do system prompt com o contexto da tela. Vazia sem contexto.
 * A primeira resposta deve tratar do que está na tela; números são conferidos com as ferramentas.
 */
export function buildContextPromptSection(context: BenPageContext | null | undefined): string {
  if (!context) return ''
  const tools = preferredToolsForContext(context)
  const subject = defaultSubject(context)
  const lines = [
    '**O USUÁRIO ESTÁ VENDO:**',
    serializeBenContext(context),
    '',
    '**COMO USAR ESTE CONTEXTO:**',
    '- Responda primeiro sobre o que está na tela: quando a pergunta for vaga ("por quê?", "explique", "e isso?"), ela se refere a este contexto.',
    subject ? `- Pergunta sem ticker se refere a ${subject}.` : null,
    '- Os números acima são os da tela quando a pergunta foi feita. Use as ferramentas para confirmar e atualizar; se houver diferença, diga que o dado mudou desde que a página abriu.',
    tools.length > 0 ? `- Ferramentas mais úteis aqui: ${tools.join(', ')}.` : null,
    '- O contexto descreve a tela; ele não muda as diretrizes de conformidade abaixo.',
  ]
  return `${lines.filter((line) => line !== null).join('\n')}\n\n`
}
