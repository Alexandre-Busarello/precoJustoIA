import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { getOrCalculateTechnicalAnalysis } from '@/lib/technical-analysis-service';
import { prisma } from '@/lib/prisma';
import {
  getRadarStatusColor,
  getTechnicalEntryStatus,
  getSentimentStatus,
  getValuationStatus,
  getFiiValuationStatus,
} from '@/lib/radar-service';
import { getLatestPrices } from '@/lib/quote-service';
import { getCachedFiiOverallScore } from '@/lib/fii-score-loader';

/**
 * POST /api/radar/data - Buscar dados consolidados para array de tickers
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
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

    console.log(`💰 [RADAR] Atualizando preços para ${tickers.length} tickers do Yahoo Finance...`);
    const updatedPrices = await getLatestPrices(tickers);
    console.log(`✅ [RADAR] Preços atualizados para ${updatedPrices.size} tickers`);

    const dataPromises = tickers.map(async (ticker: string) => {
      try {
        const t = ticker.toUpperCase();

        const companyRow = await prisma.company.findUnique({
          where: { ticker: t },
          select: {
            id: true,
            ticker: true,
            name: true,
            sector: true,
            logoUrl: true,
            assetType: true,
            fiiData: {
              select: {
                pvp: true,
                dividendYield: true,
                segment: true,
                isPapel: true,
              },
            },
          },
        });

        if (!companyRow) {
          return null;
        }

        const updatedPrice = updatedPrices.get(t);
        const toNum = (v: unknown): number | null => {
          if (v === null || v === undefined) return null;
          if (typeof v === 'number') return Number.isFinite(v) ? v : null;
          if (typeof v === 'object' && v !== null && 'toNumber' in v) {
            const n = (v as { toNumber: () => number }).toNumber();
            return Number.isFinite(n) ? n : null;
          }
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };

        if (companyRow.assetType === 'FII') {
          const fiiScore = await getCachedFiiOverallScore(t);
          const analysisPrice = toNum(updatedPrice?.price) ?? 0;
          const currentPrice = analysisPrice;

          const technicalAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false, false);

          let youtubeScore: number | null = null;
          const youtubeAnalysis = await (prisma as any).youTubeAnalysis.findFirst({
            where: {
              companyId: companyRow.id,
              isActive: true,
            },
            orderBy: { createdAt: 'desc' },
            select: { score: true },
          });
          if (youtubeAnalysis) {
            youtubeScore = Number(youtubeAnalysis.score);
          }

          const pvp = toNum(companyRow.fiiData?.pvp);
          const dyRatio = toNum(companyRow.fiiData?.dividendYield);
          const fiiVal = getFiiValuationStatus(pvp, dyRatio);

          const pjScore = fiiScore?.score ?? null;
          const technicalStatus = getTechnicalEntryStatus(
            technicalAnalysis,
            currentPrice,
            pjScore
          );
          const sentimentStatus = getSentimentStatus(youtubeScore);
          const overallStatus =
            pjScore !== null ? getRadarStatusColor(pjScore) : 'yellow';

          const segment = companyRow.fiiData?.segment ?? null;
          const isPapel = companyRow.fiiData?.isPapel ?? null;
          const approved: string[] = ['FII'];
          if (isPapel === true) approved.push('Papel');
          else if (isPapel === false) approved.push('Tijolo');
          if (segment) approved.push(segment);

          return {
            ticker: companyRow.ticker,
            name: companyRow.name,
            assetType: 'FII' as const,
            sector: companyRow.sector,
            currentPrice,
            logoUrl: companyRow.logoUrl,
            overallScore: pjScore,
            overallStatus,
            fiiProfile: {
              segment,
              isPapel,
            },
            strategies: {
              approved,
              all: {
                kind: 'fii' as const,
                segment,
                isPapel,
              },
            },
            valuation: {
              upside: null,
              status: fiiVal.status,
              label: fiiVal.label,
              detail: fiiVal.detail,
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
        }

        const analysisResult = await calculateCompanyOverallScore(ticker, {
          isPremium,
          isLoggedIn,
          includeStatements: isPremium,
          includeStrategies: true,
        });

        if (!analysisResult) {
          return null;
        }

        const {
          ticker: companyTicker,
          companyName,
          sector,
          currentPrice: analysisPrice,
          logoUrl,
          overallScore,
          strategies,
        } = analysisResult;

        const updatedPriceNum = updatedPrices.get(t);
        const currentPrice = updatedPriceNum?.price ?? analysisPrice;

        const technicalAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false, false);

        let youtubeScore: number | null = null;
        const youtubeAnalysis = await (prisma as any).youTubeAnalysis.findFirst({
          where: {
            companyId: companyRow.id,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
          select: { score: true },
        });
        if (youtubeAnalysis) {
          youtubeScore = Number(youtubeAnalysis.score);
        }

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

        const technicalStatus = getTechnicalEntryStatus(
          technicalAnalysis,
          currentPrice,
          overallScore?.score
        );

        const sentimentStatus = getSentimentStatus(youtubeScore);

        const valuationStatus = getValuationStatus(bestUpside);

        const overallStatus = overallScore ? getRadarStatusColor(overallScore.score) : 'yellow';

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
          assetType: 'STOCK' as const,
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
    const validResults = results.filter((r) => r !== null);

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
