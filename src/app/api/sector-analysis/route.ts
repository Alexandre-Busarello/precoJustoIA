import { NextRequest, NextResponse } from 'next/server';
import { analyzeSectors } from '@/lib/sector-analysis-service';
import { cache } from '@/lib/cache-service';
import { getCurrentUser } from '@/lib/user-service';

const CACHE_DURATION = 60 * 60 * 24; // 24 horas em segundos

type SectorAnalysisResult = Awaited<ReturnType<typeof analyzeSectors>>[number];

/** Setores abertos para todos (os mesmos que /analise-setorial carrega no servidor). */
const FREE_SECTORS = ['Energia', 'Tecnologia da Informação'];

/** Mesmo gate da página: sem Premium, a 1ª empresa de cada setor não sai do servidor. */
function withoutTopCompany(sectors: SectorAnalysisResult[]) {
  return sectors.map((sector) => ({
    ...sector,
    topCompanies: sector.topCompanies.map((company, index) => (index === 0 ? null : company)),
  }));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectorsParam = searchParams.get('sectors');

    // Parsear setores do parâmetro
    const requestedSectors = sectorsParam
      ? sectorsParam.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const user = await getCurrentUser();
    const isPremium = user?.isPremium || false;

    // Sem Premium só os setores abertos (adicionar setores é recurso Premium na página)
    if (!isPremium && requestedSectors?.some((sector) => !FREE_SECTORS.includes(sector))) {
      return NextResponse.json(
        { error: 'Adicionar setores é exclusivo do Premium', upgradeUrl: '/planos' },
        { status: 403 }
      );
    }
    const sectorsToAnalyze = isPremium ? requestedSectors : requestedSectors ?? FREE_SECTORS;

    // Criar chave de cache baseada nos setores solicitados
    const cacheKey = sectorsToAnalyze
      ? `sector-analysis-specific-${sectorsToAnalyze.join('-')}`
      : 'sector-analysis-all';

    // Verificar cache Redis
    let sectorAnalysis = await cache.get<SectorAnalysisResult[]>(cacheKey);
    const cached = Boolean(sectorAnalysis);

    if (!sectorAnalysis) {
      console.log('📊 [API] Calculando análise setorial...');
      sectorAnalysis = await analyzeSectors(sectorsToAnalyze);
      await cache.set(cacheKey, sectorAnalysis, { ttl: CACHE_DURATION });
    }

    return NextResponse.json({
      sectors: isPremium ? sectorAnalysis : withoutTopCompany(sectorAnalysis),
      cached,
      ...(cached ? {} : { timestamp: new Date().toISOString() })
    });

  } catch (error) {
    console.error('❌ Erro na análise setorial:', error);
    return NextResponse.json(
      { error: 'Erro ao processar análise setorial' },
      { status: 500 }
    );
  }
}
