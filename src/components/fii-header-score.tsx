import Link from "next/link";
import { getCachedFiiOverallScore } from "@/lib/fii-score-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface Props {
  ticker: string;
  canViewFullContent?: boolean;
  isLoggedIn?: boolean;
}

export async function FiiHeaderScore({
  ticker,
  canViewFullContent = true,
  isLoggedIn = false,
}: Props) {
  if (!canViewFullContent) {
    const href = isLoggedIn ? "/checkout" : "/register";
    const label = isLoggedIn ? "Upgrade Premium" : "Cadastre-se Grátis";
    const pillars = ["Dividendos", "Valuation", "Qualidade", "Liquidez", "Gestão"];
    return (
      <Card className="border-amber-200/60 dark:border-amber-900/40 lg:max-w-md w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between gap-2">
            PJ-FII Score
            <Badge variant="secondary">—</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Faça login ou assine para ver o score real</p>
        </CardHeader>
        <CardContent className="space-y-4 relative min-h-[220px]">
          <div className="filter blur-sm pointer-events-none select-none space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-700/70 dark:text-amber-400/70">
                0.0
              </div>
              <div className="text-xs text-muted-foreground">Classificação</div>
            </div>
            <div className="space-y-3">
              {pillars.map((label) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{label}</span>
                    <span className="text-muted-foreground">0.0 pts</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/60 w-[55%]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px] border border-dashed border-orange-300 px-3">
            <Crown className="w-6 h-6 text-orange-600 mb-2" />
            <p className="text-xs text-muted-foreground mb-2 text-center">
              {isLoggedIn ? "Upgrade para ver o PJ-FII Score" : "Faça login para ver o score"}
            </p>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href={href}>{label}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = await getCachedFiiOverallScore(ticker.toUpperCase());
  if (!score) return null;

  const pillars = [
    { label: "Dividendos", ...score.breakdown.dividendos },
    { label: "Valuation", ...score.breakdown.valuation },
    { label: "Qualidade", ...score.breakdown.qualidadePortfolio },
    { label: "Liquidez", ...score.breakdown.liquidez },
    { label: "Gestão", ...score.breakdown.gestao },
  ];

  return (
    <Card className="border-amber-200/60 dark:border-amber-900/40 lg:max-w-md w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between gap-2">
          PJ-FII Score
          <Badge variant="secondary">{score.grade}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{score.recommendation}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-amber-700 dark:text-amber-400">
            {score.score.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground">{score.classification}</div>
        </div>

        <div className="space-y-3">
          {pillars.map((p) => (
            <div key={p.label}>
              <div className="flex justify-between text-xs mb-1">
                <span>{p.label}</span>
                <span className="text-muted-foreground">
                  {(p.score * p.weight).toFixed(1)} pts
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, p.score))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {score.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
              Pontos fortes
            </p>
            <ul className="text-xs list-disc pl-4 space-y-0.5">
              {score.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {score.weaknesses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Atenção
            </p>
            <ul className="text-xs list-disc pl-4 space-y-0.5">
              {score.weaknesses.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {score.flags?.length ? (
          <p className="text-xs text-destructive">{score.flags.join(" · ")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
