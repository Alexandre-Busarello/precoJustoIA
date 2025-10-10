import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper';

/**
 * GET /api/asset-subscriptions/by-ticker/[ticker]
 * Verifica se o usuário está inscrito em um ticker específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        isSubscribed: false,
        requiresAuth: true,
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        isSubscribed: false,
        error: 'Usuário não encontrado',
      });
    }

    const resolvedParams = await params;
    const ticker = resolvedParams.ticker.toUpperCase();

    // Buscar empresa pelo ticker
    const company = await safeQueryWithParams(
      'company-by-ticker',
      () => prisma.company.findUnique({
        where: { ticker },
        select: { id: true },
      }),
      { ticker }
    );

    if (!company) {
      return NextResponse.json({
        isSubscribed: false,
        error: 'Empresa não encontrada',
      });
    }

    // Verificar se existe inscrição
    const subscription = await safeQueryWithParams(
      'asset-subscription-check',
      () => prisma.userAssetSubscription.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId: (company as any).id,
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      }),
      { userId: user.id, companyId: (company as any).id }
    );

    return NextResponse.json({
      isSubscribed: !!subscription,
      subscription: subscription || null,
    });
  } catch (error) {
    console.error('Erro ao verificar inscrição:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar inscrição' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/asset-subscriptions/by-ticker/[ticker]
 * Inscreve o usuário em um ticker específico
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
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

    const resolvedParams = await params;
    const ticker = resolvedParams.ticker.toUpperCase();

    // Buscar empresa pelo ticker
    const company = await safeQueryWithParams(
      'company-by-ticker',
      () => prisma.company.findUnique({
        where: { ticker },
        select: {
          id: true,
          ticker: true,
          name: true,
        },
      }),
      { ticker }
    );

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Criar inscrição
    const subscription = await safeWrite(
      'create-asset-subscription-by-ticker',
      () => prisma.userAssetSubscription.create({
        data: {
          userId: user.id,
          companyId: (company as any).id,
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
      message: `Você agora receberá notificações sobre ${ticker}`,
      subscription,
    });
  } catch (error: any) {
    console.error('Erro ao criar inscrição:', error);

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

/**
 * DELETE /api/asset-subscriptions/by-ticker/[ticker]
 * Cancela inscrição em um ticker específico
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
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

    const resolvedParams = await params;
    const ticker = resolvedParams.ticker.toUpperCase();

    // Buscar empresa pelo ticker
    const company = await safeQueryWithParams(
      'company-by-ticker',
      () => prisma.company.findUnique({
        where: { ticker },
        select: { id: true, ticker: true },
      }),
      { ticker }
    );

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Deletar inscrição
    await safeWrite(
      'delete-asset-subscription-by-ticker',
      () => prisma.userAssetSubscription.deleteMany({
        where: {
          userId: user.id,
          companyId: (company as any).id,
        },
      }),
      ['user_asset_subscriptions']
    );

    return NextResponse.json({
      success: true,
      message: `Inscrição em ${ticker} cancelada com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao cancelar inscrição:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar inscrição' },
      { status: 500 }
    );
  }
}

