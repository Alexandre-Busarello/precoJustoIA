/**
 * API: Gerenciar Gatilho Customizado Individual
 * 
 * DELETE: Remover/desativar gatilho
 * PATCH: Atualizar gatilho
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { TriggerConfig } from '@/lib/custom-trigger-service';

/**
 * DELETE /api/user-asset-monitor/[id]
 * Remove ou desativa um gatilho customizado
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
    const monitorId = resolvedParams.id;

    // Verificar se o gatilho pertence ao usuário
    const monitor = await prisma.userAssetMonitor.findUnique({
      where: { id: monitorId },
      select: { userId: true },
    });

    if (!monitor) {
      return NextResponse.json(
        { error: 'Gatilho não encontrado' },
        { status: 404 }
      );
    }

    if (monitor.userId !== user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    // Desativar ao invés de deletar (manter histórico)
    await prisma.userAssetMonitor.update({
      where: { id: monitorId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Gatilho removido com sucesso',
    });
  } catch (error) {
    console.error('Erro ao remover gatilho:', error);
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
 * PATCH /api/user-asset-monitor/[id]
 * Atualiza um gatilho customizado
 */
export async function PATCH(
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
    const monitorId = resolvedParams.id;
    const body = await request.json();
    const { triggerConfig, isActive } = body;

    // Verificar se o gatilho pertence ao usuário
    const monitor = await prisma.userAssetMonitor.findUnique({
      where: { id: monitorId },
      select: { userId: true },
    });

    if (!monitor) {
      return NextResponse.json(
        { error: 'Gatilho não encontrado' },
        { status: 404 }
      );
    }

    if (monitor.userId !== user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    // Atualizar gatilho
    const updateData: any = {};
    if (triggerConfig !== undefined) {
      updateData.triggerConfig = triggerConfig as any;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updated = await prisma.userAssetMonitor.update({
      where: { id: monitorId },
      data: updateData,
      include: {
        company: {
          select: {
            ticker: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      monitor: {
        id: updated.id,
        companyId: updated.companyId,
        ticker: updated.company.ticker,
        companyName: updated.company.name,
        companyLogoUrl: updated.company.logoUrl,
        triggerConfig: updated.triggerConfig,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        lastTriggeredAt: updated.lastTriggeredAt,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar gatilho:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

