import { NextRequest, NextResponse } from "next/server";
import { getCachedFiiOverallScore } from "@/lib/fii-score-loader";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await context.params;
  if (!ticker) {
    return NextResponse.json({ error: "Ticker obrigatório" }, { status: 400 });
  }

  const score = await getCachedFiiOverallScore(ticker.toUpperCase());
  if (!score) {
    return NextResponse.json(
      { error: "FII não encontrado ou score indisponível" },
      { status: 404 }
    );
  }

  return NextResponse.json(score, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
