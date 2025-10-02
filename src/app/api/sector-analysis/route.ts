import { NextRequest, NextResponse } from 'next/server';
import { analyzeSectors } from '@/lib/sector-analysis-service';
import { cache } from '@/lib/cache-service';

const CACHE_DURATION = 60 * 60 * 24; // 24 horas em segundos

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectorsParam = searchParams.get('sectors');
    
    // Parsear setores do parâmetro
    const sectorsToAnalyze = sectorsParam 
      ? sectorsParam.split(',').map(s => s.trim())
      : undefined;

    // Criar chave de cache baseada nos setores solicitados
    const cacheKey = sectorsParam 
      ? `sector-analysis-specific-${sectorsParam.replace(/,/g, '-')}`
      : 'sector-analysis-all';

    // Verificar cache Redis
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log('📊 Retornando análise setorial do cache Redis');
      return NextResponse.json({
        sectors: cachedData,
        cached: true
      });
    }

    console.log('📊 [API] Calculando análise setorial...');

    // Chamar serviço de análise
    const sectorAnalysis = await analyzeSectors(sectorsToAnalyze);

    // Salvar no cache Redis
    await cache.set(cacheKey, sectorAnalysis, { ttl: CACHE_DURATION });

    return NextResponse.json({
      sectors: sectorAnalysis,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na análise setorial:', error);
    return NextResponse.json(
      { error: 'Erro ao processar análise setorial' },
      { status: 500 }
    );
  }
}

