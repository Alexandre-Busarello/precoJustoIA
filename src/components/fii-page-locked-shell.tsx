import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

/** Valores fictícios (o dado real nunca vai para o DOM de quem não tem acesso). */
const PREVIEW_FACTS = [
  { label: "Dividend yield (12m)", value: "0,0%" },
  { label: "P/VP", value: "0,00x" },
  { label: "Preço-teto (DY-alvo 8%)", value: "R$ 00,00" },
  { label: "Último rendimento", value: "R$ 0,00" },
  { label: "Patrimônio líquido", value: "R$ 0,0 bi" },
  { label: "Liquidez média diária", value: "R$ 0,0 mi" },
  { label: "Vacância média", value: "0,0%" },
  { label: "Cap rate", value: "0,0%" },
];

const PREVIEW_PILLARS = [
  { label: "Dividendos", width: "72%" },
  { label: "Valuation", width: "58%" },
  { label: "Qualidade do portfólio", width: "64%" },
];

/**
 * Prévia bloqueada da página de FII: a mesma estrutura da análise completa, borrada, com um único CTA.
 * `showCta={false}` quando a página já mostra o aviso de limite do anônimo (que tem o mesmo "Criar conta grátis").
 * Componente de servidor, sem consultas.
 */
export function FiiPageLockedShell({ isLoggedIn, showCta = true }: { isLoggedIn: boolean; showCta?: boolean }) {
  const cta = isLoggedIn
    ? { href: "/planos", label: "Assinar o Premium", text: "A análise completa deste FII faz parte do Premium." }
    : { href: "/register", label: "Criar conta grátis", text: "Crie sua conta e teste o Premium por 1 dia para ver a análise completa." };

  return (
    <section aria-labelledby="fii-analise-bloqueada" className="space-y-4">
      <SectionHeader
        id="fii-analise-bloqueada"
        title="Análise completa do fundo"
        description="Preço-teto, dados do fundo, score por pilar, sentimento de mercado e análise técnica."
      />
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div aria-hidden="true" className="pointer-events-none select-none space-y-6 blur-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {PREVIEW_FACTS.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="truncate text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-3">
            {PREVIEW_PILLARS.map((pillar) => (
              <li key={pillar.label}>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{pillar.label}</span>
                  <span className="tabular-nums">00</span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: pillar.width }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            {cta.text}
          </p>
          {showCta && (
            <Button asChild className="shrink-0">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
