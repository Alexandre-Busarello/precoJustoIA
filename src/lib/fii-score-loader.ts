import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/strategies/base-strategy";
import {
  calculateFiiOverallScore,
  type FiiOverallScore,
} from "@/lib/strategies/fii-overall-score";

/** Deduplicação no server (RSC) — não usar no client */
export const getCachedFiiOverallScore = cache(
  async (ticker: string): Promise<FiiOverallScore | null> => {
    const t = ticker.trim().toUpperCase();
    const company = await prisma.company.findUnique({
      where: { ticker: t },
      include: {
        fiiData: true,
        dividendHistory: { orderBy: { exDate: "desc" }, take: 12 },
        dailyQuotes: { orderBy: { date: "desc" }, take: 1 },
      },
    });
    if (!company?.fiiData || company.assetType !== "FII") return null;
    const fd = company.fiiData;
    const cot =
      toNumber(company.dailyQuotes[0]?.price) ?? toNumber(fd.cotacao) ?? 0;

    return calculateFiiOverallScore(
      {
        ticker: company.ticker,
        cotacao: cot || fd.cotacao,
        dividendYield: fd.dividendYield,
        pvp: fd.pvp,
        ffoYield: fd.ffoYield,
        capRate: fd.capRate,
        valorPatrimonial: fd.valorPatrimonial,
        liquidez: fd.liquidez,
        valorMercado: fd.valorMercado,
        qtdImoveis: fd.qtdImoveis,
        vacanciaMedia: fd.vacanciaMedia,
        precoM2: fd.precoM2,
        aluguelM2: fd.aluguelM2,
        segment: fd.segment,
        isPapel: fd.isPapel,
        patrimonioLiquido: fd.patrimonioLiquido,
        lastFetchedAt: fd.lastFetchedAt,
      },
      company.dividendHistory.map((d) => ({
        amount: d.amount,
        exDate: d.exDate,
      }))
    );
  }
);
