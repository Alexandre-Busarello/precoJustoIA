/**
 * API: Restore Index Composition from Snapshot
 * POST /api/admin/indices/[id]/restore-composition
 * 
 * Restaura a composição do índice usando o último snapshot disponível
 * e remove logs de rebalanceamento posteriores à data do snapshot
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/user-service';
import { getLastSnapshot } from '@/lib/index-engine';

export async function POST(
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
        { error: 'Nenhum snapshot disponível para restaurar' },
        { status: 404 }
      );
    }

    const { date: snapshotDate, snapshot } = lastSnapshot;

    // Extrair data diretamente da string ISO (YYYY-MM-DD) sem conversão de timezone
    // O Prisma retorna datas @db.Date como UTC midnight, mas queremos apenas a parte da data
    const dateStr = snapshotDate.toISOString().split('T')[0];
    
    // Criar data para comparação: usar o início do dia SEGUINTE ao snapshot
    // Isso garante que logs do próprio dia do snapshot sejam preservados
    // e apenas logs posteriores sejam deletados
    const [year, month, day] = dateStr.split('-').map(Number);
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

    // Deletar composição atual
    await prisma.indexComposition.deleteMany({
      where: { indexId }
    });

    // Restaurar composição do snapshot
    const restoredAssets: string[] = [];
    for (const [ticker, data] of Object.entries(snapshot)) {
      await prisma.indexComposition.create({
        data: {
          indexId,
          assetTicker: ticker,
          targetWeight: data.weight,
          entryPrice: data.entryPrice,
          entryDate: data.entryDate
        }
      });
      restoredAssets.push(ticker);
    }

    // Verificar quais logs serão deletados antes de deletar (para debug)
    const logsToDelete = await prisma.indexRebalanceLog.findMany({
      where: {
        indexId,
        date: {
          gte: nextDay
        }
      },
      select: {
        id: true,
        date: true,
        action: true,
        ticker: true,
        reason: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`🔍 [RESTORE COMPOSITION] Will delete ${logsToDelete.length} logs after ${dateStr}:`);
    if (logsToDelete.length > 0) {
      logsToDelete.slice(0, 10).forEach(log => {
        const logDateStr = log.date.toISOString().split('T')[0];
        console.log(`   - ${logDateStr}: ${log.action} ${log.ticker} - ${log.reason.substring(0, 50)}...`);
      });
      if (logsToDelete.length > 10) {
        console.log(`   ... and ${logsToDelete.length - 10} more logs`);
      }
    }

    // Remover logs de rebalanceamento posteriores à data do snapshot
    // Usar gte (greater than or equal) com o dia seguinte para garantir que:
    // - Logs do próprio dia do snapshot são preservados
    // - Logs do dia seguinte em diante são deletados
    const deletedLogs = await prisma.indexRebalanceLog.deleteMany({
      where: {
        indexId,
        date: {
          gte: nextDay
        }
      }
    });

    console.log(`✅ [RESTORE COMPOSITION] Index ${index.ticker}: Restored ${restoredAssets.length} assets from snapshot dated ${dateStr}, deleted ${deletedLogs.count} rebalance logs`);

    return NextResponse.json({
      success: true,
      message: `Composição restaurada com sucesso`,
      data: {
        indexId: index.id,
        indexTicker: index.ticker,
        snapshotDate: dateStr,
        assetsRestored: restoredAssets.length,
        assets: restoredAssets,
        logsDeleted: deletedLogs.count
      }
    });
  } catch (error) {
    console.error('❌ [RESTORE COMPOSITION] Error restoring composition:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao restaurar composição'
      },
      { status: 500 }
    );
  }
}

