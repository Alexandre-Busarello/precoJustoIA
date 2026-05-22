import Link from 'next/link';
import { getCachedEtfScore } from '@/lib/etf-score-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EtfScorePillars } from '@/components/etf-score-pillars';
import { Crown, Info } from 'lucide-react';

interface Props {
  ticker: string;
  canViewFullContent?: boolean;
  isLoggedIn?: boolean;
}

function getGrade(score: number): string {
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function getClassification(score: number): string {
  if (score >= 70) return 'Excelente';
  if (score >= 55) return 'Bom';
  if (score >= 40) return 'Regular';
  return 'Fraco';
}

const PILLARS_PREVIEW = [
  { key: 'custo', label: 'Custo' },
  { key: 'retorno', label: 'Retorno' },
  { key: 'liquidez', label: 'Liquidez' },
  { key: 'solidez', label: 'Solidez' },
  { key: 'qualidadeCarteira', label: 'Qualidade da Carteira' },
  { key: 'analiseIA', label: 'Análise IA' },
] as const;

export async function EtfHeaderScore({
  ticker,
  canViewFullContent = true,
  isLoggedIn = false,
}: Props) {
  if (!canViewFullContent) {
    const href = isLoggedIn ? '/checkout' : '/register';
    const label = isLoggedIn ? 'Upgrade Premium' : 'Cadastre-se Grátis';
    return (
      <Card className="border-teal-200/60 dark:border-teal-900/40 lg:max-w-md w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between gap-2">
            PJ-ETF Score
            <Badge variant="secondary">—</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Faça login para ver o score</p>
        </CardHeader>
        <CardContent className="space-y-4 relative min-h-[220px]">
          <div className="filter blur-sm pointer-events-none select-none space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-700/70 dark:text-teal-400/70">0</div>
              <div className="text-xs text-muted-foreground">Classificação</div>
            </div>
            <div className="space-y-3">
              {PILLARS_PREVIEW.map((p) => (
                <div key={p.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500/60 w-[55%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-[2px] border border-dashed border-teal-300 px-3">
            <Crown className="w-6 h-6 text-teal-600 mb-2" />
            <p className="text-xs text-muted-foreground mb-2 text-center">
              {isLoggedIn ? 'Upgrade para ver o PJ-ETF Score' : 'Faça login para ver o score'}
            </p>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href={href}>{label}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const result = await getCachedEtfScore(ticker);

  if (!result) {
    return (
      <Card className="border-teal-200/60 dark:border-teal-900/40 lg:max-w-md w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            PJ-ETF Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Score indisponível — histórico de retorno insuficiente para este ETF.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { score, dimensions } = result;
  const grade = getGrade(score);
  const classification = getClassification(score);

  return (
    <Card className="border-teal-200/60 dark:border-teal-900/40 lg:max-w-md w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between gap-2">
          PJ-ETF Score
          <Badge variant="secondary">{grade}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{classification}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-teal-700 dark:text-teal-400">
            {score}
          </div>
          <div className="text-xs text-muted-foreground">de 100 pontos</div>
        </div>

        <EtfScorePillars dimensions={dimensions} overrideActive={result.aiConcentracaoPenaltyOverride} />
      </CardContent>
    </Card>
  );
}
