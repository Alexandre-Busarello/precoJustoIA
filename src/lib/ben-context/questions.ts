/**
 * Perguntas dos pontos "Perguntar ao Ben" e sugestões iniciais por contexto (até 3), para a tela inicial do chat.
 * Linguagem de explicação, nunca de indicação de compra ou venda.
 */

import { formatBRL } from '@/lib/format'
import type { BenPageContext } from './types'

/** Como cada modelo aparece na pergunta: "pelo FCD", "o número de Graham", "o preço-teto (Bazin)". */
const VALUATION_SUBJECT: Record<string, string> = {
  graham: 'o número de Graham',
  bazin: 'o preço-teto (Bazin)',
  bankPvp: 'o preço justo pelo P/VP justo',
}

export const askBenQuestions = {
  /** Linha da tabela de valuation: "Por que o preço justo pelo FCD é R$ 45,10?". */
  valuation(model: { key: string; shortLabel: string }, fairValue: number | null): string {
    const subject = VALUATION_SUBJECT[model.key] ?? `o preço justo pelo ${model.shortLabel}`
    return fairValue === null ? `Como é calculado ${subject}?` : `Por que ${subject} é ${formatBRL(fairValue)}?`
  },
  /** Posição da carteira. */
  holding(ticker: string): string {
    return `Como ${ticker} pesa na minha carteira?`
  },
  /** Resultado do Onde aportar. */
  allocation(): string {
    return 'Explique por que esta alocação'
  },
  /** Resultados de ranking ou screening. */
  results(): string {
    return 'O que estes resultados têm em comum?'
  },
  /** Alerta que disparou. */
  alert(): string {
    return 'Por que este alerta disparou?'
  },
}

export interface BenSuggestion {
  /** Texto do botão. */
  label: string
  /** Pergunta enviada. */
  prompt: string
}

function suggestion(label: string, prompt: string = label): BenSuggestion {
  return { label, prompt }
}

/** Até 3 sugestões para o início da conversa, de acordo com o que está na tela. */
export function contextSuggestions(context: BenPageContext | null | undefined): BenSuggestion[] {
  if (!context) return []
  const list: BenSuggestion[] = (() => {
    switch (context.kind) {
      case 'asset': {
        const t = context.ticker
        if (context.section === 'technical') {
          return [
            suggestion(`Leia a análise técnica de ${t}`, `Explique os indicadores técnicos de ${t} que aparecem nesta página, em linguagem simples.`),
            suggestion(`Suportes e resistências de ${t}`, `Quais são os principais suportes e resistências de ${t}?`),
          ]
        }
        if (context.section === 'dividends') {
          return [
            suggestion(`Dividendos de ${t} em 1 minuto`, `Resumo dos dividendos de ${t}: yield projetado 12m, próximos pagamentos e sustentabilidade.`),
            suggestion(`O payout de ${t} é sustentável?`),
          ]
        }
        if (context.assetType === 'index') {
          return [suggestion(`Como está o ${t} hoje?`), suggestion('O que mais pesou no índice recentemente?')]
        }
        const firstModel = context.valuations?.find((v) => v.fairValue !== null)
        return [
          suggestion(`Resumo de ${t} em 5 tópicos`, `Resumo de ${t} em 5 tópicos: preço justo estimado, diferença para o preço atual, dividend yield, riscos principais e posição em relação ao preço justo.`),
          firstModel
            ? suggestion(`Por que o preço justo pelo ${firstModel.model}?`, `Por que o preço justo de ${t} pelo ${firstModel.model} é ${formatBRL(firstModel.fairValue)}?`)
            : suggestion(`Como os modelos avaliam ${t}?`, `Explique o que os modelos de valuation da plataforma indicam para ${t} e por que divergem.`),
          suggestion(`Riscos de ${t}`, `Liste os 3 principais riscos e os 3 principais pontos fortes de ${t}, de forma objetiva.`),
        ]
      }
      case 'portfolio': {
        const top = context.holdings[0]?.ticker
        return [
          suggestion('Resumo da carteira', 'Faça um resumo desta carteira: retorno, concentração e principais posições.'),
          suggestion('Como está a diversificação?', 'Como está a diversificação desta carteira por setor e por ativo?'),
          ...(top ? [suggestion(`Como ${top} pesa na carteira?`, `Como ${top} pesa na minha carteira?`)] : []),
        ]
      }
      case 'ranking':
        return context.tickers.length > 0
          ? [
              suggestion('O que estes resultados têm em comum?'),
              suggestion(`Como o modelo ${context.model || 'do ranking'} funciona?`, `Explique como o modelo ${context.model || 'deste ranking'} seleciona e ordena os ativos.`),
              suggestion(`Compare ${context.tickers.slice(0, 2).join(' e ')}`, `Compare ${context.tickers.slice(0, 2).join(' e ')} pelos fundamentos e pelo preço justo estimado.`),
            ]
          : [suggestion('Qual modelo de ranking usar para dividendos?', 'Quais modelos de ranking da plataforma olham para dividendos e como cada um funciona?')]
      case 'screening':
        return [
          suggestion('O que estes resultados têm em comum?'),
          suggestion('Que filtros afinam esta busca?', 'Que filtros posso ajustar para deixar esta busca mais seletiva, e o que cada um mede?'),
        ]
      case 'comparador':
        return context.tickers.length >= 2
          ? [suggestion(`Compare ${context.tickers.join(' e ')}`, `Compare ${context.tickers.join(', ')} pelos fundamentos, pelo preço justo estimado e pelos dividendos.`)]
          : [suggestion('Como usar o comparador?', 'Como funciona o comparador de ações da plataforma?')]
      case 'onde-aportar':
        return context.allocations.length > 0
          ? [suggestion('Explique por que esta alocação'), suggestion('Como mudar os critérios muda o resultado?', 'Como os pesos de desconto, qualidade e peso-alvo mudam esta distribuição?')]
          : [suggestion('Como o Onde aportar funciona?', 'Explique como a calculadora Onde aportar distribui um aporte entre os ativos.')]
      case 'backtest':
        return [
          suggestion('Leia este resultado', 'Explique o resultado deste backtest comparado ao CDI e ao Ibovespa.'),
          suggestion('O que o drawdown mostra?', 'O que significam drawdown máximo e volatilidade num backtest?'),
        ]
      case 'agenda':
        return [
          suggestion('Próximos proventos', 'Quais são os próximos proventos da agenda e quando é a data-com de cada um?'),
          suggestion('Data-com e data ex', 'Qual a diferença entre data-com, data ex e data de pagamento?'),
        ]
      case 'alerts':
        return context.alert
          ? [suggestion('Por que este alerta disparou?'), suggestion(`O que mudou em ${context.alert.ticker}?`, `O que mudou recentemente nos fundamentos e no preço de ${context.alert.ticker}?`)]
          : [suggestion('Que alertas posso criar?', 'Que tipos de alerta e monitoramento posso criar na plataforma?')]
      case 'dashboard':
        return [
          suggestion('Como está o Ibovespa?', 'Como está o Ibovespa e o sentimento do mercado hoje?'),
          suggestion('Resumo das minhas carteiras', 'Faça um resumo das minhas carteiras: retorno e maiores posições.'),
          suggestion('Por onde começar?', 'Quais ferramentas da plataforma ajudam a decidir onde aportar este mês?'),
        ]
      case 'generic':
        return [suggestion('O que o Ben pode fazer?', 'O que você pode fazer por mim na plataforma?')]
    }
  })()
  return list.slice(0, 3)
}
