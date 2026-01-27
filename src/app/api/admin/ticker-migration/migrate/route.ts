/**
 * API: Execute Ticker Migration
 * POST /api/admin/ticker-migration/migrate
 * 
 * Executa migração de histórico financeiro de um ticker antigo para um novo
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { TickerMigrationService } from '@/lib/ticker-migration-service';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { oldTicker, newTicker } = body;

    if (!oldTicker || !newTicker) {
      return NextResponse.json(
        { error: 'oldTicker e newTicker são obrigatórios' },
        { status: 400 }
      );
    }

    // Executar migração
    const result = await TickerMigrationService.migrateTickerHistory(
      oldTicker,
      newTicker
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Erro ao executar migração de ticker:', error);
    return NextResponse.json(
      {
        error: 'Erro ao executar migração',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}


















