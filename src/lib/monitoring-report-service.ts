import { prisma } from '@/lib/prisma';
import { safeWrite } from '@/lib/prisma-wrapper';
import { GoogleGenAI } from '@google/genai';
import { ScoreComposition, compareScoreCompositions } from '@/lib/score-composition-service';

/**
 * Serviço de Relatórios de Monitoramento
 * 
 * Gera relatórios comparativos usando IA quando há mudanças significativas
 * nos fundamentos de um ativo.
 */
export class MonitoringReportService {
  /**
   * Gera relatório comparativo de mudança fundamental
   */
  static async generateChangeReport(params: {
    ticker: string;
    name: string;
    previousData: Record<string, unknown>;
    currentData: Record<string, unknown>;
    previousScore: number;
    currentScore: number;
    changeDirection: 'positive' | 'negative';
    previousScoreComposition?: ScoreComposition;
    currentScoreComposition?: ScoreComposition | null;
    penaltyInfo?: { applied: boolean; value: number; reason: string; flagId: string } | null;
  }): Promise<string> {
    const {
      ticker,
      name,
      previousData,
      currentData,
      previousScore,
      currentScore,
      changeDirection,
      previousScoreComposition,
      currentScoreComposition,
      penaltyInfo,
    } = params;

    const prompt = this.buildComparisonPrompt({
      ticker,
      name,
      previousData,
      currentData,
      previousScore,
      currentScore,
      changeDirection,
      previousScoreComposition,
      currentScoreComposition,
      penaltyInfo,
    });

    try {
      const content = await this.callGeminiAPI(prompt);
      return content;
    } catch (error) {
      console.error('Erro ao gerar relatório com IA:', error);
      throw error;
    }
  }

  /**
   * Mapeia categorias técnicas para nomes amigáveis usados na plataforma
   */
  private static getCategoryDisplayName(category: string): string {
    const categoryMap: Record<string, string> = {
      'strategy': 'Estratégias de Investimento',
      'statements': 'Demonstrações Financeiras',
      'youtube': 'Sentimento de Mercado',
    };
    return categoryMap[category] || category;
  }

  /**
   * Mapeia indicadores técnicos para nomes amigáveis
   */
  private static getIndicatorDisplayName(indicator: string): string {
    const indicatorMap: Record<string, string> = {
      'pl': 'P/L (Preço/Lucro)',
      'pvp': 'P/VP (Preço/Valor Patrimonial)',
      'roe': 'ROE (Retorno sobre Patrimônio)',
      'roic': 'ROIC (Retorno sobre Capital Investido)',
      'margemLiquida': 'Margem Líquida',
      'margemEbitda': 'Margem EBITDA',
      'dy': 'Dividend Yield',
      'evEbitda': 'EV/EBITDA',
      'liquidezCorrente': 'Liquidez Corrente',
      'debtToEquity': 'Dívida/Patrimônio',
      'crescimentoReceitas': 'Crescimento de Receitas',
      'crescimentoLucros': 'Crescimento de Lucros',
    };
    return indicatorMap[indicator] || indicator;
  }

