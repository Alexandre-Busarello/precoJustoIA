/**
 * Cron Job Endpoint: Expire Premium Subscriptions
 * 
 * Identifica usuários Premium com assinatura expirada e:
 * - Atualiza subscriptionTier para FREE
 * - Envia email transacional informando sobre a expiração
 * 
 * Designed to run periodically via cron job
 * 
 * GET /api/cron/expire-premium-subscriptions
 * 
 * Headers required:
 * - Authorization: Bearer <CRON_SECRET> ou x-cron-secret: <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EmailQueueService } from '@/lib/email-queue-service';

/**
 * GET /api/cron/expire-premium-subscriptions
 * 
 * Busca usuários Premium com assinatura expirada, atualiza para FREE e envia emails
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
    console.log(`🕐 [CRON JOB] Iniciando expiração de assinaturas Premium`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    const now = new Date();

    // 2. Buscar usuários Premium com assinatura expirada
    const expiredUsers = await prisma.user.findMany({
      where: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: {
          lt: now, // Data de expiração já passou
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        premiumExpiresAt: true,
      },
    });

    console.log(`📊 Encontrados ${expiredUsers.length} usuários com assinatura expirada`);

    if (expiredUsers.length === 0) {
      return NextResponse.json({
        success: true,
        expiredUsersFound: 0,
        usersUpdated: 0,
        emailsQueued: 0,
        timestamp: new Date().toISOString(),
        message: 'Nenhum usuário com assinatura expirada encontrado'
      });
    }

    // 3. Atualizar subscriptionTier para FREE em batch
    const expiredUserIds = expiredUsers.map(user => user.id);
    
    const updateResult = await prisma.user.updateMany({
      where: {
        id: { in: expiredUserIds },
      },
      data: {
        subscriptionTier: 'FREE',
      },
    });

    console.log(`✅ ${updateResult.count} usuários atualizados para FREE`);

    // 4. Enfileirar emails para cada usuário
    let emailsQueued = 0;
    const emailErrors: string[] = [];

    for (const user of expiredUsers) {
      try {
        // Apenas enfileirar se o usuário tem email
        if (user.email) {
          await EmailQueueService.queueEmail({
            email: user.email,
            emailType: 'PREMIUM_EXPIRED',
            recipientName: user.name || null,
            emailData: {
              userName: user.name || undefined,
            },
            priority: 0,
            metadata: {
              userId: user.id,
              expiredAt: user.premiumExpiresAt?.toISOString(),
            },
          });
          emailsQueued++;
        }
      } catch (error) {
        const errorMsg = `Erro ao enfileirar email para ${user.email}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(`❌ ${errorMsg}`);
        emailErrors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [CRON JOB] Processamento concluído`);
    console.log(`   Usuários encontrados: ${expiredUsers.length}`);
    console.log(`   Usuários atualizados: ${updateResult.count}`);
    console.log(`   Emails enfileirados: ${emailsQueued}`);
    console.log(`   Erros: ${emailErrors.length}`);
    console.log(`   Duração: ${duration}ms`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      expiredUsersFound: expiredUsers.length,
      usersUpdated: updateResult.count,
      emailsQueued,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n❌ [CRON JOB] Erro durante expiração de assinaturas:', error);

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








