import { NextRequest, NextResponse } from 'next/server';
import { AssetMonitoringService } from '@/lib/asset-monitoring-service';
import { MonitoringReportService } from '@/lib/monitoring-report-service';
import { EmailQueueService } from '@/lib/email-queue-service';
import { NotificationService } from '@/lib/notification-service';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { calculateScoreComposition, ScoreComposition } from '@/lib/score-composition-service';
import { toNumber, StrategyAnalysis } from '@/lib/strategies';
import { prisma } from '@/lib/prisma';

// Configurar timeout para 60 segundos (máximo do plano hobby da Vercel)
export const maxDuration = 60;

/**
 * Ajusta os scores das estratégias no snapshotData para refletir os scores ajustados
 * usados no cálculo final (conforme score_composition).
 * 
 * Isso garante consistência entre snapshot_data e score_composition.
 */
function adjustStrategiesScoresForSnapshot(
  strategies: Record<string, StrategyAnalysis | null>,
  scoreComposition: ScoreComposition | null
): Record<string, StrategyAnalysis | null> {
  if (!scoreComposition) {
    return strategies;
  }

  const adjustedStrategies = { ...strategies };

  // Mapear nomes das estratégias para os nomes no score_composition
  const strategyNameMap: Record<string, string> = {
    fcd: 'Fluxo de Caixa Descontado',
    graham: 'Graham (Valor Intrínseco)',
    gordon: 'Gordon (Dividendos)',
    barsi: 'Método Barsi',
    dividendYield: 'Dividend Yield',
    lowPE: 'Low P/E',
    magicFormula: 'Fórmula Mágica',
    fundamentalist: 'Fundamentalista 3+1',
  };

  // Ajustar cada estratégia que tem correspondência no score_composition
  Object.entries(strategyNameMap).forEach(([strategyKey, compositionName]) => {
    const strategy = adjustedStrategies[strategyKey];
    if (!strategy) return;

    const compositionComponent = scoreComposition.contributions.find(
      c => c.name === compositionName
    );

    if (compositionComponent && compositionComponent.score !== strategy.score) {
      // Atualizar o score para refletir o score ajustado usado no cálculo final
      adjustedStrategies[strategyKey] = {
        ...strategy,
        score: compositionComponent.score,
      };
    }
  });

  return adjustedStrategies;
}

