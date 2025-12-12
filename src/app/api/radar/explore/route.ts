import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { getOrCalculateTechnicalAnalysis } from '@/lib/technical-analysis-service';
import { prisma } from '@/lib/prisma';
import { calculateRadarScore, getTechnicalEntryStatus } from '@/lib/radar-service';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { cache } from '@/lib/cache-service';
import { getLatestPrices } from '@/lib/quote-service';

const EXPLORE_LIMIT = 50;
const CACHE_TTL = 60 * 60 * 24; // 24 horas em segundos

/**
 * GET /api/radar/explore - Lista automática de melhores oportunidades
 * 
 * Algoritmo balanceado:
 * - Solidez (30%): Overall Score
 * - Valuation (25%): Melhor upside entre estratégias
 * - Estratégia (25%): % de estratégias aprovadas
 * - Timing (20%): Baseado em entry point técnico
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const isPremium = currentUser.isPremium;
    const isLoggedIn = true;

    // Usar o dia atual como parte da chave de cache para garantir mudança diária
    const currentDate = new Date();
    const dayKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;
    const cacheKey = `radar-explore:${isPremium ? 'premium' : 'free'}:${dayKey}`;

    console.log(`🔍 [RADAR EXPLORE] Verificando cache: ${cacheKey}`);
    console.log(`📅 [RADAR EXPLORE] Data atual: ${currentDate.toISOString()}, dayKey: ${dayKey}`);

    // Verificar informações do cache
    const cacheInfo = cache.getConnectionInfo();
    console.log(`🔗 [RADAR EXPLORE] Status do cache:`, cacheInfo);

    // Verificar cache
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log(`✅ [RADAR EXPLORE] Cache HIT: ${cacheKey}`);
      return NextResponse.json({
        ...cachedData,
        cached: true,
      });
    }

    console.log(`❌ [RADAR EXPLORE] Cache MISS: ${cacheKey}`);

    // Buscar todas as empresas com dados financeiros válidos
    // Usar seed baseado no dia para garantir diversidade e mudança diária
    const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000)); // Dias desde epoch
    
    // Buscar empresas com cache que varia por dia
    const allCompanies = await safeQueryWithParams(
      'radar-explore-companies',
      () => prisma.company.findMany({
        where: {
          assetType: { in: ['STOCK', 'BDR'] },
          financialData: {
            some: {
              year: { gte: new Date().getFullYear() - 1 },
            },
          },
        },
        include: {
          financialData: {
            orderBy: { year: 'desc' },
            take: 1,
          },
          dailyQuotes: {
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
        take: 1000, // Buscar mais empresas para ter diversidade
      }),
      { dayKey } // Incluir dia na chave de cache para variar diariamente
    ) as any[];

    // Embaralhar aleatoriamente usando o dia atual como seed
    // Isso garante que a ordem varie diariamente, mas seja consistente durante o mesmo dia
    const shuffledCompanies = [...allCompanies].sort((a, b) => {
      // Função auxiliar para calcular hash do ticker
      const calculateHash = (ticker: string, seed: number): number => {
        let hash = seed;
        for (let idx = 0; idx < ticker.length; idx++) {
          hash += ticker.charCodeAt(idx) * (idx + 1);
        }
        return hash % 10000;
      };
      
      const hashA = calculateHash(a.ticker, daySeed);
      const hashB = calculateHash(b.ticker, daySeed);
      return hashA - hashB;
    });

    const companies = shuffledCompanies;

    // Extrair tickers e atualizar preços do Yahoo Finance
    const tickers = companies.map((c: any) => c.ticker);
    const updatedPrices = await getLatestPrices(tickers);

    // Processar empresas em paralelo (limitado para não sobrecarregar)
    const results: Array<{
      ticker: string;
      name: string;
      sector: string | null;
      currentPrice: number;
      logoUrl: string | null;
      compositeScore: number;
      overallScore: number | null;
      upside: number | null;
      approvedStrategies: number;
      technicalStatus: string;
    }> = [];

    // Processar em lotes de 10 para não sobrecarregar
    const batchSize = 10;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (company: any) => {
          try {
            const ticker = company.ticker;
            const companyId = company.id;
            const latestQuote = company.dailyQuotes?.[0];
            
            if (!latestQuote || !latestQuote.price) {
              return null;
            }

            // Buscar análise completa
            const analysisResult = await calculateCompanyOverallScore(ticker, {
              isPremium,
              isLoggedIn,
              includeStatements: isPremium,
              includeStrategies: true,
            });

            if (!analysisResult || !analysisResult.overallScore) {
              return null;
            }

            const { overallScore, strategies, currentPrice: analysisPrice } = analysisResult;
            
            // Usar preço atualizado do Yahoo Finance se disponível, senão usar do analysis
            const updatedPrice = updatedPrices.get(ticker.toUpperCase());
            const currentPrice = updatedPrice?.price ?? analysisPrice;

            // Filtrar por score mínimo
            if (overallScore.score < 60) {
              return null;
            }

            // Verificar se tem upside positivo em pelo menos 1 estratégia
            const upsides: number[] = [];
            if (strategies?.graham?.upside !== null && strategies?.graham?.upside !== undefined) {
              upsides.push(strategies.graham.upside);
            }
            if (strategies?.fcd?.upside !== null && strategies?.fcd?.upside !== undefined) {
              upsides.push(strategies.fcd.upside);
            }
            if (strategies?.gordon?.upside !== null && strategies?.gordon?.upside !== undefined) {
              upsides.push(strategies.gordon.upside);
            }

            const bestUpside = upsides.length > 0 ? Math.max(...upsides) : null;
            
            // Filtrar por upside positivo
            if (!bestUpside || bestUpside <= 0) {
              return null;
            }

            // Verificar se tem pelo menos 1 estratégia aprovada
            const approvedCount = [
              strategies?.graham?.isEligible,
              strategies?.barsi?.isEligible,
              strategies?.dividendYield?.isEligible,
              strategies?.lowPE?.isEligible,
              strategies?.magicFormula?.isEligible,
              strategies?.fcd?.isEligible,
              strategies?.gordon?.isEligible,
              strategies?.fundamentalist?.isEligible,
            ].filter(Boolean).length;

            if (approvedCount === 0) {
              return null;
            }

            // Buscar análise técnica
            const technicalAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false, false);

            // Buscar análise de sentimento (YouTube)
            let youtubeScore: number | null = null;
            if (companyId) {
              const youtubeAnalysis = await (prisma as any).youTubeAnalysis.findFirst({
                where: {
                  companyId: companyId,
                  isActive: true,
                },
                orderBy: { createdAt: 'desc' },
                select: { score: true },
              });

              if (youtubeAnalysis) {
                youtubeScore = Number(youtubeAnalysis.score);
              }
            }

            // Calcular score composto
            const compositeScoreResult = calculateRadarScore(
              overallScore.score,
              strategies || {
                graham: null,
                fcd: null,
                gordon: null,
                dividendYield: null,
                lowPE: null,
                magicFormula: null,
                fundamentalist: null,
                barsi: null,
              },
              technicalAnalysis,
              currentPrice
            );

            // Determinar status de entrada técnico usando função centralizada
            const technicalStatusResult = getTechnicalEntryStatus(
              technicalAnalysis,
              currentPrice,
              overallScore.score
            );
            
            // Converter status para formato esperado pelo frontend
            const technicalStatus = technicalStatusResult.status === 'green' ? 'compra' : 'neutro';
            const technicalLabel = technicalStatusResult.label;

            // Estratégias aprovadas
            const approvedStrategiesList: string[] = [];
            if (strategies?.graham?.isEligible) approvedStrategiesList.push('Graham');
            if (strategies?.barsi?.isEligible) approvedStrategiesList.push('Bazin');
            if (strategies?.dividendYield?.isEligible) approvedStrategiesList.push('Dividend Yield');
            if (strategies?.lowPE?.isEligible) approvedStrategiesList.push('Low P/E');
            if (strategies?.magicFormula?.isEligible) approvedStrategiesList.push('Magic Formula');
            if (strategies?.fcd?.isEligible) approvedStrategiesList.push('FCD');
            if (strategies?.gordon?.isEligible) approvedStrategiesList.push('Gordon');
            if (strategies?.fundamentalist?.isEligible) approvedStrategiesList.push('Fundamentalista');

            return {
              ticker,
              name: analysisResult.companyName,
              sector: analysisResult.sector,
              currentPrice,
              logoUrl: analysisResult.logoUrl,
              compositeScore: compositeScoreResult.score,
              overallScore: overallScore.score,
              overallStatus: overallScore.score >= 70 ? 'green' : overallScore.score >= 50 ? 'yellow' : 'red',
              upside: bestUpside,
              valuationStatus: bestUpside > 10 ? 'green' : bestUpside >= 0 ? 'yellow' : 'red',
              approvedStrategies: approvedStrategiesList,
              strategies: strategies || {},
              technicalStatus,
              technicalLabel,
              technicalFairEntryPrice: technicalAnalysis?.aiFairEntryPrice || null,
              sentimentScore: youtubeScore,
              sentimentStatus: youtubeScore !== null 
                ? (youtubeScore >= 70 ? 'green' : youtubeScore >= 50 ? 'yellow' : 'red')
                : 'yellow',
              sentimentLabel: youtubeScore !== null ? `${youtubeScore.toFixed(0)}` : 'N/A',
            };
          } catch (error: any) {
            console.error(`Erro ao processar ${company.ticker}:`, error);
            return null;
          }
        })
      );

      results.push(...batchResults.filter(r => r !== null) as any[]);
      
      // Continuar processando mais empresas para ter diversidade na seleção final
      // Não parar quando encontra 50, mas processar pelo menos 200 empresas válidas
      // ou todas as empresas disponíveis, o que for menor
      if (results.length >= Math.max(EXPLORE_LIMIT * 4, 200) || i + batchSize >= companies.length) {
        break;
      }
    }

    // Ordenar por score composto (maior primeiro)
    results.sort((a, b) => b.compositeScore - a.compositeScore);

    // Limitar resultados finais
    const limitedResults = results.slice(0, EXPLORE_LIMIT);

    const response = {
      data: limitedResults,
      count: limitedResults.length,
      cached: false,
      timestamp: new Date().toISOString(),
    };

    // Salvar no cache por 24 horas (chave já inclui o dia, garantindo mudança diária)
    console.log(`💾 [RADAR EXPLORE] Salvando no cache: ${cacheKey} (TTL: ${CACHE_TTL}s)`);
    await cache.set(cacheKey, response, { ttl: CACHE_TTL });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Erro ao buscar oportunidades:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar oportunidades' },
      { status: 500 }
    );
  }
}

