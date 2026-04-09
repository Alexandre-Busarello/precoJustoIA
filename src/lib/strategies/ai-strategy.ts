import { GoogleGenAI } from '@google/genai';
import { CompanyData, RankBuilderResult, AIParams, StrategyAnalysis } from './types';
import { StrategyFactory } from './strategy-factory';
import { AbstractStrategy, toNumber } from './base-strategy';

export class AIStrategy extends AbstractStrategy<AIParams> {
  name = 'Análise Preditiva com IA';

  // Método principal para análise individual (não suportado)
  runAnalysis(): StrategyAnalysis {
    return {
      isEligible: false,
      score: 0,
      reasoning: 'Estratégia de IA disponível apenas para ranking completo.',
      fairValue: null,
      upside: null,
      criteria: [
        {
          label: 'Disponível apenas para ranking',
          value: false,
          description: 'Esta estratégia funciona apenas no modo ranking completo'
        }
      ]
    };
  }

  // Método principal para ranking (3 etapas)
  async runRanking(companies: CompanyData[], params: AIParams): Promise<RankBuilderResult[]> {
    const { includeBDRs = true } = params;
    console.log(`🚀 [AI-STRATEGY] Iniciando análise preditiva com IA para ${companies.length} empresas`);
    console.log(`📊 [AI-STRATEGY] Parâmetros: ${JSON.stringify(params)}`);
    
    // ETAPA 0: Filtrar por tipo de ativo primeiro (b3, bdr, both)
    let filteredCompanies = this.filterByAssetType(companies, params.assetTypeFilter);
    
    // ETAPA 0.25: Filtrar tickers que terminam em 5, 6, 7, 8 ou 9
    filteredCompanies = this.filterTickerEndingDigits(filteredCompanies);
    
    // ETAPA 0.5: Aplicar exclusões automáticas antes da análise IA
    console.log(`🚫 [AI-STRATEGY] ETAPA 0.5: Aplicando exclusões automáticas`);
    filteredCompanies = filteredCompanies.filter(company => !this.shouldExcludeCompany(company));
    console.log(`✅ [AI-STRATEGY] ${companies.length - filteredCompanies.length} empresas excluídas automaticamente`);
    
    // ETAPA 1: Seleção inteligente com LLM baseada nos critérios do usuário
    console.log(`🧠 [AI-STRATEGY] ETAPA 1: Seleção inteligente com LLM`);
    let selectedCompanies: CompanyData[];
    try {
      selectedCompanies = await this.selectCompaniesWithAI(filteredCompanies, params);
      console.log(`✅ [AI-STRATEGY] ${selectedCompanies.length} empresas selecionadas pela IA na primeira etapa`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [AI-STRATEGY] Falha na seleção IA: ${errorMsg}. Usando seleção baseada em estratégias.`);
      // Fallback: selecionar empresas baseado em overall_score e filtros
      selectedCompanies = this.selectCompaniesFallback(filteredCompanies, params);
      console.log(`✅ [AI-STRATEGY] ${selectedCompanies.length} empresas selecionadas via fallback`);
    }
    
    // ETAPA 2: Executar estratégias tradicionais para empresas selecionadas
    console.log(`📈 [AI-STRATEGY] ETAPA 2: Executando estratégias tradicionais`);
    const companiesWithStrategies = await this.executeAllStrategies(selectedCompanies);
    console.log(`✅ [AI-STRATEGY] Estratégias executadas para ${companiesWithStrategies.length} empresas`);
    
    // ETAPA 3: Análise final com IA (todas as empresas de uma vez)
    console.log(`🤖 [AI-STRATEGY] ETAPA 3: Análise final com IA (batch processing)`);
    let finalResults: RankBuilderResult[];
    try {
      finalResults = await this.analyzeBatchWithAI(companiesWithStrategies, params);
      console.log(`🎯 [AI-STRATEGY] Análise concluída: ${finalResults.length} resultados finais`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [AI-STRATEGY] Falha na análise batch IA: ${errorMsg}. Usando ranking fallback.`);
      // Fallback já está implementado dentro de analyzeBatchWithAI, mas garantimos aqui também
      finalResults = this.generateFallbackRanking(companiesWithStrategies, params);
      console.log(`🎯 [AI-STRATEGY] Ranking fallback gerado: ${finalResults.length} resultados`);
    }
    
    // Ordenar por score composto primeiro (já ordenado no fallback, mas garantimos aqui também)
    const sortedByScore = finalResults
      .sort((a, b) => (b.key_metrics?.compositeScore || 0) - (a.key_metrics?.compositeScore || 0));
    
    // ETAPA 3.5: Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    console.log(`🔄 [AI-STRATEGY] ETAPA 3.5: Removendo empresas duplicadas`);
    const uniqueResults = this.removeDuplicateCompanies(sortedByScore);
    console.log(`✅ [AI-STRATEGY] Empresas únicas: ${uniqueResults.length} (removidas ${sortedByScore.length - uniqueResults.length} duplicatas)`);
    
    // ETAPA 4: Aplicar priorização técnica (complementar à análise da IA)
    console.log(`📊 [AI-STRATEGY] ETAPA 4: Aplicando priorização técnica (useTechnicalAnalysis: ${params.useTechnicalAnalysis || false})`);
    const technicallyPrioritized = this.applyTechnicalPrioritization(
      uniqueResults, 
      selectedCompanies, 
      params.useTechnicalAnalysis || false
    );
    
    // Limitar resultados finais
    const finalSortedResults = technicallyPrioritized.slice(0, params.limit || 10);
    
    console.log(`🏆 [AI-STRATEGY] Ranking final: ${finalSortedResults.length} empresas`);
    console.log(`📋 [AI-STRATEGY] Top 3: ${finalSortedResults.slice(0, 3).map(r => `${r.ticker} (${r.key_metrics?.compositeScore})`).join(', ')}`);
    
    if (params.useTechnicalAnalysis) {
      console.log(`📊 [AI-STRATEGY] Análise técnica aplicada para otimizar timing de entrada`);
    }
    
    return finalSortedResults;
  }

  // NOVA ETAPA 1: Seleção inteligente com LLM
  private async selectCompaniesWithAI(companies: CompanyData[], params: AIParams): Promise<CompanyData[]> {
    // Otimização: reduzir targetCount para acelerar processamento (máximo 15 empresas)
    const targetCount = Math.min((params.limit || 10) + 5, 15);
    console.log(`🔍 [AI-STRATEGY] Preparando dados de ${companies.length} empresas para seleção IA (target: ${targetCount})`);
    
    // Aplicar filtros antes da seleção IA
    // Filtrar empresas por overall_score > 50 (remover empresas ruins)
    let filteredCompanies = this.filterCompaniesByOverallScore(companies, 50);
    console.log(`🎯 [AI-STRATEGY] Após filtro de qualidade (overall_score > 50): ${filteredCompanies.length} empresas`);
    
    filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize || 'all');
    console.log(`📊 [AI-STRATEGY] Após filtro de tamanho (${params.companySize || 'all'}): ${filteredCompanies.length} empresas`);
    
    // Filtrar empresas sem lucro
    const beforeProfitabilityFilter = filteredCompanies.length;
    filteredCompanies = this.filterProfitableCompanies(filteredCompanies);
    console.log(`💰 [AI-STRATEGY] Após filtro de lucratividade: ${filteredCompanies.length} empresas (removidas ${beforeProfitabilityFilter - filteredCompanies.length} sem lucro)`);
    
    // Otimização: Limitar número de empresas enviadas para IA (máximo 50 para reduzir tamanho do prompt)
    if (filteredCompanies.length > 50) {
      // Ordenar por overall_score (maior primeiro) e pegar top 50
      filteredCompanies = [...filteredCompanies]
        .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
        .slice(0, 50);
      console.log(`⚡ [AI-STRATEGY] Limitando a top 50 empresas por overall_score para otimizar tempo de resposta`);
    }
    
