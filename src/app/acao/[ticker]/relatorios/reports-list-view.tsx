import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { ReportsTable, type ReportsTableRow } from './reports-table'

interface ReportsListViewProps {
  company: { ticker: string; name: string }
  /** Rota da página do ativo (ex.: `/acao/petr4`). */
  assetHref: string
  rows: ReportsTableRow[]
  windowMonths: number
  isPremium: boolean
  isLoggedIn: boolean
  /** Linha de resumo ("5 relatórios: 2 análises mensais..."). */
  summary?: string
  /** Conteúdo extra abaixo do cabeçalho (ex.: link para o ticker anterior). */
  aside?: ReactNode
}

/** Página "Relatórios" de um ativo: cabeçalho, uma chamada para o Premium (quando aplicável) e a tabela. */
export function ReportsListView({
  company,
  assetHref,
  rows,
  windowMonths,
  isPremium,
  isLoggedIn,
  summary,
  aside,
}: ReportsListViewProps) {
  const cta = isLoggedIn
    ? { label: 'Desbloquear relatórios completos', href: '/planos' }
    : { label: 'Desbloquear com 1 dia grátis', href: '/register' }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: company.ticker, href: assetHref }, { label: 'Relatórios' }]}
        title={`Relatórios de ${company.ticker}`}
        description={`${company.name} · relatórios gerados por IA nos últimos ${windowMonths} meses`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={assetHref}>Voltar para {company.ticker}</Link>
          </Button>
        }
      />

      {aside}

      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

      {!isPremium && rows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Scores e textos completos dos relatórios estão disponíveis no Premium.
          </p>
          <Button asChild size="sm" className="shrink-0">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </div>
      )}

      <ReportsTable
        rows={rows}
        emptyDescription={`Nenhum relatório nos últimos ${windowMonths} meses. Acompanhe o ativo para ser avisado quando houver um novo.`}
      />

      <p className="text-xs text-muted-foreground">
        Relatórios gerados por IA a partir de dados públicos. São estimativas, não recomendação de investimento.
      </p>
    </main>
  )
}

/** "5 relatórios: 2 análises mensais, 1 mudança positiva e 1 negativa". */
export function reportsSummary(reports: Array<{ type: string; changeDirection: string | null }>): string | undefined {
  if (reports.length === 0) return undefined
  const count = (predicate: (r: { type: string; changeDirection: string | null }) => boolean) => reports.filter(predicate).length
  const monthly = count((r) => r.type === 'MONTHLY_OVERVIEW')
  const positive = count((r) => r.type === 'FUNDAMENTAL_CHANGE' && r.changeDirection === 'positive')
  const negative = count((r) => r.type === 'FUNDAMENTAL_CHANGE' && r.changeDirection !== 'positive')
  const price = count((r) => r.type === 'PRICE_VARIATION')
  const custom = count((r) => r.type === 'CUSTOM_TRIGGER')
  const parts = [
    monthly > 0 && `${monthly} ${monthly === 1 ? 'análise mensal' : 'análises mensais'}`,
    positive > 0 && `${positive} ${positive === 1 ? 'mudança positiva' : 'mudanças positivas'}`,
    negative > 0 && `${negative} ${negative === 1 ? 'mudança negativa' : 'mudanças negativas'}`,
    price > 0 && `${price} ${price === 1 ? 'variação de preço' : 'variações de preço'}`,
    custom > 0 && `${custom} ${custom === 1 ? 'gatilho personalizado' : 'gatilhos personalizados'}`,
  ].filter(Boolean) as string[]
  const total = `${reports.length} ${reports.length === 1 ? 'relatório' : 'relatórios'}`
  if (parts.length === 0) return total
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
  return `${total}: ${list}.`
}
