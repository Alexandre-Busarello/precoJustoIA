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
    console.log(`🚀 [AI-STRATEGY] Iniciando análise preditiva com IA para ${companies.length} empresas`);
    console.log(`📊 [AI-STRATEGY] Parâmetros: ${JSON.stringify(params)}`);
    
    // ETAPA 0: Aplicar exclusões automáticas antes da análise IA
    console.log(`🚫 [AI-STRATEGY] ETAPA 0: Aplicando exclusões automáticas`);
    const filteredCompanies = companies.filter(company => !this.shouldExcludeCompany(company));
    console.log(`✅ [AI-STRATEGY] ${companies.length - filteredCompanies.length} empresas excluídas automaticamente`);
    
    // ETAPA 1: Seleção inteligente com LLM baseada nos critérios do usuário
    console.log(`🧠 [AI-STRATEGY] ETAPA 1: Seleção inteligente com LLM`);
    const selectedCompanies = await this.selectCompaniesWithAI(filteredCompanies, params);
    console.log(`✅ [AI-STRATEGY] ${selectedCompanies.length} empresas selecionadas pela IA na primeira etapa`);
    
    // ETAPA 2: Executar estratégias tradicionais para empresas selecionadas
    console.log(`📈 [AI-STRATEGY] ETAPA 2: Executando estratégias tradicionais`);
    const companiesWithStrategies = await this.executeAllStrategies(selectedCompanies);
    console.log(`✅ [AI-STRATEGY] Estratégias executadas para ${companiesWithStrategies.length} empresas`);
    
    // ETAPA 3: Análise final com IA (todas as empresas de uma vez)
    console.log(`🤖 [AI-STRATEGY] ETAPA 3: Análise final com IA (batch processing)`);
    const finalResults = await this.analyzeBatchWithAI(companiesWithStrategies, params);
    console.log(`🎯 [AI-STRATEGY] Análise concluída: ${finalResults.length} resultados finais`);
    
    // Ordenar por score da IA primeiro
    const sortedByAI = finalResults
      .sort((a, b) => (b.key_metrics?.compositeScore || 0) - (a.key_metrics?.compositeScore || 0));
    
    // ETAPA 3.5: Remover empresas duplicadas (manter apenas o primeiro ticker de cada empresa)
    console.log(`🔄 [AI-STRATEGY] ETAPA 3.5: Removendo empresas duplicadas`);
    const uniqueResults = this.removeDuplicateCompanies(sortedByAI);
    console.log(`✅ [AI-STRATEGY] Empresas únicas: ${uniqueResults.length} (removidas ${sortedByAI.length - uniqueResults.length} duplicatas)`);
    
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
    const targetCount = (params.limit || 10) + 10;
    console.log(`🔍 [AI-STRATEGY] Preparando dados de ${companies.length} empresas para seleção IA`);
    
    // Aplicar filtros antes da seleção IA
    let filteredCompanies = this.filterCompaniesBySize(companies, params.companySize || 'all');
    console.log(`📊 [AI-STRATEGY] Após filtro de tamanho (${params.companySize || 'all'}): ${filteredCompanies.length} empresas`);
    
    // Filtrar empresas sem lucro
    const beforeProfitabilityFilter = filteredCompanies.length;
    filteredCompanies = this.filterProfitableCompanies(filteredCompanies);
    console.log(`💰 [AI-STRATEGY] Após filtro de lucratividade: ${filteredCompanies.length} empresas (removidas ${beforeProfitabilityFilter - filteredCompanies.length} sem lucro)`);
    
    // Preparar dados resumidos das empresas filtradas
    const use7YearAverages = params.use7YearAverages !== undefined ? params.use7YearAverages : true;
    const companiesData = filteredCompanies.map(company => ({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector || 'Não informado',
      currentPrice: company.currentPrice,
      marketCap: toNumber(company.financials.marketCap) || 0,
      roe: this.getROE(company.financials, use7YearAverages, company.historicalFinancials) || 0,
      pl: this.getPL(company.financials, use7YearAverages, company.historicalFinancials) || 0,
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

  // NOVA ETAPA 2: Executar estratégias para empresas selecionadas
  private async executeAllStrategies(companies: CompanyData[]): Promise<Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>> {
    console.log(`⚙️ [AI-STRATEGY] Executando 6 estratégias para ${companies.length} empresas`);
    
    const results = [];
    
    for (const company of companies) {
      console.log(`📊 [AI-STRATEGY] Processando ${company.ticker}...`);
      
      try {
        // Executar todas as 6 estratégias tradicionais
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
          })
        };
        
        results.push({ company, strategies });
        
      } catch (error) {
        console.error(`❌ [AI-STRATEGY] Erro ao processar ${company.ticker}:`, error);
        // Continuar com estratégias vazias em caso de erro
        results.push({ 
          company, 
          strategies: {
            graham: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            dividendYield: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            lowPE: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            magicFormula: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            fcd: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] },
            fundamentalist: { isEligible: false, score: 0, fairValue: null, upside: null, reasoning: 'Erro na análise', criteria: [] }
          }
        });
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
    const maxAttempts = 3;
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
        console.log(`🎯 [AI-STRATEGY] ${results.length} resultados processados da análise batch`);
        
        // Verificar duplicatas nos resultados
        const tickers = results.map(r => r.ticker);
        const uniqueTickers = new Set(tickers);
        
        if (tickers.length !== uniqueTickers.size) {
          const duplicates = tickers.filter((ticker, index) => tickers.indexOf(ticker) !== index);
          const errorMsg = `NÃO repita tickers. Duplicatas encontradas: ${duplicates.join(', ')}. Cada ticker deve aparecer APENAS UMA VEZ.`;
          previousErrors.push(errorMsg);
          console.warn(`⚠️ [AI-STRATEGY] ${errorMsg}`);
          continue;
        }
        
        // Verificar se temos resultados para todas as empresas
        if (results.length !== companiesWithStrategies.length) {
          const expectedTickers = companiesWithStrategies.map(c => c.company.ticker);
          const receivedTickers = results.map(r => r.ticker);
          const missing = expectedTickers.filter(t => !receivedTickers.includes(t));
          const extra = receivedTickers.filter(t => !expectedTickers.includes(t));
          
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
        
        // Adicionar orientação específica para erros de parsing
        if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
          previousErrors.push(`ERRO DE FORMATO: Retorne APENAS um JSON válido: {"results": [{"ticker": "TICKER1", "score": 85, "fairValue": 25.50, "upside": 15.2, "confidenceLevel": 0.8, "reasoning": "texto em português"}]}. NÃO adicione texto antes ou depois do JSON. NÃO use \`\`\`json. PARE após fechar a chave }.`);
        } else {
          previousErrors.push(`Erro técnico: ${errorMsg}. Simplifique a resposta e foque apenas no JSON solicitado.`);
        }
        
        if (attempts === maxAttempts) {
          throw new Error(`Falha após ${maxAttempts} tentativas. Últimos erros: ${previousErrors.join(' | ')}`);
        }
      }
    }
    
    if (results.length === 0) {
      throw new Error('Falha na análise batch após múltiplas tentativas');
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
- Fundamentalista 3+1: ${strategies.fundamentalist.isEligible ? '✅' : '❌'} (Score: ${strategies.fundamentalist.score}) - ${strategies.fundamentalist.reasoning}`;
    }).join('\n\n');

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

**REGRAS CRÍTICAS ANTI-LOOP**: 
- Seja DIRETO e OBJETIVO, evite repetições
- NÃO analise a mesma empresa múltiplas vezes
- NÃO repita explicações ou conceitos
- Ordene por score (0-100) decrescente
- Inclua TODAS as empresas analisadas APENAS UMA VEZ
- TODO o campo "reasoning" deve estar em PORTUGUÊS BRASILEIRO
- Use termos financeiros em português (ex: "potencial de valorização", "fundamentos sólidos", "perspectivas positivas")

**FORMATO DE RESPOSTA OBRIGATÓRIO**:
- Responda APENAS com o JSON, sem texto adicional
- NÃO use markdown (\`\`\`json)
- NÃO adicione explicações antes ou depois do JSON
- PARE imediatamente após fechar a chave final }
- Formato exato: {"results": [...]}
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

  // Parse robusto da resposta de análise batch
  private parseBatchAnalysisResponse(response: string, companiesWithStrategies: Array<{company: CompanyData, strategies: Record<string, StrategyAnalysis>}>): RankBuilderResult[] {
    console.log(`🔍 [AI-STRATEGY] Iniciando parse da resposta (${response.length} chars)`);
    
    // Múltiplas estratégias de parsing (otimizadas para texto extra após JSON)
    const parseStrategies = [
      // Estratégia 1: Buscar JSON entre marcadores específicos
      () => {
        const jsonStart = response.indexOf('{"results"');
        if (jsonStart === -1) throw new Error('Início do JSON não encontrado');
        
        let braceCount = 0;
        let jsonEnd = jsonStart;
        
        for (let i = jsonStart; i < response.length; i++) {
          const char = response[i];
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          
          if (braceCount === 0 && i > jsonStart) {
            jsonEnd = i + 1;
            break;
          }
        }
        
        const jsonStr = response.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonStr);
      },
      
      // Estratégia 2: Regex mais específica para capturar JSON completo
      () => {
        const jsonMatch = response.match(/\{"results":\s*\[[\s\S]*?\]\s*\}/);
        if (!jsonMatch) throw new Error('JSON com results não encontrado');
        return JSON.parse(jsonMatch[0]);
      },
      
      // Estratégia 3: Limpeza agressiva e busca por JSON
      () => {
        const cleanResponse = response
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/^[^{]*/g, '') // Remove tudo antes do primeiro {
          .replace(/\}[^}]*$/g, '}'); // Remove tudo após o último }
        
        // Encontrar o JSON válido
        const jsonMatch = cleanResponse.match(/\{[\s\S]*?\}(?=\s*$|$)/);
        if (!jsonMatch) throw new Error('JSON não encontrado após limpeza agressiva');
        return JSON.parse(jsonMatch[0]);
      },
      
      // Estratégia 4: Parse incremental com validação
      () => {
        const lines = response.split('\n');
        let jsonStr = '';
        let braceCount = 0;
        let started = false;
        let inString = false;
        let escapeNext = false;
        
        for (const line of lines) {
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (!started && char === '{') {
              started = true;
              braceCount = 0;
            }
            
            if (started) {
              jsonStr += char;
              
              if (!escapeNext) {
                if (char === '"') inString = !inString;
                if (!inString) {
                  if (char === '{') braceCount++;
                  if (char === '}') braceCount--;
                }
                escapeNext = char === '\\' && inString;
              } else {
                escapeNext = false;
              }
              
              // JSON completo encontrado
              if (braceCount === 0 && started && !inString) {
                return JSON.parse(jsonStr);
              }
            }
          }
          
          if (started) jsonStr += '\n';
        }
        
        throw new Error('JSON válido não encontrado por parsing incremental');
      },
      
      // Estratégia 5: Fallback - tentar extrair apenas o array de results
      () => {
        const resultsMatch = response.match(/\[[\s\S]*?\{[\s\S]*?"ticker"[\s\S]*?\}[\s\S]*?\]/);
        if (!resultsMatch) throw new Error('Array de results não encontrado');
        return { results: JSON.parse(resultsMatch[0]) };
      }
    ];
    
    let parsed: Record<string, unknown> | null = null;
    let parseError: string = '';
    
    // Tentar cada estratégia de parsing
    for (let i = 0; i < parseStrategies.length; i++) {
      try {
        console.log(`🔄 [AI-STRATEGY] Tentativa de parse ${i + 1}/${parseStrategies.length}`);
        parsed = parseStrategies[i]();
        console.log(`✅ [AI-STRATEGY] Parse bem-sucedido com estratégia ${i + 1}`);
        break;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        parseError += `Estratégia ${i + 1}: ${errorMsg}; `;
        console.warn(`⚠️ [AI-STRATEGY] Estratégia ${i + 1} falhou: ${errorMsg}`);
      }
    }
    
    if (!parsed) {
      console.error(`❌ [AI-STRATEGY] Todas as estratégias de parse falharam: ${parseError}`);
      throw new Error(`Falha no parse após ${parseStrategies.length} tentativas: ${parseError}`);
    }
    
    const results: RankBuilderResult[] = [];
      
    if (parsed.results && Array.isArray(parsed.results)) {
      for (const result of parsed.results) {
        const companyData = companiesWithStrategies.find(c => c.company.ticker === result.ticker);
        if (companyData) {
          const eligibleStrategies = Object.values(companyData.strategies).filter((s: StrategyAnalysis) => s.isEligible).length;
          
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
              compositeScore: result.score || 0,
              confidenceLevel: result.confidenceLevel || 0.5,
              eligibleStrategies: eligibleStrategies,
              aiScore: result.score || 50
            }
          });
        }
      }
    }
    
    return results;
  }

  // Chamada para Gemini API (reutilizada)
  private async callGeminiAPI(prompt: string, retryCount = 0, useGoogleSearch = true): Promise<string> {
    const maxRetries = 3;
    
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

      const model = 'gemini-2.5-flash-lite';
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
            console.log(chunk.text);
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
- **Análise Multiestrategica**: Executa Graham, Dividend Yield, Low P/E, Fórmula Mágica, FCD e Fundamentalista 3+1
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
- Análise de 7 estratégias simultaneamente para cada empresa selecionada
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
      'blue_chips': 'Blue Chips (> R$ 10 bi)'
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