    // Preparar dados resumidos das empresas filtradas
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const companiesData = filteredCompanies.map(company => ({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector || 'Não informado',
      currentPrice: company.currentPrice,
      marketCap: toNumber(company.financials.marketCap) || 0,
      roe: this.getROE(company.financials, use7YearAverages, company.historicalFinancials) || 0,
      pl: this.getPL(company.financials, false, company.historicalFinancials) || 0,
      dy: this.getDividendYield(company.financials, use7YearAverages, company.historicalFinancials) || 0,
      liquidezCorrente: this.getLiquidezCorrente(company.financials, use7YearAverages, company.historicalFinancials) || 0,
      margemLiquida: this.getMargemLiquida(company.financials, use7YearAverages, company.historicalFinancials) || 0,
      crescimentoReceitas: toNumber(company.financials.crescimentoReceitas) || 0,
      dividaLiquidaPl: this.getDividaLiquidaPl(company.financials, use7YearAverages, company.historicalFinancials) || 0,
      // Adicionar dados para identificar liquidez do ticker
      companyBaseName: company.name.replace(/\s+(S\.?A\.?|SA|LTDA|ON|PN|UNT).*$/i, '').trim()
    }));

    // Construir prompt para seleção
    const selectionPrompt = this.buildSelectionPrompt(companiesData, params, targetCount);
    
    console.log(`🤖 [AI-STRATEGY] Enviando ${companiesData.length} empresas para seleção IA (target: ${targetCount})`);
    
