import type { Metadata } from "next"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { getMacroAssumptions, keFromMacro, type MacroField, type MacroFieldInfo } from "@/lib/finance/macro"
import { LIQUIDITY_DEFAULTS } from "@/lib/finance/liquidity-rules"
import { JCP_IRRF_RATE_FROM_2026, JCP_IRRF_RATE_UNTIL_2025 } from "@/lib/finance/dividends"
import { formatDate, formatNumber, formatPct } from "@/lib/format"

// As premissas vêm do banco (BCB SGS) com cache de 1 hora; a página acompanha esse ritmo.
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Metodologia: modelos de valuation, premissas e limitações",
  description:
    "Como o Preço Justo AI calcula cada estimativa: fórmulas de Graham, Bazin, Barsi, Gordon, FCD, P/VP justo para bancos, Peter Lynch e Fórmula Mágica, com critérios, limitações e as premissas macro em uso.",
  keywords:
    "metodologia análise fundamentalista, número de graham, método bazin, método barsi, modelo de gordon, fluxo de caixa descontado, p/vp justo bancos, peter lynch peg, fórmula mágica greenblatt, margem de segurança",
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

interface Model {
  id: string
  name: string
  idea: string
  formula: string
  criteria: string[]
  limitations: string[]
  notApplicable: string[]
}

