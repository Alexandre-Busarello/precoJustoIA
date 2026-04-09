/**
 * DIVIDEND RADAR SERVICE
 *
 * Serviço de projeção de dividendos usando IA (Gemini)
 * Analisa histórico e projeta os próximos 12 meses com datas e valores prováveis
 */

import { prisma } from "@/lib/prisma";
import { safeWrite, safeQueryWithParams } from "@/lib/prisma-wrapper";
import { GoogleGenAI } from '@google/genai';
import { Prisma } from "@prisma/client";

export interface DividendProjection {
  month: number; // 1-12
  year: number;
  projectedExDate: string; // ISO date string
  projectedAmount: number;
  confidence: number; // 0-100
}

export interface DividendRadarProjections {
  projections: DividendProjection[];
  lastProcessedAt: string; // ISO date string
  lastDividendDate: string | null; // ISO date string
}

/**
 * Dividend Radar Service
 */
export class DividendRadarService {
  /**
   * Gera projeções para os próximos 12 meses usando IA
   */
  static async generateProjections(ticker: string): Promise<DividendProjection[]> {
    console.log(`🤖 [DIVIDEND RADAR] Gerando projeções para ${ticker}...`);

    // Buscar histórico de dividendos (últimos 5 anos)
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        dividendHistory: {
          where: {
            exDate: {
              gte: new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
            },
          },
          orderBy: { exDate: 'asc' },
        },
      },
    });

    if (!company) {
      throw new Error(`Company ${ticker} not found`);
    }

    if (company.dividendHistory.length === 0) {
      console.log(`⚠️ [DIVIDEND RADAR] ${ticker}: Sem histórico de dividendos`);
      return [];
    }

    // Preparar dados históricos para a IA
    const historicalData = company.dividendHistory.map(d => ({
      date: d.exDate.toISOString().split('T')[0],
      amount: Number(d.amount),
      type: d.type || 'dividend',
    }));

    // Chamar IA para gerar projeções
    const projections = await this.callAIForProjections(
      ticker,
      company.name,
      company.sector,
      historicalData
    );

    // Filtrar projeções antigas (meses passados) antes de salvar
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const filteredProjections = projections.filter((p) => {
      const projDate = new Date(p.projectedExDate);
      const projMonth = projDate.getMonth() + 1;
      const projYear = projDate.getFullYear();

      // Manter apenas projeções futuras ou do mês atual
      if (projYear > currentYear) {
        return true;
      }
      if (projYear === currentYear && projMonth >= currentMonth) {
        return true;
      }

      // Remover projeções de meses passados
      return false;
    });

    if (filteredProjections.length < projections.length) {
      console.log(
        `🧹 [DIVIDEND RADAR] ${ticker}: Removidas ${projections.length - filteredProjections.length} projeções antigas`
      );
    }

    // Salvar projeções filtradas no banco
    await this.saveProjections(ticker, filteredProjections);

    return filteredProjections;
  }

  /**
   * Busca projeções do cache ou gera novas
   */
  static async getOrGenerateProjections(ticker: string): Promise<DividendProjection[]> {
    // Buscar do banco
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dividendRadarProjections: true,
        dividendRadarLastProcessedAt: true,
        dividendRadarLastDividendDate: true,
      },
    });

    if (!company) {
      throw new Error(`Company ${ticker} not found`);
    }

    // SEMPRE verificar se precisa reprocessar (novos dividendos) ANTES de retornar do cache
    // Isso garante que novos dividendos sejam sempre detectados e projeções recalculadas
    const needsReprocessing = await this.shouldReprocessProjections(ticker);
    
    if (needsReprocessing) {
      console.log(`🔄 [DIVIDEND RADAR] ${ticker}: Reprocessando projeções (novos dividendos ou projeções antigas detectadas)...`);
      return await this.generateProjections(ticker);
    }

    // Se já tem projeções e foram processadas recentemente (últimas 24h), retornar
    // Só retornar do cache se NÃO houver novos dividendos (já verificado acima)
    if (company.dividendRadarProjections && company.dividendRadarLastProcessedAt) {
      const lastProcessed = new Date(company.dividendRadarLastProcessedAt);
      const hoursSinceProcessed = (Date.now() - lastProcessed.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceProcessed < 24) {
        console.log(`📦 [DIVIDEND RADAR] ${ticker}: Retornando projeções do cache (sem novos dividendos)`);
        return company.dividendRadarProjections as unknown as DividendProjection[];
      }
    }

    // Se tem projeções antigas, retornar
    if (company.dividendRadarProjections) {
      return company.dividendRadarProjections as unknown as DividendProjection[];
    }

    // Gerar novas projeções
    return await this.generateProjections(ticker);
  }

  /**
   * Verifica se há projeções em meses passados que precisam ser removidas/reprocessadas
   */
  static async hasStaleProjections(ticker: string): Promise<boolean> {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dividendRadarProjections: true,
      },
    });

    if (!company || !company.dividendRadarProjections) {
      return false;
    }

    const projections = company.dividendRadarProjections as unknown as DividendProjection[];
    if (!Array.isArray(projections) || projections.length === 0) {
      return false;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Verificar se há projeções com datas passadas (meses anteriores ao mês atual)
    const hasStale = projections.some((p) => {
      const projDate = new Date(p.projectedExDate);
      const projMonth = projDate.getMonth() + 1;
      const projYear = projDate.getFullYear();

      // Considerar "stale" se a projeção está em um mês passado
      // Comparar ano e mês para detectar projeções antigas
      if (projYear < currentYear) {
        return true;
      }
      if (projYear === currentYear && projMonth < currentMonth) {
        return true;
      }

      return false;
    });

    if (hasStale) {
      console.log(
        `🔄 [DIVIDEND RADAR] ${ticker}: Projeções antigas detectadas (meses passados), precisa reprocessar`
      );
    }

    return hasStale;
  }

  /**
   * Verifica se precisa reprocessar projeções
   * (quando novo dividendo confirmado não estava nas projeções OU quando há projeções em meses passados)
   */
  static async shouldReprocessProjections(ticker: string): Promise<boolean> {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dividendRadarLastDividendDate: true,
        dividendHistory: {
          orderBy: { exDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!company || company.dividendHistory.length === 0) {
      // Mesmo sem histórico, verificar se há projeções antigas
      return await this.hasStaleProjections(ticker);
    }

    const latestDividend = company.dividendHistory[0];
    const lastProcessedDate = company.dividendRadarLastDividendDate;

    // Se não tem data de último processamento, precisa processar
    if (!lastProcessedDate) {
      return true;
    }

    // Se o último dividendo é mais recente que o último usado no cálculo, precisa reprocessar
    if (latestDividend.exDate > lastProcessedDate) {
      console.log(
        `🔄 [DIVIDEND RADAR] ${ticker}: Novo dividendo detectado (${latestDividend.exDate.toISOString().split('T')[0]})`
      );
      return true;
    }

    // Verificar se há projeções antigas (meses passados)
    return await this.hasStaleProjections(ticker);
  }

  /**
   * Detecta novos dividendos e reprocessa se necessário
   */
  static async detectAndReprocessIfNeeded(ticker: string): Promise<void> {
    if (await this.shouldReprocessProjections(ticker)) {
      console.log(`🔄 [DIVIDEND RADAR] ${ticker}: Reprocessando após detecção de novo dividendo`);
      await this.generateProjections(ticker);
    }
  }

  /**
   * Chama Gemini para gerar projeções
   */
  private static async callAIForProjections(
    ticker: string,
    companyName: string,
    sector: string | null,
    historicalData: Array<{ date: string; amount: number; type: string }>
  ): Promise<DividendProjection[]> {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️ [DIVIDEND RADAR] GEMINI_API_KEY não configurada, usando projeções baseadas em regras');
      return this.generateRuleBasedProjections(historicalData);
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const prompt = this.buildProjectionPrompt(ticker, companyName, sector, historicalData);
      
      const model = 'gemini-3.1-flash-lite-preview';
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

      return this.parseAIResponse(fullResponse, historicalData);
    } catch (error) {
      console.error(`❌ [DIVIDEND RADAR] Erro ao chamar Gemini para ${ticker}:`, error);
      // Fallback para projeções baseadas em regras
      return this.generateRuleBasedProjections(historicalData);
    }
  }

  /**
   * Constrói prompt para Gemini
   */
  private static buildProjectionPrompt(
    ticker: string,
    companyName: string,
    sector: string | null,
    historicalData: Array<{ date: string; amount: number; type: string }>
  ): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Calcular estatísticas do histórico
    const amounts = historicalData.map(d => d.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

    // Agrupar por mês para identificar padrões sazonais
    const byMonth: Record<number, number[]> = {};
    historicalData.forEach(d => {
      const month = new Date(d.date).getMonth() + 1;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(d.amount);
    });

    // Calcular frequência média (quantos dividendos por ano)
    const years = new Set(historicalData.map(d => new Date(d.date).getFullYear()));
    const avgDividendsPerYear = historicalData.length / years.size;

    return `Você é um analista especializado em projeção de dividendos de ações brasileiras.

CONTEXTO:
- Ticker: ${ticker}
- Empresa: ${companyName}
- Setor: ${sector || 'N/A'}
- Data atual: ${now.toISOString().split('T')[0]}

HISTÓRICO DE DIVIDENDOS (últimos 5 anos):
${historicalData.map((d, i) => `${i + 1}. ${d.date}: R$ ${d.amount.toFixed(4)} (${d.type})`).join('\n')}

ESTATÍSTICAS:
- Total de dividendos: ${historicalData.length}
- Média por dividendo: R$ ${avgAmount.toFixed(4)}
- Mínimo: R$ ${minAmount.toFixed(4)}
- Máximo: R$ ${maxAmount.toFixed(4)}
- Média de dividendos por ano: ${avgDividendsPerYear.toFixed(2)}
- Padrões mensais: ${Object.entries(byMonth).map(([month, amounts]) => 
  `Mês ${month}: ${amounts.length} dividendos, média R$ ${(amounts.reduce((a, b) => a + b, 0) / amounts.length).toFixed(4)}`
).join('; ')}

TAREFA:
Analise o histórico e projete os dividendos para os próximos 12 meses (de ${currentMonth}/${currentYear} até ${currentMonth}/${currentYear + 1}).

Para cada mês, você deve identificar:
1. Se há probabilidade de pagamento de dividendo
2. Data ex-dividendo mais provável (dia do mês)
3. Valor projetado (baseado em padrões históricos)
4. Nível de confiança (0-100) baseado em:
   - Consistência histórica no mês
   - Regularidade dos pagamentos
   - Variação dos valores históricos

IMPORTANTE - REGRAS CRÍTICAS:
1. **Padrões Sazonais**: Identifique o padrão real do histórico:
   - Trimestral: Empresas que pagam 4x/ano (ex: Fev, Mai, Ago, Nov ou Mar, Jun, Set, Dez)
   - Semestral: Empresas que pagam 2x/ano
   - Mensal: Apenas se TODOS os meses tiverem histórico consistente
   - Anual: Apenas 1x/ano

2. **Confiança Mínima**: APENAS projete dividendos com confiança >= 60%
   - Confiança alta (70-100): Padrão muito claro e consistente (ex: sempre mesmo mês há 3+ anos)
   - Confiança média (60-69): Padrão claro mas com pequenas variações
   - NÃO projete se confiança < 60%

3. **Análise de Padrão Trimestral**:
   - Se histórico mostra pagamentos em meses específicos (ex: sempre Fev, Mai, Ago, Nov), projete APENAS esses meses
   - NÃO projete para meses onde nunca houve pagamento histórico
   - Se empresa paga trimestralmente, projete apenas 4 meses no ano, não todos os meses

4. **Valores**: Devem ser realistas baseados na média histórica do mês específico

RETORNE APENAS UM JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "projections": [
    {
      "month": 2,
      "year": 2025,
      "projectedExDate": "2025-02-15",
      "projectedAmount": 0.50,
      "confidence": 85
    },
    ...
  ]
}

CRÍTICO: Inclua APENAS meses onde há padrão histórico claro E confiança >= 60%. Se empresa paga trimestralmente, projete apenas os 4 meses trimestrais, não todos os 12 meses.`;
  }

  /**
   * Parse da resposta da IA
   */
  private static parseAIResponse(
    response: string,
    historicalData: Array<{ date: string; amount: number; type: string }>
  ): DividendProjection[] {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na resposta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.projections || !Array.isArray(parsed.projections)) {
        throw new Error('Formato de resposta inválido');
      }

      // Validar e normalizar projeções
      const projections: DividendProjection[] = parsed.projections
        .filter((p: any) => {
          return (
            p.month >= 1 && p.month <= 12 &&
            p.year &&
            p.projectedExDate &&
            p.projectedAmount > 0 &&
            p.confidence >= 60 && p.confidence <= 100 // Filtrar apenas confiança >= 60%
          );
        })
        .map((p: any) => ({
          month: Number(p.month),
          year: Number(p.year),
          projectedExDate: p.projectedExDate,
          projectedAmount: Number(p.projectedAmount),
          confidence: Math.round(Number(p.confidence)),
        }));

      return projections;
    } catch (error) {
      console.error('❌ [DIVIDEND RADAR] Erro ao parsear resposta da IA:', error);
      console.log('Resposta recebida:', response);
      // Fallback para projeções baseadas em regras
      return this.generateRuleBasedProjections(historicalData);
    }
  }

  /**
   * Gera projeções baseadas em regras (fallback quando IA não disponível)
   */
  private static generateRuleBasedProjections(
    historicalData: Array<{ date: string; amount: number; type: string }>
  ): DividendProjection[] {
    if (historicalData.length === 0) {
      return [];
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Calcular média de valores
    const amounts = historicalData.map(d => d.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Agrupar por mês para identificar padrões
    const byMonth: Record<number, number[]> = {};
    historicalData.forEach(d => {
      const month = new Date(d.date).getMonth() + 1;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(d.amount);
    });

    // Calcular frequência média
    const years = new Set(historicalData.map(d => new Date(d.date).getFullYear()));
    const avgDividendsPerYear = historicalData.length / years.size;

    // Identificar meses com histórico (ordenados)
    const monthsWithHistory = Object.keys(byMonth)
      .map(Number)
      .sort((a, b) => a - b);

    const projections: DividendProjection[] = [];

    // Se média > 10 dividendos/ano, projeta mensalmente (apenas meses com histórico)
    if (avgDividendsPerYear >= 10) {
      for (let i = 0; i < 12; i++) {
        const month = ((currentMonth - 1 + i) % 12) + 1;
        const year = currentYear + Math.floor((currentMonth - 1 + i) / 12);
        
        // Apenas projetar se o mês tem histórico consistente
        if (byMonth[month] && byMonth[month].length >= 2) {
          const monthAvg = byMonth[month].reduce((a, b) => a + b, 0) / byMonth[month].length;
          const confidence = byMonth[month].length >= 3 ? 75 : 65;

          projections.push({
            month,
            year,
            projectedExDate: `${year}-${String(month).padStart(2, '0')}-15`,
            projectedAmount: monthAvg,
            confidence,
          });
        }
      }
    } 
    // Se média entre 3.5-10, identificar padrão trimestral específico
    else if (avgDividendsPerYear >= 3.5 && avgDividendsPerYear <= 10) {
      // Identificar meses específicos com histórico (ex: Fev, Mai, Ago, Nov)
      // Projetar apenas esses meses específicos, não todos os trimestres padrão
      monthsWithHistory.forEach(month => {
        // Verificar se o mês aparece consistentemente (pelo menos 2 vezes)
        if (byMonth[month] && byMonth[month].length >= 2) {
          const monthAvg = byMonth[month].reduce((a, b) => a + b, 0) / byMonth[month].length;
          const frequency = byMonth[month].length;
          // Confiança baseada na frequência: mais vezes = mais confiança
          const confidence = frequency >= 4 ? 75 : frequency >= 3 ? 70 : 65;

          projections.push({
            month,
            year: currentYear,
            projectedExDate: `${currentYear}-${String(month).padStart(2, '0')}-15`,
            projectedAmount: monthAvg,
            confidence,
          });
        }
      });
    }
    // Caso contrário, projeta apenas meses com histórico consistente
    else {
      monthsWithHistory.forEach(month => {
        // Apenas projetar se o mês tem histórico (pelo menos 1 vez, mas preferir 2+)
        if (byMonth[month] && byMonth[month].length >= 1) {
          const monthAvg = byMonth[month].reduce((a, b) => a + b, 0) / byMonth[month].length;
          const frequency = byMonth[month].length;
          // Confiança mínima 60% apenas se tiver histórico consistente
          const confidence = frequency >= 2 ? 65 : 60;

          projections.push({
            month,
            year: currentYear,
            projectedExDate: `${currentYear}-${String(month).padStart(2, '0')}-15`,
            projectedAmount: monthAvg,
            confidence,
          });
        }
      });
    }

    // Filtrar apenas projeções com confiança >= 60%
    return projections.filter(p => p.confidence >= 60);
  }

  /**
   * Salva projeções no banco
   */
  private static async saveProjections(
    ticker: string,
    projections: DividendProjection[]
  ): Promise<void> {
    // Buscar último dividendo para salvar a data
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        dividendHistory: {
          orderBy: { exDate: 'desc' },
          take: 1,
        },
      },
    });

    const lastDividendDate = company?.dividendHistory[0]?.exDate || null;

    await safeWrite(
      'update-dividend-radar-projections',
      () =>
        prisma.company.update({
          where: { ticker },
          data: {
            dividendRadarProjections: projections as unknown as Prisma.InputJsonValue,
            dividendRadarLastProcessedAt: new Date(),
            dividendRadarLastDividendDate: lastDividendDate,
          },
        }),
      ['companies']
    );

    console.log(`✅ [DIVIDEND RADAR] ${ticker}: ${projections.length} projeções salvas`);
  }
}

