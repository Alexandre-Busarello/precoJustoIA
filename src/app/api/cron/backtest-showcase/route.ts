import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { warmShowcaseResults } from "@/lib/backtest-showcase/cache";
import { SHOWCASE_CACHE_TAG } from "@/lib/backtest-showcase/definitions";

export const maxDuration = 120;

/**
 * Cron da vitrine de backtests: invalida o cache (tag `backtest-showcase`) e recalcula as três carteiras logo depois
 * da resposta, para a próxima visita já encontrar o resultado novo. A invalidação só vale quando o handler termina,
 * por isso o recálculo roda em `after`.
 * Autorização: header `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  revalidateTag(SHOWCASE_CACHE_TAG);
  after(async () => {
    const start = Date.now();
    const block = await warmShowcaseResults();
    console.info(
      `[backtest-showcase] cron: ${block ? `${block.items.length} vitrines prontas` : "vitrine indisponível"} em ${Date.now() - start} ms`
    );
  });

  return NextResponse.json({ success: true, revalidated: SHOWCASE_CACHE_TAG, timestamp: new Date().toISOString() });
}