// Descrições alinhadas a src/lib/strategies/* (generateRational e constantes de cada estratégia).
const MODELS: Model[] = [
  {
    id: "graham",
    name: "Número de Graham",
    idea:
      "Preço máximo que o investidor defensivo de Benjamin Graham aceitaria pagar (P/L 15 × P/VP 1,5). É um teto conservador, não uma estimativa de valor justo.",
    formula:
      "Número de Graham = √(22,5 × LPA × VPA)\n\nLPA = média dos últimos 5 anos (mínimo de 3 anos;\n      cíclicas de commodities sempre usam a média)\nVPA = valor patrimonial por ação",
    criteria: [
      "Margem de segurança mínima de 16,7% (1 − preço ÷ número de Graham)",
      "LPA e VPA positivos",
      "ROE ≥ 10%",
      "Liquidez corrente ≥ 1,0 e dívida líquida/PL ≤ 150% (não se aplicam a bancos e seguradoras)",
      "Margem líquida positiva e crescimento dos lucros ≥ −15%",
      "Valor de mercado ≥ R$ 2 bi",
    ],
    limitations: [
      "A constante 22,5 foi calibrada para os juros dos EUA dos anos 1970; com a Selic alta, o resultado tende a ser otimista.",
      "Ignora crescimento, qualidade dos lucros e geração de caixa.",
    ],
    notApplicable: ["Empresas com prejuízo ou patrimônio negativo.", "BDRs sem paridade e câmbio na base de dados."],
  },
  {
    id: "bazin",
    name: "Método Bazin",
    idea:
      "Décio Bazin propôs um preço-teto para ações pagadoras de dividendos: o preço que entrega um dividend yield mínimo sobre os proventos que a empresa costuma distribuir.",
    formula:
      "Preço-teto = média anual dos proventos ÷ DY alvo\n\nMédia = últimos 5 anos-calendário completos\n        (dividendos + JCP brutos; o ano corrente não entra)\nDY alvo padrão = 6%",
    criteria: [
      "Pelo menos 3 anos completos de histórico de proventos",
      "DY médio sobre o preço atual ≥ DY alvo (equivale a preço ≤ preço-teto)",
      "Dívida líquida/PL ≤ 0,5x; bancos e seguradoras usam ROE médio de 5 anos ≥ 12% e payout entre 25% e 80%",
      "Lucros consistentes: no máximo 2 anos de prejuízo nos últimos 8",
    ],
    limitations: [
      "Olha só para proventos passados, que podem não se repetir.",
      "Um DY alvo fixo não acompanha a Selic: com juros altos, 6% pode ser pouco.",
    ],
    notApplicable: ["Empresas que não distribuem proventos de forma regular.", "Empresas em crescimento que reinvestem o lucro."],
  },
  {
    id: "barsi",
    name: "Método Barsi",
    idea:
      "Inspirado na estratégia de Luiz Barsi de acumular ações pagadoras de dividendos em setores perenes, comparando o preço com um preço-teto calculado pelo dividend yield alvo.",
    formula:
      "Preço-teto = média anual dos proventos brutos ÷ DY alvo\n\nScore Barsi = 40% desconto até o preço-teto\n            + 35% qualidade dos dividendos\n            + 25% saúde financeira",
    criteria: [
      "Setores perenes (B.E.S.T.): bancos, energia elétrica, saneamento, seguros, telecomunicações e gás",
      "ROE ≥ 10%, dívida líquida/PL ≤ 1,0x e margem líquida positiva",
      "Dividendos pagos de forma consistente em 5 anos",
      "Entram no ranking só as empresas com preço igual ou abaixo do preço-teto",
    ],
    limitations: [
      "Depende de proventos passados e de um DY alvo escolhido pelo usuário.",
      "Concentra a análise em poucos setores.",
    ],
    notApplicable: ["Empresas fora dos setores perenes (quando o filtro B.E.S.T. está ativo).", "Empresas sem histórico de proventos."],
  },
  {
    id: "gordon",
    name: "Modelo de Gordon",
    idea:
      "O preço justo é o valor presente dos dividendos futuros, crescendo a uma taxa constante. É muito sensível à diferença entre a taxa de desconto e o crescimento.",
    formula:
      "Preço justo = D1 ÷ (k − g)\n\nD1 = D0 × (1 + g)\nD0 = proventos dos últimos 12 meses, sem extraordinários\nk  = Ke com beta setorial, nunca abaixo da Selic\ng  = menor entre 5%, ROE × (1 − payout) e 6%",
    criteria: [
      "k − g de pelo menos 4 p.p.; abaixo disso o modelo não se aplica",
      "Dividend yield ≥ 4% e payout ≤ 80%",
      "ROE ≥ 12%",
      "Margem de segurança ≥ 10% (cerca de 11% de potencial)",
      "Beta setorial: 0,8 para utilidade pública, 1,2 para commodities cíclicas e 1,0 para os demais",
    ],
    limitations: [
      "Pequenas mudanças em k ou g mudam muito o resultado.",
      "Supõe dividendos crescendo para sempre a uma taxa constante.",
    ],
    notApplicable: ["Empresas que pagam pouco ou nada de dividendos.", "BDRs sem paridade e câmbio na base de dados."],
  },
  {
    id: "fcd",
    name: "Fluxo de caixa descontado (FCD)",
    idea:
      "O valor intrínseco é o valor presente do caixa que a empresa deve gerar. É uma estimativa sensível às premissas, não uma previsão.",
    formula:
      "FCFF = EBIT × (1 − 34%) + D&A − capex − ΔNCG\n\nValor da firma = Σ FCFFₜ ÷ (1 + WACC)ᵗ + valor terminal\nValor por ação = (valor da firma − dívida líquida) ÷ ações\n\nCrescimento inicial = menor CAGR 5a (receitas, lucros),\n                      entre −5% e 10%, convergindo em 5 anos\nCrescimento perpétuo = 4% a 5% nominal (padrão 4,5%)\nWACC = Ke e Kd (Selic + 2 p.p., após IR de 34%)",
    criteria: [
      "Margem de segurança mínima de 13%",
      "EBITDA e fluxo de caixa operacional positivos",
      "ROE ≥ 12% e margem EBITDA ≥ 15%",
      "Crescimento das receitas ≥ −10% e liquidez corrente ≥ 1,2",
      "No ranking, dívida líquida/EBITDA ≤ 3x",
      "Valor de mercado ≥ R$ 2 bi",
    ],
    limitations: [
      "O valor terminal costuma responder pela maior parte do resultado.",
      "Sem dados de DFC, usa o fluxo de caixa livre alavancado, descontado pelo Ke.",
    ],
    notApplicable: [
      "Bancos e seguradoras: o fluxo de caixa não separa operação e financiamento (veja P/VP justo).",
      "BDRs sem paridade e câmbio na base de dados.",
    ],
  },
  {
    id: "pvp-justo",
    name: "P/VP justo (bancos e seguradoras)",
    idea:
      "Em bancos, dívida é matéria-prima, não financiamento. O P/VP justo compara o retorno sobre o patrimônio com o custo de capital (lucro residual em perpetuidade).",
    formula: "P/VP justo = (ROE − g) ÷ (Ke − g)\nValor estimado = VPA × P/VP justo\n\nROE = média dos últimos 5 anos\ng   = ROE × (1 − payout), limitado a 6%",
    criteria: [
      "ROE médio de 5 anos ≥ 12%",
      "Ke − g de pelo menos 4 p.p.; abaixo disso o resultado fica instável",
      "Preço abaixo do valor estimado",
    ],
    limitations: ["Supõe que o ROE médio dos últimos 5 anos se mantém.", "Não capta risco de crédito nem mudanças regulatórias."],
    notApplicable: ["Empresas não financeiras.", "Bancos sem histórico de ROE, sem payout ou com patrimônio negativo."],
  },
  {
    id: "lynch",
    name: "Peter Lynch (PEG)",
    idea: "Peter Lynch comparava o P/L com o crescimento dos lucros: uma empresa que cresce mais rápido pode valer um P/L maior.",
    formula:
      "g = CAGR dos lucros em 5 anos, limitado a 25% a.a.\n\nPEG = P/L ÷ (g × 100)\nP/L justo = g + dividend yield (em p.p.)\nValor estimado = LPA × P/L justo",
    criteria: ["PEG ≤ 1,0 (abaixo de 0,5 muito barato; de 0,5 a 1 barato; acima de 1 caro)", "Preço abaixo do valor estimado"],
    limitations: ["O crescimento passado pode não se repetir.", "O teto de 25% evita valores extremos, mas ainda favorece quem cresceu muito."],
    notApplicable: [
      "Empresas com LPA negativo ou sem crescimento de lucros em 5 anos.",
      "Commodities cíclicas (petróleo, mineração, siderurgia, papel e celulose): o lucro de pico distorce o P/L.",
    ],
  },
  {
    id: "formula-magica",
    name: "Fórmula Mágica (Greenblatt)",
    idea:
      "Encontrar bons negócios a preços razoáveis, combinando retorno sobre o capital com preço baixo em relação ao lucro operacional. Gera uma ordem, não um preço justo.",
    formula: "Earnings yield = EBIT ÷ EV\nROIC = retorno sobre o capital investido\n\nPosição final = posição(ROIC) + posição(EY)\n(menor soma vem primeiro)",
    criteria: [
      "ROIC e EBIT positivos",
      "Na análise individual: ROIC ≥ 15% e earnings yield ≥ 8%",
      "Margem líquida, liquidez corrente e dívida líquida/PL dentro dos limites do modelo",
      "Valor de mercado ≥ R$ 1 bi (R$ 3 bi para BDRs)",
    ],
    limitations: ["Não estima preço justo, só ordena empresas.", "Usa um único ano de EBIT e ROIC."],
    notApplicable: ["Bancos, seguradoras e utilidade pública, como no método original."],
  },
  {
    id: "dividendos",
    name: "Anti-armadilha de dividendos",
    idea:
      "Filtra empresas com dividend yield alto e sustentável, evitando as que parecem pagar muito só porque o preço caiu ou porque o lucro não sustenta os proventos.",
    formula: "Entrada: DY ≥ mínimo escolhido\nOrdem: score de sustentabilidade (DY e saúde financeira)",
    criteria: [
      "Empresas em geral: ROE ≥ 10%, margem líquida ≥ 5%, liquidez corrente ≥ 1,2, dívida líquida/PL ≤ 100%, P/L entre 4 e 25, valor de mercado ≥ R$ 1 bi",
      "Utilidade pública: dívida líquida/EBITDA ≤ 3,5 no lugar de dívida líquida/PL",
      "Bancos e seguradoras: ROE médio de 5 anos ≥ 12%, payout entre 25% e 80% e lucros consistentes",
    ],
    limitations: ["É um filtro, não um preço justo.", "DY passado não garante proventos futuros."],
    notApplicable: ["Empresas sem distribuição recorrente de proventos."],
  },
  {
    id: "pl-baixo",
    name: "P/L baixo com qualidade",
    idea:
      "Value investing clássico: empresas com P/L baixo que mantêm rentabilidade, filtrando armadilhas de valor (ações baratas por um motivo).",
    formula: "Entrada: 3 < P/L ≤ teto escolhido (25 para BDRs)\nOrdem: score de valor (P/L baixo e qualidade)",
    criteria: [
      "ROA ≥ 5% e margem líquida ≥ 3%",
      "Crescimento das receitas ≥ −10%",
      "Liquidez corrente ≥ 1,0 e dívida líquida/PL ≤ 200% (não se aplicam a bancos e seguradoras)",
      "Valor de mercado ≥ R$ 500 mi",
    ],
    limitations: ["O teto de P/L é fixo e não compara com a média do setor.", "Lucros não recorrentes podem deixar o P/L artificialmente baixo."],
    notApplicable: ["Empresas com prejuízo (P/L negativo)."],
  },
  {
    id: "fundamentalista",
    name: "Fundamentalista 3+1",
    idea: "Análise simplificada com três indicadores essenciais, escolhidos conforme o perfil da empresa, mais um bônus para dividendos.",
    formula:
      "Sem dívida relevante: ROE + P/L vs. CAGR de lucros 5a + endividamento\nCom dívida relevante: ROIC + EV/EBITDA + endividamento\nBancos e seguradoras: ROE + P/L\nBônus: payout + dividend yield",
    criteria: ["ROE ou ROIC mínimo conforme o perfil", "Dívida líquida/EBITDA abaixo do limite escolhido", "Filtro de tamanho opcional (small, mid ou large caps)"],
    limitations: ["Gera um score, não um preço justo.", "Simplifica empresas com contabilidade complexa."],
    notApplicable: ["Empresas sem ROE nem ROIC na base de dados."],
  },
  {
    id: "ia",
    name: "Síntese dos modelos com IA",
    idea:
      "A IA resume os resultados dos modelos acima. Preço justo e potencial vêm sempre dos modelos determinísticos; a IA não calcula valores próprios.",
    formula: "Preço justo de referência = mediana dos preços justos\n                            de Graham, FCD, Gordon e Barsi\nTexto = síntese gerada por IA (pode variar entre execuções)",
    criteria: ["Remove empresas sem lucro (ROE ≤ 0 ou margem líquida ≤ 0)", "Nível de confiança pela convergência entre os modelos"],
    limitations: ["O texto é uma estimativa gerada por IA e pode conter erros.", "Não substitui a leitura dos números de cada modelo."],
    notApplicable: ["Empresas sem dados suficientes para os modelos quantitativos."],
  },
]

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

