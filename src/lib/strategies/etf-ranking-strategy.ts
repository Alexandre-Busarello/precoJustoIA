import type { PrismaClient } from '@prisma/client';
import { effectiveReturn1y, isFixedIncomeBenchmark, toNullableNumber } from '@/lib/etf-scoring-core';

export interface EtfRankingItem {
  ticker: string;
  name: string;
  logoUrl: string | null;
  etfScore: number | null;
  netExpenseRatio: number | null;
  return1y: number | null;
  return6m: number | null;
  return3y: number | null;
  return5y: number | null;
  netAssets: number | null;
  benchmarkIndex: string | null;
  isEstimatedReturn: boolean;
}

export type EtfPresetSlug =
  | 'etfs-melhor-score-geral'
  | 'etfs-menor-taxa-administracao'
  | 'etfs-maior-retorno-1a'
  | 'etfs-renda-fixa';

export interface EtfPreset {
  slug: EtfPresetSlug;
  title: string;
  description: string;
}

export const ETF_PRESETS: Record<EtfPresetSlug, EtfPreset> = {
  'etfs-melhor-score-geral': {
    slug: 'etfs-melhor-score-geral',
    title: 'Maior score',
    description: 'ETFs com maior score composto: custo, retorno, liquidez, patrimônio e qualidade da carteira.',
  },
  'etfs-menor-taxa-administracao': {
    slug: 'etfs-menor-taxa-administracao',
    title: 'Menor taxa de administração',
    description: 'ETFs com score a partir de 40, ordenados pela menor taxa de administração.',
  },
  'etfs-maior-retorno-1a': {
    slug: 'etfs-maior-retorno-1a',
    title: 'Maior retorno em 12 meses',
    description: 'ETFs com maior retorno em 12 meses (retorno de 6 meses anualizado quando falta histórico).',
  },
  'etfs-renda-fixa': {
    slug: 'etfs-renda-fixa',
    title: 'Renda fixa (Selic e IPCA)',
    description: 'ETFs cujo índice de referência é Selic, IPCA, IRF-M ou IMA (IMA-B, IMA-S, IMA-Geral).',
  },
};

type EtfRow = Awaited<ReturnType<PrismaClient['etfData']['findMany']>>[number] & {
  company: { ticker: string; name: string; logoUrl: string | null };
};

function toItem(e: EtfRow): EtfRankingItem {
  const r1y = toNullableNumber(e.return1y);
  const r6m = toNullableNumber(e.return6m);
  return {
    ticker: e.company.ticker,
    name: e.company.name,
    logoUrl: e.company.logoUrl,
    etfScore: e.etfScore,
    netExpenseRatio: toNullableNumber(e.netExpenseRatio),
    return1y: r1y,
    return6m: r6m,
    return3y: toNullableNumber(e.return3y),
    return5y: toNullableNumber(e.return5y),
    netAssets: toNullableNumber(e.netAssets),
    benchmarkIndex: e.benchmarkIndex,
    isEstimatedReturn: r1y === null && r6m !== null,
  };
}

export async function runEtfRanking(
  prisma: PrismaClient,
  preset: EtfPresetSlug,
  limit?: number
): Promise<EtfRankingItem[]> {
  const baseWhere = { company: { isActive: true, assetType: 'ETF' as const } };
  const companySelect = { select: { ticker: true, name: true, logoUrl: true } };

  switch (preset) {
    case 'etfs-melhor-score-geral': {
      const rows = await prisma.etfData.findMany({
        where: { ...baseWhere, etfScore: { not: null } },
        orderBy: { etfScore: 'desc' },
        take: limit,
        include: { company: companySelect },
      });
      return rows.map(toItem);
    }

    case 'etfs-menor-taxa-administracao': {
      const rows = await prisma.etfData.findMany({
        where: { ...baseWhere, etfScore: { gte: 40 }, netExpenseRatio: { not: null } },
        orderBy: { netExpenseRatio: 'asc' },
        take: limit,
        include: { company: companySelect },
      });
      return rows.map(toItem);
    }

    case 'etfs-maior-retorno-1a': {
      const rows = await prisma.etfData.findMany({
        where: {
          ...baseWhere,
          etfScore: { not: null },
          OR: [{ return1y: { not: null } }, { return6m: { not: null } }],
        },
        include: { company: companySelect },
      });
      rows.sort((a, b) => {
        const ra = effectiveReturn1y({ return1y: toNullableNumber(a.return1y), return6m: toNullableNumber(a.return6m) }) ?? -Infinity;
        const rb = effectiveReturn1y({ return1y: toNullableNumber(b.return1y), return6m: toNullableNumber(b.return6m) }) ?? -Infinity;
        return rb - ra;
      });
      return (limit ? rows.slice(0, limit) : rows).map(toItem);
    }

    case 'etfs-renda-fixa': {
      const rows = await prisma.etfData.findMany({
        where: { ...baseWhere, etfScore: { not: null } },
        include: { company: companySelect },
      });
      const filtered = rows.filter((e) => isFixedIncomeBenchmark(e.benchmarkIndex));
      filtered.sort((a, b) => (b.etfScore ?? 0) - (a.etfScore ?? 0));
      return (limit ? filtered.slice(0, limit) : filtered).map(toItem);
    }

    default:
      return [];
  }
}
