import { NextResponse } from 'next/server';
import { getSectorsAndIndustries } from '@/lib/screening-ai-service';
import { prisma } from '@/lib/prisma-wrapper';

export async function GET() {
  try {
    // Usar o serviço para buscar setores e indústrias
    const { sectors, industries } = await getSectorsAndIndustries();

    // Buscar indústrias agrupadas por setor (funcionalidade adicional da API)
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
      industries, // Lista simples de todas as indústrias
      industriesBySector // Indústrias agrupadas por setor
    });
  } catch (error) {
    console.error('Erro ao buscar setores e indústrias:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar setores e indústrias' },
      { status: 500 }
    );
  }
}
