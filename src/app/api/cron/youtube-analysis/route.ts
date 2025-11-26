import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAnalysisService } from '@/lib/youtube-analysis-service';
import { prisma } from '@/lib/prisma';

// Configurar timeout para 60 segundos (máximo do plano hobby da Vercel)
export const maxDuration = 60;

/**
 * Cron Job para Análise de Vídeos do YouTube
 * 
 * Executa periodicamente para buscar e analisar vídeos recentes do YouTube
 * sobre empresas brasileiras listadas na bolsa.
 * 
 * Prioridade de processamento:
 * 1. Empresas sem análise de YouTube
 * 2. Empresas com análise mais antiga
 * 
 * Se os vídeos encontrados forem os mesmos da análise anterior, skip.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('🎬 Iniciando cron job de análise do YouTube...');

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizada ao cron job');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.YOUTUBE_ANALYSIS_BATCH_SIZE || '30');
    const PARALLEL_BATCH_SIZE = 10; // Processar 10 empresas em paralelo
    const DELAY_BETWEEN_BATCHES = parseInt(
      process.env.YOUTUBE_ANALYSIS_DELAY_MS || '500'
    );
    const MAX_EXECUTION_TIME = 60 * 1000; // 50 segundos em ms (deixar buffer de 10s)

    console.log(
      `📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, PARALLEL_BATCH_SIZE=${PARALLEL_BATCH_SIZE}, DELAY=${DELAY_BETWEEN_BATCHES}ms`
    );

    // 3. Buscar próximo lote de empresas para processar
    const companies = await YouTubeAnalysisService.getNextBatchToProcess(BATCH_SIZE);

    console.log(`📦 Processando lote de ${companies.length} empresas em paralelo (${PARALLEL_BATCH_SIZE} por vez)`);

    let processedCount = 0;
    let newAnalysesCount = 0;
    let updatedAnalysesCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Função para processar uma única empresa
    const processCompany = async (company: typeof companies[0]) => {
      const stats = {
        processed: false,
        newAnalysis: false,
        updatedAnalysis: false,
        skipped: false,
        error: null as string | null,
      };

      try {
        console.log(`\n🔍 Processando ${company.ticker} (ID: ${company.id})...`);

        // 5. Verificar se já existe análise de empresa relacionada (PETR3/PETR4)
        console.log(`🔗 ${company.ticker}: Verificando análise de empresas relacionadas...`);
        const relatedAnalysis = await YouTubeAnalysisService.findRelatedCompanyAnalysis(
          company.ticker,
          company.name
        );

        if (relatedAnalysis) {
          // Pegar ticker da empresa relacionada
          const relatedCompany = await prisma.company.findUnique({
            where: { id: relatedAnalysis.companyId },
            select: { ticker: true }
          });

          if (relatedCompany) {
            console.log(`✅ ${company.ticker}: Copiando análise de ${relatedCompany.ticker} (Score: ${relatedAnalysis.analysis.score}/100)`);
            
            await YouTubeAnalysisService.copyAnalysisFromRelated(
              company.id,
              relatedAnalysis.analysis,
              relatedCompany.ticker,
              company.ticker
            );

            await YouTubeAnalysisService.updateLastChecked(company.id);
            stats.processed = true;
            stats.newAnalysis = true;
            
            console.log(`✅ ${company.ticker}: Análise copiada com sucesso!`);
            return stats;
          } else {
            console.log(`⚠️ ${company.ticker}: Empresa relacionada não encontrada, processando normalmente...`);
          }
        }

        // 6. Buscar vídeos mais recentes
        console.log(`📺 ${company.ticker}: Buscando vídeos no YouTube...`);

        let videoSearchResult;
        try {
          const videoIds = await YouTubeAnalysisService.searchYouTubeVideos(
            company.ticker,
            company.name,
            company.sector,
            company.industry
          );
          videoSearchResult = { videoIds, reason: 'Vídeos encontrados' };
        } catch (searchError: any) {
          console.error(`❌ ${company.ticker}: Erro na busca de vídeos`, searchError);
          videoSearchResult = { 
            videoIds: [], 
            reason: searchError.message || 'Erro ao buscar vídeos' 
          };
        }

        if (!videoSearchResult.videoIds || videoSearchResult.videoIds.length === 0) {
          console.log(`⚠️ ${company.ticker}: Nenhum vídeo encontrado`);
          
          // 6.1. Verificar se já existe análise anterior (web-only)
          const existingAnalysis = await YouTubeAnalysisService.getActiveAnalysis(company.id);
          
          if (existingAnalysis && (!existingAnalysis.videoIds || existingAnalysis.videoIds.length === 0)) {
            // Já existe análise web anterior - verificar se precisa atualizar
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            const analysisDate = new Date(existingAnalysis.createdAt);
            const needsUpdate = analysisDate < oneWeekAgo;
            
            if (!needsUpdate) {
              // Análise ainda está fresca (menos de 1 semana)
              console.log(`✅ ${company.ticker}: Mantendo análise web recente (criada há ${Math.floor((Date.now() - analysisDate.getTime()) / (1000 * 60 * 60 * 24))} dias)`);
              await YouTubeAnalysisService.updateLastChecked(company.id);
              stats.processed = true;
              stats.skipped = true;
              return stats;
            }
            
            // Análise tem mais de 1 semana - fazer nova análise e comparar
            console.log(`🔄 ${company.ticker}: Análise web tem mais de 1 semana, atualizando...`);
          }
          
          // 6.2. Não existe análise anterior OU análise tem mais de 1 semana OU análise anterior tinha vídeos
          console.log(`🌐 ${company.ticker}: Buscando análise web...`);
          
          // Buscar análise web como alternativa
          try {
            const webAnalysis = await YouTubeAnalysisService.analyzeWebContent(
              company.ticker,
              company.name,
              company.sector || undefined,
              company.industry || undefined
            );

            // Se encontrou informações na web, salvar análise atualizada
            if (webAnalysis.score !== 50 || webAnalysis.positivePoints.length > 0 || webAnalysis.negativePoints.length > 0) {
              // Como a pesquisa web já foi feita e análise tem mais de 1 semana, salvar atualização
              console.log(`🌐 ${company.ticker}: Salvando análise web atualizada...`);
              
              const webAnalysisResult: any = {
                score: webAnalysis.score,
                summary: webAnalysis.summary,
                positivePoints: webAnalysis.positivePoints,
                negativePoints: webAnalysis.negativePoints,
              };

              // Validar análise antes de salvar
              if (!YouTubeAnalysisService.isValidAnalysis(webAnalysisResult)) {
                console.warn(`⚠️ ${company.ticker}: Análise web inválida - mantendo última análise válida`);
                console.warn(`   Summary: "${webAnalysisResult.summary}"`);
                console.warn(`   Pontos positivos: ${webAnalysisResult.positivePoints?.length || 0}`);
                console.warn(`   Pontos negativos: ${webAnalysisResult.negativePoints?.length || 0}`);
                
                // Não criar nova versão - manter a última válida
                // NÃO atualizar lastCheckedAt para que seja reprocessada na próxima execução
                stats.processed = true;
                stats.skipped = true;
                return stats;
              }

              try {
                const analysisId = await YouTubeAnalysisService.saveAnalysis(
                  company.id,
                  [], // Sem vídeos
                  webAnalysisResult
                );

                console.log(`✅ ${company.ticker}: Análise web atualizada salva (ID: ${analysisId}, Score: ${webAnalysis.score}/100)`);
                
                if (existingAnalysis) {
                  stats.updatedAnalysis = true;
                } else {
                  stats.newAnalysis = true;
                }
                
                await YouTubeAnalysisService.updateLastChecked(company.id);
                stats.processed = true;
                return stats;
              } catch (saveError: any) {
                // Se erro ao salvar (ex: análise inválida), manter última válida
                if (saveError?.message?.includes('Análise inválida')) {
                  console.warn(`⚠️ ${company.ticker}: Erro ao salvar análise web inválida - mantendo última análise válida`);
                  // NÃO atualizar lastCheckedAt para que seja reprocessada na próxima execução
                  stats.processed = true;
                  stats.skipped = true;
                  return stats;
                }
                throw saveError;
              }
            } else {
              // Sem informações relevantes na web também
              console.log(`⚠️ ${company.ticker}: Sem cobertura adequada (YouTube e Web)`);
              const reason = 'Empresa sem cobertura adequada em vídeos do YouTube ou fontes web profissionais';
              await YouTubeAnalysisService.saveEmptyAnalysis(company.id, reason);
              console.log(`💾 ${company.ticker}: Análise vazia salva (aguardar 1 semana para nova tentativa)`);
            }
          } catch (webError) {
            console.error(`❌ ${company.ticker}: Erro na análise web`, webError);
            // Salvar análise vazia em caso de erro
            const reason = videoSearchResult.reason || 'Erro ao buscar informações (YouTube e Web indisponíveis)';
            await YouTubeAnalysisService.saveEmptyAnalysis(company.id, reason);
          }
          
          await YouTubeAnalysisService.updateLastChecked(company.id);
          stats.processed = true;
          stats.skipped = true;
          return stats;
        }

        const videoIds = videoSearchResult.videoIds;

        console.log(`📹 ${company.ticker}: ${videoIds.length} vídeo(s) encontrado(s)`);

        // 7. Verificar se há vídeos novos em relação à análise anterior
        const existingAnalysis = await YouTubeAnalysisService.getActiveAnalysis(
          company.id
        );

        if (existingAnalysis && existingAnalysis.videoIds && existingAnalysis.videoIds.length > 0) {
          // Verificar se há vídeos novos (que não estavam na análise anterior)
          const existingVideoIds = existingAnalysis.videoIds;
          const newVideoIds = videoIds.filter(id => !existingVideoIds.includes(id));
          
          if (newVideoIds.length === 0) {
            // Todos os vídeos encontrados já estavam na análise anterior
            console.log(
              `✅ ${company.ticker}: Nenhum vídeo novo encontrado, mantendo análise anterior`
            );
            await YouTubeAnalysisService.updateLastChecked(company.id);
            stats.processed = true;
            stats.skipped = true;
            return stats;
          } else {
            // Há vídeos novos! Refazer análise
            console.log(
              `🆕 ${company.ticker}: ${newVideoIds.length} vídeo(s) novo(s) encontrado(s), refazendo análise...`
            );
          }
        }

        // 8. Analisar vídeos
        console.log(`🎬 ${company.ticker}: Analisando ${videoIds.length} vídeo(s)...`);

        let analysisResult;
        try {
          analysisResult = await YouTubeAnalysisService.analyzeVideos(
            videoIds,
            company.ticker,
            company.name
          );
        } catch (analysisError: any) {
          // Tratar erro específico de vídeo muito longo
          if (analysisError?.message?.includes('Vídeo muito longo')) {
            console.error(`🎥 ${company.ticker}: Vídeo muito longo - pulando esta empresa`);
            stats.error = `${company.ticker}: Vídeo excede limite de processamento (muito longo)`;
            // NÃO atualizar lastCheckedAt - não salvamos análise válida, deve ser reprocessada
            stats.processed = true;
            stats.skipped = true;
            return stats;
          }
          // Outros erros de análise
          throw analysisError;
        }

        console.log(
          `📊 ${company.ticker}: Análise YouTube - Score ${analysisResult.score}/100`
        );

        // 9. Buscar análise web complementar
        console.log(`🌐 ${company.ticker}: Buscando análise web complementar...`);
        
        let finalAnalysisResult = analysisResult;
        try {
          const webAnalysis = await YouTubeAnalysisService.analyzeWebContent(
            company.ticker,
            company.name,
            company.sector || undefined,
            company.industry || undefined
          );

          // Combinar análises (70% YouTube + 30% Web)
          finalAnalysisResult = YouTubeAnalysisService.combineAnalyses(
            analysisResult,
            webAnalysis,
            company.ticker
          );

          console.log(
            `🔗 ${company.ticker}: Análise combinada - Score final ${finalAnalysisResult.score}/100`
          );
        } catch (webError) {
          console.warn(`⚠️ ${company.ticker}: Análise web falhou, usando apenas YouTube`, webError);
          // Se falhar a análise web, continua com apenas YouTube
          finalAnalysisResult = analysisResult;
        }

        // 10. Validar análise antes de salvar
        if (!YouTubeAnalysisService.isValidAnalysis(finalAnalysisResult)) {
          console.warn(`⚠️ ${company.ticker}: Análise inválida detectada - mantendo última análise válida`);
          console.warn(`   Summary: "${finalAnalysisResult.summary}"`);
          console.warn(`   Pontos positivos: ${finalAnalysisResult.positivePoints?.length || 0}`);
          console.warn(`   Pontos negativos: ${finalAnalysisResult.negativePoints?.length || 0}`);
          
          // Não criar nova versão - manter a última válida
          // NÃO atualizar lastCheckedAt para que seja reprocessada na próxima execução
          stats.processed = true;
          stats.skipped = true;
          return stats;
        }

        // 11. Salvar análise final
        const analysisId = await YouTubeAnalysisService.saveAnalysis(
          company.id,
          videoIds,
          finalAnalysisResult
        );

        console.log(`💾 ${company.ticker}: Análise salva (ID: ${analysisId})`);

        if (existingAnalysis) {
          stats.updatedAnalysis = true;
        } else {
          stats.newAnalysis = true;
        }

        // 12. Atualizar lastCheckedAt
        await YouTubeAnalysisService.updateLastChecked(company.id);
        stats.processed = true;
        return stats;
      } catch (error) {
        console.error(`❌ Erro ao processar ${company.ticker}:`, error);
        stats.error = `${company.ticker}: ${(error as Error).message}`;

        // NÃO atualizar lastCheckedAt quando há erro - não salvamos análise válida
        // A empresa será reprocessada na próxima execução
        stats.processed = true;
        return stats;
      }
    };

    // 4. Processar empresas em lotes paralelos
    for (let i = 0; i < companies.length; i += PARALLEL_BATCH_SIZE) {
      // Verificar timeout antes de processar próximo batch
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= MAX_EXECUTION_TIME) {
        console.log(
          `⏰ Tempo limite atingido (${elapsedTime}ms). Encerrando graciosamente...`
        );
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
          if (stats.newAnalysis) newAnalysesCount++;
          if (stats.updatedAnalysis) updatedAnalysesCount++;
          if (stats.skipped) skippedCount++;
          if (stats.error) errors.push(stats.error);
        } else {
          // Erro não tratado na função processCompany
          errors.push(`Erro não tratado: ${result.reason}`);
        }
      }

      // Delay entre batches (exceto no último batch)
      if (i + PARALLEL_BATCH_SIZE < companies.length) {
        console.log(`⏱️  Aguardando ${DELAY_BETWEEN_BATCHES}ms antes do próximo batch...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // 13. Resumo da execução
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);

    console.log('\n📊 ===== RESUMO DA EXECUÇÃO =====');
    console.log(`✅ Empresas processadas: ${processedCount}`);
    console.log(`🆕 Novas análises: ${newAnalysesCount}`);
    console.log(`🔄 Análises atualizadas: ${updatedAnalysesCount}`);
    console.log(`⏭️  Empresas puladas (mesmos vídeos ou copiadas): ${skippedCount}`);
    console.log(`⏱️  Tempo total: ${minutes}m ${seconds}s`);

    if (errors.length > 0) {
      console.log(`\n⚠️ Erros (${errors.length}):`);
      errors.forEach((err) => console.log(`  - ${err}`));
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job de análise do YouTube executado com sucesso',
      stats: {
        processedCount,
        newAnalysesCount,
        updatedAnalysesCount,
        skippedCount,
        errors: errors.length,
      },
      executionTime: `${minutes}m ${seconds}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Erro fatal no cron job de análise do YouTube:', error);

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

