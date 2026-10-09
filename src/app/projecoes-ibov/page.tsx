/**
 * Projeções do Ibovespa: faixas estatísticas para 1 semana, 1 mês e 12 meses calculadas a partir do comportamento
 * histórico do índice (percentis das variações passadas aplicados ao último fechamento), com calibração.
 * Todos os números vêm do cálculo determinístico; a IA, quando há comentário, só escreve o contexto.
 */

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/ui/section-header'
import { Stat } from '@/components/ui/stat'
import { formatDate, formatMultiple, formatNumber, formatPct } from '@/lib/format'
import { LOOKBACK_DAYS, VOL_SCALE_MAX, VOL_SCALE_MIN } from '@/lib/ibov-projections/engine'
import { getIbovProjectionReport } from '@/lib/ibov-projections/service'
import type { IbovProjectionReport, MacroRate } from '@/lib/ibov-projections/types'
import { HorizonCard } from './horizon-card'
import ProjectionChart from './projection-chart'

export const dynamic = 'force-dynamic'

const day = (date: string) => formatDate(`${date}T12:00:00Z`)

async function loadReport(): Promise<IbovProjectionReport | null> {
  try {
    return await getIbovProjectionReport()
  } catch {
    return null
  }
}

function StaleNotice({ report }: { report: IbovProjectionReport }) {
  if (!report.stale.isStale || !report.lastCloseDate) return null
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-warning-subtle p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-foreground">
        O último fechamento disponível é de {day(report.lastCloseDate)}, há {formatNumber(report.stale.tradingDaysSinceClose, { digits: 0 })}{' '}
        dias úteis. As faixas podem estar desatualizadas até a fonte de cotações voltar a responder.
      </p>
    </div>
  )
}

function Overview({ report }: { report: IbovProjectionReport }) {
  const lastClose = report.lastClose ?? 0
  const delta = report.previousClose ? lastClose / report.previousClose - 1 : null
  const vol = report.horizons.find((h) => h.volatility)?.volatility ?? null

  return (
    <section className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
      <Stat
        label="Último fechamento"
        value={`${formatNumber(lastClose, { digits: 0 })} pts`}
        delta={delta}
        deltaLabel={report.lastCloseDate ? `em ${day(report.lastCloseDate)}` : undefined}
      />
      <Stat
        label="Volatilidade"
        value={vol?.ratio ? formatMultiple(vol.ratio, { digits: 2 }) : '—'}
        caption="da mediana de 10 anos"
        hint={`Volatilidade dos últimos 63 pregões dividida pela mediana dessa medida nos últimos 10 anos. As faixas são ajustadas por esse fator, limitado entre ${formatMultiple(VOL_SCALE_MIN)} e ${formatMultiple(VOL_SCALE_MAX)}.`}
      />
      <Stat
        label="Calculado em"
        value={formatDate(report.generatedAt, { style: 'datetime' })}
        size="sm"
        caption="atualiza a cada pregão"
        className="col-span-2 sm:col-span-1"
      />
    </section>
  )
}

/** Data da taxa; sem dado recente no banco, avisa que o valor é a premissa padrão. */
function rateHint(rate: MacroRate): string {
  return rate.source === 'db' && rate.asOf
    ? `Taxa do Banco Central em ${day(rate.asOf)}.`
    : 'Premissa padrão do Preço Justo AI: não há dado recente do Banco Central nesta base.'
}

function ContextSection({ report }: { report: IbovProjectionReport }) {
  const { plBolsa, selic, cdi } = report.context
  if (!plBolsa && !selic && !cdi) return null
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader
        title="Contexto"
        description="Dados de mercado para leitura das faixas. Eles não entram no cálculo."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {plBolsa && (
          <Stat
            label="P/L da bolsa"
            value={formatMultiple(plBolsa.current)}
            caption={`percentil ${formatNumber(plBolsa.percentileRank * 100, { digits: 0 })} desde ${plBolsa.since.slice(0, 4)}`}
            hint={`P/L agregado das ações da B3 em ${day(plBolsa.asOf)}. Média da série: ${formatMultiple(plBolsa.average)}. Percentil 80 significa que em 80% dos meses o P/L esteve igual ou abaixo do atual.`}
            className="col-span-2 sm:col-span-1"
          />
        )}
        {selic && <Stat label="Selic" value={formatPct(selic.value, { digits: 2 })} caption="ao ano" hint={rateHint(selic)} />}
        {cdi && <Stat label="CDI" value={formatPct(cdi.value, { digits: 2 })} caption="ao ano" hint={rateHint(cdi)} />}
      </div>
      {plBolsa && (
        <p className="text-sm">
          <Link href="/pl-bolsa" className="font-medium text-brand underline-offset-4 hover:underline">
            Ver o histórico do P/L da bolsa
          </Link>
        </p>
      )}
    </section>
  )
}

