import { NextRequest, NextResponse } from "next/server";
import { syncMacroIndicators } from "@/lib/finance/macro-sync";

export const maxDuration = 60;

/**
 * Cron diário: sincroniza Selic meta (SGS 432), CDI (SGS 12) e IPCA (SGS 433) do BCB com EconomicIndicatorHistory.
 * Autorização: header `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const start = Date.now();
  try {
    const series = await syncMacroIndicators();
    const failed = series.filter((s) => s.error);
    return NextResponse.json(
      {
        success: failed.length === 0,
        series,
        ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: failed.length === series.length ? 502 : 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
