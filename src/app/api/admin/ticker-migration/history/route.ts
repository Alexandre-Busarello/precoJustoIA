/**
 * API: Get Migration History
 * GET /api/admin/ticker-migration/history
 * 
 * Retorna histórico de migrações já realizadas
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { TickerMigrationService } from '@/lib/ticker-migration-service';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação e admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const migrations = await TickerMigrationService.getCompletedMigrations();

    return NextResponse.json({
      migrations,
      total: migrations.length,
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de migrações:', error);
    return NextResponse.json(
      {
        error: 'Erro ao buscar histórico de migrações',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}