  /**
   * Constrói o prompt para comparação com IA
   */
  private static buildComparisonPrompt(params: {
    ticker: string;
    name: string;
    previousData: Record<string, unknown>;
    currentData: Record<string, unknown>;
    previousScore: number;
    currentScore: number;
    changeDirection: 'positive' | 'negative';
    previousScoreComposition?: ScoreComposition;
    currentScoreComposition?: ScoreComposition | null;
    penaltyInfo?: { applied: boolean; value: number; reason: string; flagId: string } | null;
  }): string {
    const {
      ticker,
      name,
      previousData,
      currentData,
      previousScore,
      currentScore,
      changeDirection,
      previousScoreComposition,
      currentScoreComposition,
      penaltyInfo,
    } = params;

    const changeTerm = changeDirection === 'positive' ? 'melhora' : 'piora';
    const scoreDelta = Math.abs(currentScore - previousScore).toFixed(1);
    
    // Adicionar contexto de penalização se aplicável
    let penaltyContext = '';
    let penaltyDetails = '';
    
    if (penaltyInfo && penaltyInfo.applied) {
      penaltyContext = `

**PENALIZAÇÃO APLICADA:**

Uma penalização de **${Math.abs(penaltyInfo.value)} pontos** foi aplicada ao score devido a uma identificação crítica de perda de fundamentos pela IA.

**Motivo da penalização:** ${penaltyInfo.reason}

**IMPORTANTE**: Esta penalização indica que a plataforma identificou sinais de deterioração nos fundamentos da empresa que não são capturados apenas pelas estratégias de análise tradicional. O score real calculado pelas estratégias pode não ter mudado significativamente, mas a penalização reflete riscos identificados pela análise de IA.

**INSTRUÇÃO CRÍTICA**: No relatório, você DEVE explicar claramente que:
1. A mudança no score foi causada principalmente por esta penalização
2. O que significa esta penalização e por que ela foi aplicada
3. Se as estratégias de investimento mudaram pouco, explique que a penalização é o fator principal da queda no score
4. Use os indicadores financeiros para contextualizar a penalização quando relevante`;
    }
    
    // Adicionar detalhes sobre penalidades gerais (não apenas flag de IA)
    if (previousScoreComposition && currentScoreComposition) {
      const previousPenalty = previousScoreComposition.rawScore - previousScoreComposition.score;
      const currentPenalty = currentScoreComposition.rawScore - currentScoreComposition.score;
      const penaltyDiff = currentPenalty - previousPenalty;
      
      // Log de validação (remover após confirmação)
      if (currentPenalty > 0 || (currentScoreComposition.penalties && currentScoreComposition.penalties.length > 0)) {
        console.log(`[MONITORING-REPORT] ${ticker}: Penalidades detectadas -`, {
          currentPenalty: currentPenalty.toFixed(1),
          previousPenalty: previousPenalty.toFixed(1),
          penaltyDiff: penaltyDiff.toFixed(1),
          penaltiesCount: currentScoreComposition.penalties?.length || 0,
          penaltyInfo: penaltyInfo?.applied ? { applied: true, value: penaltyInfo.value } : null,
          rawScore: currentScoreComposition.rawScore.toFixed(1),
          finalScore: currentScoreComposition.score.toFixed(1)
        });
      }
      
      if (Math.abs(penaltyDiff) >= 0.5 || currentPenalty > 0) {
        penaltyDetails = `

**PENALIDADES APLICADAS AO SCORE:**

${currentPenalty > 0 ? `
- **Penalidade atual**: ${currentPenalty.toFixed(1)} pontos (Score bruto: ${currentScoreComposition.rawScore.toFixed(1)} → Score final: ${currentScoreComposition.score.toFixed(1)})
${previousPenalty > 0 ? `- **Penalidade anterior**: ${previousPenalty.toFixed(1)} pontos (Score bruto: ${previousScoreComposition.rawScore.toFixed(1)} → Score final: ${previousScoreComposition.score.toFixed(1)})` : ''}
${Math.abs(penaltyDiff) >= 0.5 ? `- **Mudança na penalidade**: ${penaltyDiff > 0 ? '+' : ''}${penaltyDiff.toFixed(1)} pontos` : ''}
` : ''}

${currentScoreComposition.penalties && currentScoreComposition.penalties.length > 0 ? `
**Detalhes das penalidades aplicadas:**
${currentScoreComposition.penalties.map(penalty => 
  `- **${penalty.reason}**: ${penalty.amount.toFixed(1)} pontos${penalty.details && penalty.details.length > 0 ? `\n  ${penalty.details.slice(0, 3).map(d => `  • ${d}`).join('\n')}` : ''}`
).join('\n')}
` : ''}

**IMPORTANTE**: As penalidades são aplicadas quando há contradições entre indicadores positivos e negativos, ou quando há uma alta proporção de alertas críticos identificados na análise das demonstrações financeiras.`;
      }
    }

    // Analisar mudanças na composição do score se disponível
    let scoreAnalysis = '';
    let financialChanges = '';
    
    if (previousScoreComposition && currentScoreComposition) {
      const comparison = compareScoreCompositions(previousScoreComposition, currentScoreComposition, 1);
      
      // Analisar mudanças financeiras significativas
      const prevFinancials = this.extractRelevantData(previousData);
      const currFinancials = this.extractRelevantData(currentData);
      const significantFinancialChanges: Array<{indicator: string, previous: number | null, current: number | null, change: number, changePercent: number}> = [];
      
      // Calcular mudanças percentuais significativas nos indicadores financeiros
      const financialIndicators = ['pl', 'pvp', 'roe', 'roic', 'margemLiquida', 'margemEbitda', 'dy', 'evEbitda', 'liquidezCorrente', 'debtToEquity', 'crescimentoReceitas', 'crescimentoLucros'];
      
      financialIndicators.forEach(indicator => {
        const prev = prevFinancials[indicator];
        const curr = currFinancials[indicator];
        
        if (prev !== null && prev !== undefined && curr !== null && curr !== undefined) {
          const prevNum = typeof prev === 'number' ? prev : parseFloat(String(prev));
          const currNum = typeof curr === 'number' ? curr : parseFloat(String(curr));
          
          if (!isNaN(prevNum) && !isNaN(currNum) && prevNum !== 0) {
            const change = currNum - prevNum;
            const changePercent = (change / Math.abs(prevNum)) * 100;
            
            // Considerar significativo se mudança > 10% ou mudança absoluta > 0.05 (para indicadores normalizados)
            if (Math.abs(changePercent) >= 10 || Math.abs(change) >= 0.05) {
              significantFinancialChanges.push({
                indicator,
                previous: prevNum,
                current: currNum,
                change,
                changePercent
              });
            }
          }
        }
      });
      
      // Ordenar por impacto absoluto
      significantFinancialChanges.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
      
      if (significantFinancialChanges.length > 0) {
        financialChanges = `

**MUDANÇAS SIGNIFICATIVAS NOS INDICADORES FINANCEIROS:**

${significantFinancialChanges.slice(0, 5).map(change => {
          const indicatorName = this.getIndicatorDisplayName(change.indicator);
          return `- **${indicatorName}**: ${change.previous?.toFixed(2)} → ${change.current?.toFixed(2)} (${change.change > 0 ? '+' : ''}${change.changePercent.toFixed(1)}%)`;
        }).join('\n')}`;
      }
      
      if (comparison.significantChanges.length > 0) {
        // Agrupar mudanças por categoria para melhor organização
        const changesByCategory: Record<string, Array<{
          component: string;
          previousScore: number;
          currentScore: number;
          previousPoints: number;
          currentPoints: number;
          impact: number;
          category: string;
        }>> = {};
        comparison.significantChanges.forEach(change => {
          const categoryName = this.getCategoryDisplayName(change.category);
          if (!changesByCategory[categoryName]) {
            changesByCategory[categoryName] = [];
          }
          changesByCategory[categoryName].push(change);
        });

        scoreAnalysis = `

**ANÁLISE DETALHADA DAS MUDANÇAS NO SCORE:**

As principais mudanças que impactaram o score foram:

${Object.entries(changesByCategory).slice(0, 3).map(([categoryName, changes]) => 
  `**${categoryName}:**
${changes.slice(0, 3).map(change => 
  `- **${change.component}**: ${change.previousScore.toFixed(1)} → ${change.currentScore.toFixed(1)} pontos (impacto: ${change.impact > 0 ? '+' : ''}${change.impact.toFixed(1)} pontos)`
).join('\n')}`
).join('\n\n')}

**Resumo das mudanças por categoria:**
${Object.entries(comparison.categoryChanges)
  .filter(([, change]) => Math.abs(change) >= 0.5)
  .map(([category, change]) => {
    const categoryName = this.getCategoryDisplayName(category);
    return `- **${categoryName}**: ${change > 0 ? '+' : ''}${change.toFixed(1)} pontos`;
  })
  .join('\n')}

${comparison.penaltyChanges ? `
**Mudança nas penalidades:**
- Penalidade anterior: ${comparison.penaltyChanges.previousPenalty.toFixed(1)} pontos
- Penalidade atual: ${comparison.penaltyChanges.currentPenalty.toFixed(1)} pontos
- Diferença: ${comparison.penaltyChanges.penaltyDiff > 0 ? '+' : ''}${comparison.penaltyChanges.penaltyDiff.toFixed(1)} pontos
` : ''}`;
      }
    }

    // Se não há mudanças significativas nas estratégias mas há penalidades, focar nas penalidades e indicadores
    const hasOnlyPenalties = !scoreAnalysis && (penaltyInfo?.applied || penaltyDetails.length > 0);
    
    // Se há apenas penalidades (sem mudanças significativas nas estratégias), instruir a focar nelas
    let penaltyFocusInstruction = '';
    if (hasOnlyPenalties) {
      penaltyFocusInstruction = `

**SITUAÇÃO ESPECIAL**: As estratégias de investimento não apresentaram mudanças significativas, mas há penalidades aplicadas ao score. Neste caso:

1. **O que aconteceu?**: Foque PRINCIPALMENTE nas penalidades aplicadas. Explique claramente:
   - Qual foi a penalidade aplicada e por quê
   - Se é uma penalização de flag de IA ou penalidades gerais por qualidade/riscos
   - Como isso impactou o score final
   - Use os indicadores financeiros para contextualizar quando relevante

2. **Por que isso importa?**: Explique o significado das penalidades identificadas e o que elas indicam sobre a empresa

3. **O que observar**: Baseado nas penalidades identificadas, quais indicadores específicos devem ser monitorados`;
    }

    return `Você é um analista fundamentalista que escreve para investidores iniciantes e intermediários.

A empresa ${name} (${ticker}) teve uma **${changeTerm}** no seu Score Geral de **${previousScore.toFixed(1)}** para **${currentScore.toFixed(1)}** pontos (variação de ${scoreDelta} pontos).${scoreAnalysis}${financialChanges}${penaltyDetails}${penaltyFocusInstruction}

**CONTEXTO SOBRE AS CATEGORIAS DO SCORE:**

O Score Geral é composto por três categorias principais:

1. **Estratégias de Investimento**: Abrange todas as estratégias da aba "Análises Fundamentalista", incluindo:
   - Graham (Valor Intrínseco)
   - Fluxo de Caixa Descontado (FCD)
   - Gordon (Dividendos)
   - Método Barsi
   - Dividend Yield
   - Low P/E (Value Investing)
   - Fórmula Mágica
   - Fundamentalista 3+1
   
   **IMPORTANTE**: "Estratégias de Investimento" é o nome coletivo para todas essas estratégias de análise fundamentalista. NÃO é uma categoria separada, mas sim o agrupamento de todas essas metodologias de avaliação.

2. **Demonstrações Financeiras**: Análise profunda dos balanços, DRE e demonstrações de fluxo de caixa

3. **Sentimento de Mercado**: Análise agregada de múltiplas fontes especializadas (YouTube, blogs, etc.)

Quando mencionar "Estratégias de Investimento", você está se referindo ao conjunto de todas essas estratégias de análise fundamentalista listadas acima.

**DADOS FINANCEIROS ANTERIORES:**
\`\`\`json
${JSON.stringify(this.extractRelevantData(previousData), null, 2)}
\`\`\`

**DADOS FINANCEIROS ATUAIS:**
\`\`\`json
${JSON.stringify(this.extractRelevantData(currentData), null, 2)}
\`\`\`

**INSTRUÇÕES PARA O RELATÓRIO:**

1. **O que aconteceu?** (1-2 parágrafos)
   - Explique de forma simples e DIRETA o que causou a mudança no score
   - **PRIORIDADE 1**: Se há penalidades aplicadas, explique-as PRIMEIRO e de forma clara
   - **PRIORIDADE 2**: Se há mudanças significativas nas estratégias, explique-as em seguida
   - **PRIORIDADE 3**: Use os indicadores financeiros para contextualizar quando relevante
   - Foque APENAS nos 2-3 fatores que REALMENTE causaram a mudança (use os dados acima)
   - Use linguagem acessível (evite jargões técnicos)
   - Use os nomes exatos das categorias e estratégias conforme listados acima
   - **CRÍTICO**: Se há penalidades mas não há mudanças significativas nas estratégias, explique que a mudança foi causada principalmente pelas penalidades
   - **CRÍTICO**: NÃO mencione indicadores que não mudaram significativamente. Se não há dados concretos sobre uma mudança, NÃO invente ou generalize.

2. **Por que isso importa?** (1-2 parágrafos)
   - Explique o impacto prático dessas mudanças ESPECÍFICAS identificadas acima
   - Como isso afeta o valor da empresa de forma CONCRETA
   - Se a empresa ficou mais ou menos atrativa e POR QUÊ (baseado nos dados reais)
   - **CRÍTICO**: NÃO use frases genéricas como "pode ter se tornado menos vantajosa" sem explicar o motivo específico baseado nos dados

3. **O que observar daqui para frente?** (1 parágrafo)
   - Pontos de atenção ESPECÍFICOS baseados nas mudanças identificadas
   - Se é uma mudança pontual ou tendência (baseado nos dados, não em suposições)
   - **CRÍTICO**: NÃO use frases genéricas como "será importante observar" ou "é crucial acompanhar" sem especificar O QUE observar e POR QUÊ

**REGRAS CRÍTICAS PARA EVITAR CONTEÚDO GENÉRICO:**
- Seja conciso: máximo 400 palavras
- Use linguagem simples e direta
- NÃO mencione "snapshots", "dados internos" ou processos técnicos
- **CRÍTICO**: Foque APENAS em mudanças significativas (>10% de variação ou impacto >1 ponto)
- **CRÍTICO**: Se um indicador mudou pouco (<5%), NÃO o mencione
- **CRÍTICO**: NÃO invente análises ou conclusões genéricas. Se não há dados suficientes para uma conclusão clara, seja honesto sobre isso
- **CRÍTICO**: Evite frases vagas como "pode ter", "sugere que", "indica que" sem dados concretos que sustentem
- Use **negrito** apenas para números importantes
- Explique siglas na primeira vez (ex: ROE - Retorno sobre Patrimônio)
- Mantenha tom neutro e informativo
- **IMPORTANTE**: Use APENAS os nomes exatos das categorias e estratégias listados acima. NÃO invente nomes
- **IMPORTANTE**: Quando mencionar "Estratégias de Investimento", você está se referindo ao conjunto de todas as estratégias de análise fundamentalista
- **CRÍTICO**: Se não há informações suficientes para explicar uma mudança de forma específica e útil, seja direto e honesto. NÃO encha linguiça com informações genéricas que não agregam valor${penaltyContext}`;
  }

