import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { DividendProjection, DividendRadarService } from '@/lib/dividend-radar-service';
import { DividendService } from '@/lib/dividend-service';
import { cache } from '@/lib/cache-service';
import { dividendTypeLabel, type DividendTypeLabel } from '@/app/agenda-proventos/agenda-model';

interface HistoricalDividend {
  month: number;
  year: number;
  exDate: Date;
  paymentDate: Date | null;
  amount: number;
  type: DividendTypeLabel;
}

interface GridCompany {
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl: string | null;
  projections: DividendProjection[];
  historicalDividends: HistoricalDividend[];
}

/**
 * GET /api/dividend-radar/grid
 * Retorna dados para o grid completo do radar de dividendos
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const searchParams = request.nextUrl.searchParams;
    
    const search = searchParams.get('search')?.toUpperCase() || '';
    const sector = searchParams.get('sector') || '';
    const period = searchParams.get('period') || '12'; // 3, 6, ou 12 meses
    const myAssets = searchParams.get('myAssets') === 'true';
    const dateType = searchParams.get('dateType') || 'exDate'; // Sempre 'exDate' (paymentDate sempre NULL no banco)
    const oneTickerPerStock = searchParams.get('oneTickerPerStock') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Chave de cache baseada nos filtros
    const cacheKey = `dividend-radar-grid:v2:${search}:${sector}:${period}:${myAssets}:${dateType}:${oneTickerPerStock}:${limit}:${offset}:${currentUser?.id || 'anonymous'}`;

    // Verificar cache (1 hora)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Buscar empresas
    const companiesQuery: any = {
      where: {
        assetType: { in: ['STOCK', 'BDR'] }, // Apenas ações e BDRs (sem FIIs e ETFs)
      },
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        logoUrl: true,
        dividendRadarProjections: true,
        dividendHistory: {
          where: {
            exDate: {
              // Dividendos desde o dia 1 do 4º mês anterior: o calendário desenha os 4 meses passados inteiros
              gte: new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() - 4, 1)),
            },
          },
          orderBy: { exDate: 'desc' },
          select: {
            exDate: true,
            paymentDate: true,
            amount: true,
            type: true,
          },
        },
      },
    };

    // Filtro por busca
    if (search) {
      companiesQuery.where.OR = [
        { ticker: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por setor
    if (sector) {
      companiesQuery.where.sector = sector;
    }

    // Filtro "meus ativos" (se logado)
    if (myAssets && currentUser?.id) {
      // Buscar portfolios do usuário (usando PortfolioConfig)
      const portfolios = await prisma.portfolioConfig.findMany({
        where: { 
          userId: currentUser.id,
          isActive: true,
        },
        include: {
          assets: {
            where: { isActive: true },
            select: { ticker: true },
          },
        },
      });

      const userTickers = new Set(
        portfolios.flatMap(p => p.assets.map(a => a.ticker))
      );

      if (userTickers.size > 0) {
        companiesQuery.where.ticker = { in: Array.from(userTickers) };
      } else {
        // Se não tem ativos, retornar vazio
        return NextResponse.json({
          success: true,
          companies: [],
          count: 0,
        });
      }
    }

    // Buscar empresas (sem processar projeções ainda)
    const companies = await safeQueryWithParams(
      'find-companies-for-dividend-radar',
      () => prisma.company.findMany(companiesQuery),
      { search, sector, myAssets }
    );

    // Filtrar apenas empresas com histórico de dividendos ou projeções existentes
    let companiesWithDividends = companies.filter(
      (c: any) => (c.dividendHistory?.length > 0) || c.dividendRadarProjections
    );

    // Aplicar filtro "um ticker por ação" ANTES de processar projeções
    if (oneTickerPerStock) {
      const tickerMap = new Map<string, typeof companiesWithDividends[0]>();
      
      for (const company of companiesWithDividends) {
        if (company.ticker.length >= 4) {
          const baseTicker = company.ticker.substring(0, 4);
          const suffix = company.ticker.substring(4);
          
          // Se é ticker principal (3 ou 4), usar ele
          if (suffix === '3' || suffix === '4') {
            tickerMap.set(baseTicker, company);
          } else {
            // Se não é principal e ainda não tem principal, adicionar
            if (!tickerMap.has(baseTicker)) {
              tickerMap.set(baseTicker, company);
            }
          }
        } else {
          // Ticker muito curto, manter como está
          tickerMap.set(company.ticker, company);
        }
      }
      
      companiesWithDividends = Array.from(tickerMap.values());
    }

    // Contar total ANTES de processar projeções
    const totalCount = companiesWithDividends.length;

    // Aplicar paginação ANTES de processar projeções
    const paginatedCompanies = companiesWithDividends.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    // Processar projeções APENAS para empresas da página atual
    const gridCompanies: GridCompany[] = [];
    const now = new Date();
    const periodMonths = Number(period);
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() + periodMonths, 1);
    
    // Calcular data de corte para histórico (4 meses atrás)
    const historicalCutoffDate = new Date(now.getFullYear(), now.getMonth() - 4, 1);

    // Empresas sem projeções em cache: atualiza o histórico de proventos em background (não bloqueia a resposta).
    // Ao salvar, o DividendService recalcula as projeções se houver provento novo.
    const companiesToRefresh = paginatedCompanies.filter((c: any) => !c.dividendRadarProjections);
    if (companiesToRefresh.length > 0) {
      Promise.all(
        companiesToRefresh.map((company: any) =>
          DividendService.fetchAndSaveDividends(company.ticker).catch((error) => {
            console.error(`[GRID] Erro ao atualizar proventos de ${company.ticker}:`, error);
          })
        )
      ).catch(() => {});
    }

    for (const company of paginatedCompanies) {
      // Projeções em cache; recalcula na hora (estimativa estatística, consulta rápida) quando faltam ou estão desatualizadas
      let projections = ((company as any).dividendRadarProjections as DividendProjection[] | null) ?? null;
      try {
        if (!projections || (await DividendRadarService.shouldReprocessProjections(company.ticker))) {
          projections = await DividendRadarService.generateProjections(company.ticker);
        }
      } catch (error) {
        console.error(`[GRID] Erro ao calcular projeções para ${company.ticker}:`, error);
        projections = projections ?? [];
      }

      // Filtrar projeções antigas (meses passados) e futuras (apenas meses futuros) E confiança >= 60%
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      const futureProjections = projections.filter((p) => {
        const projDate = new Date(p.projectedExDate);
        const projMonth = projDate.getMonth() + 1;
        const projYear = projDate.getFullYear();
        
        // Remover projeções de meses passados
        if (projYear < currentYear) {
          return false;
        }
        if (projYear === currentYear && projMonth < currentMonth) {
          return false;
        }
        
        // Manter apenas projeções futuras dentro do período E confiança >= 60%
        return projDate > now && projDate <= cutoffDate && p.confidence >= 60;
      });

      // Processar histórico de dividendos pagos (últimos 6 meses)
      const historicalDividends: HistoricalDividend[] = [];
      if ((company as any).dividendHistory && Array.isArray((company as any).dividendHistory)) {
        (company as any).dividendHistory.forEach((div: any) => {
          const divDate = new Date(div.exDate);
          if (divDate >= historicalCutoffDate && divDate <= now) {
            historicalDividends.push({
              month: divDate.getUTCMonth() + 1,
              year: divDate.getUTCFullYear(),
              exDate: divDate,
              paymentDate: div.paymentDate ?? null,
              amount: Number(div.amount),
              type: dividendTypeLabel(div.type),
            });
          }
        });
      }

      // Adicionar empresa se tiver projeções futuras OU histórico de dividendos
      if (futureProjections.length > 0 || historicalDividends.length > 0) {
        gridCompanies.push({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          logoUrl: company.logoUrl,
          projections: futureProjections,
          historicalDividends,
        });
      }
    }

    // Ordenar por número de projeções (mais projeções primeiro)
    gridCompanies.sort((a, b) => b.projections.length - a.projections.length);

    const result = {
      success: true,
      companies: gridCompanies, // Usar gridCompanies que tem as projeções processadas
      count: gridCompanies.length,
      totalCount,
      hasMore,
      offset,
      limit,
    };

    // Cache por 1 hora
    await cache.set(cacheKey, result, { ttl: 3600 });

    return NextResponse.json(result);
  } catch (error) {
    console.error(`❌ [DIVIDEND RADAR API] Erro ao buscar grid:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

