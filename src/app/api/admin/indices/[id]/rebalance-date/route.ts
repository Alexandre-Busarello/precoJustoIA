/**
 * API: Re-gerar rebalanceamento de uma data específica
 * POST /api/admin/indices/[id]/rebalance-date
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { regenerateRebalanceForDate } from '@/lib/index-rebalance-date';

export async function POST(
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
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Data não fornecida' },
        { status: 400 }
      );
    }

    // Validar formato da data e parsear corretamente (evitar problemas de timezone)
    // Se a data vem como string "YYYY-MM-DD", parsear diretamente para evitar timezone issues
    let targetDate: Date;
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parsear como data local (não UTC) para evitar problemas de timezone
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: 'Data inválida' },
          { status: 400 }
        );
      }
      // Normalizar data (sem hora)
      targetDate.setHours(0, 0, 0, 0);
    }

    // Verificar se a data não é futura
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (targetDate > today) {
      return NextResponse.json(
        { error: 'Não é possível re-gerar rebalanceamento para uma data futura' },
        { status: 400 }
      );
    }

    console.log(`🔄 [ADMIN REBALANCE DATE] Re-generating rebalance for index ${id} on ${targetDate.toISOString().split('T')[0]}`);

    // Executar re-geração
    // CRÍTICO: skipScreening=true para fazer apenas after market (sem screening/rebalanceamento)
    // Isso garante que apenas os pontos sejam recalculados com preços atualizados do Yahoo Finance
    const result = await regenerateRebalanceForDate(id, targetDate, true);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        recalculatedDays: result.recalculatedDays,
        errors: result.errors
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          errors: result.errors
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [ADMIN REBALANCE DATE] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMsg
      },
      { status: 500 }
    );
  }
}

