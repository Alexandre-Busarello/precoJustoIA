/**
 * API: Admin Indices Management (Individual)
 * GET /api/admin/indices/[id] - Busca um índice específico
 * PUT /api/admin/indices/[id] - Atualiza um índice
 * DELETE /api/admin/indices/[id] - Deleta um índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const index = await prisma.indexDefinition.findUnique({
      where: { id }
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      index: {
        id: index.id,
        ticker: index.ticker,
        name: index.name,
        description: index.description,
        color: index.color,
        methodology: index.methodology,
        config: index.config,
        createdAt: index.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error getting index:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar índice'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { ticker, name, description, color, methodology, config } = body;

    if (!ticker || !name || !config) {
      return NextResponse.json(
        { error: 'Ticker, nome e config são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o índice existe
    const existing = await prisma.indexDefinition.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o novo ticker já existe em outro índice
    if (ticker.toUpperCase() !== existing.ticker) {
      const tickerExists = await prisma.indexDefinition.findUnique({
        where: { ticker: ticker.toUpperCase() }
      });

      if (tickerExists) {
        return NextResponse.json(
          { error: 'Já existe um índice com este ticker' },
          { status: 400 }
        );
      }
    }

    // Atualizar índice
    const updated = await prisma.indexDefinition.update({
      where: { id },
      data: {
        ticker: ticker.toUpperCase(),
        name,
        description: description || '',
        color: color || existing.color,
        methodology: methodology || '',
        config: config as any
      }
    });

    return NextResponse.json({
      success: true,
      index: {
        id: updated.id,
        ticker: updated.ticker,
        name: updated.name
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error updating index:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar índice'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar se o índice existe
    const existing = await prisma.indexDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            composition: true,
            history: true,
            rebalanceLogs: true
          }
        }
      }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    // Deletar em cascata (composição, histórico e logs)
    await prisma.indexComposition.deleteMany({
      where: { indexId: id }
    });

    await prisma.indexHistoryPoints.deleteMany({
      where: { indexId: id }
    });

    await prisma.indexRebalanceLog.deleteMany({
      where: { indexId: id }
    });

    // Deletar checkpoints relacionados (se houver)
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        lastProcessedIndexId: id
      }
    });

    // Deletar definição
    await prisma.indexDefinition.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: `Índice ${existing.ticker} deletado com sucesso`
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error deleting index:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao deletar índice'
      },
      { status: 500 }
    );
  }
}

