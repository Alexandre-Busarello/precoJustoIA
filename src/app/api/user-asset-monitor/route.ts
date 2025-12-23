/**
 * API: Gerenciar Gatilhos Customizados
 * 
 * GET: Listar gatilhos do usuário
 * POST: Criar novo gatilho
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { TriggerConfig } from '@/lib/custom-trigger-service';

/**
 * GET /api/user-asset-monitor
 * Lista todos os gatilhos customizados do usuário
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

    const body = await request.json();
    const { companyId, triggerConfig } = body;

    if (!companyId || !triggerConfig) {
      return NextResponse.json(
        { error: 'companyId e triggerConfig são obrigatórios' },
        { status: 400 }
      );
    }

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

    // Verificar se já existe gatilho ativo para esta empresa
    const existingMonitor = await prisma.userAssetMonitor.findFirst({
      where: {
        userId: user.id,
        companyId,
        isActive: true,
      },
    });

    if (existingMonitor) {
      // Atualizar existente ao invés de criar novo
      const updated = await prisma.userAssetMonitor.update({
        where: { id: existingMonitor.id },
        data: {
          triggerConfig: triggerConfig as TriggerConfig,
        },
      });

      return NextResponse.json({
        success: true,
        monitor: {
          id: updated.id,
          companyId: updated.companyId,
          triggerConfig: updated.triggerConfig,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
        },
        message: 'Gatilho atualizado com sucesso',
      });
    }

    // Criar novo gatilho
    const monitor = await prisma.userAssetMonitor.create({
      data: {
        userId: user.id,
        companyId,
        triggerConfig: triggerConfig as TriggerConfig,
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

