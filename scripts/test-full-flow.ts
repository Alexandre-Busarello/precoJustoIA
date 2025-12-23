/**
 * Teste Ponta a Ponta Completo: Fluxo End-to-End
 * 
 * Testa o fluxo completo desde detecção até geração de relatório
 * 
 * Uso:
 *   npx tsx scripts/test-full-flow.ts PETR4
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { checkPriceVariations } from '../src/lib/price-variation-service';
import { addToQueue, getNextStep, saveCheckpoint, getCheckpoint, completeQueue } from '../src/lib/ai-report-queue-service';
import {
  researchPriceDropReason,
  analyzeFundamentalImpact,
  generatePriceVariationReport,
  createFlagIfNeeded,
} from '../src/lib/price-variation-report-service';
// Importar serviços diretamente do Prisma para evitar server-only
// AssetMonitoringService usa prisma-wrapper que importa cache-service (server-only)
// Então vamos buscar subscribers diretamente do Prisma
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const ticker = process.argv[2]?.toUpperCase();

  if (!ticker) {
    console.error('❌ Erro: Forneça um ticker');
    console.log('Uso: npx tsx scripts/test-full-flow.ts PETR4');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Erro: GEMINI_API_KEY não configurada');
    process.exit(1);
  }

  console.log('🧪 TESTE COMPLETO: Fluxo End-to-End\n');
  console.log(`📊 Testando ticker: ${ticker}\n`);

  // Configurar thresholds para teste
  process.env.PRICE_DROP_1D = '1';
  process.env.PRICE_DROP_30D = '1';
  process.env.PRICE_DROP_1Y = '10';

  try {
    // ETAPA 1: Buscar empresa
    console.log('='.repeat(60));
    console.log('ETAPA 1: Buscar Empresa');
    console.log('='.repeat(60));
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        id: true,
        ticker: true,
        name: true,
      },
    });

    if (!company) {
      console.error(`❌ Empresa ${ticker} não encontrada`);
      process.exit(1);
    }
    console.log(`✅ Empresa: ${company.name} (ID: ${company.id})\n`);

    // ETAPA 2: Detectar variação de preço
    console.log('='.repeat(60));
    console.log('ETAPA 2: Detectar Variação de Preço');
    console.log('='.repeat(60));
    const variationCheck = await checkPriceVariations(company.id, company.ticker);

    if (!variationCheck.triggered || !variationCheck.triggerReason) {
      console.log('⚠️  Nenhuma QUEDA significativa detectada');
      console.log('   Variações encontradas:');
      variationCheck.variations.forEach(v => {
        const isDrop = v.variation < 0;
        const threshold = v.days === 1 
          ? parseFloat(process.env.PRICE_DROP_1D || '5')
          : v.days === 30
          ? parseFloat(process.env.PRICE_DROP_30D || '20')
          : parseFloat(process.env.PRICE_DROP_1Y || '50');
        const status = isDrop 
          ? (Math.abs(v.variation) >= threshold ? '✅ (dispararia)' : `⚠️ (threshold: ${threshold}%)`)
          : '📈 (subida, não dispara)';
        console.log(`   - ${v.days} dias: ${v.variation.toFixed(2)}% ${status}`);
      });
      console.log('\n💡 Dica: O sistema só dispara para QUEDAS (valores negativos) que ultrapassem o threshold');
      console.log('   Exemplo: Se threshold=1%, precisa cair pelo menos -1% para disparar');
      return;
    }

    console.log('🚨 Variação detectada!');
    console.log(`   - Janela: ${variationCheck.triggerReason.days} dias`);
    console.log(`   - Variação: ${variationCheck.triggerReason.variation.toFixed(2)}%\n`);

    // ETAPA 3: Criar entrada na fila
    console.log('='.repeat(60));
    console.log('ETAPA 3: Criar Entrada na Fila');
    console.log('='.repeat(60));
    const queueId = await addToQueue({
      companyId: company.id,
      reportType: 'PRICE_VARIATION' as any,
      triggerReason: {
        variation: variationCheck.triggerReason.variation,
        days: variationCheck.triggerReason.days,
        threshold: variationCheck.triggerReason.threshold,
        currentPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.currentPrice,
        previousPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.previousPrice,
      },
      priority: 2,
    });
    console.log(`✅ Entrada criada: ${queueId}\n`);

    // ETAPA 4: Processar RESEARCH
    console.log('='.repeat(60));
    console.log('ETAPA 4: RESEARCH (Pesquisa na Internet)');
    console.log('='.repeat(60));
    const nextStep1 = await getNextStep(queueId);
    if (nextStep1 === 'RESEARCH') {
      console.log('🔍 Pesquisando motivo da queda...');
      const research = await researchPriceDropReason(
        company.ticker,
        company.name,
        {
          days: variationCheck.triggerReason.days,
          variation: variationCheck.triggerReason.variation,
          currentPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.currentPrice || 0,
          previousPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.previousPrice || 0,
        }
      );
      await saveCheckpoint(queueId, 'RESEARCH', { research });
      console.log(`✅ Pesquisa concluída (${research.length} caracteres)\n`);
    }

    // ETAPA 5: Processar ANALYSIS
    console.log('='.repeat(60));
    console.log('ETAPA 5: ANALYSIS (Análise de Impacto)');
    console.log('='.repeat(60));
    const nextStep2 = await getNextStep(queueId);
    if (nextStep2 === 'ANALYSIS') {
      const researchCheckpoint = await getCheckpoint(queueId, 'RESEARCH');
      if (researchCheckpoint) {
        console.log('🤖 Analisando impacto fundamental...');
        const analysis = await analyzeFundamentalImpact(
          company.ticker,
          company.name,
          {
            days: variationCheck.triggerReason.days,
            variation: variationCheck.triggerReason.variation,
            currentPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.currentPrice || 0,
            previousPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.previousPrice || 0,
          },
          researchCheckpoint.data.research
        );
        await saveCheckpoint(queueId, 'ANALYSIS', { analysis });
        console.log(`✅ Análise concluída`);
        console.log(`   - É perda de fundamento: ${analysis.isFundamentalLoss ? 'SIM ⚠️' : 'NÃO ✅'}`);
        console.log(`   - Conclusão: ${analysis.conclusion}\n`);
      }
    }

    // ETAPA 6: Processar COMPILATION
    console.log('='.repeat(60));
    console.log('ETAPA 6: COMPILATION (Geração do Relatório)');
    console.log('='.repeat(60));
    const nextStep3 = await getNextStep(queueId);
    if (nextStep3 === 'COMPILATION') {
      const researchCheckpoint = await getCheckpoint(queueId, 'RESEARCH');
      const analysisCheckpoint = await getCheckpoint(queueId, 'ANALYSIS');

      if (researchCheckpoint && analysisCheckpoint) {
        console.log('📝 Gerando relatório final...');
        const report = await generatePriceVariationReport({
          ticker: company.ticker,
          companyName: company.name,
          variation: {
            days: variationCheck.triggerReason.days,
            variation: variationCheck.triggerReason.variation,
            currentPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.currentPrice || 0,
            previousPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.previousPrice || 0,
          },
          researchData: researchCheckpoint.data.research,
        });
        await saveCheckpoint(queueId, 'COMPILATION', {
          report,
          isFundamentalLoss: analysisCheckpoint.data.analysis.isFundamentalLoss,
          conclusion: analysisCheckpoint.data.analysis.conclusion,
        });
        console.log(`✅ Relatório gerado (${report.length} caracteres)\n`);
      }
    }

    // ETAPA 7: Criar relatório final e flag
    console.log('='.repeat(60));
    console.log('ETAPA 7: Finalizar Processamento');
    console.log('='.repeat(60));
    const compilationCheckpoint = await getCheckpoint(queueId, 'COMPILATION');
    
    let notificationsCreated = 0;
    let emailsQueued = 0;
    let subscribersCount = 0;
    
    if (compilationCheckpoint) {
      const report = await prisma.aIReport.create({
        data: {
          companyId: company.id,
          content: compilationCheckpoint.data.report,
          type: 'PRICE_VARIATION' as any,
          status: 'COMPLETED',
          isActive: true,
          metadata: {
            triggerReason: variationCheck.triggerReason,
            generatedAt: new Date().toISOString(),
          } as any,
        },
      });
      console.log(`✅ Relatório criado: ${report.id}`);

      // Criar flag se necessário
      if (compilationCheckpoint.data.isFundamentalLoss) {
        const flagId = await createFlagIfNeeded(
          company.id,
          report.id,
          compilationCheckpoint.data.conclusion || 'Perda de fundamento detectada'
        );
        if (flagId) {
          console.log(`✅ Flag criado: ${flagId}`);
        }
      }

      // ETAPA 8: Buscar subscribers e enviar emails/notificações
      console.log('='.repeat(60));
      console.log('ETAPA 8: Enviar Emails e Notificações');
      console.log('='.repeat(60));
      
      // Buscar subscribers diretamente do Prisma (evita server-only)
      const subscriptions = await prisma.userAssetSubscription.findMany({
        where: { companyId: company.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Processar subscriptions: logados e anônimos (mesma lógica do AssetMonitoringService)
      const subscribers: Array<{
        userId: string | null;
        email: string;
        name: string | null;
        isPremium: boolean;
      }> = [];

      for (const sub of subscriptions) {
        // Subscription anônima (sem userId, com email)
        if (!sub.userId && sub.email) {
          subscribers.push({
            userId: null,
            email: sub.email,
            name: null,
            isPremium: false, // Anônimos sempre são gratuitos
          });
          continue;
        }
        
        // Subscription de usuário logado
        if (sub.userId && sub.user) {
          // Verificar se é premium diretamente do Prisma
          const user = await prisma.user.findUnique({
            where: { id: sub.user.id },
            select: {
              subscriptionTier: true,
              premiumExpiresAt: true,
            },
          });
          
          const isPremium = user?.subscriptionTier === 'PREMIUM' && 
            (user.premiumExpiresAt === null || user.premiumExpiresAt > new Date());
          
          subscribers.push({
            userId: sub.user.id,
            email: sub.user.email,
            name: sub.user.name,
            isPremium,
          });
        }
      }

      subscribersCount = subscribers.length;
      
      if (subscribers.length === 0) {
        console.log('⚠️  Nenhum subscriber encontrado para esta empresa');
        console.log('💡 Dica: Crie uma subscription para testar o envio de emails');
        console.log('   Exemplo SQL: INSERT INTO user_asset_subscriptions (company_id, email) VALUES (14, \'teste@example.com\');\n');
      } else {
        // Declarar variáveis no escopo correto
        let localNotificationsCreated = 0;
        let localEmailsQueued = 0;
        console.log(`📧 Encontrados ${subscribers.length} subscriber(s)\n`);
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai';
        const reportUrl = `/acao/${company.ticker.toLowerCase()}/relatorios/${report.id}`;
        const reportSummary = compilationCheckpoint.data.report
          .replace(/[#*`]/g, '')
          .substring(0, 500)
          .trim() + '...';

        // Buscar dados completos da empresa
        const companyFull = await prisma.company.findUnique({
          where: { id: company.id },
          select: {
            id: true,
            ticker: true,
            name: true,
            logoUrl: true,
          },
        });

        if (!companyFull) {
          throw new Error('Empresa não encontrada');
        }

        // Separar usuários logados e anônimos
        const loggedInSubscribers = subscribers.filter((sub): sub is typeof sub & { userId: string } => sub.userId !== null);
        const anonymousSubscribers = subscribers.filter(sub => sub.userId === null);

        // Criar notificações e emails para usuários logados
        // NOTA: NotificationService e EmailQueueService podem ter imports server-only
        // Vamos criar diretamente no banco para o teste
        for (const subscriber of loggedInSubscribers) {
          try {
            console.log(`📬 Processando subscriber logado: ${subscriber.email} (Premium: ${subscriber.isPremium ? 'SIM' : 'NÃO'})`);
            
            // Criar notificação diretamente no banco (evita server-only)
            await prisma.notification.create({
              data: {
                userId: subscriber.userId!,
                title: `Variação de Preço: ${companyFull.ticker}`,
                message: reportSummary,
                link: reportUrl,
                linkType: 'INTERNAL',
                type: 'ASSET_CHANGE',
                metadata: {
                  ticker: companyFull.ticker,
                  companyName: companyFull.name,
                  reportId: report.id,
                  reportType: 'PRICE_VARIATION',
                } as any,
                isRead: false,
              },
            });
            localNotificationsCreated++;

            // Adicionar email diretamente à fila (evita server-only)
            await prisma.emailQueue.create({
              data: {
                email: subscriber.email,
                emailType: 'PRICE_VARIATION_REPORT' as any,
                emailData: {
                  ticker: companyFull.ticker,
                  companyName: companyFull.name,
                  companyLogoUrl: companyFull.logoUrl || null,
                  reportUrl: `${baseUrl}${reportUrl}`,
                  reportSummary,
                  isPremium: subscriber.isPremium,
                } as any,
                recipientName: subscriber.name || 'Investidor',
                status: 'PENDING',
              },
            });
            localEmailsQueued++;
            console.log(`   ✅ Notificação criada e email adicionado à fila\n`);
          } catch (error) {
            console.error(`   ❌ Erro ao processar ${subscriber.email}:`, error);
            if (error instanceof Error) {
              console.error(`      Mensagem: ${error.message}`);
            }
          }
        }

        // Adicionar emails à fila para subscriptions anônimas
        for (const subscriber of anonymousSubscribers) {
          try {
            console.log(`📬 Processando subscriber anônimo: ${subscriber.email}`);
            
            await prisma.emailQueue.create({
              data: {
                email: subscriber.email,
                emailType: 'PRICE_VARIATION_REPORT' as any,
                emailData: {
                  ticker: companyFull.ticker,
                  companyName: companyFull.name,
                  companyLogoUrl: companyFull.logoUrl || null,
                  reportUrl: `${baseUrl}${reportUrl}`,
                  reportSummary,
                  isPremium: false, // Anônimos sempre são não-premium
                } as any,
                recipientName: subscriber.name || 'Investidor',
                status: 'PENDING',
              },
            });
            localEmailsQueued++;
            console.log(`   ✅ Email adicionado à fila\n`);
          } catch (error) {
            console.error(`   ❌ Erro ao processar ${subscriber.email}:`, error);
            if (error instanceof Error) {
              console.error(`      Mensagem: ${error.message}`);
            }
          }
        }

        // Atualizar contadores globais
        notificationsCreated = localNotificationsCreated;
        emailsQueued = localEmailsQueued;
        
        console.log(`📊 Resumo de envios:`);
        console.log(`   - Notificações criadas: ${notificationsCreated}`);
        console.log(`   - Emails adicionados à fila: ${emailsQueued}\n`);

        // Verificar emails na fila
        const emailsInQueue = await prisma.emailQueue.findMany({
          where: {
            emailType: 'PRICE_VARIATION_REPORT' as any,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        if (emailsInQueue.length > 0) {
          console.log(`📧 Últimos ${emailsInQueue.length} email(s) na fila:`);
          emailsInQueue.forEach((email, index) => {
            console.log(`   ${index + 1}. ${email.email} - ${email.status} - ${email.createdAt.toLocaleString('pt-BR')}`);
          });
          console.log();
        }
      }

      // Finalizar fila
      await completeQueue(queueId, report.id);
      console.log(`✅ Fila finalizada\n`);

      // Mostrar resumo
      console.log('='.repeat(60));
      console.log('📊 RESUMO DO PROCESSAMENTO');
      console.log('='.repeat(60));
      console.log(`   - Empresa: ${company.ticker} - ${company.name}`);
      console.log(`   - Variação: ${variationCheck.triggerReason.variation.toFixed(2)}% em ${variationCheck.triggerReason.days} dias`);
      console.log(`   - Relatório ID: ${report.id}`);
      console.log(`   - Flag criado: ${compilationCheckpoint.data.isFundamentalLoss ? 'SIM' : 'NÃO'}`);
      console.log(`   - Tamanho do relatório: ${compilationCheckpoint.data.report.length} caracteres`);
      console.log(`   - Subscribers encontrados: ${subscribersCount}`);
      console.log(`   - Notificações criadas: ${notificationsCreated}`);
      console.log(`   - Emails na fila: ${emailsQueued}`);
    }

  } catch (error) {
    console.error('\n❌ Erro:', error);
    if (error instanceof Error) {
      console.error(`   Mensagem: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 10).join('\n')}`);
      }
    }
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Teste completo concluído!');
  console.log('='.repeat(60));
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

