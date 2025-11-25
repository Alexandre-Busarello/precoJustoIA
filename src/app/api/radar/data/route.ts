import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { getOrCalculateTechnicalAnalysis } from '@/lib/technical-analysis-service';
import { prisma } from '@/lib/prisma';
import { getRadarStatusColor, getTechnicalEntryStatus, getSentimentStatus, getValuationStatus } from '@/lib/radar-service';
import { getLatestPrices } from '@/lib/quote-service';

/**
 * POST /api/radar/data - Buscar dados consolidados para array de tickers
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tickers } = body;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json(
        { error: 'Tickers deve ser um array não vazio' },
        { status: 400 }
      );
    }

    const isPremium = currentUser.isPremium;
    const isLoggedIn = true;

    // Atualizar preços do Yahoo Finance antes de processar
    console.log(`💰 [RADAR] Atualizando preços para ${tickers.length} tickers do Yahoo Finance...`);
    const updatedPrices = await getLatestPrices(tickers);
    console.log(`✅ [RADAR] Preços atualizados para ${updatedPrices.size} tickers`);

    // Buscar dados para cada ticker em paralelo
    const dataPromises = tickers.map(async (ticker: string) => {
      try {
        // Buscar análise completa da empresa
        const analysisResult = await calculateCompanyOverallScore(ticker, {
          isPremium,
          isLoggedIn,
          includeStatements: isPremium,
          includeStrategies: true,
        });

        if (!analysisResult) {
          return null;
        }

        const { ticker: companyTicker, companyName, sector, currentPrice: analysisPrice, logoUrl, overallScore, strategies } = analysisResult;
        
        // Usar preço atualizado do Yahoo Finance se disponível, senão usar do analysis
        const updatedPrice = updatedPrices.get(ticker.toUpperCase());
        const currentPrice = updatedPrice?.price ?? analysisPrice;

        // Buscar análise técnica
        const technicalAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false, false);

        // Buscar análise de sentimento (YouTube)
        const company = await prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() },
          select: { id: true },
        });

        let youtubeScore: number | null = null;
        if (company) {
          const youtubeAnalysis = await (prisma as any).youTubeAnalysis.findFirst({
            where: {
              companyId: company.id,
              isActive: true,
            },
            orderBy: { createdAt: 'desc' },
            select: { score: true },
          });

          if (youtubeAnalysis) {
            youtubeScore = Number(youtubeAnalysis.score);
          }
        }

        // Calcular melhor upside entre estratégias
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

        // Determinar status de entrada técnico (considerando score fundamentalista)
        const technicalStatus = getTechnicalEntryStatus(technicalAnalysis, currentPrice, overallScore?.score);

        // Determinar status de sentimento
        const sentimentStatus = getSentimentStatus(youtubeScore);

        // Determinar status de valuation
        const valuationStatus = getValuationStatus(bestUpside);

        // Status geral baseado no score
        const overallStatus = overallScore 
          ? getRadarStatusColor(overallScore.score)
          : 'yellow';

        // Estratégias aprovadas
        const approvedStrategies: string[] = [];
        if (strategies?.graham?.isEligible) approvedStrategies.push('Graham');
        if (strategies?.barsi?.isEligible) approvedStrategies.push('Bazin');
        if (strategies?.dividendYield?.isEligible) approvedStrategies.push('Dividend Yield');
        if (strategies?.lowPE?.isEligible) approvedStrategies.push('Low P/E');
        if (strategies?.magicFormula?.isEligible) approvedStrategies.push('Magic Formula');
        if (strategies?.fcd?.isEligible) approvedStrategies.push('FCD');
        if (strategies?.gordon?.isEligible) approvedStrategies.push('Gordon');
        if (strategies?.fundamentalist?.isEligible) approvedStrategies.push('Fundamentalista');

        return {
          ticker: companyTicker,
          name: companyName,
          sector,
          currentPrice,
          logoUrl,
          overallScore: overallScore?.score || null,
          overallStatus,
          strategies: {
            approved: approvedStrategies,
            all: strategies,
          },
          valuation: {
            upside: bestUpside,
            status: valuationStatus.status,
            label: valuationStatus.label,
          },
          technical: {
            status: technicalStatus.status,
            label: technicalStatus.label,
            fairEntryPrice: technicalAnalysis?.aiFairEntryPrice || null,
          },
          sentiment: {
            score: youtubeScore,
            status: sentimentStatus.status,
            label: sentimentStatus.label,
          },
        };
      } catch (error: any) {
        console.error(`Erro ao processar ticker ${ticker}:`, error);
        return null;
      }
    });

    const results = await Promise.all(dataPromises);
    const validResults = results.filter(r => r !== null);

    return NextResponse.json({
      data: validResults,
      count: validResults.length,
    });

  } catch (error: any) {
    console.error('Erro ao buscar dados do radar:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar dados do radar' },
      { status: 500 }
    );
  }
}

