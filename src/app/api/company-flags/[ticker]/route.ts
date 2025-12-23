/**
 * API: Consultar Flags de Empresa
 * 
 * GET: Buscar flags ativos de uma empresa
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company-flags/[ticker]
 * Busca flags ativos de uma empresa
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params;
    const ticker = resolvedParams.ticker.toUpperCase();

    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Buscar flags ativos
    const flags = await prisma.companyFlag.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      include: {
        report: {
          select: {
            id: true,
            type: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      flags: flags.map(flag => ({
        id: flag.id,
        flagType: flag.flagType,
        reason: flag.reason,
        createdAt: flag.createdAt,
        report: {
          id: flag.report.id,
          type: flag.report.type,
          createdAt: flag.report.createdAt,
        },
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar flags da empresa:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