function CommentarySection({ report }: { report: IbovProjectionReport }) {
  if (!report.commentary) return null
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Leitura do cenário</h2>
        <Badge variant="neutral">Comentário gerado por IA</Badge>
      </div>
      <p className="text-sm leading-6 text-foreground">{report.commentary.text}</p>
      <p className="text-xs text-muted-foreground">
        Escrito pelo Ben em {formatDate(report.commentary.generatedAt, { style: 'datetime' })} a partir dos números acima. O comentário não altera as
        faixas.
      </p>
    </section>
  )
}

function Methodology({ report }: { report: IbovProjectionReport }) {
  const years = formatNumber(LOOKBACK_DAYS / 252, { digits: 0 })
  return (
    <section id="metodologia" className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm leading-6 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Como as faixas são calculadas</h2>
      <p className="text-muted-foreground">
        Usamos os fechamentos diários do Ibovespa dos últimos {years} anos
        {report.historyStart ? ` (desde ${day(report.historyStart)})` : ''}. Para cada horizonte (5, 21 e 252 pregões), medimos a variação do
        índice em todas as janelas desse tamanho, uma começando em cada pregão. Os percentis 16 e 84 dessas variações formam a faixa provável
        (cerca de 68% dos casos) e os percentis 5 e 95, a faixa ampla (cerca de 90%). As variações são aplicadas ao último fechamento.
      </p>
      <p className="text-muted-foreground">
        {report.volatilityAdjusted
          ? `A largura é ajustada pela volatilidade recente: se os últimos 63 pregões oscilaram mais que o normal, a faixa abre; se oscilaram menos, fecha. O fator fica entre ${formatMultiple(VOL_SCALE_MIN)} e ${formatMultiple(VOL_SCALE_MAX)}. `
          : ''}
        Para conferir se o método funciona, refazemos o cálculo em datas passadas usando só os dados disponíveis em cada data e contamos quantas vezes o
        fechamento realizado caiu dentro das faixas. É isso que aparece como calibração em cada cartão.
      </p>
      <p className="text-muted-foreground">
        Janelas sobrepostas não são independentes: em 10 anos há só cerca de 10 períodos de 12 meses sem sobreposição, por isso a faixa anual é a
        menos precisa. Os valores não consideram dividendos, eventos inéditos nem mudanças de regime além da volatilidade.
      </p>
      <p>
        <Link href="/metodologia" className="font-medium text-brand underline-offset-4 hover:underline">
          Ver a metodologia geral do Preço Justo AI
        </Link>
      </p>
    </section>
  )
}

export default async function ProjecoesIbovPage() {
  const report = await loadReport()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <PageHeader
          title="Projeções do Ibovespa"
          description="Faixas estatísticas para 1 semana, 1 mês e 12 meses com base no comportamento histórico do índice. Não é previsão nem recomendação."
        />

        {!report || report.lastClose === null ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground">Não foi possível calcular as faixas agora.</p>
            <p className="mt-1 text-sm text-muted-foreground">A fonte de cotações não respondeu. Tente de novo em alguns minutos.</p>
          </div>
        ) : (
          <>
            <StaleNotice report={report} />
            <Overview report={report} />

            <div className="grid gap-4 lg:grid-cols-3">
              {report.horizons.map((horizon) => (
                <HorizonCard key={horizon.id} horizon={horizon} lastClose={report.lastClose!} historyStart={report.historyStart} />
              ))}
            </div>

            {report.cone.length > 0 && (
              <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
                <SectionHeader
                  title="Histórico e faixas"
                  description="Últimos 12 meses de fechamentos e as faixas para os próximos 12 meses. Datas futuras aproximadas, sem feriados."
                />
                <ProjectionChart history={report.history} cone={report.cone} />
              </section>
            )}

            <ContextSection report={report} />
            <CommentarySection report={report} />
            <Methodology report={report} />
          </>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          Faixa estatística com base no comportamento histórico do índice, não é previsão nem recomendação de investimento. Rentabilidade passada não
          garante resultados futuros.
        </p>
      </div>
    </div>
  )
}
