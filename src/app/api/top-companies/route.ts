import { NextRequest, NextResponse } from "next/server";
import { requirePremiumUser } from "@/lib/user-service";
import { prisma } from "@/lib/prisma";
import { calculateCompanyOverallScore } from "@/lib/calculate-company-score-service";
import { cache } from "@/lib/cache-service";

// Cache agora usa Redis com fallback para memória
const TOP_COMPANIES_CACHE_TTL = 1440 * 60; // 1 dia em segundos

interface TopCompany {
  ticker: string;
  companyName: string;
  score: number;
  sector: string | null;
  currentPrice: number;
  logoUrl: string | null;
  recommendation: string;
}

export async function GET(request: NextRequest) {
  try {
    // ✅ Verificar se usuário é Premium (recurso exclusivo)
    const user = await requirePremiumUser();
    if (!user) {
      return NextResponse.json(
        { 
          error: "Premium required",
          message: "Este recurso está disponível apenas para assinantes Premium" 
        }, 
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const minScore = parseInt(searchParams.get('minScore') || '80');

    // Verificar cache
    const cacheKey = 'top-companies-all'
    const cachedTopCompanies = await cache.get<TopCompany[]>(cacheKey, {
      prefix: 'companies',
      ttl: TOP_COMPANIES_CACHE_TTL
    });

    if (cachedTopCompanies && cachedTopCompanies.length > 0) {
      // Filtrar por minScore e retornar aleatoriamente
      const filtered = cachedTopCompanies.filter(c => c.score >= minScore);
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      return NextResponse.json({ 
        companies: shuffled.slice(0, limit),
        cached: true,
        cacheAge: 'Redis/Memory cache'
      });
    }

    // Buscar ano mais recente disponível
    const currentYear = new Date().getFullYear();
    const recentYear = await prisma.financialData.findFirst({
      where: { year: { lte: currentYear } },
      orderBy: { year: 'desc' },
      select: { year: true }
    });

    if (!recentYear) {
      return NextResponse.json({
        companies: [],
        cached: false,
        totalFound: 0
      });
    }

    const targetYear = recentYear.year;

    // Buscar empresas com dados financeiros completos do ano mais recente
    // ✅ Filtros de qualidade inicial para otimizar performance e garantir apenas empresas saudáveis
    // ✅ Buscar um conjunto maior e depois selecionar aleatoriamente para garantir variedade
    const allQualifiedCompanies = await prisma.company.findMany({
      where: {
        financialData: {
          some: {
            year: targetYear,
            // Indicadores básicos de qualidade
            roe: { 
              not: null,
              gte: 0.1 // ROE >= 5% (rentabilidade mínima)
            },
            pl: { 
              not: null,
              gt: 0,    // P/L > 0 (empresa lucrativa)
              lt: 25   // P/L < 25 (não absurdamente cara)
            },
            lpa: { not: null }, // LPA (Lucro por Ação) obrigatório
            vpa: { not: null }, // VPA (Valor Patrimonial por Ação) obrigatório
            liquidezCorrente: {
              not: null,
              gte: 1  // Liquidez >= 1 (capacidade mínima de pagamento)
            },
            margemLiquida: {
              not: null,
              gt: 0     // Margem > 0 (empresa lucrativa)
            },
            marketCap: { 
              not: null,
              gte: 1000000000 // Market Cap >= 1 bilhão (evitar micro caps)
            }
          }
        }
      },
      select: {
        ticker: true
        // Apenas o ticker - o serviço fará as buscas necessárias
      },
      take: 100 // Buscar 100 empresas qualificadas
    });

    // ✅ SELEÇÃO ALEATÓRIA: Pegar apenas 10 empresas aleatórias do pool qualificado
    // Isso garante variedade e reduz drasticamente o processamento
    const shuffled = allQualifiedCompanies.sort(() => 0.5 - Math.random());
    const companies = shuffled.slice(0, 20);
    
    console.log(`🔍 Selecionadas ${companies.length} empresas aleatórias de ${allQualifiedCompanies.length} qualificadas para análise`);


    // ✅ PROCESSAMENTO EM BATCHES - Evita esgotar connection pool
    // Com apenas 20 empresas, processar em 2 batches de 10 é suficiente
    const BATCH_SIZE = 10;
    const companiesWithScore: any[] = [];
    
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      console.log(`📊 Processando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companies.length / BATCH_SIZE)} (${batch.length} empresas)`);
      
      const batchResults = await Promise.all(
        batch.map(async (company) => {
          try {
            // Usar o serviço centralizado que replica EXATAMENTE a lógica da página da empresa
            const result = await calculateCompanyOverallScore(company.ticker, {
              isPremium: true,
              isLoggedIn: true,
              includeStatements: true, // Sempre true para dashboard (só Premium acessa)
              // companyId e industry serão buscados automaticamente pelo serviço
            });

            if (!result) return null;

            return {
              ticker: result.ticker,
              companyName: result.companyName,
              score: result.overallScore?.score || 0,
              sector: result.sector,
              currentPrice: result.currentPrice,
              logoUrl: result.logoUrl,
              recommendation: result.overallScore?.recommendation || 'NEUTRO'
            };
          } catch (error) {
            console.error(`❌ Erro ao processar ${company.ticker}:`, error);
            return null;
          }
        })
      );
      
      companiesWithScore.push(...batchResults);
      
      // Pequeno delay entre batches para dar tempo ao pool recuperar
      if (i + BATCH_SIZE < companies.length) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms entre batches
      }
    }

    // Filtrar empresas válidas e com score mínimo
    const validCompanies = companiesWithScore
      .filter((c): c is NonNullable<typeof c> => c !== null && c.score >= minScore)
      .sort((a, b) => b.score - a.score);

    console.log(`✅ Encontradas ${validCompanies.length} empresas com score >= ${minScore}`);

    // Atualizar cache
    await cache.set(cacheKey, validCompanies, {
      prefix: 'companies',
      ttl: TOP_COMPANIES_CACHE_TTL
    });

    // Retornar 'limit' empresas (default: 3)
    // Se houver mais empresas válidas que o limit, embaralhar e retornar aleatoriamente
    const companiesToReturn = validCompanies.length > limit
      ? validCompanies.sort(() => 0.5 - Math.random()).slice(0, limit)
      : validCompanies;

    return NextResponse.json({
      companies: companiesToReturn,
      cached: false,
      totalFound: validCompanies.length
    });

  } catch (error) {
    console.error("Erro ao buscar top empresas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar empresas" },
      { status: 500 }
    );
  }
}
