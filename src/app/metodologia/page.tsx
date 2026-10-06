import type { Metadata } from "next"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { getMacroAssumptions, keFromMacro, type MacroField, type MacroFieldInfo } from "@/lib/finance/macro"
import { LIQUIDITY_DEFAULTS } from "@/lib/finance/liquidity-rules"
import { JCP_IRRF_RATE_FROM_2026, JCP_IRRF_RATE_UNTIL_2025 } from "@/lib/finance/dividends"
import { formatDate, formatNumber, formatPct } from "@/lib/format"
import { fiiTargetDY } from "@/lib/fii-listing-valuation"
import {
  METHODOLOGY_GROUPS,
  METODOLOGIA_INTRO_SECTIONS,
  METODOLOGIA_OUTRO_SECTIONS,
  type MethodologyDoc,
} from "@/lib/metodologia-content"
import { formatLiquidityLimit } from "@/lib/ranking-methodology"

// As premissas vêm do banco (BCB SGS) com cache de 1 hora; a página acompanha esse ritmo.
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Metodologia: modelos de valuation, premissas e limitações",
  description:
    "Como o Preço Justo AI calcula cada estimativa: Graham, Bazin, Barsi, Gordon, FCD, P/VP justo para bancos, Peter Lynch, Fórmula Mágica, Score PJ-FII, preço-teto de FIIs e Score PJ-ETF, com critérios, limitações e as premissas macro em uso.",
  keywords:
    "metodologia análise fundamentalista, número de graham, método bazin, método barsi, modelo de gordon, fluxo de caixa descontado, p/vp justo bancos, peter lynch peg, fórmula mágica greenblatt, margem de segurança, score fii, preço-teto fii, dy alvo ntn-b, score etf",
  openGraph: {
    title: "Metodologia: modelos de valuation, premissas e limitações",
    description: "Fórmulas, critérios, limitações e premissas macro de cada modelo usado no Preço Justo AI.",
    type: "article",
    url: "https://precojusto.ai/metodologia",
  },
  alternates: {
    canonical: "/metodologia",
  },
}

const DISCLAIMER =
  "Estimativa gerada por modelo quantitativo com dados públicos; não é recomendação de investimento. Rentabilidade passada não garante resultados futuros."

const MACRO_ROWS: { field: MacroField; label: string; note?: string }[] = [
  { field: "selic", label: "Selic meta" },
  { field: "cdi", label: "CDI" },
  { field: "ipca12m", label: "IPCA", note: "realizado em 12 meses" },
  { field: "ntnbRealLong", label: "NTN-B longa", note: "taxa real" },
  { field: "erp", label: "Prêmio de risco (ERP)" },
]

/** Datas das premissas chegam como YYYY-MM-DD; meio-dia UTC evita mostrar o dia anterior no fuso de Brasília. */
function formatDay(isoDay: string): string {
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? `${isoDay}T12:00:00Z` : isoDay)
}

function sourceLabel(info: MacroFieldInfo): string {
  return info.source === "db" ? "BCB SGS" : "Valor de referência"
}

interface TocEntry {
  id: string
  label: string
  children?: { id: string; label: string }[]
}

const TOC: TocEntry[] = [
  ...METODOLOGIA_INTRO_SECTIONS.map((section) => ({ id: section.id, label: section.label })),
  ...METHODOLOGY_GROUPS.map((group) => ({
    id: group.id,
    label: group.tocLabel,
    children: group.docs.map((doc) => ({ id: doc.id, label: doc.name })),
  })),
  ...METODOLOGIA_OUTRO_SECTIONS.map((section) => ({ id: section.id, label: section.label })),
]

const tocLinkClass =
  "flex min-h-11 items-center rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:min-h-8"

