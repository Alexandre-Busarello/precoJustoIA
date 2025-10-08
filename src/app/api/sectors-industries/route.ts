import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma-wrapper';

export async function GET() {
  try {
    // Buscar todos os setores únicos
    const sectorsResult = await prisma.company.findMany({
      where: {
        sector: {
          not: null
        }
      },
      select: {
        sector: true
      },
      distinct: ['sector']
    });

    const sectors = sectorsResult
      .map(c => c.sector)
      .filter((sector): sector is string => sector !== null)
      .sort();

    // Buscar todas as indústrias agrupadas por setor
    const companiesWithIndustry = await prisma.company.findMany({
      where: {
        AND: [
          { sector: { not: null } },
          { industry: { not: null } }
        ]
      },
      select: {
        sector: true,
        industry: true
      }
    });

    // Agrupar indústrias por setor
    const industriesBySector: Record<string, string[]> = {};
    companiesWithIndustry.forEach(company => {
      if (company.sector && company.industry) {
        if (!industriesBySector[company.sector]) {
          industriesBySector[company.sector] = [];
        }
        if (!industriesBySector[company.sector].includes(company.industry)) {
          industriesBySector[company.sector].push(company.industry);
        }
      }
    });

    // Ordenar indústrias dentro de cada setor
    Object.keys(industriesBySector).forEach(sector => {
      industriesBySector[sector].sort();
    });

    return NextResponse.json({
      sectors,
      industriesBySector
    });
  } catch (error) {
    console.error('Erro ao buscar setores e indústrias:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar setores e indústrias' },
      { status: 500 }
    );
  }
}
