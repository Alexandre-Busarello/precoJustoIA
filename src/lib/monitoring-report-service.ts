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
    currentScoreComposition?: ScoreComposition;
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
    currentScoreComposition?: ScoreComposition;
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
    } = params;

    const changeTerm = changeDirection === 'positive' ? 'melhora' : 'piora';
    const scoreDelta = Math.abs(currentScore - previousScore).toFixed(1);

    // Analisar mudanças na composição do score se disponível
    let scoreAnalysis = '';
    if (previousScoreComposition && currentScoreComposition) {
      const comparison = compareScoreCompositions(previousScoreComposition, currentScoreComposition, 1);
      
      if (comparison.significantChanges.length > 0) {
        scoreAnalysis = `

**ANÁLISE DETALHADA DAS MUDANÇAS NO SCORE:**

As principais mudanças que impactaram o score foram:
${comparison.significantChanges.slice(0, 5).map(change => 
  `- **${change.component}**: ${change.previousScore.toFixed(1)} → ${change.currentScore.toFixed(1)} pontos (impacto: ${change.impact > 0 ? '+' : ''}${change.impact.toFixed(1)} pontos)`
).join('\n')}

**Mudanças por categoria:**
${Object.entries(comparison.categoryChanges)
  .filter(([, change]) => Math.abs(change) >= 0.5)
  .map(([category, change]) => `- ${category}: ${change > 0 ? '+' : ''}${change.toFixed(1)} pontos`)
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
- Mantenha tom neutro e informativo`;
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
  }): Promise<string> {
    const { companyId, snapshotId, content, previousScore, currentScore, changeDirection, snapshotData } =
      params;

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
            metadata: {
              generatedAt: new Date().toISOString(),
              scoreDelta: currentScore - previousScore,
              snapshotData,
            } as any,
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

