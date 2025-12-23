import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ReportPreferences {
  MONTHLY_OVERVIEW?: boolean;
  FUNDAMENTAL_CHANGE?: boolean;
  PRICE_VARIATION?: boolean;
}

/**
 * PUT /api/user/report-preferences
 * Atualiza as preferências de relatórios do usuário
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const preferences: ReportPreferences = await request.json();

    // Validar estrutura
    const validKeys = ['MONTHLY_OVERVIEW', 'FUNDAMENTAL_CHANGE', 'PRICE_VARIATION'];
    const invalidKeys = Object.keys(preferences).filter(
      key => !validKeys.includes(key)
    );

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Chaves inválidas: ${invalidKeys.join(', ')}` },
        { status: 400 }
      );
    }

    // Atualizar preferências do usuário
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        reportPreferences: preferences as any,
      },
    });

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Erro ao atualizar preferências de relatórios:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/report-preferences
 * Busca as preferências de relatórios do usuário
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { reportPreferences: true },
    });

    return NextResponse.json({
      success: true,
      preferences: (user?.reportPreferences as ReportPreferences) || {
        MONTHLY_OVERVIEW: true,
        FUNDAMENTAL_CHANGE: true,
        PRICE_VARIATION: true,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar preferências de relatórios:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