function TocLinks() {
  return (
    <ol className="space-y-0.5 text-sm">
      {TOC.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className={item.children ? `${tocLinkClass} font-medium text-foreground` : tocLinkClass}>
            {item.label}
          </a>
          {item.children && (
            <ol className="ml-2 space-y-0.5 border-l border-border pl-2">
              {item.children.map((child) => (
                <li key={child.id}>
                  <a href={`#${child.id}`} className={tocLinkClass}>
                    {child.label}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-base text-foreground marker:text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function Formula({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-surface p-4 font-mono text-sm leading-6 text-foreground">
      {children}
    </pre>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-base font-semibold text-foreground">{children}</h4>
}

function DocSection({ doc, live }: { doc: MethodologyDoc; live?: React.ReactNode }) {
  return (
    <section id={doc.id} className="scroll-mt-24 space-y-4 border-t border-dashed border-border pt-6">
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{doc.name}</h3>
      <p className="text-base text-foreground">{doc.idea}</p>
      {doc.formula && <Formula>{doc.formula}</Formula>}
      {live}
      {doc.criteria && doc.criteria.length > 0 && (
        <div className="space-y-2">
          <SubHeading>{doc.criteriaTitle ?? "Critérios"}</SubHeading>
          <List items={doc.criteria} />
        </div>
      )}
      {doc.limitations && doc.limitations.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Limitações</SubHeading>
          <List items={doc.limitations} />
        </div>
      )}
      {doc.notApplicable && doc.notApplicable.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Quando não se aplica</SubHeading>
          <List items={doc.notApplicable} />
        </div>
      )}
    </section>
  )
}

/** DY-alvo dos FIIs com as premissas vigentes (mesma conta de `computeFiiListingValuation`). */
function FiiTargetDYLive({ macro }: { macro: Awaited<ReturnType<typeof getMacroAssumptions>> }) {
  const rows = [
    { label: "Tijolo", target: fiiTargetDY("tijolo", macro) },
    { label: "Papel", target: fiiTargetDY("papel", macro) },
  ]
  return (
    <div className="space-y-2">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ label, target }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">DY-alvo hoje · {label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatPct(target.value, { digits: 2 })} a.a.</dd>
            <dd className="mt-1 text-xs tabular-nums text-muted-foreground">
              NTN-B {formatPct(target.ntnbRealLong, { digits: 2 })} + IPCA {formatPct(target.ipcaExpected, { digits: 2 })} + spread de{" "}
              {formatNumber(target.spread * 100, { digits: 1 })} p.p.
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Premissas de <span className="tabular-nums">{formatDay(macro.asOf)}</span>, as mesmas da seção{" "}
        <a href="#premissas" className="text-foreground underline underline-offset-4 hover:text-brand">
          Premissas atuais
        </a>
        .
      </p>
    </div>
  )
}

export default async function MetodologiaPage() {
  const macro = await getMacroAssumptions()
  const ke = keFromMacro(macro)
  const usesFallback = MACRO_ROWS.some((row) => macro.sources[row.field].source === "fallback")

  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Metodologia" }]} />

        <header className="max-w-[68ch] space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Metodologia</h1>
          <p className="text-base text-muted-foreground">
            Como cada número do Preço Justo AI é calculado: fórmula, critérios, limitações e quando o modelo não se aplica.
            Todos os valores são estimativas de modelos quantitativos sobre dados públicos.
          </p>
        </header>

        <details className="group mt-6 rounded-lg border border-border bg-card lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            Nesta página
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </summary>
          <nav aria-label="Índice da metodologia" className="border-t border-border p-2">
            <TocLinks />
          </nav>
        </details>

        <div className="mt-8 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <nav aria-label="Índice da metodologia" className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Nesta página</p>
              <TocLinks />
            </nav>
          </aside>

          <article className="min-w-0 max-w-[68ch] space-y-10">
            <Section id="visao-geral" title="Visão geral">
              <p className="text-base text-foreground">
                Cada modelo responde a uma pergunta diferente: quanto pagar por lucro e patrimônio (Graham), por proventos (Bazin,
                Barsi, Gordon), por geração de caixa (FCD) ou por retorno sobre o patrimônio (P/VP justo, para bancos). Por isso o
                preço justo sempre aparece com o nome do modelo e a data do dado. Modelos que não fazem sentido para um tipo de
                empresa ficam marcados como não aplicáveis, em vez de mostrar um número enganoso.
              </p>
              <p className="text-base text-foreground">
                Os FIIs têm uma nota própria, o Score PJ-FII, e um preço-teto calculado pelo DY-alvo, que parte da NTN-B. Os ETFs
                são comparados pelo Score PJ-ETF, que olha custo, retorno, liquidez, porte e carteira. Cada modelo do ranking tem
                uma seção abaixo, agrupada por classe de ativo.
              </p>
              <p className="text-base text-foreground">
                Fontes: dados da B3 e da CVM via BRAPI (demonstrações anuais e trimestrais, cotações diárias) e séries do Banco
                Central (SGS) para os indicadores macro.
              </p>
            </Section>

            <Section id="definicoes" title="Definições">
              <dl className="space-y-4 text-base">
                <div>
                  <dt className="font-medium text-foreground">Margem de segurança</dt>
                  <dd className="mt-1 text-muted-foreground">
                    <code className="font-mono text-sm text-foreground">1 − preço ÷ preço justo</code>. Quanto o preço está abaixo
                    da estimativa. Preço de R$ 80 com preço justo de R$ 100 dá margem de 20%.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Potencial</dt>
                  <dd className="mt-1 text-muted-foreground">
                    <code className="font-mono text-sm text-foreground">preço justo ÷ preço − 1</code>. Quanto o preço teria de subir
                    para chegar à estimativa. No mesmo exemplo, 25%.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Dividend yield (DY 12m, bruto)</dt>
                  <dd className="mt-1 text-muted-foreground">
                    Soma dos proventos (dividendos e JCP, antes do imposto) com data-com nos últimos 12 meses, dividida pelo preço
                    atual.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">JCP</dt>
                  <dd className="mt-1 text-muted-foreground">
                    Exibido sempre bruto. O IRRF sobre juros sobre capital próprio é de{" "}
                    <span className="tabular-nums">{formatPct(JCP_IRRF_RATE_FROM_2026)}</span> desde 2026 (
                    <span className="tabular-nums">{formatPct(JCP_IRRF_RATE_UNTIL_2025, { digits: 0 })}</span> até 2025).
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Faixas de leitura</dt>
                  <dd className="mt-1 text-muted-foreground">
                    Abaixo do preço justo, dentro da faixa estimada ou acima do preço justo. Descrevem o resultado do modelo e não
                    indicam compra ou venda.
                  </dd>
                </div>
              </dl>
            </Section>

            <Section id="premissas" title="Premissas atuais">
              <p className="text-base text-muted-foreground">
                Usadas no custo de capital próprio (Ke) do FCD, de Gordon e do P/VP justo, e no DY-alvo dos FIIs (NTN-B + IPCA). Atualizado em{" "}
                <span className="tabular-nums text-foreground">{formatDay(macro.asOf)}</span>.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Premissa
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Valor a.a.
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">
                        Fonte e data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {MACRO_ROWS.map((row) => {
                      const info = macro.sources[row.field]
                      return (
                        <tr key={row.field}>
                          <th scope="row" className="px-3 py-2 text-left font-normal text-foreground">
                            {row.label}
                            {row.note && <span className="block text-xs text-muted-foreground">{row.note}</span>}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatPct(macro[row.field], { digits: 2 })}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {sourceLabel(info)}
                            <span className="block text-xs tabular-nums">{formatDay(info.asOf)}</span>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-surface">
                      <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                        Ke (beta 1)
                        <span className="block text-xs font-normal text-muted-foreground">nunca abaixo da Selic</span>
                      </th>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{formatPct(ke, { digits: 2 })}</td>
                      <td className="px-3 py-2 text-muted-foreground">Calculado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Formula>{"Ke = máx(Selic, (1 + NTN-B real) × (1 + IPCA) − 1 + beta × ERP)"}</Formula>
              <p className="text-sm text-muted-foreground">
                Selic, CDI e IPCA vêm das séries 432, 12 e 433 do Banco Central. Quando uma série está sem dado recente ou fora de
                uma faixa plausível, usamos um valor de referência revisado manualmente
                {usesFallback ? " (indicado na coluna Fonte)" : ""}. NTN-B longa e prêmio de risco também são revisados
                manualmente.
              </p>
            </Section>

            <Section id="liquidez" title="Liquidez mínima">
              <p className="text-base text-foreground">
                Ativos com volume financeiro médio diário abaixo destes limites recebem um aviso de baixa liquidez e podem ficar fora
                dos rankings, porque o preço de tela pode não refletir o preço de execução.
              </p>
              <dl className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Ações", value: LIQUIDITY_DEFAULTS.stock },
                  { label: "FIIs", value: LIQUIDITY_DEFAULTS.fii },
                  { label: "BDRs", value: LIQUIDITY_DEFAULTS.bdr },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatLiquidityLimit(item.value)}/dia</dd>
                  </div>
                ))}
              </dl>
            </Section>

            {METHODOLOGY_GROUPS.map((group) => (
              <section key={group.id} id={group.id} className="scroll-mt-24 space-y-8 border-t border-border pt-8">
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">{group.title}</h2>
                  {group.intro.map((paragraph) => (
                    <p key={paragraph} className="text-base text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {group.docs.map((doc) => (
                  <DocSection
                    key={doc.id}
                    doc={doc}
                    live={doc.live === "fiiTargetDY" ? <FiiTargetDYLive macro={macro} /> : null}
                  />
                ))}
              </section>
            ))}

            <Section id="limitacoes" title="Limitações gerais">
              <List
                items={[
                  "Os modelos usam demonstrações passadas; eventos recentes podem ainda não estar refletidos.",
                  "Lucros não recorrentes, mudanças contábeis e reestruturações distorcem indicadores.",
                  "Modelos diferentes chegam a valores diferentes para a mesma empresa. A divergência também é informação.",
                  "Nenhum modelo considera seu perfil, seus objetivos ou sua situação financeira.",
                ]}
              />
              <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">{DISCLAIMER}</p>
              <p className="text-sm text-muted-foreground">
                Encontrou um erro ou tem dúvida sobre um cálculo?{" "}
                <Link href="/contato" className="text-brand underline-offset-4 hover:underline">
                  Fale com a gente
                </Link>
                .
              </p>
            </Section>
          </article>
        </div>
      </div>
    </div>
  )
}
