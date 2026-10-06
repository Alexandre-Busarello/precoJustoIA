import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Check, Lock, TriangleAlert, X } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getCurrentUser } from "@/lib/user-service";
import { prisma } from "@/lib/prisma";
import { getScoreBreakdown } from "@/lib/score-breakdown-service";
import { formatDate, formatNumber, formatPct } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ScoreCard } from "@/components/asset/score-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { name: true },
  });

  if (!company) {
    return {
      title: "Empresa não encontrada",
    };
  }

  return {
    title: `Como é calculado o score de ${ticker} (${company.name})`,
    description: `Entenda como calculamos o score de ${ticker} (${company.name}): a contribuição de cada critério de análise, as penalidades aplicadas e a metodologia completa.`,
  };
}

type Decimalish = { toNumber: () => number } | number | string | null | undefined;

function toNumberOrNull(value: Decimalish): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "toNumber" in value) return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Pontos com sinal (+12,3 / −4,0), uma casa decimal. */
function formatPoints(value: number) {
  const text = formatNumber(value, { digits: 1 });
  return value > 0 ? `+${text}` : text;
}

const LOCKED_FEATURES = [
  "Contribuição de cada modelo e critério para o score final",
  "Penalidades aplicadas por alertas e contradições entre indicadores",
  "Pontos fortes e fracos identificados nos fundamentos",
  "O cálculo passo a passo, do subtotal ao score final",
];

