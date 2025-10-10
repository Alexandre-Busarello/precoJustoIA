import { prisma } from '@/lib/prisma';
import { safeWrite } from '@/lib/prisma-wrapper';
import { GoogleGenAI } from '@google/genai';

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
  }): Promise<string> {
    const {
      ticker,
      name,
      previousData,
      currentData,
      previousScore,
      currentScore,
      changeDirection,
    } = params;

    const prompt = this.buildComparisonPrompt({
      ticker,
      name,
      previousData,
      currentData,
      previousScore,
      currentScore,
      changeDirection,
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
  }): string {
    const {
      ticker,
      name,
      previousData,
      currentData,
      previousScore,
      currentScore,
      changeDirection,
    } = params;

    const changeTerm = changeDirection === 'positive' ? 'melhora' : 'piora';
    const scoreDelta = Math.abs(currentScore - previousScore).toFixed(1);

    return `Você é um analista fundamentalista especializado em ações brasileiras.

Compare os dados anteriores com os dados atuais da empresa ${name} (${ticker}) e explique de forma clara e objetiva as principais mudanças que causaram a **${changeTerm}** no Score Geral de **${previousScore.toFixed(1)}** para **${currentScore.toFixed(1)}** (variação de ${scoreDelta} pontos).

**DADOS DO SNAPSHOT ANTERIOR:**
\`\`\`json
${JSON.stringify(previousData, null, 2)}
\`\`\`

**DADOS ATUAIS:**
\`\`\`json
${JSON.stringify(currentData, null, 2)}
\`\`\`

**INSTRUÇÕES PARA A ANÁLISE:**

1. **Resumo Executivo** (2-3 parágrafos)
   - Contextualize a mudança no Score Geral
   - Destaque o que mudou de forma mais significativa
   - Indique se é uma mudança pontual ou tendência

2. **Principais Mudanças Identificadas** (liste os 3-5 fatores mais importantes)
   - Para cada fator, compare o valor anterior com o atual
   - Explique o impacto de cada mudança no valuation/qualidade
   - Use **negrito** para destacar indicadores-chave

3. **Impacto no Valuation e Análise das Estratégias**
   - Como as mudanças afetam o preço justo estimado
   - Quais estratégias de investimento foram mais impactadas
   - Se a empresa ficou mais ou menos atrativa para investimento

4. **Recomendação**
   - Com base nas mudanças, qual a perspectiva para a empresa
   - Pontos de atenção para os investidores
   - Se mantém, fortalece ou enfraquece a tese de investimento

**FORMATO:**
- Use Markdown para formatação
- Seja objetivo e direto
- Use bullet points quando apropriado
- Inclua números e percentuais relevantes
- Foque nas mudanças mais significativas (não liste tudo)

**IMPORTANTE:**
- NÃO invente dados que não estão nos JSONs fornecidos
- Se um dado não mudou significativamente, não o mencione
- Priorize qualidade sobre quantidade de informações
- Mantenha tom profissional mas acessível`;
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
    content: string;
    previousScore: number;
    currentScore: number;
    changeDirection: 'positive' | 'negative';
    snapshotData: Record<string, unknown>;
  }): Promise<string> {
    const { companyId, content, previousScore, currentScore, changeDirection, snapshotData } =
      params;

    const report = await safeWrite(
      'create-monitoring-report',
      () =>
        prisma.aIReport.create({
          data: {
            companyId,
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
          },
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

