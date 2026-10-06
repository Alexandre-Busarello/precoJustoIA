/**
 * API: Gerenciar Gatilhos Customizados
 * 
 * GET: Listar gatilhos do usuário
 * POST: Criar novo gatilho
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import {
  checkMonitorLimit,
  mergeTriggerConfigs,
  monitorLimitMessage,
  parseTriggerConfig,
  triggerConfigToJson,
} from '@/lib/custom-trigger-service';
import { clearQueryCache } from '@/lib/prisma-wrapper';

const createMonitorSchema = z.object({
  companyId: z.number().int().positive(),
  triggerConfig: z.unknown(),
});

/**
 * GET /api/user-asset-monitor
 * Lista todos os gatilhos customizados do usuário
 */
export async function GET() {
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

    const monitors = await prisma.userAssetMonitor.findMany({
      where: {
        userId: user.id,
      },
      include: {
        company: {
          select: {
            id: true,
            ticker: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Verificar status Premium e calcular limites
    const isPremium = user.isPremium;
    const { current, max } = checkMonitorLimit(isPremium, monitors.filter(m => m.isActive).length);

    return NextResponse.json({
      success: true,
      monitors: monitors.map(m => ({
        id: m.id,
        companyId: m.companyId,
        ticker: m.company.ticker,
        companyName: m.company.name,
        companyLogoUrl: m.company.logoUrl,
        triggerConfig: m.triggerConfig,
        isActive: m.isActive,
        createdAt: m.createdAt,
        lastTriggeredAt: m.lastTriggeredAt,
      })),
      limits: {
        current,
        max, // null = ilimitado
        isPremium,
      },
    });
  } catch (error) {
    console.error('Erro ao listar gatilhos customizados:', error);
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
 * POST /api/user-asset-monitor
 * Cria novo gatilho customizado
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

    const body = createMonitorSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { error: 'companyId e triggerConfig são obrigatórios' },
        { status: 400 }
      );
    }
    const { companyId } = body.data;
    const parsedConfig = parseTriggerConfig(body.data.triggerConfig);
    if (!parsedConfig.success) {
      return NextResponse.json({ error: parsedConfig.error }, { status: 400 });
    }
    const triggerConfig = parsedConfig.config;

    // Validar que a empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se já existe gatilho ativo para esta empresa (atualizar não conta no limite)
    const existingMonitor = await prisma.userAssetMonitor.findFirst({
      where: {
        userId: user.id,
        companyId,
        isActive: true,
      },
    });

    // Limite do plano gratuito: só ao criar um novo monitoramento ativo
    if (!existingMonitor) {
      const activeMonitorsCount = await prisma.userAssetMonitor.count({
        where: {
          userId: user.id,
          isActive: true,
        },
      });
      const limit = checkMonitorLimit(user.isPremium, activeMonitorsCount);

      if (!limit.allowed && limit.max !== null) {
        return NextResponse.json(
          {
            success: false,
            error: 'LIMIT_REACHED',
            message: monitorLimitMessage(limit.max),
            limits: {
              current: limit.current,
              max: limit.max,
              isPremium: false,
            },
          },
          { status: 403 }
        );
      }
    }

    if (existingMonitor) {
      // Já existe monitoramento ativo para o ativo: soma os novos critérios aos atuais (nunca apaga critérios).
      // Remover critérios é feito pela edição (PATCH /api/user-asset-monitor/[id]).
      const mergedConfig = mergeTriggerConfigs(existingMonitor.triggerConfig, triggerConfig);
      const updated = await prisma.userAssetMonitor.update({
        where: { id: existingMonitor.id },
        data: {
          triggerConfig: triggerConfigToJson(mergedConfig),
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
          triggerConfig: updated.triggerConfig,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
        },
        merged: true,
        message: 'Os critérios foram adicionados ao monitoramento que você já tinha para este ativo',
      });
    }

    // Criar novo gatilho
    const monitor = await prisma.userAssetMonitor.create({
      data: {
        userId: user.id,
        companyId,
        triggerConfig: triggerConfigToJson(triggerConfig),
        isActive: true,
      },
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

    // Invalidar cache após criação
    await clearQueryCache(['user_asset_monitor']);
    
    // Invalidar cache do Next.js para forçar recarregamento da página
    revalidatePath('/dashboard/monitoramentos-customizados');

    return NextResponse.json({
      success: true,
      monitor: {
        id: monitor.id,
        companyId: monitor.companyId,
        ticker: monitor.company.ticker,
        companyName: monitor.company.name,
        companyLogoUrl: monitor.company.logoUrl,
        triggerConfig: monitor.triggerConfig,
        isActive: monitor.isActive,
        createdAt: monitor.createdAt,
      },
    });
  } catch (error) {
    console.error('Erro ao criar gatilho customizado:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

