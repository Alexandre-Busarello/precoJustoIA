import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Stat } from "@/components/ui/stat";
import { formatBRL, formatDeltaPct, formatMultiple, formatPct } from "@/lib/format";
import {
  FII_LISTING_TARGET_DY,
  fiiListingFairValueModelLabel,
  type FiiListingValuation,
} from "@/lib/fii-listing-valuation";
import { marginOfSafety, valuationStatusLabel } from "@/lib/valuation-metrics";

interface Props {
  /** Preço exibido no cabeçalho (mesma base da margem de segurança do cabeçalho). */
  price: number | null;
  /** Resultado de `computeFiiListingValuation`: a mesma referência usada no cabeçalho, no screening e no ranking. */
  valuation: FiiListingValuation | null;
  /** DY dos últimos 12 meses como fração (0,086 = 8,6%). */
  dividendYield: number | null;
  pvp: number | null;
  liquidez: number | null;
  qtdImoveis: number | null;
  /** Fração (0,055 = 5,5%). */
  vacanciaMedia: number | null;
  isPapel: boolean;
}

function pvpLabel(pvp: number | null): string | undefined {
  if (pvp === null) return undefined;
  if (pvp < 0.9) return "Abaixo do valor patrimonial";
  if (pvp <= 1.1) return "Próximo do valor patrimonial";
  return "Acima do valor patrimonial";
}

type Tag = { label: string; variant: "neutral" | "warning" };

function fundTags({ liquidez, qtdImoveis, vacanciaMedia, isPapel }: Pick<Props, "liquidez" | "qtdImoveis" | "vacanciaMedia" | "isPapel">): Tag[] {
  const tags: Tag[] = [{ label: isPapel ? "Papel / renda fixa" : "Tijolo", variant: "neutral" }];
  if (liquidez !== null) {
    tags.push(liquidez >= 1_000_000 ? { label: "Liquidez adequada", variant: "neutral" } : { label: "Liquidez baixa", variant: "warning" });
  }
  if (!isPapel && qtdImoveis !== null && qtdImoveis >= 10) tags.push({ label: "Portfólio diversificado", variant: "neutral" });
  if (vacanciaMedia !== null && vacanciaMedia < 0.1) tags.push({ label: "Vacância controlada", variant: "neutral" });
  return tags;
}

/** Preço-teto (DY-alvo) e P/VP do FII. O preço-teto vem da mesma função do cabeçalho, então sinal e magnitude batem. */
export function FiiStrategicAnalysis({ price, valuation, dividendYield, pvp, liquidez, qtdImoveis, vacanciaMedia, isPapel }: Props) {
  const fairValue = valuation?.fairValue ?? null;
  const isVpReference = valuation?.upsideSource === "valor_patrimonial";
  const margin = marginOfSafety(price, fairValue);
  const status = valuationStatusLabel(margin);
  const targetLabel = formatPct(FII_LISTING_TARGET_DY, { digits: 0 });

  const referenceLabel = isVpReference
    ? fiiListingFairValueModelLabel("valor_patrimonial") ?? "Valor patrimonial"
    : `Preço-teto (DY-alvo ${targetLabel})`;
  const referenceNote = isVpReference
    ? "Sem rendimento recente, usamos o valor patrimonial por cota como referência."
    : `Rendimento anual por cota dividido pelo DY-alvo de ${targetLabel} a.a. É o mesmo cálculo do potencial exibido no screening e no ranking de FIIs.`;

  return (
    <section aria-labelledby="fii-referencias" className="space-y-4">
      <SectionHeader
        id="fii-referencias"
        title="Preço-teto e P/VP"
        description="Referências de preço estimadas para o fundo. Não são recomendação de investimento."
      />
      <div className="grid gap-5 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <div className="min-w-0">
          <Stat
            label={referenceLabel}
            value={formatBRL(fairValue)}
            caption={margin !== null ? `Margem ${formatDeltaPct(margin)}${status ? ` · ${status}` : ""}` : undefined}
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {fairValue !== null ? referenceNote : "Dados de rendimento insuficientes para estimar o preço-teto."}
          </p>
        </div>
        <div className="min-w-0">
          <Stat label="P/VP" value={formatMultiple(pvp, { digits: 2 })} caption={pvpLabel(pvp)} />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Dividend yield dos últimos 12 meses: <span className="tabular-nums">{formatPct(dividendYield)}</span> a.a.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {fundTags({ liquidez, qtdImoveis, vacanciaMedia, isPapel }).map((tag) => (
          <Badge key={tag.label} variant={tag.variant}>
            {tag.label}
          </Badge>
        ))}
      </div>
    </section>
  );
}