export default async function EntendendoScorePage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  const assetHref = `/acao/${ticker.toLowerCase()}`;

  // Sessão e status Premium
  const session = await getServerSession(authOptions);
  let userIsPremium = false;
  let isLoggedIn = false;

  if (session?.user?.id) {
    isLoggedIn = true;
    const user = await getCurrentUser();
    userIsPremium = user?.isPremium || false;
  }

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      name: true,
      financialData: {
        orderBy: { year: "desc" },
        take: 1,
        select: { payout: true, lpa: true, dy: true },
      },
    },
  });

  if (!company) {
    notFound();
  }

  const header = (
    <PageHeader
      breadcrumb={[{ label: ticker, href: assetHref }, { label: "Como o score é calculado" }]}
      title={`Como o score de ${ticker} é calculado`}
      description={company.name}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={assetHref}>Voltar para {ticker}</Link>
        </Button>
      }
    />
  );

  const methodology = (
    <section aria-labelledby="como-interpretar" className="space-y-3">
      <SectionHeader as="h2" id="como-interpretar" title="Como interpretar" />
      <div className="max-w-[68ch] space-y-3 text-base leading-7 text-muted-foreground">
        <p>
          O score vai de 0 a 100 e resume a qualidade dos fundamentos da empresa. Ele é a soma ponderada das notas de
          cada modelo de análise (valuation, dividendos, rentabilidade e demonstrações financeiras): cada modelo dá
          uma nota de 0 a 100 e contribui com o seu peso.
        </p>
        <p>
          Depois da soma, aplicamos penalidades quando há contradições entre pontos fortes e fracos, alertas nas
          demonstrações ou perda de fundamentos detectada pela IA. Assim o resultado fica conservador.
        </p>
        <p className="text-sm">Score final = subtotal das contribuições − penalidades. O score é uma estimativa e não é recomendação de investimento.</p>
      </div>
    </section>
  );

  // Não-assinantes: explicação da metodologia e um único CTA, sem o detalhamento
  if (!userIsPremium) {
    const cta = isLoggedIn
      ? { label: "Assinar Premium", href: "/checkout" }
      : { label: "Desbloquear com 1 dia grátis", href: "/register" };

    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 pt-6 pb-12">
        {header}
        <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <div aria-hidden="true" className="select-none space-y-3 blur-sm">
            <p className="text-3xl font-semibold tabular-nums text-foreground">00/100</p>
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <p className="text-sm text-muted-foreground">Contribuições · Penalidades · Score final</p>
          </div>
          <h2 className="mt-6 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <Lock className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Detalhamento disponível no Premium
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
            {LOCKED_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <Button asChild className="mt-5 w-full sm:w-auto">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </section>
        {methodology}
      </div>
    );
  }

  const breakdown = await getScoreBreakdown(ticker, userIsPremium, isLoggedIn);

  if (!breakdown) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 pt-6 pb-12">
        {header}
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Não foi possível carregar o detalhamento do score agora. Tente novamente mais tarde.
        </p>
      </div>
    );
  }

  // Empresa que reinveste o lucro: lucro positivo com payout baixo ou sem dividendos
  const latestFinancials = company.financialData[0];
  const payout = toNumberOrNull(latestFinancials?.payout);
  const lpa = toNumberOrNull(latestFinancials?.lpa);
  const dy = toNumberOrNull(latestFinancials?.dy);
  const isReinvesting =
    lpa !== null && lpa > 0 && ((payout !== null && payout <= 0.3) || dy === 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-6 pb-12">
      {header}

      <section aria-labelledby="resumo" className="space-y-4">
        <SectionHeader as="h2" id="resumo" title="Resumo" description={`Classificação: ${breakdown.classification} · nota ${breakdown.grade}`} />
        <ScoreCard score={breakdown.score} label={breakdown.classification} title="Score final" />
        {(breakdown.strengths.length > 0 || breakdown.weaknesses.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            {breakdown.strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground">Pontos fortes</h3>
                <ul className="mt-2 space-y-2 text-sm text-foreground">
                  {breakdown.strengths.map((strength) => (
                    <li key={strength} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={1.75} aria-hidden="true" />
                      <span className="min-w-0 break-words">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {breakdown.weaknesses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground">Pontos fracos</h3>
                <ul className="mt-2 space-y-2 text-sm text-foreground">
                  {breakdown.weaknesses.map((weakness) => (
                    <li key={weakness} className="flex items-start gap-2">
                      <X className="mt-0.5 size-4 shrink-0 text-negative" strokeWidth={1.75} aria-hidden="true" />
                      <span className="min-w-0 break-words">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="contribuicoes" className="space-y-4">
        <SectionHeader
          as="h2"
          id="contribuicoes"
          title="Contribuição de cada critério"
          description="Nota de cada modelo (0 a 100) multiplicada pelo seu peso no score."
        />

        {isReinvesting && (
          <p className="max-w-[68ch] border-l-2 border-brand pl-3 text-sm text-muted-foreground">
            A empresa tem lucro positivo e payout de {formatPct(payout ?? 0, { digits: 0 })}: ela reinveste a maior
            parte do lucro no próprio negócio. Por isso os modelos de dividendos (Anti-armadilha de dividendos, Barsi e
            Gordon) não penalizam o score.
          </p>
        )}

        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {breakdown.contributions.map((contrib) => (
            <li key={contrib.name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {contrib.eligible ? (
                    <Check className="size-4 shrink-0 text-positive" strokeWidth={1.75} aria-label="Critério atendido" />
                  ) : (
                    <X className="size-4 shrink-0 text-negative" strokeWidth={1.75} aria-label="Critério não atendido" />
                  )}
                  <span className="break-words">{contrib.name}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{contrib.description}</p>
              </div>
              <div className="shrink-0 pl-6 sm:pl-0 sm:text-right">
                <p className="text-base font-semibold tabular-nums text-foreground">{formatPoints(contrib.points)}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  nota {formatNumber(Math.round(contrib.score), { digits: 0 })} × peso {formatPct(contrib.weight)}
                </p>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-4 bg-surface p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Subtotal</p>
              <p className="text-xs text-muted-foreground">Soma das contribuições</p>
            </div>
            <p className="text-base font-semibold tabular-nums text-foreground">{formatNumber(breakdown.rawScore, { digits: 1 })}</p>
          </li>
        </ol>
      </section>

      {(breakdown.flagPenalty || (breakdown.penalties && breakdown.penalties.length > 0)) && (
        <section aria-labelledby="penalidades" className="space-y-4">
          <SectionHeader as="h2" id="penalidades" title="Penalidades" />
          <ul className="space-y-3">
            {breakdown.flagPenalty && (
              <li className="rounded-lg border border-warning/30 bg-warning-subtle p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
                    Perda de fundamentos detectada pela IA
                  </p>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-negative">
                    {formatPoints(breakdown.flagPenalty.value)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{breakdown.flagPenalty.reason}</p>
                {breakdown.flagPenalty.reportId && (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={`${assetHref}/relatorios/${breakdown.flagPenalty.reportId}`}>Ver relatório completo</Link>
                  </Button>
                )}
              </li>
            )}
            {breakdown.penalties?.map((penalty) => (
              <li key={penalty.reason} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-foreground">{penalty.reason}</p>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-negative">{formatPoints(penalty.amount)}</p>
                </div>
                {penalty.details && penalty.details.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                    {penalty.details.map((detail, index) => {
                      const isSubItem = detail.startsWith("   •");
                      return (
                        <li
                          key={`${index}-${detail}`}
                          className={isSubItem ? "pl-4 text-muted-foreground" : "font-medium text-foreground"}
                        >
                          {isSubItem ? detail.replace(/^\s*•\s*/, "") : detail}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="score-final" className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 id="score-final" className="text-lg font-semibold tracking-tight text-foreground">
            Score final
          </h2>
          <p className="text-sm text-muted-foreground">
            {breakdown.classification} · nota {breakdown.grade}
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatNumber(breakdown.score, { digits: 1 })}
        </p>
      </section>

      {methodology}

      <p className="text-center text-xs text-muted-foreground">Score calculado em {formatDate(new Date())}</p>
    </div>
  );
}
