/**
 * Script de teste para Asset Monitoring (Teste de Ponta a Ponta)
 * 
 * Permite testar o processo COMPLETO de monitoramento com um ticker específico,
 * incluindo geração de relatório, atualização de snapshot e ENVIO REAL DE EMAILS.
 * 
 * ⚠️  ATENÇÃO: Este script ENVIA EMAILS DE VERDADE para os usuários inscritos!
 * 
 * Usage:
 *   npm run monitor:test BBSE3
 *   npm run monitor:test PETR4 --force-change
 *   npm run monitor:test VALE3 --simulate-score 85
 */

import { PrismaClient } from '@prisma/client';
import { AssetMonitoringService } from '../src/lib/asset-monitoring-service';
import { MonitoringReportService } from '../src/lib/monitoring-report-service';
import { sendAssetChangeEmail } from '../src/lib/email-service';
import { calculateCompanyOverallScore } from '../src/lib/calculate-company-score-service';
import { toNumber } from '../src/lib/strategies';

const prisma = new PrismaClient();

interface TestOptions {
  ticker: string;
  forceChange?: boolean;
  simulateScore?: number;
}

async function testAssetMonitoring(options: TestOptions) {
  const { ticker, forceChange = false, simulateScore } = options;

  console.log('\n🧪 ===== TESTE DE MONITORAMENTO DE ATIVO =====\n');
  console.log(`📊 Ticker: ${ticker}`);
  console.log(`🔧 Forçar mudança: ${forceChange ? 'SIM' : 'NÃO'}`);
  if (simulateScore) {
    console.log(`🎯 Simular score: ${simulateScore}`);
  }
  console.log('');

  try {
    // 1. Buscar empresa
    console.log('1️⃣ Buscando empresa no banco...');
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    if (!company) {
      throw new Error(`Empresa ${ticker} não encontrada no banco de dados`);
    }

    console.log(`   ✅ Empresa encontrada: ${company.name} (ID: ${company.id})`);
    console.log('');

    // 2. Verificar inscritos
    console.log('2️⃣ Verificando inscritos...');
    const hasSubscribers = await AssetMonitoringService.hasSubscribers(company.id);
    const subscribers = hasSubscribers
      ? await AssetMonitoringService.getSubscribersForCompany(company.id)
      : [];

    console.log(`   📧 Inscritos: ${subscribers.length}`);
    if (subscribers.length > 0) {
      subscribers.forEach((sub) => {
        console.log(`      - ${sub.email} (${sub.name || 'Sem nome'})`);
      });
    }
    console.log('');

    // 3. Buscar dados atuais
    console.log('3️⃣ Buscando dados fundamentais...');
    const companyWithData = await prisma.company.findUnique({
      where: { id: company.id },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1,
        },
        dailyQuotes: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    if (!companyWithData || !companyWithData.financialData[0] || !companyWithData.dailyQuotes[0]) {
      throw new Error('Dados insuficientes para análise');
    }

    const latestFinancials = companyWithData.financialData[0];

    // 4. Calcular score usando o serviço centralizado (MESMA LÓGICA DA PLATAFORMA)
    console.log('4️⃣ Calculando score com serviço centralizado (igual à plataforma)...');
    
    const scoreResult = await calculateCompanyOverallScore(company.ticker, {
      isPremium: true,
      isLoggedIn: true,
      includeStatements: true,
      includeStrategies: true,
      companyId: String(company.id),
      industry: company.industry
    });

    if (!scoreResult || !scoreResult.overallScore || !scoreResult.strategies) {
      console.error(`❌ Score não pode ser calculado para ${company.ticker}`);
      return;
    }

    const currentPrice = scoreResult.currentPrice;
    console.log(`   💰 Preço atual: R$ ${currentPrice.toFixed(2)}`);
    console.log('');
    const overallScoreResult = scoreResult.overallScore;
    const strategies = scoreResult.strategies;
    let currentScore = overallScoreResult.score;

    // Aplicar simulação se necessário
    if (simulateScore !== undefined) {
      console.log(`   🎯 Simulando score: ${currentScore.toFixed(1)} → ${simulateScore}`);
      currentScore = simulateScore;
    }

    console.log(`   📊 Score atual: ${currentScore.toFixed(1)}`);
    console.log(`   📈 Classificação: ${overallScoreResult.classification}`);
    console.log('');

    // 5. Verificar snapshot existente
    console.log('5️⃣ Verificando snapshot existente...');
    const existingSnapshot = await AssetMonitoringService.getSnapshot(company.id);

    if (!existingSnapshot) {
      console.log('   ℹ️  Nenhum snapshot encontrado (primeira execução)');
      console.log('');

      // Criar primeiro snapshot
      console.log('6️⃣ Criando primeiro snapshot...');
      const snapshotData = {
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        strategies,
        overallScore: overallScoreResult,
        financials: latestFinancials,
        timestamp: new Date().toISOString(),
      };

      await AssetMonitoringService.createOrUpdateSnapshot(company.id, snapshotData, currentScore);
      console.log('   ✅ Snapshot criado com sucesso');
      console.log('');
      console.log('ℹ️  Na próxima execução, o sistema comparará com este snapshot.');
    } else {
      const previousScore = toNumber(existingSnapshot.overallScore) || 0;
      console.log(`   📸 Snapshot encontrado`);
      console.log(`   📊 Score anterior: ${previousScore.toFixed(1)}`);
      console.log(`   📅 Última atualização: ${new Date(existingSnapshot.updatedAt).toLocaleString('pt-BR')}`);
      console.log('');

      // 6. Comparar scores
      console.log('6️⃣ Comparando scores...');
      let comparison = AssetMonitoringService.compareScores(currentScore, previousScore);

      // Forçar mudança se necessário
      if (forceChange && !comparison.hasChange) {
        console.log('   🔧 Forçando mudança para teste...');
        const forcedScore = previousScore + 6; // Criar diferença de 6 pontos
        comparison = AssetMonitoringService.compareScores(forcedScore, previousScore);
        currentScore = forcedScore;
      }

      console.log(`   📊 Delta: ${comparison.delta.toFixed(1)} pontos`);
      console.log(`   ${comparison.hasChange ? '🔔' : '✅'} Mudança significativa: ${comparison.hasChange ? 'SIM' : 'NÃO'}`);
      if (comparison.direction) {
        console.log(`   📈 Direção: ${comparison.direction === 'positive' ? '↑ POSITIVA' : '↓ NEGATIVA'}`);
      }
      console.log('');

      if (comparison.hasChange && comparison.direction) {
        // 7. Gerar relatório
        console.log('7️⃣ Gerando relatório com IA...');
        console.log('   ⏳ Aguarde, isso pode levar alguns segundos...');

        const currentData = {
          ticker: company.ticker,
          name: company.name,
          currentPrice,
          strategies,
          overallScore: overallScoreResult,
          financials: latestFinancials,
        };

        try {
          const reportContent = await MonitoringReportService.generateChangeReport({
            ticker: company.ticker,
            name: company.name || company.ticker,
            previousData: existingSnapshot.snapshotData as Record<string, any>,
            currentData,
            previousScore,
            currentScore,
            changeDirection: comparison.direction,
          });

          console.log(`   ✅ Relatório gerado (${reportContent.length} caracteres)`);
          console.log('');

          // Preview do relatório
          console.log('📝 ===== PREVIEW DO RELATÓRIO =====\n');
          const preview = reportContent.substring(0, 500);
          console.log(preview);
          console.log('\n... (relatório completo omitido para brevidade) ...\n');

          // 8. Salvar relatório
          console.log('8️⃣ Salvando relatório...');
          const reportId = await MonitoringReportService.saveReport({
            companyId: company.id,
            content: reportContent,
            previousScore,
            currentScore,
            changeDirection: comparison.direction,
            snapshotData: currentData,
          });

          console.log(`   ✅ Relatório salvo (ID: ${reportId})`);
          console.log('');

          // 9. Atualizar snapshot
          console.log('9️⃣ Atualizando snapshot...');
          const newSnapshotData = {
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            currentPrice,
            strategies,
            overallScore: overallScoreResult,
            financials: latestFinancials,
            timestamp: new Date().toISOString(),
          };

          await AssetMonitoringService.createOrUpdateSnapshot(
            company.id,
            newSnapshotData,
            currentScore
          );
          console.log('   ✅ Snapshot atualizado');
          console.log('');

          // 10. Envio de emails
          console.log('🔟 Enviando emails aos inscritos...');
          if (subscribers.length > 0) {
            console.log(`   📧 Enviando emails para ${subscribers.length} inscritos...`);

            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai';
            const reportUrl = `${baseUrl}/acao/${company.ticker.toLowerCase()}/relatorios/${reportId}`;

            // Extrair resumo do relatório (primeiros 200 caracteres)
            const reportSummary = reportContent
              .replace(/[#*`]/g, '')
              .substring(0, 500)
              .trim() + '...';

            let emailsSent = 0;
            let emailsFailed = 0;

            for (const subscriber of subscribers) {
              try {
                await sendAssetChangeEmail({
                  email: subscriber.email,
                  userName: subscriber.name || 'Investidor',
                  ticker: company.ticker,
                  companyName: company.name || company.ticker,
                  companyLogoUrl: company.logoUrl,
                  changeDirection: comparison.direction || 'positive',
                  previousScore,
                  currentScore,
                  reportSummary,
                  reportUrl,
                });

                console.log(`      ✅ Email enviado para ${subscriber.email}`);
                emailsSent++;
              } catch (error: any) {
                console.error(`      ❌ Erro ao enviar email para ${subscriber.email}:`, error.message);
                emailsFailed++;
              }
            }

            console.log('');
            console.log(`   📊 Resultado: ${emailsSent} enviados, ${emailsFailed} falharam`);
          } else {
            console.log('   ℹ️  Nenhum inscrito, emails não enviados');
          }
        } catch (error: any) {
          console.error('   ❌ Erro ao gerar relatório:', error.message);
          throw error;
        }
      } else {
        console.log('ℹ️  Sem mudanças significativas. Relatório não será gerado.');
      }
    }

    console.log('');
    console.log('✅ ===== TESTE CONCLUÍDO COM SUCESSO =====\n');
  } catch (error: any) {
    console.error('');
    console.error('❌ ===== ERRO NO TESTE =====');
    console.error('');
    console.error(error.message);
    console.error('');
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse argumentos
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
📊 Script de Teste de Monitoramento de Ativos (PONTA A PONTA)

⚠️  ATENÇÃO: Este script ENVIA EMAILS DE VERDADE para usuários inscritos!

Usage:
  npm run monitor:test <TICKER> [options]

Exemplos:
  npm run monitor:test BBSE3
  npm run monitor:test PETR4 --force-change
  npm run monitor:test VALE3 --simulate-score 85

Options:
  --force-change        Força uma mudança mesmo se não houver alteração significativa
  --simulate-score N    Simula um score específico para testar comparação

Descrição:
  Este script executa um teste COMPLETO de ponta a ponta do sistema de monitoramento:
  
  1. Busca dados fundamentais atuais da empresa
  2. Calcula o Overall Score
  3. Compara com o snapshot anterior (se existir)
  4. Gera relatório com IA (se houver mudança significativa)
  5. Salva o relatório no banco de dados
  6. Atualiza o snapshot
  7. 📧 ENVIA EMAILS REAIS para todos os usuários inscritos no ativo

  Use com cuidado em produção!
  `);
  process.exit(0);
}

const ticker = args[0].toUpperCase();
const forceChange = args.includes('--force-change');
const simulateScoreIndex = args.indexOf('--simulate-score');
const simulateScore =
  simulateScoreIndex !== -1 && args[simulateScoreIndex + 1]
    ? parseFloat(args[simulateScoreIndex + 1])
    : undefined;

testAssetMonitoring({ ticker, forceChange, simulateScore });

