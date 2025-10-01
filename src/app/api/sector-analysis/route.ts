import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';

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

    console.log('📊 Calculando análise setorial...');

    // Definir setores macro da B3 para análise
    const mainSectors = [
      'Bens Industriais',
      'Comunicações',
      'Consumo Cíclico',
      'Consumo Não Cíclico',
      'Energia',
      'Financeiro',
      'Imobiliário',
      'Materiais Básicos',
      'Saúde',
      'Tecnologia da Informação',
      'Utilidade Pública'
    ];

    // Filtrar setores se parâmetro fornecido
    const sectorsToAnalyze = sectorsParam 
      ? sectorsParam.split(',').filter(s => mainSectors.includes(s))
      : mainSectors;

    console.log(`📊 Analisando ${sectorsToAnalyze.length} setores`);
    const startTime = Date.now();

    // ✅ PROCESSAMENTO EM LOTES - Evitar sobrecarga do banco
    const BATCH_SIZE = 3; // Processar 3 setores por vez
    const BATCH_DELAY = 200; // 200ms entre lotes
    const sectorAnalysisResults: any[] = [];

    // Dividir setores em lotes
    for (let i = 0; i < sectorsToAnalyze.length; i += BATCH_SIZE) {
      const batch = sectorsToAnalyze.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sectorsToAnalyze.length / BATCH_SIZE)}: ${batch.join(', ')}`);

      const batchPromises = batch.map(async (sector) => {
        const sectorStartTime = Date.now();
        console.log(`🔍 Analisando setor: ${sector}`);

        // Buscar empresas do setor com indicadores mínimos de qualidade
        const companies = await prisma.company.findMany({
          where: {
            sector: sector,
            financialData: {
              some: {
                roe: { gte: 0.08 }, // ROE >= 8%
                pl: { gt: 0, lt: 100 }, // P/L positivo e < 30
                lpa: { not: null },
                vpa: { not: null },
                // Adicionando a condição OR para liquidezCorrente
                OR: [
                  { liquidezCorrente: { gte: 0.8 } },
                  { liquidezCorrente: null }
                ]
              }
            }
          },
          select: {
            ticker: true,
            name: true
          },
          take: 50 // Pegar 50 para calcular e pegar as top 5
        });

        if (companies.length === 0) {
          console.log(`⚠️ Nenhuma empresa qualificada no setor ${sector}`);
          return null;
        }

        // Calcular score para cada empresa do setor, mas limitar paralelismo
        const companyScores = [];
        for (let j = 0; j < companies.length; j += 20) {
          const companyBatch = companies.slice(j, j + 20);
          const batchResults = await Promise.all(
            companyBatch.map(async (company) => {
              try {
                const result = await calculateCompanyOverallScore(company.ticker, {
                  isPremium: true,
                  isLoggedIn: true,
                  includeStatements: true // ✅ IMPORTANTE: Incluir statements para score consistente com página individual
                });

                if (result && result.overallScore.score >= 60) {
                  return {
                    ticker: result.ticker,
                    name: result.companyName,
                    score: result.overallScore.score,
                    currentPrice: result.currentPrice,
                    logoUrl: result.logoUrl,
                    recommendation: result.overallScore.recommendation
                  };
                }
                return null;
              } catch (error) {
                console.error(`❌ Erro ao calcular score para ${company.ticker}:`, error);
                return null;
              }
            })
          );
          companyScores.push(...batchResults.filter(c => c !== null));
        }

        // Ordenar por score e pegar top 5
        const topCompanies = companyScores
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (topCompanies.length === 0) {
          return null;
        }

        const sectorTime = Date.now() - sectorStartTime;
        console.log(`✅ Setor ${sector} analisado em ${(sectorTime / 1000).toFixed(2)}s`);

        return {
          sector: sector,
          companyCount: topCompanies.length,
          topCompanies: topCompanies,
          averageScore: topCompanies.reduce((sum, c) => sum + c.score, 0) / topCompanies.length
        };
      });

      // Processar lote atual
      const batchResults = await Promise.all(batchPromises);
      sectorAnalysisResults.push(...batchResults);

      // Pequeno delay entre lotes (exceto no último)
      if (i + BATCH_SIZE < sectorsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    // Filtrar setores válidos e ordenar por score médio
    const sectorAnalysis = sectorAnalysisResults
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.averageScore - a.averageScore);

    // Atualizar cache apenas se não foi requisição específica de setores
    if (!sectorsParam) {
      cachedSectorData = sectorAnalysis;
      cacheTimestamp = now;
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Análise setorial concluída: ${sectorAnalysis.length} setores analisados em ${(totalTime / 1000).toFixed(2)}s`);

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

