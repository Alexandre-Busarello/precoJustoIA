import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper';

/**
 * GET /api/asset-subscriptions
 * Lista todas as inscrições do usuário autenticado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const subscriptions = await safeQueryWithParams(
      'user-asset-subscriptions',
      () => prisma.userAssetSubscription.findMany({
        where: { userId: user.id },
        include: {
          company: {
            select: {
              id: true,
              ticker: true,
              name: true,
              sector: true,
              logoUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      { userId: user.id }
    );

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error('Erro ao buscar inscrições:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar inscrições' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/asset-subscriptions
 * Cria uma nova inscrição em um ativo
 * Body: { companyId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId || typeof companyId !== 'number') {
      return NextResponse.json(
        { error: 'companyId inválido' },
        { status: 400 }
      );
    }

    // Verificar se a empresa existe
    const company = await safeQueryWithParams(
      'company-by-id',
      () => prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          ticker: true,
          name: true,
        },
      }),
      { companyId }
    );

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Criar inscrição (unique constraint garante que não haverá duplicatas)
    const subscription = await safeWrite(
      'create-asset-subscription',
      () => prisma.userAssetSubscription.create({
        data: {
          userId: user.id,
          companyId,
        },
        include: {
          company: {
            select: {
              id: true,
              ticker: true,
              name: true,
              sector: true,
              logoUrl: true,
            },
          },
        },
      }),
      ['user_asset_subscriptions']
    );

    return NextResponse.json({
      success: true,
      message: `Você agora receberá notificações sobre ${company.ticker}`,
      subscription,
    });
  } catch (error: any) {
    console.error('Erro ao criar inscrição:', error);

    // Tratar erro de unique constraint
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Você já está inscrito neste ativo' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar inscrição' },
      { status: 500 }
    );
  }
}

