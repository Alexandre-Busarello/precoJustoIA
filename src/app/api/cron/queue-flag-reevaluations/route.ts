/**
 * Cron Job Endpoint: Enfileirar Flags para Reavaliação
 * 
 * Busca flags ativos criados há mais de 30 dias e adiciona à fila de reavaliação
 * 
 * GET /api/cron/queue-flag-reevaluations
 * 
 * Headers required:
 * - Authorization: Bearer <CRON_SECRET> ou x-cron-secret: <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addFlagToQueue } from '@/lib/company-flags-queue-service';

/**
 * GET /api/cron/queue-flag-reevaluations
 * 
 * Busca flags ativos criados há mais de 30 dias e adiciona à fila
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Verificar autenticação
    const isAuthorized = verifyCronAuth(request);
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🕐 [CRON JOB] Iniciando enfileiramento de flags para reavaliação`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 2. Buscar flags ativos criados há mais de 30 dias
    // Excluir flags que já estão na fila (PENDING ou PROCESSING)
    const flagsToReevaluate = await prisma.companyFlag.findMany({
      where: {
        isActive: true,
        createdAt: {
          lt: thirtyDaysAgo,
        },
        // Excluir flags que já estão na fila
        queueEntries: {
          none: {
            status: {
              in: ['PENDING', 'PROCESSING'],
            },
          },
        },
      },
      select: {
        id: true,
        companyId: true,
        flagType: true,
        reason: true,
        createdAt: true,
        company: {
          select: {
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📊 Encontrados ${flagsToReevaluate.length} flags elegíveis para reavaliação`);

    if (flagsToReevaluate.length === 0) {
      return NextResponse.json({
        success: true,
        flagsFound: 0,
        flagsQueued: 0,
        timestamp: new Date().toISOString(),
        message: 'Nenhum flag elegível para reavaliação encontrado'
      });
    }

    // 3. Adicionar flags à fila
    let flagsQueued = 0;
    const errors: string[] = [];

    for (const flag of flagsToReevaluate) {
      try {
        await addFlagToQueue({
          flagId: flag.id,
          priority: 0, // Prioridade padrão
        });
        flagsQueued++;
        console.log(`✅ Flag ${flag.id} (${flag.company.ticker}) adicionado à fila`);
      } catch (error) {
        const errorMsg = `Erro ao enfileirar flag ${flag.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [CRON JOB] Processamento concluído`);
    console.log(`   Flags encontrados: ${flagsToReevaluate.length}`);
    console.log(`   Flags enfileirados: ${flagsQueued}`);
    console.log(`   Erros: ${errors.length}`);
    console.log(`   Duração: ${duration}ms`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      flagsFound: flagsToReevaluate.length,
      flagsQueued,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n❌ [CRON JOB] Erro durante enfileiramento de flags:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Verifica autenticação do cron job
 * Suporta dois métodos:
 * 1. Header Authorization: Bearer <secret>
 * 2. Header x-cron-secret: <secret>
 */
function verifyCronAuth(request: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET;

  // Se não há secret configurado, aceitar em dev (CUIDADO!)
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [CRON AUTH] CRON_SECRET não configurado - permitindo em DEV');
      return true;
    }
    console.error('❌ [CRON AUTH] CRON_SECRET não configurado em produção');
    return false;
  }

  // Método 1: Authorization Bearer
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === CRON_SECRET) {
      return true;
    }
  }

  // Método 2: x-cron-secret header
  const cronSecretHeader = request.headers.get('x-cron-secret');
  if (cronSecretHeader === CRON_SECRET) {
    return true;
  }

  console.warn('⚠️ [CRON AUTH] Tentativa de acesso não autorizado');
  return false;
}

/**
 * POST - Mesmo comportamento do GET (para compatibilidade com alguns serviços de cron)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

