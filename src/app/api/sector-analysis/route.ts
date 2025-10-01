import { NextRequest, NextResponse } from 'next/server';
import { analyzeSectors } from '@/lib/sector-analysis-service';

// Cache para evitar recalcular constantemente
let cachedSectorData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 horas

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const searchParams = request.nextUrl.searchParams;
    const sectorsParam = searchParams.get('sectors');
    
    // Verificar cache apenas se não houver parâmetro de setores específicos
    if (!sectorsParam && cachedSectorData && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📊 Retornando análise setorial do cache');
      return NextResponse.json({
        sectors: cachedSectorData,
        cached: true
      });
    }

    console.log('📊 [API] Calculando análise setorial...');

    // Parsear setores do parâmetro
    const sectorsToAnalyze = sectorsParam 
      ? sectorsParam.split(',').map(s => s.trim())
      : undefined;

    // Chamar serviço de análise
    const sectorAnalysis = await analyzeSectors(sectorsToAnalyze);

    // Atualizar cache apenas se não foi requisição específica de setores
    if (!sectorsParam) {
      cachedSectorData = sectorAnalysis;
      cacheTimestamp = now;
    }

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

