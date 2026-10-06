/**
 * API: Gerenciar Gatilho Customizado Individual
 * 
 * DELETE: Remover/desativar gatilho
 * PATCH: Atualizar gatilho
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import {
  checkMonitorLimit,
  monitorLimitMessage,
  parseTriggerConfig,
  triggerConfigToJson,
} from '@/lib/custom-trigger-service';
import { clearQueryCache } from '@/lib/prisma-wrapper';

const updateMonitorSchema = z.object({
  triggerConfig: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

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

    // Deletar o monitoramento
    await prisma.userAssetMonitor.delete({
      where: { id: monitorId },
    });

    // Invalidar cache após exclusão
    await clearQueryCache(['user_asset_monitor']);
    
    // Invalidar cache do Next.js para forçar recarregamento da página
    revalidatePath('/dashboard/monitoramentos-customizados');

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
    const body = updateMonitorSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }
    const { isActive } = body.data;

    // Verificar se o gatilho pertence ao usuário
    const monitor = await prisma.userAssetMonitor.findUnique({
      where: { id: monitorId },
      select: { userId: true, isActive: true },
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
    const updateData: Prisma.UserAssetMonitorUpdateInput = {};
    if (body.data.triggerConfig !== undefined) {
      const parsedConfig = parseTriggerConfig(body.data.triggerConfig);
      if (!parsedConfig.success) {
        return NextResponse.json({ error: parsedConfig.error }, { status: 400 });
      }
      updateData.triggerConfig = triggerConfigToJson(parsedConfig.config);
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Reativar um monitoramento pausado conta no limite do plano gratuito
    if (isActive === true && !monitor.isActive) {
      const activeMonitorsCount = await prisma.userAssetMonitor.count({
        where: { userId: user.id, isActive: true },
      });
      const limit = checkMonitorLimit(user.isPremium, activeMonitorsCount);
      if (!limit.allowed && limit.max !== null) {
        return NextResponse.json(
          {
            success: false,
            error: 'LIMIT_REACHED',
            message: monitorLimitMessage(limit.max),
            limits: { current: limit.current, max: limit.max, isPremium: false },
          },
          { status: 403 }
        );
      }
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

    // Invalidar cache após atualização
    await clearQueryCache(['user_asset_monitor']);
    
    // Invalidar cache do Next.js para forçar recarregamento da página
    revalidatePath('/dashboard/monitoramentos-customizados');

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

