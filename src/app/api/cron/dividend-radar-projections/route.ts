/**
 * Cron Job Endpoint: Dividend Radar Projections
 * 
 * Processa dividendos e gera projeções para todas as empresas que precisam:
 * - Carrega dividendos atualizados do Yahoo Finance
 * - Gera projeções usando IA (Gemini) ou regras baseadas em histórico
 * - Salva projeções no banco de dados
 * 
 * Designed to run periodically via cron job
 * 
 * GET /api/cron/dividend-radar-projections - Processa todas as empresas
 * GET /api/cron/dividend-radar-projections?limit=50 - Limita número de empresas
 * GET /api/cron/dividend-radar-projections?ticker=PETR4 - Processa apenas um ticker
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DividendService } from '@/lib/dividend-service';
import { DividendRadarService } from '@/lib/dividend-radar-service';

/**
 * GET /api/cron/dividend-radar-projections
 * 
 * Processa dividendos e gera projeções para empresas
 * 
 * Query params:
 * - limit: número máximo de empresas para processar (default: 100)
 * - ticker: processar apenas um ticker específico
 * - skipDividends: pular carregamento de dividendos (apenas gerar projeções)
 * 
 * Headers required:
 * - Authorization: Bearer <CRON_SECRET> ou x-cron-secret: <CRON_SECRET>
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

    // 2. Pegar parâmetros
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const tickerParam = searchParams.get('ticker');
    const skipDividends = searchParams.get('skipDividends') === 'true';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🕐 [CRON JOB] Iniciando processamento de projeções de dividendos`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Limit: ${limit}`);
    console.log(`   Skip Dividends: ${skipDividends}`);
    if (tickerParam) {
      console.log(`   Ticker específico: ${tickerParam}`);
    }
    console.log(`${'='.repeat(60)}\n`);

    let companiesToProcess: Array<{ ticker: string; id: number }> = [];

    // 3. Buscar empresas para processar
    if (tickerParam) {
      // Processar apenas um ticker específico
      const company = await prisma.company.findUnique({
        where: { ticker: tickerParam.toUpperCase() },
        select: { id: true, ticker: true },
      });

      if (!company) {
        return NextResponse.json({
          success: false,
          error: `Company ${tickerParam} not found`,
          timestamp: new Date().toISOString(),
        }, { status: 404 });
      }

      companiesToProcess = [company];
    } else {
      // Buscar empresas para processamento contínuo
      // Estratégia: Priorizar empresas nunca processadas (NULL), depois as mais antigas
      // IMPORTANTE: Não filtrar por histórico de dividendos - vamos carregar sob demanda se necessário
      const baseWhere: any = {
        assetType: { in: ['STOCK', 'BDR'] }, // Apenas ações e BDRs
        // Removido filtro de dividendHistory - vamos carregar dividendos sob demanda
      };

      // Buscar TODAS as empresas STOCK/BDR (sem filtro de histórico)
      // IMPORTANTE: Vamos carregar dividendos sob demanda se necessário
      // Filtrar no código para separar por prioridade (campos JSON não podem ser verificados diretamente no Prisma)
      const allCompanies = await prisma.company.findMany({
        where: baseWhere,
        select: {
          id: true,
          ticker: true,
          dividendRadarProjections: true,
          dividendRadarLastProcessedAt: true,
        },
        orderBy: {
          dividendRadarLastProcessedAt: 'asc', // NULL primeiro, depois mais antigas
        },
      });

      // Separar empresas por prioridade
      const neverProcessed: Array<{ id: number; ticker: string }> = [];
      const failedProcessing: Array<{ id: number; ticker: string }> = [];
      const withProjections: Array<{ id: number; ticker: string }> = [];

      for (const company of allCompanies) {
        const hasNoProcessedAt = company.dividendRadarLastProcessedAt === null || company.dividendRadarLastProcessedAt === undefined;
        // Verificar se tem projeções: null, undefined, ou objeto vazio/array vazio
        const projections = company.dividendRadarProjections;
        const hasNoProjections = 
          projections === null || 
          projections === undefined ||
          (typeof projections === 'object' && 
           (Array.isArray(projections) ? projections.length === 0 : Object.keys(projections).length === 0));

        if (hasNoProcessedAt) {
          // Prioridade 1: Nunca processadas (dividendRadarLastProcessedAt = NULL)
          neverProcessed.push({ id: company.id, ticker: company.ticker });
        } else if (hasNoProjections) {
          // Prioridade 2: Tentaram processar mas não têm projeções
          // (dividendRadarLastProcessedAt != NULL mas dividendRadarProjections = NULL)
          failedProcessing.push({ id: company.id, ticker: company.ticker });
        } else {
          // Prioridade 3: Têm projeções válidas (ciclo contínuo)
          withProjections.push({ id: company.id, ticker: company.ticker });
        }
      }

      console.log(`\n📊 [CRON JOB] Empresas encontradas:`);
      console.log(`   - Nunca processadas (NULL): ${neverProcessed.length}`);
      console.log(`   - Sem projeções (tentaram antes): ${failedProcessing.length}`);
      console.log(`   - Com projeções válidas: ${withProjections.length}`);
      
      if (neverProcessed.length > 0) {
        console.log(`   📋 Exemplos de empresas nunca processadas: ${neverProcessed.slice(0, 5).map(c => c.ticker).join(', ')}`);
      }

      // Combinar por prioridade até atingir o limite
      // IMPORTANTE: Só processar empresas com projeções válidas se não houver outras opções
      const totalNeverProcessed = neverProcessed.length;
      const totalFailedProcessing = failedProcessing.length;
      
      companiesToProcess = [];
      
      // Prioridade 1: Empresas nunca processadas
      if (totalNeverProcessed > 0) {
        const toAdd = Math.min(limit, totalNeverProcessed);
        const selected = neverProcessed.slice(0, toAdd);
        companiesToProcess.push(...selected);
        console.log(`   ✅ Selecionadas ${toAdd} empresas nunca processadas: ${selected.map(c => c.ticker).join(', ')}`);
      }
      
      // Prioridade 2: Empresas sem projeções (só se ainda não atingiu o limite)
      if (companiesToProcess.length < limit && totalFailedProcessing > 0) {
        const remaining = limit - companiesToProcess.length;
        const toAdd = Math.min(remaining, totalFailedProcessing);
        const selected = failedProcessing.slice(0, toAdd);
        companiesToProcess.push(...selected);
        console.log(`   ✅ Selecionadas ${toAdd} empresas sem projeções: ${selected.map(c => c.ticker).join(', ')}`);
      }
      
      // Prioridade 3: Empresas com projeções válidas (só se ainda não atingiu o limite)
      // CRÍTICO: Só processar empresas com projeções válidas se NÃO houver empresas nunca processadas ou sem projeções disponíveis
      // Se há empresas nunca processadas disponíveis, NÃO processar empresas com projeções válidas
      const processedNeverProcessed = companiesToProcess.filter(c => neverProcessed.some(np => np.id === c.id)).length;
      const processedFailed = companiesToProcess.filter(c => failedProcessing.some(fp => fp.id === c.id)).length;
      const remainingNeverProcessed = totalNeverProcessed - processedNeverProcessed;
      const remainingFailed = totalFailedProcessing - processedFailed;
      
      if (companiesToProcess.length < limit && remainingNeverProcessed === 0 && remainingFailed === 0 && withProjections.length > 0) {
        // Só processar empresas com projeções válidas se já processamos TODAS as empresas nunca processadas e sem projeções disponíveis
        const remaining = limit - companiesToProcess.length;
        const toAdd = Math.min(remaining, withProjections.length);
        const selected = withProjections.slice(0, toAdd);
        companiesToProcess.push(...selected);
        console.log(`   ⚠️ Selecionadas ${toAdd} empresas com projeções válidas (ciclo contínuo): ${selected.map(c => c.ticker).join(', ')}`);
      } else if (remainingNeverProcessed > 0 || remainingFailed > 0) {
        console.log(`   ⚠️ AINDA HÁ ${remainingNeverProcessed} empresas nunca processadas e ${remainingFailed} sem projeções disponíveis - NÃO processando empresas com projeções válidas`);
      }
      
      console.log(`   📋 Total selecionado: ${companiesToProcess.length} empresas`);
    }

    console.log(`📊 [CRON JOB] Encontradas ${companiesToProcess.length} empresas para processar`);

    if (companiesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma empresa STOCK/BDR encontrada',
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Processar empresas em lotes
    const BATCH_SIZE = 5; // Processar 5 empresas por vez para não sobrecarregar
    const results = {
      total: companiesToProcess.length,
      processed: 0,
      success: 0,
      failed: 0,
      dividendsLoaded: 0,
      projectionsGenerated: 0,
      errors: [] as Array<{ ticker: string; error: string }>,
    };

    for (let i = 0; i < companiesToProcess.length; i += BATCH_SIZE) {
      const batch = companiesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 [CRON JOB] Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companiesToProcess.length / BATCH_SIZE)} (${batch.length} empresas)`);

      // Processar lote em paralelo
      await Promise.all(
        batch.map(async (company) => {
          try {
            results.processed++;

            console.log(`\n  🔄 [${company.ticker}] Iniciando processamento...`);

            // 1. SEMPRE carregar dividendos atualizados (se não pular)
            // IMPORTANTE: Carregar dividendos sob demanda mesmo se empresa não tem histórico
            // Isso garante que sempre temos dados atualizados antes de gerar projeções
            if (!skipDividends) {
              try {
                const dividendResult = await DividendService.fetchAndSaveDividends(company.ticker);
                if (dividendResult.success && dividendResult.dividendsCount > 0) {
                  results.dividendsLoaded++;
                  console.log(`  ✅ [${company.ticker}] ${dividendResult.dividendsCount} dividendos carregados`);
                } else {
                  console.log(`  ⚠️ [${company.ticker}] Nenhum dividendo encontrado`);
                }
              } catch (error) {
                console.error(`  ❌ [${company.ticker}] Erro ao carregar dividendos:`, error);
                // Continuar mesmo se falhar carregamento de dividendos
              }
            }

            // 2. Verificar se precisa reprocessar projeções
            const needsReprocessing = await DividendRadarService.shouldReprocessProjections(company.ticker);
            
            // Verificar se já tem projeções válidas
            const companyData = await prisma.company.findUnique({
              where: { ticker: company.ticker },
              select: {
                dividendRadarProjections: true,
                dividendRadarLastProcessedAt: true,
              },
            });

            const hasValidProjections = companyData?.dividendRadarProjections && !needsReprocessing;

            if (hasValidProjections) {
              // Empresa já tem projeções válidas
              // IMPORTANTE: Só atualizar data se realmente não há outras empresas para processar
              // Isso evita que empresas com projeções sejam processadas enquanto há empresas nunca processadas
              // A atualização da data será feita apenas para manter o ciclo contínuo quando necessário
              await prisma.company.update({
                where: { ticker: company.ticker },
                data: {
                  dividendRadarLastProcessedAt: new Date(),
                },
              });
              console.log(`  ⏭️ [${company.ticker}] Projeções válidas, atualizando data de processamento (ciclo contínuo)`);
              results.success++;
              return;
            }

            // 3. Gerar projeções (não tem projeções ou precisa reprocessar)
            try {
              const projections = await DividendRadarService.getOrGenerateProjections(company.ticker);
              if (projections && projections.length > 0) {
                results.projectionsGenerated++;
                results.success++;
                console.log(`  ✅ [${company.ticker}] ${projections.length} projeções geradas`);
              } else {
                console.log(`  ⚠️ [${company.ticker}] Nenhuma projeção gerada (sem histórico suficiente)`);
                // NÃO atualizar dividendRadarLastProcessedAt se não gerou projeções
                // Isso mantém a empresa na lista de prioridade para tentar novamente no futuro
                // quando talvez tenha mais histórico de dividendos
                results.success++; // Não é erro, apenas não tem dados suficientes
              }
            } catch (error) {
              throw error; // Propagar erro para tratamento abaixo
            }

          } catch (error) {
            results.failed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push({
              ticker: company.ticker,
              error: errorMessage,
            });
            console.error(`  ❌ [${company.ticker}] Erro durante processamento:`, error);
          }
        })
      );

      // Delay entre lotes para não sobrecarregar APIs
      if (i + BATCH_SIZE < companiesToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 segundo entre lotes
      }
    }

    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [CRON JOB] Processamento concluído`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Processadas: ${results.processed}`);
    console.log(`   Sucesso: ${results.success}`);
    console.log(`   Falhas: ${results.failed}`);
    console.log(`   Dividendos carregados: ${results.dividendsLoaded}`);
    console.log(`   Projeções geradas: ${results.projectionsGenerated}`);
    console.log(`   Duração: ${minutes}m ${seconds}s`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      summary: results,
      duration: `${minutes}m ${seconds}s`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ [CRON JOB] Erro durante processamento:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`,
        timestamp: new Date().toISOString(),
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