/**
 * Cron Job para Monitoramento de Ativos
 * 
 * Executa periodicamente para verificar mudanças nos fundamentos
 * dos ativos monitorados pelos usuários.
 * 
 * IMPORTANTE: Usa calculateCompanyOverallScore para garantir que o score
 * seja calculado EXATAMENTE da mesma forma que na plataforma.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  console.log('🕐 Iniciando cron job de monitoramento de ativos...');

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizada ao cron job');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.MONITORING_BATCH_SIZE || '20');
    const PARALLEL_BATCH_SIZE = 5; // Processar 5 empresas em paralelo
    const SCORE_THRESHOLD = parseFloat(process.env.MONITORING_SCORE_THRESHOLD || '5');
    const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos em ms (deixar buffer de 10s)

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, PARALLEL_BATCH_SIZE=${PARALLEL_BATCH_SIZE}, SCORE_THRESHOLD=${SCORE_THRESHOLD}`);

    // 3. Buscar próximo lote de empresas para processar
    const companies = await AssetMonitoringService.getNextBatchToProcess(BATCH_SIZE);

    console.log(`📦 Processando lote de ${companies.length} empresas em paralelo (${PARALLEL_BATCH_SIZE} por vez)`);

    let processedCount = 0;
    let snapshotsCreated = 0;
    let changesDetected = 0;
    let reportsGenerated = 0;
    let emailsSent = 0;
    const errors: string[] = [];

    // Função para processar uma única empresa
    const processCompany = async (company: typeof companies[0]) => {
      const stats = {
        processed: false,
        snapshotCreated: false,
        changeDetected: false,
        reportGenerated: false,
        emailsSent: 0,
        error: null as string | null,
      };

      try {
        console.log(`\n🔍 Processando ${company.ticker} (ID: ${company.id})...`);

        // 5. Calcular score usando o serviço centralizado (MESMA LÓGICA DA PLATAFORMA)
        console.log(`📊 ${company.ticker}: Calculando score com serviço centralizado...`);
        
        const scoreResult = await calculateCompanyOverallScore(company.ticker, {
          isPremium: true, // Cron job sempre calcula como Premium
          isLoggedIn: true,
          includeStatements: true, // Incluir demonstrações financeiras
          includeStrategies: true, // Incluir estratégias para o snapshot
          companyId: String(company.id),
          industry: company.industry
        });

        if (!scoreResult || !scoreResult.overallScore || !scoreResult.strategies) {
          console.log(`⚠️ ${company.ticker}: Score não pode ser calculado, pulando...`);
          await AssetMonitoringService.updateLastChecked(company.id);
          stats.processed = true;
          return stats;
        }

        const currentScore = scoreResult.overallScore.score;
        const currentPrice = scoreResult.currentPrice;
        const overallScoreResult = scoreResult.overallScore;
        const strategies = scoreResult.strategies;

        console.log(`📈 ${company.ticker}: Score atual = ${currentScore.toFixed(1)}`);

        // 6. Buscar dados financeiros para o snapshot
        const companyWithData = await prisma.company.findUnique({
          where: { id: company.id },
          include: {
            financialData: {
              orderBy: { year: 'desc' },
              take: 1,
            },
            youtubeAnalyses: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (!companyWithData || !companyWithData.financialData[0]) {
          console.log(`⚠️ ${company.ticker}: Dados financeiros não disponíveis, pulando...`);
          await AssetMonitoringService.updateLastChecked(company.id);
          stats.processed = true;
          return stats;
        }

        const latestFinancials = companyWithData.financialData[0];
        
        // Preparar análise do YouTube se disponível
        const youtubeAnalysisData = companyWithData.youtubeAnalyses && companyWithData.youtubeAnalyses[0] ? {
          score: toNumber(companyWithData.youtubeAnalyses[0].score) || 0,
          summary: companyWithData.youtubeAnalyses[0].summary,
          positivePoints: companyWithData.youtubeAnalyses[0].positivePoints as string[] | null,
          negativePoints: companyWithData.youtubeAnalyses[0].negativePoints as string[] | null,
        } : null;

        // 7. Calcular composição do score usando função centralizada
        const scoreComposition = await calculateScoreComposition(company.ticker);

        // 8. Verificar se existe snapshot
        const existingSnapshot = await AssetMonitoringService.getLatestSnapshot(company.id);

        if (!existingSnapshot) {
          // Criar primeiro snapshot
          // Ajustar scores das estratégias para refletir os scores ajustados usados no cálculo final
          const adjustedStrategies = adjustStrategiesScoresForSnapshot(strategies, scoreComposition);
          const snapshotData = {
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            currentPrice,
            strategies: adjustedStrategies,
            overallScore: overallScoreResult,
            financials: latestFinancials,
            youtubeAnalysis: youtubeAnalysisData,
            timestamp: new Date().toISOString(),
          };

          await AssetMonitoringService.createSnapshot(
            company.id,
            snapshotData,
            currentScore,
            scoreComposition
          );

          console.log(`✅ ${company.ticker}: Primeiro snapshot criado`);
          stats.snapshotCreated = true;
        } else {
          // Comparar scores
          const previousScore = toNumber(existingSnapshot.overallScore) || 0;
          const comparison = AssetMonitoringService.compareScores(
            currentScore,
            previousScore,
            SCORE_THRESHOLD
          );

          console.log(
            `🔄 ${company.ticker}: Score anterior = ${previousScore.toFixed(1)}, Delta = ${comparison.delta.toFixed(1)}`
          );

          if (comparison.hasChange && comparison.direction) {
            console.log(`🚨 ${company.ticker}: Mudança ${comparison.direction} detectada!`);
            stats.changeDetected = true;

            // Verificar se há inscritos antes de gerar relatório
            const hasSubscribers = await AssetMonitoringService.hasSubscribers(company.id);

            if (!hasSubscribers) {
              console.log(`⚠️ ${company.ticker}: Sem inscritos, pulando geração de relatório`);
              
              // Criar snapshot mesmo sem inscritos (para evitar detectar a mesma mudança novamente)
              // Ajustar scores das estratégias para refletir os scores ajustados usados no cálculo final
              const adjustedStrategies = adjustStrategiesScoresForSnapshot(strategies, scoreComposition);
              const snapshotData = {
                ticker: company.ticker,
                name: company.name,
                sector: company.sector,
                currentPrice,
                strategies: adjustedStrategies,
                overallScore: overallScoreResult,
                financials: latestFinancials,
                youtubeAnalysis: youtubeAnalysisData,
                timestamp: new Date().toISOString(),
              };

              await AssetMonitoringService.createSnapshot(
                company.id,
                snapshotData,
                currentScore,
                scoreComposition
              );
              stats.snapshotCreated = true;
            } else {
              // Criar novo snapshot primeiro
              // Ajustar scores das estratégias para refletir os scores ajustados usados no cálculo final
              const adjustedStrategies = adjustStrategiesScoresForSnapshot(strategies, scoreComposition);
              const snapshotData = {
                ticker: company.ticker,
                name: company.name,
                sector: company.sector,
                currentPrice,
                strategies: adjustedStrategies,
                overallScore: overallScoreResult,
                financials: latestFinancials,
                youtubeAnalysis: youtubeAnalysisData,
                timestamp: new Date().toISOString(),
              };

              const snapshotId = await AssetMonitoringService.createSnapshot(
                company.id,
                snapshotData,
                currentScore,
                scoreComposition
              );

              console.log(`📸 ${company.ticker}: Novo snapshot criado (ID: ${snapshotId})`);
              stats.snapshotCreated = true;

              // Gerar relatório com IA
              const currentData = {
                ticker: company.ticker,
                name: company.name,
                currentPrice,
                strategies,
                overallScore: overallScoreResult,
                financials: latestFinancials,
              };

              try {
                // Buscar composição do score anterior se disponível
                const previousScoreComposition = (existingSnapshot as any).scoreComposition as ScoreComposition | undefined;

                const reportContent = await MonitoringReportService.generateChangeReport({
                  ticker: company.ticker,
                  name: company.name || company.ticker,
                  previousData: existingSnapshot.snapshotData as Record<string, unknown>,
                  currentData,
                  previousScore,
                  currentScore,
                  changeDirection: comparison.direction,
                  previousScoreComposition,
                  currentScoreComposition: scoreComposition,
                });

                console.log(`📝 ${company.ticker}: Relatório gerado (${reportContent.length} chars)`);

                // Salvar relatório associado ao snapshot
                const reportId = await MonitoringReportService.saveReport({
                  companyId: company.id,
                  snapshotId,
                  content: reportContent,
                  previousScore,
                  currentScore,
                  changeDirection: comparison.direction,
                  snapshotData: currentData,
                });

                console.log(`💾 ${company.ticker}: Relatório salvo (ID: ${reportId})`);
                stats.reportGenerated = true;

                // Buscar inscritos e criar notificações
                const subscribers = await AssetMonitoringService.getSubscribersForCompany(
                  company.id
                );

                console.log(`🔔 ${company.ticker}: Criando notificações para ${subscribers.length} inscritos`);

                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai';
                const reportUrl = `/acao/${company.ticker.toLowerCase()}/relatorios/${reportId}`;

                // Extrair resumo do relatório (primeiros 500 caracteres do conteúdo)
                const reportSummary = reportContent
                  .replace(/[#*`]/g, '')
                  .substring(0, 500)
                  .trim() + '...';

                // Separar Premium/Trial de Gratuitos
                const premiumSubscribers = subscribers.filter(sub => sub.isPremium);
                const freeSubscribers = subscribers.filter(sub => !sub.isPremium);

                console.log(`👑 ${company.ticker}: ${premiumSubscribers.length} Premium/Trial, ${freeSubscribers.length} Gratuitos`);

                // Criar notificações para Premium/Trial
                const premiumNotificationPromises = premiumSubscribers.map(async (subscriber) => {
                  try {
                    await NotificationService.createNotificationFromAIReport({
                      userId: subscriber.userId,
                      ticker: company.ticker,
                      companyName: company.name || company.ticker,
                      reportId,
                      reportType: 'ASSET_CHANGE',
                      reportUrl,
                      reportSummary,
                      changeDirection: comparison.direction!,
                      previousScore,
                      currentScore
                    });
                    return true;
                  } catch (notificationError) {
                    console.error(`❌ Erro ao criar notificação Premium para ${subscriber.email}:`, notificationError);
                    return false;
                  }
                });

                // Criar notificações de conversão para Gratuitos
                const freeNotificationPromises = freeSubscribers.map(async (subscriber) => {
                  try {
                    await NotificationService.createNotificationFromAIReport({
                      userId: subscriber.userId,
                      ticker: company.ticker,
                      companyName: company.name || company.ticker,
                      reportId,
                      reportType: 'FREE_USER_ASSET_CHANGE',
                      reportUrl,
                      reportSummary
                    });
                    return true;
                  } catch (notificationError) {
                    console.error(`❌ Erro ao criar notificação Gratuita para ${subscriber.email}:`, notificationError);
                    return false;
                  }
                });

                const notificationResults = await Promise.allSettled([
                  ...premiumNotificationPromises,
                  ...freeNotificationPromises,
                ]);

                const successfulNotifications = notificationResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
                stats.emailsSent = successfulNotifications; // Mantendo nome da variável para compatibilidade
                console.log(`✅ ${company.ticker}: ${successfulNotifications} notificações criadas`);
              } catch (reportError) {
                console.error(`❌ ${company.ticker}: Erro ao gerar/enviar relatório:`, reportError);
                stats.error = `${company.ticker}: ${(reportError as Error).message}`;
              }
            }
          } else {
            console.log(`✅ ${company.ticker}: Sem mudanças significativas`);
          }
        }

        // 9. Atualizar lastCheckedAt
        await AssetMonitoringService.updateLastChecked(company.id);
        stats.processed = true;
        return stats;
      } catch (error) {
        console.error(`❌ Erro ao processar ${company.ticker}:`, error);
        stats.error = `${company.ticker}: ${(error as Error).message}`;

        // Atualizar lastCheckedAt mesmo com erro para não travar o ativo
        try {
          await AssetMonitoringService.updateLastChecked(company.id);
        } catch (updateError) {
          console.error(`❌ Erro ao atualizar lastCheckedAt de ${company.ticker}:`, updateError);
        }
        stats.processed = true;
        return stats;
      }
    };

    // 4. Processar empresas em lotes paralelos
    for (let i = 0; i < companies.length; i += PARALLEL_BATCH_SIZE) {
      // Verificar timeout antes de processar próximo batch
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= MAX_EXECUTION_TIME) {
        console.log(`⏰ Tempo limite atingido (${elapsedTime}ms). Encerrando graciosamente...`);
        break;
      }

      const batch = companies.slice(i, i + PARALLEL_BATCH_SIZE);
      console.log(`\n🚀 Processando batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1} com ${batch.length} empresa(s) em paralelo...`);

      // Processar batch em paralelo
      const results = await Promise.allSettled(
        batch.map(company => processCompany(company))
      );

      // Agregar estatísticas
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const stats = result.value;
          if (stats.processed) processedCount++;
          if (stats.snapshotCreated) snapshotsCreated++;
          if (stats.changeDetected) changesDetected++;
          if (stats.reportGenerated) reportsGenerated++;
          emailsSent += stats.emailsSent;
          if (stats.error) errors.push(stats.error);
        } else {
          // Erro não tratado na função processCompany
          errors.push(`Erro não tratado: ${result.reason}`);
        }
      }
    }

    // 10. Resumo da execução
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);

    console.log('\n📊 ===== RESUMO DA EXECUÇÃO =====');
    console.log(`✅ Empresas processadas: ${processedCount}`);
    console.log(`📸 Snapshots criados: ${snapshotsCreated}`);
    console.log(`🔔 Mudanças detectadas: ${changesDetected}`);
    console.log(`📝 Relatórios gerados: ${reportsGenerated}`);
    console.log(`📧 Emails enviados: ${emailsSent}`);
    console.log(`⏱️  Tempo total: ${minutes}m ${seconds}s`);

    if (errors.length > 0) {
      console.log(`\n⚠️ Erros (${errors.length}):`);
      errors.forEach((err) => console.log(`  - ${err}`));
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job executado com sucesso',
      stats: {
        processedCount,
        snapshotsCreated,
        changesDetected,
        reportsGenerated,
        emailsSent,
        errors: errors.length,
      },
      executionTime: `${minutes}m ${seconds}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Erro fatal no cron job:', error);

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        executionTime: `${minutes}m ${seconds}s`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

