/**
 * API: Admin Indices Management
 * GET /api/admin/indices - Lista todos os índices
 * POST /api/admin/indices - Cria novo índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { runScreening, updateComposition } from '@/lib/index-screening-engine';
import { updateIndexPoints } from '@/lib/index-engine';
import { getTodayInBrazil } from '@/lib/market-status';

export async function GET() {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const indices = await prisma.indexDefinition.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { composition: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      indices: indices.map(index => ({
        id: index.id,
        ticker: index.ticker,
        name: index.name,
        description: index.description,
        color: index.color,
        methodology: index.methodology,
        config: index.config,
        createdAt: index.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error listing indices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao listar índices'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ticker, name, description, color, methodology, config } = body;

    if (!ticker || !name || !config) {
      return NextResponse.json(
        { error: 'Ticker, nome e config são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe índice com mesmo ticker
    const existing = await prisma.indexDefinition.findUnique({
      where: { ticker: ticker.toUpperCase() }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um índice com este ticker' },
        { status: 400 }
      );
    }

    // Criar índice
    const index = await prisma.indexDefinition.create({
      data: {
        ticker: ticker.toUpperCase(),
        name,
        description: description || '',
        color: color || '#10b981',
        methodology: methodology || '',
        config: config as any
      }
    });

    // Executar primeiro screening para definir composição inicial
    try {
      const selectedCompanies = await runScreening(index);
      
      if (selectedCompanies.length > 0) {
        // Criar mudanças iniciais (todas são ENTRY)
        const initialChanges = selectedCompanies.map(candidate => ({
          action: 'ENTRY' as const,
          ticker: candidate.ticker,
          reason: `Ativo selecionado no screening inicial com ${candidate.upside !== null ? `${candidate.upside.toFixed(1)}% de upside` : 'critérios atendidos'}`
        }));
        await updateComposition(index.id, selectedCompanies, initialChanges);
        
        // Criar primeiro ponto histórico (base 100)
        const today = getTodayInBrazil();
        
        await updateIndexPoints(index.id, today);
      }
    } catch (screeningError) {
      console.warn('⚠️ [ADMIN INDICES] Erro no screening inicial:', screeningError);
      // Não falhar a criação do índice se o screening falhar
    }

    return NextResponse.json({
      success: true,
      index: {
        id: index.id,
        ticker: index.ticker,
        name: index.name
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error creating index:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar índice'
      },
      { status: 500 }
    );
  }
}