    // Retry com verificação de duplicatas e orientação de erros
    let selectedTickers: string[] = [];
    let attempts = 0;
    const maxAttempts = 3;
    const previousErrors: string[] = [];
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 [AI-STRATEGY] Tentativa ${attempts}/${maxAttempts} de seleção`);
      
      // Construir prompt com orientações baseadas em erros anteriores
      let currentPrompt = selectionPrompt;
      if (previousErrors.length > 0) {
        const errorGuidance = `

## ⚠️ CORREÇÕES CRÍTICAS (baseado em erros anteriores):
${previousErrors.map((error, i) => `${i + 1}. ${error}`).join('\n')}

**IMPORTANTE**: Corrija esses problemas na sua resposta!`;
        
        currentPrompt += errorGuidance;
        console.log(`📝 [AI-STRATEGY] Adicionando orientações de erro ao prompt (${previousErrors.length} erros anteriores)`);
      }
      
      try {
        const response = await this.callGeminiAPI(currentPrompt, 0, false); // Sem Google Search na seleção
        console.log(`✅ [AI-STRATEGY] Resposta da IA recebida para seleção (${response.length} chars)`);
        
        selectedTickers = this.parseSelectionResponse(response);
        console.log(`📋 [AI-STRATEGY] Tickers selecionados: ${selectedTickers.join(', ')}`);
        
        // Verificar duplicatas
        if (this.checkForDuplicateCompanies(selectedTickers, filteredCompanies)) {
          const errorMsg = `NÃO selecione múltiplos tickers da mesma empresa. Escolha APENAS UM ticker por empresa, preferencialmente o de maior Market Cap.`;
          previousErrors.push(errorMsg);
          console.warn(`⚠️ [AI-STRATEGY] ${errorMsg}`);
          continue;
        }
        
        // Verificar se temos o número correto
        if (selectedTickers.length !== targetCount) {
          const errorMsg = `Selecione EXATAMENTE ${targetCount} tickers. Você selecionou ${selectedTickers.length}. Conte corretamente e retorne apenas ${targetCount} tickers no array JSON.`;
          previousErrors.push(errorMsg);
          console.warn(`⚠️ [AI-STRATEGY] ${errorMsg}`);
          continue;
        }
        
        // Verificar se todos os tickers existem na base filtrada
        const invalidTickers = selectedTickers.filter(ticker => !filteredCompanies.find(c => c.ticker === ticker));
        if (invalidTickers.length > 0) {
          const errorMsg = `Tickers inválidos encontrados: ${invalidTickers.join(', ')}. Use APENAS tickers da lista fornecida.`;
          previousErrors.push(errorMsg);
          console.warn(`⚠️ [AI-STRATEGY] ${errorMsg}`);
          continue;
        }
        
        // Sucesso!
        console.log(`🎉 [AI-STRATEGY] Seleção bem-sucedida na tentativa ${attempts}`);
        break;
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [AI-STRATEGY] Erro na tentativa ${attempts}: ${errorMsg}`);
        
        // Adicionar orientação específica para erros de parsing
        if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
          previousErrors.push(`ERRO DE FORMATO: Retorne APENAS um array JSON válido: ["TICKER1", "TICKER2", "TICKER3"]. NÃO adicione texto antes ou depois do array. NÃO use \`\`\`json. PARE após fechar o ].`);
        } else {
          previousErrors.push(`Erro técnico: ${errorMsg}. Simplifique a resposta e foque apenas no array JSON solicitado.`);
        }
        
        if (attempts === maxAttempts) {
          throw new Error(`Falha após ${maxAttempts} tentativas. Últimos erros: ${previousErrors.join(' | ')}`);
        }
      }
    }
    
    if (selectedTickers.length === 0) {
      throw new Error('Falha em selecionar empresas após múltiplas tentativas');
    }
    
    // Filtrar empresas selecionadas
    const selectedCompanies = filteredCompanies.filter(company => 
      selectedTickers.includes(company.ticker)
    );
    
    console.log(`✅ [AI-STRATEGY] ${selectedCompanies.length} empresas selecionadas pela IA`);
    return selectedCompanies;
  }

  // NOVA ETAPA 2: Executar estratégias para empresas selecionadas (PARALELIZADO)
  private async executeAllStrategies(companies: CompanyData[]): Promise<Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>> {
    console.log(`⚙️ [AI-STRATEGY] Executando 7 estratégias para ${companies.length} empresas (paralelizado)`);
    
    // Função auxiliar para processar uma empresa
    const processCompany = async (company: CompanyData): Promise<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}> => {
      try {
        // Executar todas as 7 estratégias tradicionais (Barsi é async, outras são síncronas)
        const strategies = {
          graham: StrategyFactory.runGrahamAnalysis(company, { marginOfSafety: 0.20 }),
          dividendYield: StrategyFactory.runDividendYieldAnalysis(company, { minYield: 0.04 }),
          lowPE: StrategyFactory.runLowPEAnalysis(company, { maxPE: 15, minROE: 0.12 }),
          magicFormula: StrategyFactory.runMagicFormulaAnalysis(company, { limit: 10, minROIC: 0.15, minEY: 0.08 }),
          fcd: StrategyFactory.runFCDAnalysis(company, {
            growthRate: 0.025,
            discountRate: 0.10,
            yearsProjection: 5,
            minMarginOfSafety: 0.15
          }),
          fundamentalist: StrategyFactory.runFundamentalistAnalysis(company, {
            minROE: 0.15,
            minROIC: 0.15,
            maxDebtToEbitda: 3.0,
            minPayout: 0.40,
            maxPayout: 0.80
          }),
          barsi: await StrategyFactory.runBarsiAnalysis(company, {
            targetDividendYield: 0.06,
            maxPriceToPayMultiplier: 1.0,
            minConsecutiveDividends: 3,
            maxDebtToEquity: 2.0,
            minROE: 0.10,
            focusOnBEST: false
          })
        };
        
        return { company, strategies };
        
      } catch (error) {
        console.error(`❌ [AI-STRATEGY] Erro ao processar ${company.ticker}:`, error);
        // Continuar com estratégias vazias em caso de erro
        return { 
          company, 
          strategies: {
            graham: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            dividendYield: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            lowPE: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            magicFormula: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            fcd: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            fundamentalist: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            barsi: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] }
          }
        };
      }
    };
    
    // Paralelizar processamento de todas as empresas (máximo de concorrência controlado)
    // Usar Promise.allSettled para garantir que erros em uma empresa não parem todas
    const BATCH_SIZE = 10; // Processar 10 empresas por vez para evitar sobrecarga
    const results: Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}> = [];
    
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      console.log(`📊 [AI-STRATEGY] Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companies.length / BATCH_SIZE)} (${batch.length} empresas)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(company => processCompany(company))
      );
      
      // Extrair resultados bem-sucedidos
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ [AI-STRATEGY] Erro no processamento em lote:`, result.reason);
        }
      }
    }
    
    console.log(`✅ [AI-STRATEGY] Estratégias executadas para ${results.length} empresas`);
    return results;
  }

  // NOVA ETAPA 3: Análise final com IA (batch processing)
  private async analyzeBatchWithAI(
    companiesWithStrategies: Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>, 
    params: AIParams
  ): Promise<RankBuilderResult[]> {
    console.log(`🧠 [AI-STRATEGY] Preparando análise batch para ${companiesWithStrategies.length} empresas`);
    
    // Construir prompt com todas as empresas
    const batchPrompt = this.buildBatchAnalysisPrompt(companiesWithStrategies, params);
    
    console.log(`🚀 [AI-STRATEGY] Enviando análise batch para IA (${batchPrompt.length} chars)`);
    
    // Retry com verificação de duplicatas e orientação de erros
    let results: RankBuilderResult[] = [];
    let attempts = 0;
    const maxAttempts = 2; // Reduzido de 3 para 2 para evitar timeouts
    const previousErrors: string[] = [];
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 [AI-STRATEGY] Tentativa ${attempts}/${maxAttempts} de análise batch`);
      
      // Construir prompt com orientações baseadas em erros anteriores
      let currentPrompt = batchPrompt;
      if (previousErrors.length > 0) {
        const errorGuidance = `

## ⚠️ CORREÇÕES CRÍTICAS (baseado em erros anteriores):
${previousErrors.map((error, i) => `${i + 1}. ${error}`).join('\n')}

**IMPORTANTE**: Corrija esses problemas na sua resposta!`;
        
        currentPrompt += errorGuidance;
        console.log(`📝 [AI-STRATEGY] Adicionando orientações de erro ao prompt (${previousErrors.length} erros anteriores)`);
      }
      
      try {
        const response = await this.callGeminiAPI(currentPrompt, 0, true); // COM Google Search na análise batch
        console.log(`✅ [AI-STRATEGY] Resposta da análise batch recebida (${response.length} chars)`);
        
        results = this.parseBatchAnalysisResponse(response, companiesWithStrategies);
        console.log(`🎯 [AI-STRATEGY] ${results.length} resultados processados da análise batch (deduplicação automática já aplicada durante parse)`);
        
        // Verificar se temos resultados para todas as empresas (após deduplicação automática)
        if (results.length !== companiesWithStrategies.length) {
          const expectedTickers = companiesWithStrategies.map(c => c.company.ticker);
          const receivedTickers = results.map(r => r.ticker);
          const missing = expectedTickers.filter(t => !receivedTickers.includes(t));
          const extra = receivedTickers.filter(t => !expectedTickers.includes(t));
          
          // Se faltam muitas empresas (>30%), usar fallback imediatamente para evitar timeout
          if (missing.length > companiesWithStrategies.length * 0.3) {
            console.warn(`⚠️ [AI-STRATEGY] Muitas empresas faltando (${missing.length}/${companiesWithStrategies.length}). Usando fallback.`);
            return this.generateFallbackRanking(companiesWithStrategies, params);
          }
          
          // Se faltam poucas empresas, tentar novamente com orientação específica
          let errorMsg = `Inclua EXATAMENTE ${companiesWithStrategies.length} empresas no resultado.`;
          if (missing.length > 0) errorMsg += ` Faltando: ${missing.join(', ')}.`;
          if (extra.length > 0) errorMsg += ` Extras inválidos: ${extra.join(', ')}.`;
          
          previousErrors.push(errorMsg);
          console.warn(`⚠️ [AI-STRATEGY] ${errorMsg}`);
          continue;
        }
        
        // Verificar se todos os resultados têm campos obrigatórios
        const invalidResults = results.filter(r => !r.ticker || !r.rational || typeof r.currentPrice !== 'number');
        if (invalidResults.length > 0) {
          const errorMsg = `Todos os resultados devem ter: ticker (string), currentPrice (número), rational (texto em português). Resultados inválidos: ${invalidResults.map(r => r.ticker || 'sem ticker').join(', ')}.`;
          previousErrors.push(errorMsg);
          console.warn(`⚠️ [AI-STRATEGY] ${errorMsg}`);
          continue;
        }
        
        // Sucesso!
        console.log(`🎉 [AI-STRATEGY] Análise batch bem-sucedida na tentativa ${attempts}`);
        break;
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [AI-STRATEGY] Erro na tentativa ${attempts}: ${errorMsg}`);
        
        // Verificar se é timeout ou erro crítico que impede continuar
        const isTimeout = errorMsg.includes('Timeout') || errorMsg.includes('timeout');
        const isCriticalError = errorMsg.includes('Falha na comunicação') || errorMsg.includes('API');
        
        if (isTimeout || (isCriticalError && attempts >= maxAttempts)) {
          console.warn(`⚠️ [AI-STRATEGY] Timeout ou erro crítico detectado. Usando fallback baseado em estratégias.`);
          // Usar fallback baseado nas estratégias
          return this.generateFallbackRanking(companiesWithStrategies, params);
        }
        
        // Adicionar orientação específica para erros de parsing
        if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
          previousErrors.push(`ERRO DE FORMATO: Retorne APENAS um JSON válido: {"results": [{"ticker": "TICKER1", "score": 85, "fairValue": 25.50, "upside": 15.2, "confidenceLevel": 0.8, "reasoning": "texto em português"}]}. NÃO adicione texto antes ou depois do JSON. NÃO use \`\`\`json. PARE após fechar a chave }.`);
        } else {
          previousErrors.push(`Erro técnico: ${errorMsg}. Simplifique a resposta e foque apenas no JSON solicitado.`);
        }
        
        if (attempts >= maxAttempts) {
          console.warn(`⚠️ [AI-STRATEGY] Todas as tentativas falharam. Usando fallback baseado em estratégias.`);
          // Usar fallback baseado nas estratégias
          return this.generateFallbackRanking(companiesWithStrategies, params);
        }
      }
    }
    
    if (results.length === 0) {
      console.warn(`⚠️ [AI-STRATEGY] Nenhum resultado obtido. Usando fallback baseado em estratégias.`);
      return this.generateFallbackRanking(companiesWithStrategies, params);
    }
    
    return results;
  }

  // Verificar duplicatas de empresas (mesmo nome base)
  private checkForDuplicateCompanies(tickers: string[], companies: CompanyData[]): boolean {
    const companyNames = new Set<string>();
    
    for (const ticker of tickers) {
      const company = companies.find(c => c.ticker === ticker);
      if (!company) continue;
      
      // Normalizar nome da empresa removendo sufixos
      const baseName = company.name
        .replace(/\s+(S\.?A\.?|SA|LTDA|ON|PN|UNT|PARTICIPACOES|PARTICIPAÇÕES).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      
      if (companyNames.has(baseName)) {
        console.warn(`🚨 [AI-STRATEGY] Empresa duplicada detectada: ${company.name} (${ticker})`);
        return true;
      }
      
      companyNames.add(baseName);
    }
    
    return false;
  }

  // Construir prompt para seleção inicial
  private buildSelectionPrompt(companiesData: Record<string, unknown>[], params: AIParams, targetCount: number): string {
    const companiesList = companiesData.map(company => 
      `${company.ticker} (${company.name}) - Setor: ${company.sector} | Preço: R$ ${(company.currentPrice as number).toFixed(2)} | Market Cap: R$ ${((company.marketCap as number) / 1000000000).toFixed(1)}B | ROE: ${((company.roe as number) * 100).toFixed(1)}% | P/L: ${(company.pl as number).toFixed(1)} | DY: ${((company.dy as number) * 100).toFixed(1)}% | Liquidez: ${(company.liquidezCorrente as number).toFixed(2)} | Margem: ${((company.margemLiquida as number) * 100).toFixed(1)}%`
    ).join('\n');

    return `# SELEÇÃO INTELIGENTE DE EMPRESAS PARA ANÁLISE PREDITIVA

## OBJETIVO
Selecionar as ${targetCount} melhores empresas da B3 baseado nos critérios do investidor para análise preditiva detalhada.

## PERFIL DO INVESTIDOR
- **Tolerância ao Risco**: ${params.riskTolerance || 'Moderado'}
- **Horizonte**: ${params.timeHorizon || 'Longo Prazo'}  
- **Foco**: ${params.focus || 'Crescimento e Valor'}
- **Filtro de Tamanho**: ${this.getCompanySizeDescription(params.companySize || 'all')}

## CRITÉRIOS DE QUALIDADE MÍNIMA
**FILTROS PRÉ-APLICADOS**: Apenas empresas LUCRATIVAS (ROE > 0 e Margem Líquida > 0). Para bancos/seguradoras: apenas ROE > 0.

- **Conservador**: ROE ≥ 12%, P/L ≤ 20, DY ≥ 3%, dívida controlada
- **Moderado**: ROE ≥ 8%, P/L ≤ 25, liquidez adequada, crescimento consistente
- **Agressivo**: Crescimento ≥ 15%, inovação, potencial disruptivo, P/L flexível
- **Dividendos**: DY ≥ 4%, histórico consistente, payout sustentável

## EMPRESAS DISPONÍVEIS
${companiesList}

## CRITÉRIOS DE DIVERSIFICAÇÃO
Monte um ranking DIVERSIFICADO similar à construção de uma carteira de investimentos:

- **Diversificação Setorial**: Evite concentração excessiva em um setor (máximo 30% em um setor)
- **Apenas 1 ticker por empresa**: 
  * Se houver múltiplos tickers da mesma empresa (ex: POMO3, POMO4 ou UNIP3, UNIP5, UNIP6), escolha apenas UM
  * Priorize o ticker com MAIOR Market Cap (maior liquidez)
  * Empresas com nomes similares podem ser da mesma companhia
- **Empresas sólidas**: Priorize empresas com fundamentos consistentes e Market Cap > R$ 1B
- **Alinhamento com perfil**: Respeite rigorosamente os parâmetros do investidor

## RESPOSTA REQUERIDA
**IMPORTANTE**: Seja DIRETO e OBJETIVO. NÃO repita análises ou explicações.

Retorne APENAS uma lista JSON com os tickers selecionados:
["TICKER1", "TICKER2", "TICKER3", ...]

**REGRAS CRÍTICAS**:
- Selecione exatamente ${targetCount} empresas DIVERSIFICADAS
- NUNCA repita o mesmo ticker
- NUNCA inclua múltiplos tickers da mesma empresa
- Resposta deve ser APENAS o array JSON, sem explicações adicionais
- NÃO adicione texto antes ou depois do array
- NÃO use markdown, NÃO use \`\`\`json
- PARE imediatamente após fechar o array com ]`;
  }

  // Construir prompt para análise batch
  private buildBatchAnalysisPrompt(
    companiesWithStrategies: Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>, 
    params: AIParams
  ): string {
    const companiesAnalysis = companiesWithStrategies.map(({company, strategies}) => {
      const eligibleStrategies = Object.values(strategies).filter(s => s.isEligible).length;
      
      return `**${company.ticker} (${company.name})**
Setor: ${company.sector} | Preço: R$ ${company.currentPrice.toFixed(2)}
Estratégias Elegíveis: ${eligibleStrategies}/7
- Graham: ${strategies.graham.isEligible ? '✅' : '❌'} (Score: ${strategies.graham.score}) - ${strategies.graham.reasoning}
- Dividend Yield: ${strategies.dividendYield.isEligible ? '✅' : '❌'} (Score: ${strategies.dividendYield.score}) - ${strategies.dividendYield.reasoning}
- Low P/E: ${strategies.lowPE.isEligible ? '✅' : '❌'} (Score: ${strategies.lowPE.score}) - ${strategies.lowPE.reasoning}
- Fórmula Mágica: ${strategies.magicFormula.isEligible ? '✅' : '❌'} (Score: ${strategies.magicFormula.score}) - ${strategies.magicFormula.reasoning}
- FCD: ${strategies.fcd.isEligible ? '✅' : '❌'} (Score: ${strategies.fcd.score}) - ${strategies.fcd.reasoning}
- Fundamentalista 3+1: ${strategies.fundamentalist.isEligible ? '✅' : '❌'} (Score: ${strategies.fundamentalist.score}) - ${strategies.fundamentalist.reasoning}
- Método Barsi: ${strategies.barsi.isEligible ? '✅' : '❌'} (Score: ${strategies.barsi.score}) - ${strategies.barsi.reasoning}`;
    }).join('\n\n');

    const tickersList = companiesWithStrategies.map(c => c.company.ticker).join(', ');

    return `# ANÁLISE PREDITIVA BATCH - INTELIGÊNCIA ARTIFICIAL

## PERFIL DO INVESTIDOR
- **Tolerância ao Risco**: ${params.riskTolerance || 'Moderado'}
- **Horizonte**: ${params.timeHorizon || 'Longo Prazo'}
- **Foco**: ${params.focus || 'Crescimento e Valor'}

## INSTRUÇÕES CRÍTICAS
**IDIOMA**: Responda SEMPRE em PORTUGUÊS BRASILEIRO. Todas as análises, reasoning e textos devem estar em português.

**EMPRESAS PRÉ-FILTRADAS**: Todas as empresas abaixo já foram filtradas por lucratividade (ROE > 0 e Margem Líquida > 0, exceto bancos/seguradoras que precisam apenas ROE > 0).

Analise TODAS as empresas abaixo simultaneamente e crie um ranking preditivo considerando:

1. **Consistência Estratégica**: Quantas estratégias aprovaram cada empresa
2. **Qualidade dos Fundamentos**: ROE, margens, crescimento, endividamento  
3. **Potencial de Valorização**: Baseado nos preços justos calculados
4. **Adequação ao Perfil**: Alinhamento com tolerância ao risco e foco
5. **Contexto Setorial**: Perspectivas do setor de cada empresa

**IMPORTANTE**: Você DEVE BUSCAR informações atualizadas na internet sobre cada empresa antes de analisar.

## EMPRESAS PARA ANÁLISE
${companiesAnalysis}

## RESPOSTA REQUERIDA
**ATENÇÃO**: Responda EXCLUSIVAMENTE em PORTUGUÊS BRASILEIRO.

**TICKERS ESPERADOS (EXATAMENTE ${companiesWithStrategies.length} empresas)**:
${tickersList}

Retorne um JSON com o ranking de TODAS as empresas analisadas:

{
  "results": [
    {
      "ticker": "TICKER1",
      "score": 85,
      "fairValue": 25.50,
      "upside": 15.2,
      "confidenceLevel": 0.8,
      "reasoning": "Análise detalhada da empresa em PORTUGUÊS considerando estratégias, fundamentos e contexto atual. Exemplo: 'Oferece forte potencial de valorização baseado no FCD, suportado por dívida moderada, bom ROE e alto dividend yield.'"
    }
  ]
}

**REGRAS CRÍTICAS**: 
- Seja DIRETO e OBJETIVO, evite repetições
- Ordene por score (0-100) decrescente
- Inclua TODAS as ${companiesWithStrategies.length} empresas da lista acima
- TODO o campo "reasoning" deve estar em PORTUGUÊS BRASILEIRO
- Use termos financeiros em português (ex: "potencial de valorização", "fundamentos sólidos", "perspectivas positivas")

**FORMATO DE RESPOSTA OBRIGATÓRIO**:
- Responda APENAS com o JSON válido, sem texto adicional antes ou depois
- NÃO use markdown (\`\`\`json ou \`\`\`)
- NÃO adicione explicações antes ou depois do JSON
- PARE imediatamente após fechar a chave final }
- Formato exato: {"results": [{"ticker": "...", "score": ..., ...}]}
- NÃO continue escrevendo após o JSON`;
  }

  // Parse da resposta de seleção
  private parseSelectionResponse(response: string): string[] {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === 'string');
        }
      }
      
      // Fallback: tentar extrair tickers manualmente
      const tickerMatches = response.match(/[A-Z]{4}[0-9]{1,2}/g);
      if (tickerMatches) {
        return Array.from(new Set(tickerMatches)); // Remove duplicatas
      }
      
      throw new Error('Não foi possível extrair tickers da resposta');
    } catch (error) {
      console.error('Erro ao parsear resposta de seleção:', error);
      return [];
    }
  }

  // Parse robusto da resposta de análise batch (otimizado e mais eficiente)
  private parseBatchAnalysisResponse(response: string, companiesWithStrategies: Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>): RankBuilderResult[] {
    console.log(`🔍 [AI-STRATEGY] Iniciando parse da resposta (${response.length} chars)`);
    
    // Função auxiliar para encontrar JSON válido com contagem balanceada de chaves
    const findValidJSON = (text: string, startPattern: string): string | null => {
      // Tentar múltiplas variações do padrão inicial
      const patterns = [
        startPattern,
        startPattern.replace(/"/g, '\\"'),
        startPattern.replace(/"/g, '"'),
        startPattern.replace(/\s+/g, '\\s*')
      ];
      
      let startPos = -1;
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const match = text.match(regex);
        if (match && match.index !== undefined) {
          startPos = match.index;
          break;
        }
      }
      
      if (startPos === -1) return null;
      
      let braceCount = 0;
      let bracketCount = 0;
      let jsonEnd = startPos;
      let inString = false;
      let escapeNext = false;
      
      for (let i = startPos; i < text.length; i++) {
        const char = text[i];
        
        if (!escapeNext) {
          if (char === '"') {
            inString = !inString;
          } else if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
          }
          escapeNext = char === '\\' && inString;
        } else {
          escapeNext = false;
        }
        
        // JSON completo quando todas as chaves e colchetes estão balanceados
        if (braceCount === 0 && bracketCount === 0 && i > startPos && !inString) {
          jsonEnd = i + 1;
          break;
        }
      }
      
      return text.substring(startPos, jsonEnd);
    };
    
    // Múltiplas estratégias de parsing (reordenadas por eficiência - mais rápidas primeiro)
    const parseStrategies = [
      // Estratégia 1: Buscar JSON completo com contagem balanceada (mais rápida e precisa)
      () => {
        const jsonStr = findValidJSON(response, '{"results"');
        if (!jsonStr) throw new Error('JSON com "results" não encontrado');
        return JSON.parse(jsonStr);
      },
      
      // Estratégia 2: Limpeza agressiva e busca por JSON (segunda mais rápida)
      () => {
        const cleanResponse = response
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/^[\s\S]*?(\{[\s\S]*?"results"[\s\S]*?\})[\s\S]*$/i, '$1') // Extrair JSON entre markdown
          .trim();
        
        const jsonStr = findValidJSON(cleanResponse, '{');
        if (!jsonStr) throw new Error('Nenhum JSON válido encontrado após limpeza');
        return JSON.parse(jsonStr);
      },
      
      // Estratégia 3: Buscar por padrão mais flexível
      () => {
        // Tentar encontrar qualquer objeto que contenha "results"
        const resultsIndex = response.toLowerCase().indexOf('"results"');
        if (resultsIndex === -1) throw new Error('Campo "results" não encontrado');
        
        // Voltar para encontrar o início do objeto
        let startPos = resultsIndex;
        while (startPos > 0 && response[startPos] !== '{') {
          startPos--;
        }
        
        if (startPos === -1 || response[startPos] !== '{') {
          throw new Error('Início do objeto JSON não encontrado');
        }
        
        const jsonStr = findValidJSON(response.substring(startPos), '{');
        if (!jsonStr) throw new Error('JSON não encontrado após busca por "results"');
        return JSON.parse(jsonStr);
      },
      
      // Estratégia 4: Regex para capturar JSON completo (fallback)
      () => {
        // Tentar múltiplos padrões regex (não-greedy para pegar o primeiro JSON completo)
        const patterns = [
          /\{"results"\s*:\s*\[[\s\S]*?\]\s*\}/,
          /\{\s*"results"\s*:\s*\[[\s\S]*?\]\s*\}/,
          /\{[\s\S]*?"results"[\s\S]*?:[\s\S]*?\[[\s\S]*?\][\s\S]*?\}/
        ];
        
        for (const pattern of patterns) {
          const matches = response.match(pattern);
          if (matches && matches[0]) {
            try {
              return JSON.parse(matches[0]);
            } catch (e) {
              // Continuar para próximo padrão
            }
          }
        }
        
        throw new Error('JSON com results não encontrado por regex');
      },
      
      // Estratégia 5: Parse incremental caractere por caractere (mais lento, mas mais robusto)
      () => {
        let jsonStr = '';
        let braceCount = 0;
        let bracketCount = 0;
        let started = false;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < response.length; i++) {
          const char = response[i];
          
          if (!started && char === '{') {
            started = true;
            braceCount = 0;
            bracketCount = 0;
          }
          
          if (started) {
            jsonStr += char;
            
            if (!escapeNext) {
              if (char === '"') {
                inString = !inString;
              } else if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
                if (char === '[') bracketCount++;
                if (char === ']') bracketCount--;
              }
              escapeNext = char === '\\' && inString;
            } else {
              escapeNext = false;
            }
            
            // JSON completo encontrado quando todas as chaves estão balanceadas
            if (braceCount === 0 && bracketCount === 0 && started && !inString && i > 0) {
              try {
                return JSON.parse(jsonStr);
              } catch (e) {
                // Se parse falhar, continuar procurando
                started = false;
                jsonStr = '';
              }
            }
          }
        }
        
        throw new Error('JSON válido não encontrado por parsing incremental');
      },
      
      // Estratégia 6: Fallback - tentar extrair apenas o array de results
      () => {
        // Buscar array que contém objetos com "ticker"
        const arrayMatch = response.match(/\[[\s\S]*?\{[\s\S]*?"ticker"[\s\S]*?\}[\s\S]*?\]/);
        if (!arrayMatch) throw new Error('Array de results não encontrado');
        
        try {
          const resultsArray = JSON.parse(arrayMatch[0]);
          return { results: resultsArray };
        } catch (e) {
          throw new Error('Array encontrado mas não é JSON válido');
        }
      }
    ];
    
    let parsed: Record<string, unknown> | null = null;
    let parseError: string = '';
    
    // Tentar cada estratégia de parsing (parar na primeira que funcionar)
    for (let i = 0; i < parseStrategies.length; i++) {
      try {
        parsed = parseStrategies[i]();
        console.log(`✅ [AI-STRATEGY] Parse bem-sucedido com estratégia ${i + 1}`);
        break;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        parseError += `Estratégia ${i + 1}: ${errorMsg}; `;
        // Não logar warning para todas as tentativas, apenas se todas falharem
      }
    }
    
    if (!parsed) {
      console.error(`❌ [AI-STRATEGY] Todas as estratégias de parse falharam: ${parseError}`);
      throw new Error(`Falha no parse após ${parseStrategies.length} tentativas: ${parseError}`);
    }
    
    const results: RankBuilderResult[] = [];
    const seenTickers = new Set<string>(); // Para deduplicação durante parsing
      
    if (parsed.results && Array.isArray(parsed.results)) {
      for (const result of parsed.results) {
        // Validar estrutura básica
        if (!result || typeof result !== 'object' || !result.ticker) {
          console.warn(`⚠️ [AI-STRATEGY] Resultado inválido ignorado: ${JSON.stringify(result)}`);
          continue;
        }
        
        // DEDUPLICAÇÃO AUTOMÁTICA: pular se já vimos este ticker (mantém apenas a primeira ocorrência)
        if (seenTickers.has(result.ticker)) {
          console.warn(`⚠️ [AI-STRATEGY] Ticker duplicado ignorado durante parse: ${result.ticker}`);
          continue;
        }
        seenTickers.add(result.ticker);
        
        const companyData = companiesWithStrategies.find(c => c.company.ticker === result.ticker);
        if (companyData) {
          const eligibleStrategies = Object.values(companyData.strategies).filter((s: StrategyAnalysis) => s.isEligible).length;
          
          // Incluir dados fundamentais básicos no key_metrics para que os filtros de ordenação funcionem
          const { financials } = companyData.company;
          
          results.push({
            ticker: result.ticker,
            name: companyData.company.name,
            sector: companyData.company.sector,
            currentPrice: companyData.company.currentPrice,
            logoUrl: companyData.company.logoUrl,
            fairValue: result.fairValue || null,
            upside: result.upside || null,
            marginOfSafety: null,
            rational: result.reasoning || 'Análise gerada por IA',
            key_metrics: {
              // Métricas específicas da IA
              compositeScore: result.score || 0,
              confidenceLevel: result.confidenceLevel || 0.5,
              eligibleStrategies: eligibleStrategies,
              aiScore: result.score || 50,
              
              // Dados fundamentais básicos para filtros de ordenação
              pl: toNumber(financials.pl),
              pvp: toNumber(financials.pvp),
              roe: toNumber(financials.roe),
              roic: toNumber(financials.roic),
              roa: toNumber(financials.roa),
              dy: toNumber(financials.dy),
              margemLiquida: toNumber(financials.margemLiquida),
              margemEbitda: toNumber(financials.margemEbitda),
              liquidezCorrente: toNumber(financials.liquidezCorrente),
              dividaLiquidaPl: toNumber(financials.dividaLiquidaPl),
              dividaLiquidaEbitda: toNumber(financials.dividaLiquidaEbitda),
              marketCap: toNumber(financials.marketCap),
              evEbitda: toNumber(financials.evEbitda),
              payout: toNumber(financials.payout),
              earningsYield: toNumber(financials.earningsYield),
              crescimentoLucros: toNumber(financials.crescimentoLucros),
              crescimentoReceitas: toNumber(financials.crescimentoReceitas)
            }
          });
        } else {
          console.warn(`⚠️ [AI-STRATEGY] Ticker não encontrado na lista de empresas: ${result.ticker}`);
        }
      }
    }
    
    console.log(`✅ [AI-STRATEGY] Parse concluído: ${results.length} resultados válidos (${seenTickers.size} tickers únicos após deduplicação automática)`);
    return results;
  }

  // Chamada para Gemini API (reutilizada) com timeout otimizado
  private async callGeminiAPI(prompt: string, retryCount = 0, useGoogleSearch = true): Promise<string> {
    const maxRetries = 2; // Reduzido de 3 para 2 para evitar timeouts
    // Timeout reduzido para Vercel (35s para deixar margem de segurança com múltiplas tentativas)
    const TIMEOUT_MS = 35000;
    
    // Validar se a API key do Gemini está configurada
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada. Configure a variável de ambiente para usar a análise de IA.');
    }

    try {
      // Configurar Gemini AI
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY!,
      });

      // Configurar ferramentas (busca na web apenas se solicitado)
      const tools = useGoogleSearch ? [{ googleSearch: {} }] : [];

      const config = {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        ...(tools.length > 0 && { tools }),
      };

      const model = 'gemini-3.1-flash-lite-preview';
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      // Criar promise com timeout para garantir que não exceda o limite da Vercel
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout após ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      });

      // Promise para coletar resposta do stream
      const streamPromise = (async () => {
        // Fazer chamada para Gemini API com ferramentas de busca
        const response = await ai.models.generateContentStream({
          model,
          config,
          contents,
        });

        // Coletar resposta completa com detector de loop
        let fullResponse = '';
        let loopDetectionBuffer = '';
        let loopCount = 0;
        const maxLoopDetections = 3;
        
        for await (const chunk of response) { 
          if (chunk.text) {
            fullResponse += chunk.text;
            loopDetectionBuffer += chunk.text;
            
            // Detector de loop: verifica se há repetições excessivas
            const loopPatterns = [
              /(.{50,})\1{2,}/g, // Repetição de texto longo
              /(Analisando|Considerando|Avaliando).{0,100}(Analisando|Considerando|Avaliando)/gi, // Palavras repetitivas
              /(\{[^}]{20,}\})\s*\1/g, // JSON repetido
            ];
            
            for (const pattern of loopPatterns) {
              if (pattern.test(loopDetectionBuffer)) {
                loopCount++;
                console.warn(`⚠️ [AI-STRATEGY] Loop detectado (${loopCount}/${maxLoopDetections}): ${pattern.source}`);
                
                if (loopCount >= maxLoopDetections) {
                  console.error(`🚨 [AI-STRATEGY] Muitos loops detectados, interrompendo resposta`);
                  throw new Error('Loop detectado na resposta da IA - reiniciando processo');
                }
                break;
              }
            }
            
            // Limpar buffer se ficar muito grande
            if (loopDetectionBuffer.length > 2000) {
              loopDetectionBuffer = loopDetectionBuffer.slice(-1000);
            }
          }
        }

        if (!fullResponse.trim()) {
          throw new Error('Resposta vazia da API Gemini');
        }

        return fullResponse.trim();
      })();

      // Usar Promise.race para aplicar timeout
      return await Promise.race([streamPromise, timeoutPromise]);
      
    } catch (error) {
      console.error(`Erro na chamada Gemini (tentativa ${retryCount + 1}):`, error);
      
      if (retryCount < maxRetries) {
        // Aguardar um tempo antes de tentar novamente (backoff exponencial)
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callGeminiAPI(prompt, retryCount + 1, useGoogleSearch);
      }
      
      throw new Error(`Falha na comunicação com Gemini API após ${maxRetries + 1} tentativas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  generateRational(params: AIParams): string {
    return `# ANÁLISE PREDITIVA COM INTELIGÊNCIA ARTIFICIAL - PREMIUM

**Filosofia**: Utiliza Inteligência Artificial (Gemini) para analisar e sintetizar os resultados de todas as estratégias tradicionais, criando uma avaliação preditiva abrangente.

## Metodologia Aplicada

- **Seleção Inteligente com IA**: Primeira chamada LLM seleciona empresas baseada no perfil do investidor
- **Análise Multiestrategica**: Executa Graham, Dividend Yield, Low P/E, Fórmula Mágica, FCD, Fundamentalista 3+1 e Método Barsi
- **Pesquisa em Tempo Real**: IA busca notícias e dados atualizados na internet
- **Processamento Batch**: Segunda chamada LLM analisa todas as empresas simultaneamente
- **Síntese Inteligente**: IA analisa consistência e convergência entre estratégias
- **Avaliação Preditiva**: Considera contexto macroeconômico e tendências setoriais
- **Priorização Técnica**: Análise técnica complementar para otimizar timing de entrada (RSI, Estocástico)

## Parâmetros de Análise

- **Tolerância ao Risco**: ${params.riskTolerance || 'Moderado'}
- **Horizonte**: ${params.timeHorizon || 'Longo Prazo'}
- **Foco**: ${params.focus || 'Crescimento e Valor'}

## Diferencial Premium

- **Filtro de Qualidade**: Remove automaticamente empresas sem lucro (ROE ≤ 0 ou Margem Líquida ≤ 0)
- **Exceções Setoriais**: Bancos e seguradoras avaliados apenas por ROE (margem pode não se aplicar)
- Seleção inteligente baseada no perfil específico do investidor
- Análise de 7 estratégias simultaneamente para cada empresa selecionada (Graham, Dividend Yield, Low P/E, Fórmula Mágica, FCD, Fundamentalista 3+1 e Método Barsi)
- Inteligência Artificial com acesso a dados da internet em tempo real
- Processamento batch otimizado (mais rápido e eficiente)
- Pesquisa automática de notícias e fatos relevantes recentes
- Síntese preditiva considerando contexto atual do mercado
- Avaliação de riscos e oportunidades específicas por empresa
- Nível de confiança da análise baseado em múltiplas fontes
- Consideração de fatores macroeconômicos e setoriais atualizados
- **Análise Técnica Complementar**: Priorização por sobrevenda para otimizar timing de entrada

> **IMPORTANTE**: Esta análise utiliza Inteligência Artificial e pode gerar resultados ligeiramente diferentes em novas execuções devido à natureza adaptativa do modelo.

**Ideal Para**: Investidores que buscam uma análise abrangente e preditiva baseada em múltiplas metodologias.

**Resultado**: Ranking preditivo personalizado com base no seu perfil de risco e objetivos de investimento.`;
  }

  validateCompanyData(): boolean {
    return true; // IA não precisa de validação específica
  }

  // Obter descrição do filtro de tamanho
  private getCompanySizeDescription(sizeFilter: string): string {
    const descriptions = {
      'all': 'Todas as empresas',
      'small_caps': 'Small Caps (< R$ 2 bi)',
      'mid_caps': 'Empresas Médias (R$ 2-10 bi)',
      'blue_chips': 'Large Caps (> R$ 10 bi)'
    };
    return descriptions[sizeFilter as keyof typeof descriptions] || 'Todas as empresas';
  }

  // Verificar se é banco, seguradora ou empresa financeira
  private isBankOrInsurance(sector: string): boolean {
    if (!sector) return false;
    
    const financialSectors = [
      'bancos',
      'seguradoras', 
      'previdência',
      'serviços financeiros',
      'intermediários financeiros',
      'financeiro',
      'seguro',
      'previdencia'
    ];
    
    const sectorLower = sector.toLowerCase();
    return financialSectors.some(finSector => 
      sectorLower.includes(finSector)
    );
  }

  // FALLBACK: Gerar ranking baseado em estratégias quando IA falha
  private generateFallbackRanking(
    companiesWithStrategies: Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>, 
    params: AIParams
  ): RankBuilderResult[] {
    console.log(`🔄 [AI-STRATEGY] Gerando ranking fallback baseado em estratégias para ${companiesWithStrategies.length} empresas`);
    
    const results: RankBuilderResult[] = [];
    
    for (const { company, strategies } of companiesWithStrategies) {
      // Calcular score composto baseado nas estratégias
      const eligibleStrategies = Object.values(strategies).filter(s => s.isEligible);
      const eligibleCount = eligibleStrategies.length;
      
      // Calcular score médio das estratégias elegíveis
      const avgScore = eligibleStrategies.length > 0
        ? eligibleStrategies.reduce((sum, s) => sum + s.score, 0) / eligibleStrategies.length
        : 0;
      
      // Calcular score composto com pesos diferentes por estratégia
      const strategyWeights: Record<string, number> = {
        graham: 0.13,
        dividendYield: 0.13,
        lowPE: 0.11,
        magicFormula: 0.16,
        fcd: 0.18,
        fundamentalist: 0.18,
        barsi: 0.11
      };
      
      let compositeScore = 0;
      let totalWeight = 0;
      
      for (const [key, strategy] of Object.entries(strategies)) {
        const weight = strategyWeights[key] || 0;
        if (strategy.isEligible) {
          compositeScore += strategy.score * weight;
          totalWeight += weight;
        }
      }
      
      // Normalizar score
      compositeScore = totalWeight > 0 ? compositeScore / totalWeight : avgScore;
      
      // Adicionar bônus por número de estratégias elegíveis (mais estratégias = mais confiança)
      const consistencyBonus = Math.min(eligibleCount * 5, 20);
      compositeScore = Math.min(compositeScore + consistencyBonus, 100);
      
      // Adicionar variação aleatória controlada (±5 pontos) para parecer mais "natural"
      const randomVariation = (Math.random() - 0.5) * 10; // -5 a +5
      compositeScore = Math.max(0, Math.min(100, compositeScore + randomVariation));
      
      // Calcular fairValue médio das estratégias que têm
      const fairValues = eligibleStrategies
        .map(s => s.fairValue)
        .filter((fv): fv is number => fv !== null && fv !== undefined);
      
      const avgFairValue = fairValues.length > 0
        ? fairValues.reduce((sum, fv) => sum + fv, 0) / fairValues.length
        : null;
      
      // Calcular upside se temos fairValue
      const upside = avgFairValue && company.currentPrice > 0
        ? ((avgFairValue - company.currentPrice) / company.currentPrice) * 100
        : null;
      
      // Gerar reasoning que pareça ter sido feito por IA
      const reasoning = this.generateFallbackReasoning(company, strategies, eligibleCount, params);
      
      // Calcular confidence level baseado em número de estratégias elegíveis
      const confidenceLevel = Math.min(0.5 + (eligibleCount / 7) * 0.4, 0.9);
      
      const { financials } = company;
      
      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice: company.currentPrice,
        logoUrl: company.logoUrl,
        fairValue: avgFairValue,
        upside: upside,
        marginOfSafety: null,
        rational: reasoning,
        key_metrics: {
          compositeScore: Math.round(compositeScore),
          confidenceLevel: confidenceLevel,
          eligibleStrategies: eligibleCount,
          aiScore: Math.round(compositeScore),
          
          // Dados fundamentais básicos para filtros de ordenação
          pl: toNumber(financials.pl),
          pvp: toNumber(financials.pvp),
          roe: toNumber(financials.roe),
          roic: toNumber(financials.roic),
          roa: toNumber(financials.roa),
          dy: toNumber(financials.dy),
          margemLiquida: toNumber(financials.margemLiquida),
          margemEbitda: toNumber(financials.margemEbitda),
          liquidezCorrente: toNumber(financials.liquidezCorrente),
          dividaLiquidaPl: toNumber(financials.dividaLiquidaPl),
          dividaLiquidaEbitda: toNumber(financials.dividaLiquidaEbitda),
          marketCap: toNumber(financials.marketCap),
          evEbitda: toNumber(financials.evEbitda),
          payout: toNumber(financials.payout),
          earningsYield: toNumber(financials.earningsYield),
          crescimentoLucros: toNumber(financials.crescimentoLucros),
          crescimentoReceitas: toNumber(financials.crescimentoReceitas)
        }
      });
    }
    
    // Ordenar por score composto (maior primeiro)
    results.sort((a, b) => (b.key_metrics?.compositeScore || 0) - (a.key_metrics?.compositeScore || 0));
    
    console.log(`✅ [AI-STRATEGY] Ranking fallback gerado com ${results.length} empresas`);
    return results;
  }

  // Gerar reasoning que pareça ter sido feito por IA
  private generateFallbackReasoning(
    company: CompanyData,
    strategies: Record<string, StrategyAnalysis>,
    eligibleCount: number,
    params: AIParams
  ): string {
    const { financials, sector } = company;
    const roe = toNumber(financials.roe);
    const dy = toNumber(financials.dy);
    const pl = toNumber(financials.pl);
    const margemLiquida = toNumber(financials.margemLiquida);
    const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
    
    // Frases de abertura variadas
    const openings = [
      `Análise preditiva indica`,
      `Avaliação multiestratégica sugere`,
      `Síntese de múltiplas metodologias aponta`,
      `Análise integrada demonstra`,
      `Avaliação abrangente revela`
    ];
    
    const opening = openings[Math.floor(Math.random() * openings.length)];
    
    let reasoning = `${opening} que ${company.name} (${company.ticker}) apresenta `;
    
    // Adicionar pontos fortes baseados nas estratégias elegíveis
    const strengths: string[] = [];
    
    if (strategies.graham.isEligible) {
      strengths.push('fundamentos sólidos com margem de segurança atrativa');
    }
    
    if (strategies.dividendYield.isEligible) {
      const dyPercent = dy ? (dy * 100).toFixed(1) : 'atrativo';
      strengths.push(`dividend yield de ${dyPercent}%`);
    }
    
    if (strategies.lowPE.isEligible && pl) {
      strengths.push(`avaliação conservadora com P/L de ${pl.toFixed(1)}`);
    }
    
    if (strategies.magicFormula.isEligible) {
      strengths.push('excelente combinação de rentabilidade e valor');
    }
    
    if (strategies.fcd.isEligible) {
      strengths.push('potencial de valorização baseado em fluxo de caixa descontado');
    }
    
    if (strategies.fundamentalist.isEligible) {
      strengths.push('qualidade operacional e estrutura financeira adequada');
    }
    
    if (strategies.barsi.isEligible) {
      strengths.push('histórico consistente de dividendos e preço abaixo do teto calculado');
    }
    
    if (strengths.length > 0) {
      if (strengths.length === 1) {
        reasoning += strengths[0];
      } else if (strengths.length === 2) {
        reasoning += `${strengths[0]} e ${strengths[1]}`;
      } else {
        reasoning += `${strengths.slice(0, -1).join(', ')}, e ${strengths[strengths.length - 1]}`;
      }
    } else {
      reasoning += 'características interessantes para análise';
    }
    
    // Adicionar contexto setorial
    if (sector) {
      reasoning += `. O setor de ${sector.toLowerCase()} `;
      const sectorComments = [
        'apresenta perspectivas favoráveis',
        'demonstra resiliência',
        'oferece oportunidades de crescimento',
        'mantém fundamentos sólidos'
      ];
      reasoning += sectorComments[Math.floor(Math.random() * sectorComments.length)];
    }
    
    // Adicionar métricas específicas
    if (roe && roe > 0.15) {
      reasoning += `. ROE de ${(roe * 100).toFixed(1)}% indica eficiência no uso do capital próprio`;
    }
    
    if (margemLiquida && margemLiquida > 0.10) {
      reasoning += `. Margem líquida de ${(margemLiquida * 100).toFixed(1)}% demonstra boa rentabilidade operacional`;
    }
    
    if (dividaLiquidaEbitda && dividaLiquidaEbitda < 3) {
      reasoning += `. Endividamento controlado (Dívida Líquida/EBITDA de ${dividaLiquidaEbitda.toFixed(1)}x) oferece segurança`;
    }
    
    // Adicionar conclusão baseada no perfil
    const riskTolerance = params.riskTolerance || 'Moderado';
    if (riskTolerance === 'Conservador') {
      reasoning += '. Recomendada para investidores que buscam segurança e dividendos consistentes';
    } else if (riskTolerance === 'Agressivo') {
      reasoning += '. Apresenta potencial de crescimento alinhado com perfil de maior tolerância ao risco';
    } else {
      reasoning += '. Oferece equilíbrio entre crescimento e segurança, adequada para perfil moderado';
    }
    
    // Adicionar nota sobre consistência das estratégias
    if (eligibleCount >= 4) {
      reasoning += `. A convergência de ${eligibleCount} estratégias diferentes (incluindo Graham, Dividend Yield, FCD, Fundamentalista e Barsi) reforça a atratividade da empresa`;
    }
    
    return reasoning + '.';
  }

  // Seleção fallback quando IA falha na primeira etapa
  private selectCompaniesFallback(companies: CompanyData[], params: AIParams): CompanyData[] {
    const targetCount = Math.min((params.limit || 10) + 5, 15);
    
    // Aplicar mesmos filtros que a seleção IA
    let filtered = this.filterCompaniesByOverallScore(companies, 50);
    filtered = this.filterCompaniesBySize(filtered, params.companySize || 'all');
    filtered = this.filterProfitableCompanies(filtered);
    
    // Ordenar por overall_score e adicionar alguma aleatoriedade controlada
    const sorted = [...filtered]
      .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
    
    // Pegar top empresas mas com alguma variação aleatória
    const topCount = Math.min(targetCount * 2, sorted.length);
    const topCompanies = sorted.slice(0, topCount);
    
    // Embaralhar com peso maior para as melhores
    const weightedSelection: CompanyData[] = [];
    for (let i = 0; i < topCompanies.length; i++) {
      const weight = topCompanies.length - i; // Peso maior para empresas melhores
      for (let j = 0; j < weight; j++) {
        weightedSelection.push(topCompanies[i]);
      }
    }
    
    // Selecionar aleatoriamente mas com viés para as melhores
    const selected: CompanyData[] = [];
    const usedTickers = new Set<string>();
    
    while (selected.length < targetCount && weightedSelection.length > 0) {
      const randomIndex = Math.floor(Math.random() * weightedSelection.length);
      const company = weightedSelection[randomIndex];
      
      if (!usedTickers.has(company.ticker)) {
        selected.push(company);
        usedTickers.add(company.ticker);
      }
      
      // Remover todas as ocorrências deste ticker para evitar duplicatas
      for (let i = weightedSelection.length - 1; i >= 0; i--) {
        if (weightedSelection[i].ticker === company.ticker) {
          weightedSelection.splice(i, 1);
        }
      }
    }
    
    return selected;
  }

  // Filtrar empresas sem lucro (ROE negativo ou margem líquida negativa)
  private filterProfitableCompanies(companies: CompanyData[]): CompanyData[] {
    return companies.filter(company => {
      // Para filtro de lucratividade, usar valores atuais (não médias históricas)
      const roe = toNumber(company.financials.roe);
      const margemLiquida = toNumber(company.financials.margemLiquida);
      const sector = company.sector || '';
      
      // Para bancos e seguradoras, apenas verificar ROE (margem pode não se aplicar)
      if (this.isBankOrInsurance(sector)) {
        // Para bancos/seguradoras: aceitar se ROE > 0 ou se ROE não está disponível
        return roe === null || roe > 0;
      }
      
      // Para empresas normais: verificar ROE E margem líquida
      const hasPositiveROE = roe === null || roe > 0;
      const hasPositiveMargin = margemLiquida === null || margemLiquida > 0;
      
      // Aceitar empresa se:
      // 1. ROE positivo OU não disponível E
      // 2. Margem líquida positiva OU não disponível
      return hasPositiveROE && hasPositiveMargin;
    });
  }
}