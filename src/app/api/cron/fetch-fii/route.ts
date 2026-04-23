import { NextRequest, NextResponse } from "next/server";
import { main as fetchFiiData } from "../../../../../scripts/fetch-data-fundamentus-fii";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const originalArgv = process.argv;
    process.argv = ["node", "fetch-data-fundamentus-fii.ts"];
    const start = Date.now();

    try {
      await fetchFiiData();
      process.argv = originalArgv;
      const ms = Date.now() - start;
      return NextResponse.json({
        success: true,
        message: "Cron FIIs ok",
        ms,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      process.argv = originalArgv;
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
