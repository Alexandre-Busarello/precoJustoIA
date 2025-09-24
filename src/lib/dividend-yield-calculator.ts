import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/strategies/base-strategy';

/**
 * Calcula o dividend yield médio dos últimos 5 anos para um ativo
 */
export async function calculateAverageDividendYield(ticker: string): Promise<number | null> {
  try {
    // Buscar empresa pelo ticker
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() }
    });

    if (!company) {
      console.log(`❌ Empresa não encontrada: ${ticker}`);
      return null;
    }

    // Buscar dados financeiros dos últimos 5 anos
    const currentYear = new Date().getFullYear();
    const fiveYearsAgo = currentYear - 5;

    const financialData = await prisma.financialData.findMany({
      where: {
        companyId: company.id,
        year: {
          gte: fiveYearsAgo,
          lte: currentYear
        },
        OR: [
          { dy: { not: null } },
          { dividendYield12m: { not: null } }
        ]
      },
      select: {
        year: true,
        dy: true,
        dividendYield12m: true
      },
      orderBy: {
        year: 'desc'
      }
    });

    if (financialData.length === 0) {
      console.log(`❌ Nenhum dado de dividend yield encontrado para ${ticker}`);
      return null;
    }

    // Calcular média dos dividend yields disponíveis
    const validYields: number[] = [];

    for (const data of financialData) {
      // Priorizar dy (dividend yield atual), depois dividendYield12m
      let yield_ = toNumber(data.dy);
      if (!yield_ || yield_ <= 0) {
        yield_ = toNumber(data.dividendYield12m);
      }

      if (yield_ && yield_ > 0 && yield_ <= 1) { // Validar que está em formato decimal (0-1)
        validYields.push(yield_);
      }
    }

    if (validYields.length === 0) {
      console.log(`❌ Nenhum dividend yield válido encontrado para ${ticker}`);
      return null;
    }

    // Calcular média
    const averageYield = validYields.reduce((sum, yield_) => sum + yield_, 0) / validYields.length;

    console.log(`✅ ${ticker}: DY médio calculado = ${(averageYield * 100).toFixed(2)}% (${validYields.length} anos)`);
    
    return averageYield;

  } catch (error) {
    console.error(`❌ Erro ao calcular DY médio para ${ticker}:`, error);
    return null;
  }
}

/**
 * Calcula dividend yield médio para múltiplos ativos
 */
export async function calculateAverageDividendYieldBatch(tickers: string[]): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {};

  for (const ticker of tickers) {
    results[ticker.toUpperCase()] = await calculateAverageDividendYield(ticker);
  }

  return results;
}

/**
 * Busca dividend yield mais recente de um ativo (fallback se não houver dados históricos)
 */
export async function getLatestDividendYield(ticker: string): Promise<number | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() }
    });

    if (!company) {
      return null;
    }

    // Buscar dados financiais mais recentes separadamente
    const latestFinancials = await prisma.financialData.findFirst({
      where: { companyId: company.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        dy: true,
        dividendYield12m: true
      }
    });

    if (!latestFinancials) {
      return null;
    }

    const latest = latestFinancials;
    let yield_ = toNumber(latest.dy);
    if (!yield_ || yield_ <= 0) {
      yield_ = toNumber(latest.dividendYield12m);
    }

    return yield_ && yield_ > 0 && yield_ <= 1 ? yield_ : null;

  } catch (error) {
    console.error(`❌ Erro ao buscar DY mais recente para ${ticker}:`, error);
    return null;
  }
}