  /**
   * Extrai apenas os dados financeiros relevantes para o relatório
   */
  private static extractRelevantData(data: Record<string, unknown>): Record<string, unknown> {
    const financials = (data as any).financials || {};
    
    return {
      pl: financials.pl,
      pvp: financials.pvp,
      roe: financials.roe,
      roic: financials.roic,
      margemLiquida: financials.margemLiquida,
      margemEbitda: financials.margemEbitda,
      dy: financials.dy,
      evEbitda: financials.evEbitda,
      liquidezCorrente: financials.liquidezCorrente,
      debtToEquity: financials.debtToEquity,
      crescimentoReceitas: financials.crescimentoReceitas,
      crescimentoLucros: financials.crescimentoLucros,
      marketCap: financials.marketCap,
      currentPrice: (data as any).currentPrice,
    };
  }

  /**
   * Chama a API do Gemini para gerar o conteúdo
   */
  private static async callGeminiAPI(prompt: string, retryCount = 0): Promise<string> {
    const maxRetries = 3;

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const model = 'gemini-2.5-flash-lite';
      const contents = [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ];

      const response = await ai.models.generateContentStream({
        model,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      if (!fullResponse.trim()) {
        throw new Error('Resposta vazia da API Gemini');
      }

      return fullResponse.trim();
    } catch (error: any) {
      console.error(`Erro na chamada Gemini (tentativa ${retryCount + 1}):`, error);

      // Retry com backoff exponencial
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.callGeminiAPI(prompt, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Salva relatório no banco de dados
   */
  static async saveReport(params: {
    companyId: number;
    snapshotId?: string;
    content: string;
    previousScore: number;
    currentScore: number;
    changeDirection: 'positive' | 'negative';
    snapshotData: Record<string, unknown>;
    scoreChangeReason?: 'FLAG_PENALTY' | 'FUNDAMENTAL_CHANGE';
    penaltyInfo?: { applied: boolean; value: number; reason: string; flagId: string } | null;
  }): Promise<string> {
    const { companyId, snapshotId, content, previousScore, currentScore, changeDirection, snapshotData, scoreChangeReason, penaltyInfo } =
      params;

    const metadata: any = {
      generatedAt: new Date().toISOString(),
      scoreDelta: currentScore - previousScore,
      snapshotData,
    };

    if (scoreChangeReason) {
      metadata.scoreChangeReason = scoreChangeReason;
    }

    if (penaltyInfo) {
      metadata.penaltyInfo = penaltyInfo;
    }

    const report = await safeWrite(
      'create-monitoring-report',
      () =>
        prisma.aIReport.create({
          data: {
            companyId,
            snapshotId,
            content,
            type: 'FUNDAMENTAL_CHANGE',
            changeDirection,
            previousScore,
            currentScore,
            status: 'COMPLETED',
            isActive: true,
            metadata,
          } as any,
        }),
      ['ai_reports']
    );

    return (report as any).id;
  }

  /**
   * Busca relatórios de mudança de um ativo
   */
  static async getChangeReports(companyId: number, limit: number = 10) {
    return await prisma.aIReport.findMany({
      where: {
        companyId,
        type: 'FUNDAMENTAL_CHANGE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        content: true,
        changeDirection: true,
        previousScore: true,
        currentScore: true,
        createdAt: true,
        likeCount: true,
        dislikeCount: true,
      },
    });
  }

  /**
   * Busca um relatório específico
   */
  static async getReport(reportId: string) {
    return await prisma.aIReport.findUnique({
      where: { id: reportId },
      include: {
        company: {
          select: {
            ticker: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });
  }
}

