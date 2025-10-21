import { NextRequest, NextResponse } from 'next/server';
import { prisma, safeQueryWithParams } from '@/lib/prisma-wrapper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    
    if (!query || query.length < 1) {
      return NextResponse.json({ companies: [] });
    }
    
    // Buscar empresas por ticker ou nome (case insensitive)
    // NOTA: Por enquanto, buscar apenas ações (STOCK)
    // ETFs, FIIs e BDRs terão páginas específicas no futuro
    const companies = await safeQueryWithParams('search-companies', () =>
      prisma.company.findMany({
        where: {
          assetType: 'STOCK', // Filtrar apenas ações
          OR: [
            {
              ticker: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              name: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ]
        },
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          logoUrl: true,
        },
        orderBy: [
          // Priorizar matches exatos do ticker
          {
            ticker: 'asc'
          },
          // Depois por nome
          {
            name: 'asc'
          }
        ],
        take: 10 // Limitar a 10 resultados
      }),
      {
        q: query,
        take: 10,
        mode: 'insensitive'
      }
    );

    // Ordenar resultados priorizando matches exatos de ticker
    const sortedCompanies = companies.sort((a, b) => {
      const aTickerMatch = a.ticker.toLowerCase().startsWith(query.toLowerCase());
      const bTickerMatch = b.ticker.toLowerCase().startsWith(query.toLowerCase());
      
      if (aTickerMatch && !bTickerMatch) return -1;
      if (!aTickerMatch && bTickerMatch) return 1;
      
      // Se ambos são matches de ticker ou ambos não são, ordenar por ticker
      return a.ticker.localeCompare(b.ticker);
    });

    return NextResponse.json({ 
      companies: sortedCompanies.map(company => ({
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        logoUrl: company.logoUrl
      }))
    });

  } catch (error) {
    console.error('Erro na API search-companies:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', companies: [] },
      { status: 500 }
    );
  }
}