const TOC = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "definicoes", label: "Definições" },
  { id: "premissas", label: "Premissas atuais" },
  { id: "liquidez", label: "Liquidez mínima" },
  ...MODELS.map((model) => ({ id: model.id, label: model.name })),
  { id: "limitacoes", label: "Limitações gerais" },
]

function TocLinks() {
  return (
    <ol className="space-y-0.5 text-sm">
      {TOC.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="flex min-h-11 items-center rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:min-h-8"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** Limites de liquidez sempre na mesma unidade compacta: `R$ 1 mi`, `R$ 500 mil`. */
function formatLiquidity(value: number): string {
  if (value >= 1_000_000) return `R$ ${formatNumber(value / 1_000_000, { digits: 1 }).replace(/,0$/, "")} mi`
  return `R$ ${formatNumber(value / 1_000, { digits: 0 })} mil`
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
                Usadas no custo de capital próprio (Ke) do FCD, de Gordon e do P/VP justo. Atualizado em{" "}
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
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatLiquidity(item.value)}/dia</dd>
                  </div>
                ))}
              </dl>
            </Section>

            {MODELS.map((model) => (
              <Section key={model.id} id={model.id} title={model.name}>
                <p className="text-base text-foreground">{model.idea}</p>
                <Formula>{model.formula}</Formula>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">Critérios</h3>
                  <List items={model.criteria} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">Limitações</h3>
                  <List items={model.limitations} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">Quando não se aplica</h3>
                  <List items={model.notApplicable} />
                </div>
              </Section>
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
