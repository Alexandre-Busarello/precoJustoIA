import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeWrite, safeQueryWithParams } from '@/lib/prisma-wrapper';
import { randomBytes } from 'crypto';
import { EmailQueueService } from '@/lib/email-queue-service';
import { EmailType } from '@prisma/client';

/**
 * API para criar múltiplos monitoramentos de ativos em massa
 * 
 * POST /api/monitor-assets/bulk
 * Body: { tickers: string[], email?: string }
 * 
 * - Se usuário estiver logado: usa userId da sessão
 * - Se usuário não estiver logado: requer email e cria subscriptions anônimas
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { tickers, email } = body;

    // Validação
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json(
        { error: 'Lista de tickers é obrigatória' },
        { status: 400 }
      );
    }

    // Se não estiver logado, email é obrigatório
    if (!session?.user?.id && !email) {
      return NextResponse.json(
        { error: 'Email é obrigatório para usuários não autenticados' },
        { status: 400 }
      );
    }

    // Validar formato de email se fornecido
    if (email && typeof email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Email inválido' },
          { status: 400 }
        );
      }
    }

    const userId = session?.user?.id || null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    const results = {
      success: 0,
      failed: 0,
      invalid: [] as string[],
    };

    // Armazenar empresas criadas com sucesso para email de confirmação
    const successfulCompanies: Array<{
      ticker: string;
      companyName: string;
      unsubscribeUrl: string;
    }> = [];

    // Processar cada ticker
    for (const ticker of tickers) {
      try {
        // Buscar empresa pelo ticker
        const company = await safeQueryWithParams(
          'company-by-ticker',
          () => prisma.company.findUnique({
            where: { ticker: ticker.toUpperCase() },
            select: { id: true, ticker: true, name: true },
          }),
          { ticker: ticker.toUpperCase() }
        );

        if (!company) {
          results.invalid.push(ticker);
          continue;
        }

        // Verificar se já existe subscription
        if (userId) {
          // Subscription de usuário logado
          const existing = await safeQueryWithParams(
            'check-user-subscription',
            () => prisma.userAssetSubscription.findFirst({
              where: {
                userId,
                companyId: company.id,
              },
            }),
            { userId, companyId: company.id }
          );

          if (existing) {
            // Já existe, considerar sucesso (idempotência)
            results.success++;
            continue;
          }

          // Criar subscription para usuário logado
          await safeWrite(
            'create-user-asset-subscription',
            () => prisma.userAssetSubscription.create({
              data: {
                userId,
                companyId: company.id,
                email: null,
                unsubscribeToken: null,
              },
            }),
            ['user_asset_subscriptions']
          );
        } else {
          // Subscription anônima (com email)
          if (!normalizedEmail) {
            results.failed++;
            continue;
          }

          const existing = await safeQueryWithParams(
            'check-anonymous-subscription',
            () => prisma.userAssetSubscription.findFirst({
              where: {
                email: normalizedEmail,
                companyId: company.id,
                userId: null,
              },
            }),
            { email: normalizedEmail, companyId: company.id }
          );

          if (existing) {
            // Já existe, considerar sucesso (idempotência)
            results.success++;
            continue;
          }

          // Gerar token único para descadastro
          let unsubscribeToken: string = '';
          let tokenExists = true;
          
          while (tokenExists) {
            unsubscribeToken = randomBytes(32).toString('hex');
            const existingToken = await safeQueryWithParams(
              'check-unsubscribe-token',
              () => prisma.userAssetSubscription.findFirst({
                where: { unsubscribeToken },
              }),
              { unsubscribeToken }
            );
            tokenExists = !!existingToken;
          }

          // Criar subscription anônima
          const subscription = await safeWrite(
            'create-anonymous-asset-subscription',
            () => prisma.userAssetSubscription.create({
              data: {
                userId: null,
                email: normalizedEmail,
                companyId: company.id,
                unsubscribeToken,
              },
            }),
            ['user_asset_subscriptions']
          );

          // Armazenar informações para email de confirmação
          if (subscription && normalizedEmail && unsubscribeToken) {
            const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://precojusto.ai'}/unsubscribe?token=${unsubscribeToken}`;
            successfulCompanies.push({
              ticker: company.ticker,
              companyName: company.name || company.ticker,
              unsubscribeUrl,
            });
          }
        }

        results.success++;
      } catch (error) {
        console.error(`Erro ao processar ticker ${ticker}:`, error);
        results.failed++;
      }
    }

    // Enviar email de confirmação se usuário não estiver logado e houver empresas criadas
    if (!userId && normalizedEmail && successfulCompanies.length > 0) {
      try {
        await EmailQueueService.queueEmail({
          email: normalizedEmail,
          emailType: EmailType.SUBSCRIPTION_CONFIRMATION,
          emailData: {
            companies: successfulCompanies,
            email: normalizedEmail,
          },
          priority: 0,
        });
      } catch (error) {
        console.error('Erro ao enviar email de confirmação:', error);
        // Não falhar a requisição se o email falhar
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Erro ao criar monitoramentos em massa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

