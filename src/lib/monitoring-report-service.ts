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
    if (penaltyInfo && penaltyInfo.applied) {
      penaltyContext = `

IMPORTANTE: A mudança no score foi causada por uma penalização de ${penaltyInfo.value} pontos aplicada devido a uma identificação crítica de perda de fundamento pela IA.

Motivo da penalização: ${penaltyInfo.reason}

O score real dos fundamentos da empresa não mudou significativamente. A queda no score é resultado direto desta penalização por perda de fundamento identificada pela análise de variação de preço.

IMPORTANTE: Deixe claro no relatório que esta mudança de score NÃO representa uma mudança real nos fundamentos da empresa pelos indicadores, mas sim uma penalização aplicada pela plataforma devido à identificação de perda de fundamentos pela IA.`;
    }

    // Analisar mudanças na composição do score se disponível
    let scoreAnalysis = '';
    if (previousScoreComposition && currentScoreComposition) {
      const comparison = compareScoreCompositions(previousScoreComposition, currentScoreComposition, 1);
      
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

    return `Você é um analista fundamentalista que escreve para investidores iniciantes e intermediários.

A empresa ${name} (${ticker}) teve uma **${changeTerm}** no seu Score Geral de **${previousScore.toFixed(1)}** para **${currentScore.toFixed(1)}** pontos (variação de ${scoreDelta} pontos).

Escreva um relatório claro e acessível explicando o que aconteceu.${scoreAnalysis}

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
   - Explique de forma simples o que causou a mudança no score
   - Foque nos 2-3 indicadores que mais mudaram
   - Use linguagem acessível (evite jargões técnicos)
   - Use os nomes exatos das categorias e estratégias conforme listados acima

2. **Por que isso importa?** (1-2 parágrafos)
   - Explique o impacto prático dessas mudanças
   - Como isso afeta o valor da empresa
   - Se a empresa ficou mais ou menos atrativa

3. **O que observar daqui para frente?** (1 parágrafo)
   - Pontos de atenção para os próximos trimestres
   - Se é uma mudança pontual ou tendência

**REGRAS IMPORTANTES:**
- Seja conciso: máximo 400 palavras
- Use linguagem simples e direta
- NÃO mencione "snapshots", "dados internos" ou processos técnicos
- Foque apenas em mudanças significativas (>10% de variação)
- Se um indicador mudou pouco (<5%), não o mencione
- Use **negrito** apenas para números importantes
- Explique siglas na primeira vez (ex: ROE - Retorno sobre Patrimônio)
- Mantenha tom neutro e informativo
- **IMPORTANTE**: Use APENAS os nomes exatos das categorias e estratégias listados acima. NÃO invente nomes como "categoria de estratégia" ou "categoria estratégia"
- **IMPORTANTE**: Quando mencionar "Estratégias de Investimento", você está se referindo ao conjunto de todas as estratégias de análise fundamentalista (Graham, FCD, Gordon, Barsi, Dividend Yield, Low P/E, Fórmula Mágica, Fundamentalista 3+1). NÃO é uma categoria separada, mas sim o nome coletivo para todas essas estratégias${penaltyContext}`;
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

