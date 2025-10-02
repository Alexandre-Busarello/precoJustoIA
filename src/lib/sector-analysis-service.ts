import { prisma } from '@/lib/prisma';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';

interface SectorAnalysisResult {
  sector: string;
  companyCount: number;
  topCompanies: Array<{
    ticker: string;
    name: string;
    score: number;
    currentPrice: number;
    logoUrl: string | null;
    recommendation: string;
  }>;
  averageScore: number;
}

// Setores macro da B3
const MAIN_SECTORS = [
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

/**
 * Analisa setores específicos e retorna as melhores empresas de cada um
 * @param sectors Array de setores para analisar. Se vazio, analisa todos.
 * @returns Array com análise de cada setor
 */
export async function analyzeSectors(sectors?: string[]): Promise<SectorAnalysisResult[]> {
  try {
    const sectorsToAnalyze = sectors && sectors.length > 0
      ? sectors.filter(s => MAIN_SECTORS.includes(s))
      : MAIN_SECTORS;

    console.log(`📊 Analisando ${sectorsToAnalyze.length} setores:`, sectorsToAnalyze);
    const startTime = Date.now();

    // Processar setores em lotes para evitar sobrecarga
    const BATCH_SIZE = 3;
    const BATCH_DELAY = 200;
    const sectorAnalysisResults: (SectorAnalysisResult | null)[] = [];

    for (let i = 0; i < sectorsToAnalyze.length; i += BATCH_SIZE) {
      const batch = sectorsToAnalyze.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sectorsToAnalyze.length / BATCH_SIZE)}`);

      const batchPromises = batch.map(async (sector) => {
        return await analyzeSingleSector(sector);
      });

      const batchResults = await Promise.all(batchPromises);
      sectorAnalysisResults.push(...batchResults);

      // Delay entre lotes (exceto no último)
      if (i + BATCH_SIZE < sectorsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Filtrar setores válidos e ordenar por score
    const validSectors = sectorAnalysisResults
      .filter((s): s is SectorAnalysisResult => s !== null)
      .sort((a, b) => b.averageScore - a.averageScore);

    const totalTime = Date.now() - startTime;
    console.log(`✅ Análise concluída: ${validSectors.length} setores em ${(totalTime / 1000).toFixed(2)}s`);

    return validSectors;
  } catch (error) {
    console.error('❌ Erro na análise setorial:', error);
    return [];
  }
}

/**
 * Analisa um único setor
 */
async function analyzeSingleSector(sector: string): Promise<SectorAnalysisResult | null> {
  try {
    const sectorStartTime = Date.now();
    console.log(`🔍 Analisando setor: ${sector}`);

    // Buscar empresas do setor com indicadores mínimos
    const companies = await prisma.company.findMany({
      where: {
        sector: sector,
        financialData: {
          some: {
            roe: { gte: 0.08 },
            pl: { gt: 0, lt: 100 },
            lpa: { not: null },
            vpa: { not: null },
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
      take: 50
    });

    if (companies.length === 0) {
      console.log(`⚠️  Nenhuma empresa qualificada no setor ${sector}`);
      return null;
    }

    // Calcular score para cada empresa (em lotes)
    const companyScores = [];
    for (let j = 0; j < companies.length; j += 20) {
      const companyBatch = companies.slice(j, j + 20);
      const batchResults = await Promise.all(
        companyBatch.map(async (company) => {
          try {
            const result = await calculateCompanyOverallScore(company.ticker, {
              isPremium: true,
              isLoggedIn: true,
              includeStatements: true
            });

            if (result && result.overallScore && result.overallScore.score >= 60) {
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

    // Ordenar e pegar top 5
    const topCompanies = companyScores
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 5) as NonNullable<typeof companyScores[0]>[];

    if (topCompanies.length === 0) {
      return null;
    }

    const averageScore = topCompanies.reduce((sum, c) => sum + c.score, 0) / topCompanies.length;
    const sectorTime = Date.now() - sectorStartTime;
    
    console.log(`✅ Setor ${sector}: ${topCompanies.length} empresas em ${(sectorTime / 1000).toFixed(2)}s`);

    return {
      sector,
      companyCount: topCompanies.length,
      topCompanies,
      averageScore
    };
  } catch (error) {
    console.error(`❌ Erro ao analisar setor ${sector}:`, error);
    return null;
  }
}

