/**
 * API: Corrigir ponto inicial do índice
 * POST /api/admin/indices/[id]/fix-starting-point
 * 
 * Cria um ponto virtual no dia anterior ao primeiro ponto histórico com 100 pontos
 * se o primeiro ponto não começar em 100
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { fixIndexStartingPoint } from '@/lib/index-engine';

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

    console.log(`🔧 [ADMIN FIX STARTING POINT] Fixing starting point for index ${id}`);

    const fixed = await fixIndexStartingPoint(id);

    if (fixed) {
      return NextResponse.json({
        success: true,
        message: 'Ponto inicial corrigido com sucesso. Criado ponto virtual no dia anterior com 100 pontos.'
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Índice já está correto ou não precisa de correção.'
      });
    }
  } catch (error) {
    console.error('❌ [ADMIN FIX STARTING POINT] Error:', error);
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

