import { PrismaClient } from '@prisma/client';

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
  emoji: string;
}

export const ETF_PRESETS: Record<EtfPresetSlug, EtfPreset> = {
  'etfs-melhor-score-geral': {
    slug: 'etfs-melhor-score-geral',
    title: 'Melhor Score Geral',
    description: 'ETFs com maior score composto (custo, retorno, liquidez, solidez e qualidade da carteira)',
    emoji: '🏆',
  },
  'etfs-menor-taxa-administracao': {
    slug: 'etfs-menor-taxa-administracao',
    title: 'Menor Taxa de Administração',
    description: 'ETFs com score ≥ 40 ordenados pela menor taxa de administração',
    emoji: '💰',
  },
  'etfs-maior-retorno-1a': {
    slug: 'etfs-maior-retorno-1a',
    title: 'Maior Retorno no Ano',
    description: 'ETFs com maior retorno em 12 meses (usa retorno de 6m anualizado como fallback)',
    emoji: '📈',
  },
  'etfs-renda-fixa': {
    slug: 'etfs-renda-fixa',
    title: 'Renda Fixa (Selic/IPCA)',
    description: 'ETFs de renda fixa (benchmark contém Selic, IPCA, IRF-M ou IMA)',
    emoji: '🏛️',
  },
};

function annualizedReturn(return6m: number): number {
  return (1 + return6m) ** 2 - 1;
}

function effectiveReturn1y(item: { return1y: number | null; return6m: number | null }): number | null {
  if (item.return1y !== null) return item.return1y;
  if (item.return6m !== null) return annualizedReturn(item.return6m);
  return null;
}

function isRendaFixa(benchmark: string | null): boolean {
  if (!benchmark) return false;
  const lower = benchmark.toLowerCase();
  return ['selic', 'ipca', 'irf-m', 'ima', 'irfm'].some((kw) => lower.includes(kw));
}

type EtfRow = Awaited<ReturnType<PrismaClient['etfData']['findMany']>>[number] & {
  company: { ticker: string; name: string; logoUrl: string | null };
};

function toItem(e: EtfRow): EtfRankingItem {
  const r1y = e.return1y ? Number(e.return1y) : null;
  const r6m = e.return6m ? Number(e.return6m) : null;
  return {
    ticker: e.company.ticker,
    name: e.company.name,
    logoUrl: e.company.logoUrl,
    etfScore: e.etfScore,
    netExpenseRatio: e.netExpenseRatio ? Number(e.netExpenseRatio) : null,
    return1y: r1y,
    return6m: r6m,
    return3y: e.return3y ? Number(e.return3y) : null,
    return5y: e.return5y ? Number(e.return5y) : null,
    netAssets: e.netAssets ? Number(e.netAssets) : null,
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
        const ra = effectiveReturn1y({ return1y: a.return1y ? Number(a.return1y) : null, return6m: a.return6m ? Number(a.return6m) : null }) ?? -Infinity;
        const rb = effectiveReturn1y({ return1y: b.return1y ? Number(b.return1y) : null, return6m: b.return6m ? Number(b.return6m) : null }) ?? -Infinity;
        return rb - ra;
      });
      return (limit ? rows.slice(0, limit) : rows).map(toItem);
    }

    case 'etfs-renda-fixa': {
      const rows = await prisma.etfData.findMany({
        where: { ...baseWhere, etfScore: { not: null } },
        include: { company: companySelect },
      });
      const filtered = rows.filter((e) => isRendaFixa(e.benchmarkIndex));
      filtered.sort((a, b) => (b.etfScore ?? 0) - (a.etfScore ?? 0));
      return (limit ? filtered.slice(0, limit) : filtered).map(toItem);
    }

    default:
      return [];
  }
}
