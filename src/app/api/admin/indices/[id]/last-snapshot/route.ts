/**
 * API: Get Last Snapshot Info
 * GET /api/admin/indices/[id]/last-snapshot
 * 
 * Retorna informações sobre o último snapshot disponível para um índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/user-service';
import { getLastSnapshot } from '@/lib/index-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação e admin
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id: indexId } = await params;

    // Buscar índice
    const index = await prisma.indexDefinition.findUnique({
      where: { id: indexId }
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    // Buscar último snapshot disponível
    const lastSnapshot = await getLastSnapshot(indexId);

    if (!lastSnapshot) {
      return NextResponse.json(
        { success: false, error: 'Nenhum snapshot disponível' },
        { status: 404 }
      );
    }

    const assetCount = Object.keys(lastSnapshot.snapshot).length;
    
    // Extrair data diretamente da string ISO (YYYY-MM-DD) sem conversão de timezone
    // O Prisma retorna datas @db.Date como UTC midnight, mas queremos apenas a parte da data
    const dateStr = lastSnapshot.date.toISOString().split('T')[0];

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        assetCount
      }
    });
  } catch (error) {
    console.error('❌ [LAST SNAPSHOT] Error getting last snapshot info:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar informações do snapshot'
      },
      { status: 500 }
    );
  }
}

