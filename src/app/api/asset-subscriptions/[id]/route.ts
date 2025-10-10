import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper';

/**
 * DELETE /api/asset-subscriptions/[id]
 * Cancela uma inscrição específica
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const subscriptionId = resolvedParams.id;

    // Verificar se a inscrição existe e pertence ao usuário
    const subscription = await safeQueryWithParams(
      'asset-subscription-by-id',
      () => prisma.userAssetSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
          company: {
            select: {
              ticker: true,
              name: true,
            },
          },
        },
      }),
      { subscriptionId }
    );

    if (!subscription) {
      return NextResponse.json(
        { error: 'Inscrição não encontrada' },
        { status: 404 }
      );
    }

    if ((subscription as any).userId !== user.id) {
      return NextResponse.json(
        { error: 'Você não tem permissão para cancelar esta inscrição' },
        { status: 403 }
      );
    }

    // Deletar inscrição
    await safeWrite(
      'delete-asset-subscription',
      () => prisma.userAssetSubscription.delete({
        where: { id: subscriptionId },
      }),
      ['user_asset_subscriptions']
    );

    return NextResponse.json({
      success: true,
      message: `Inscrição em ${(subscription as any).company.ticker} cancelada com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao deletar inscrição:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar inscrição' },
      { status: 500 }
    );
  }
}

