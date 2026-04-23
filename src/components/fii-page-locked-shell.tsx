import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock, Sparkles, TrendingUp, Youtube } from "lucide-react";
import { FiiStrategicAnalysis } from "@/components/fii-strategic-analysis";

/**
 * Prévia estática para !canViewFullContent: layout parecido com a página real,
 * sem dados sensíveis e sem props para hooks de fetch (RSC apenas).
 */
export function FiiPageLockedShell({ isLoggedIn }: { isLoggedIn: boolean }) {
  const ctaHref = isLoggedIn ? "/checkout" : "/register";
  const ctaLabel = isLoggedIn ? "Upgrade Premium" : "Cadastre-se Grátis";

  const overlay = (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/85 backdrop-blur-[2px] border border-dashed border-orange-300/80 px-3 text-center">
      <Crown className="h-6 w-6 text-orange-600 mb-1" />
      <p className="text-xs text-muted-foreground mb-2 max-w-xs">
        {isLoggedIn
          ? "Assine o Premium para ver análises completas deste FII."
          : "Crie sua conta gratuita para desbloquear análises e trial."}
      </p>
      <Button asChild size="sm" variant="outline" className="text-xs">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="relative mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 p-4 min-h-[180px]">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 text-sm">
          Dados do Fundo Imobiliário
        </h3>
        <div className="filter blur-sm pointer-events-none select-none grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div>Dividend Yield: 0,00%</div>
          <div>P/VP: 0,00</div>
          <div>Patrimônio: R$ 0,00</div>
          <div>Último dividendo: R$ 0,00</div>
        </div>
        {overlay}
      </div>

      <FiiStrategicAnalysis
        previewLocked
        isLoggedIn={isLoggedIn}
        currentPrice={0}
        dividendYield={null}
        ultimoDividendo={null}
        pvp={null}
        liquidez={null}
        qtdImoveis={null}
        vacanciaMedia={null}
        isPapel={false}
      />

      <Card className="relative min-h-[200px] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Youtube className="h-4 w-4" />
            Sentimento de mercado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="filter blur-sm pointer-events-none select-none space-y-2">
            <div className="flex gap-2">
              <Badge>Score 0</Badge>
              <Badge variant="outline">Neutro</Badge>
            </div>
            <p className="text-sm leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Resumo fictício da análise.
            </p>
          </div>
          {overlay}
        </CardContent>
      </Card>

      <Card className="relative min-h-[220px] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Análise técnica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="filter blur-sm pointer-events-none select-none h-32 rounded-md bg-muted/50 border" />
          {overlay}
        </CardContent>
      </Card>

      <Card className="relative min-h-[160px] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Indicadores e IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="filter blur-sm pointer-events-none select-none grid grid-cols-2 gap-2 text-xs">
            <div className="h-16 rounded bg-muted" />
            <div className="h-16 rounded bg-muted" />
            <div className="h-16 rounded bg-muted col-span-2" />
          </div>
          {overlay}
        </CardContent>
      </Card>

      <Card className="relative min-h-[140px] overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Dados financeiros detalhados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="filter blur-sm pointer-events-none select-none h-24 rounded-md bg-muted/40 border" />
          {overlay}
        </CardContent>
      </Card>
    </div>
  );
}
