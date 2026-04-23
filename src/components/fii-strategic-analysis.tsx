import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface Props {
  currentPrice: number;
  dividendYield: number | null;
  ultimoDividendo: number | null;
  pvp: number | null;
  liquidez: number | null;
  qtdImoveis: number | null;
  vacanciaMedia: number | null;
  isPapel: boolean;
  targetDY?: number;
  /** Sem números reais no DOM; apenas layout + blur + CTA */
  previewLocked?: boolean;
  isLoggedIn?: boolean;
}

function StrategicLockedOverlay({ isLoggedIn }: { isLoggedIn: boolean }) {
  const href = isLoggedIn ? "/checkout" : "/register";
  const label = isLoggedIn ? "Upgrade Premium" : "Cadastre-se Grátis";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/85 backdrop-blur-[2px] border border-dashed border-orange-300/80 px-3 text-center z-10">
      <Crown className="h-6 w-6 text-orange-600 mb-1" />
      <p className="text-xs text-muted-foreground mb-2 max-w-xs">
        {isLoggedIn
          ? "Assine o Premium para ver a análise estratégica completa."
          : "Crie sua conta para desbloquear análises e trial."}
      </p>
      <Button asChild size="sm" variant="outline" className="text-xs">
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  );
}

export function FiiStrategicAnalysis({
  currentPrice,
  dividendYield,
  ultimoDividendo,
  pvp,
  liquidez,
  qtdImoveis,
  vacanciaMedia,
  isPapel,
  targetDY = 0.08,
  previewLocked,
  isLoggedIn = false,
}: Props) {
  if (previewLocked) {
    return (
      <section className="mb-8 space-y-4 relative">
        <h2 className="text-xl font-semibold">Análise estratégica (FII)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="relative min-h-[140px] overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Preço teto (DY alvo)</CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="filter blur-sm pointer-events-none select-none space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Meta 8,0% a.a. — <span className="font-mono">Preço teto ≈ último dividendo / DY alvo</span>
                </p>
                <p className="text-2xl font-bold">R$ 0,00</p>
                <p className="text-muted-foreground text-xs">Cotação atual R$ 0,00</p>
              </div>
              <StrategicLockedOverlay isLoggedIn={isLoggedIn} />
            </CardContent>
          </Card>
          <Card className="relative min-h-[140px] overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">P/VP</CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="filter blur-sm pointer-events-none select-none space-y-2">
                <p className="text-2xl font-bold">0,00</p>
                <p className="text-sm">Próximo do valor patrimonial</p>
                <p className="text-muted-foreground">DY atual: 0,00% a.a.</p>
              </div>
              <StrategicLockedOverlay isLoggedIn={isLoggedIn} />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Liquidez OK</Badge>
          <Badge variant="secondary">{isPapel ? "Papel / renda fixa" : "Tijolo"}</Badge>
        </div>
      </section>
    );
  }

  const precoTeto =
    ultimoDividendo && ultimoDividendo > 0 && targetDY > 0
      ? ultimoDividendo / targetDY
      : null;

  let pvpLabel = "—";
  if (pvp !== null) {
    if (pvp < 0.9) pvpLabel = "Abaixo do VP (desconto)";
    else if (pvp <= 1.1) pvpLabel = "Próximo do valor patrimonial";
    else pvpLabel = "Acima do VP (prêmio)";
  }

  const badges: string[] = [];
  if (liquidez != null && liquidez >= 1_000_000) badges.push("Liquidez OK");
  else if (liquidez != null) badges.push("Liquidez fraca");
  if (!isPapel && qtdImoveis != null && qtdImoveis >= 10)
    badges.push("Boa diversificação");
  if (vacanciaMedia != null && vacanciaMedia < 0.1) badges.push("Vacância controlada");

  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-xl font-semibold">Análise estratégica (FII)</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preço teto (DY alvo)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              Meta {(targetDY * 100).toFixed(1)}% a.a. —{" "}
              <span className="font-mono">Preço teto ≈ último dividendo / DY alvo</span>
            </p>
            {precoTeto != null ? (
              <>
                <p className="text-2xl font-bold">
                  {precoTeto.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
                <p className="text-muted-foreground text-xs">
                  Cotação atual{" "}
                  {currentPrice.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  {currentPrice > 0 && precoTeto > 0
                    ? ` (${(((precoTeto - currentPrice) / currentPrice) * 100).toFixed(1)}% vs teto)`
                    : ""}
                </p>
                <p className="text-[11px] text-muted-foreground/90">
                  O mesmo conceito de teto alimenta o potencial % em screening e ranking de FIIs; sem
                  dividendo recente usamos o valor patrimonial (VP) como referência.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Dados de dividendo insuficientes.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">P/VP</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-2xl font-bold">{pvp != null ? pvp.toFixed(2) : "—"}</p>
            <p>{pvpLabel}</p>
            {dividendYield != null && (
              <p className="text-muted-foreground">
                DY atual: {(dividendYield * 100).toFixed(2)}% a.a.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <Badge key={b} variant="outline">
              {b}
            </Badge>
          ))}
          {isPapel && (
            <Badge variant="secondary">
              Papel / renda fixa
            </Badge>
          )}
          {!isPapel && (
            <Badge variant="secondary">
              Tijolo
            </Badge>
          )}
        </div>
      )}
    </section>
  );
}
