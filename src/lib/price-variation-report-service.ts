/**
 * PRICE VARIATION REPORT SERVICE
 * 
 * Serviço para gerar relatórios de variação de preço com pesquisa na internet
 * e análise de perda de fundamento
 */

import { GoogleGenAI } from '@google/genai';
import { prisma } from './prisma';
import { DividendService } from './dividend-service';

export interface PriceVariationReportParams {
  ticker: string;
  companyName: string;
  variation: {
    days: number;
    variation: number;
    currentPrice: number;
    previousPrice: number;
  };
  researchData?: string; // Dados da pesquisa (opcional, pode vir do checkpoint)
}

export interface FundamentalAnalysisResult {
  isFundamentalLoss: boolean;
  conclusion: string;
  reasoning: string;
}

export interface DividendInfo {
  exDate: Date;
  amount: number;
  type?: string | null;
}

export interface DividendsInPeriodResult {
  dividends: DividendInfo[];
  totalAmount: number;
  dividendImpact: number; // Impacto percentual no preço
  adjustedVariation: number; // Variação ajustada sem considerar dividendos
}

/**
 * Verifica dividendos pagos no período analisado
 * Consulta banco de dados e, se necessário, Yahoo Finance para garantir dados atualizados
 */
export async function checkDividendsInPeriod(
  companyId: number,
  ticker: string,
  startDate: Date,
  endDate: Date,
  previousPrice: number
): Promise<DividendsInPeriodResult> {
  try {
    // Normalizar datas para comparação (apenas data, sem hora)
    const normalizedStartDate = new Date(startDate);
    normalizedStartDate.setHours(0, 0, 0, 0);
    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(23, 59, 59, 999);

    // 1. Consultar dividendos no banco de dados
    const dbDividends = await prisma.dividendHistory.findMany({
      where: {
        companyId,
        exDate: {
          gte: normalizedStartDate,
          lte: normalizedEndDate,
        },
      },
      orderBy: {
        exDate: 'desc',
      },
    });

    // 2. Verificar se precisamos buscar dados mais recentes do Yahoo Finance
    // Se o período inclui datas muito recentes (últimos 30 dias), buscar do Yahoo para garantir atualização
    const daysSinceStart = Math.floor((Date.now() - normalizedStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const shouldCheckYahoo = daysSinceStart <= 30;

    let yahooDividends: DividendInfo[] = [];
    if (shouldCheckYahoo) {
      try {
        // Buscar dividendos do Yahoo Finance para o período
        const yahooData = await DividendService.fetchDividendsFromYahoo(ticker, normalizedStartDate);
        
        // Converter para formato DividendInfo
        yahooDividends = yahooData
          .filter(d => {
            const exDate = new Date(d.date);
            return exDate >= normalizedStartDate && exDate <= normalizedEndDate;
          })
          .map(d => ({
            exDate: new Date(d.date),
            amount: d.amount,
            type: d.type || null,
          }));

        // Se encontramos dividendos no Yahoo que não estão no banco, usar os do Yahoo
        // (priorizar Yahoo para dados mais recentes)
        if (yahooDividends.length > dbDividends.length) {
          console.log(`📊 [DIVIDENDS] ${ticker}: Encontrados ${yahooDividends.length} dividendos no Yahoo vs ${dbDividends.length} no banco para o período`);
        }
      } catch (error) {
        console.warn(`⚠️ [DIVIDENDS] ${ticker}: Erro ao buscar dividendos do Yahoo Finance, usando apenas dados do banco:`, error);
      }
    }

    // 3. Combinar dividendos (evitar duplicatas)
    // Criar um Map usando exDate + amount como chave para evitar duplicatas
    const dividendsMap = new Map<string, DividendInfo>();
    
    // Primeiro adicionar dividendos do banco
    dbDividends.forEach(d => {
      const key = `${d.exDate.toISOString().split('T')[0]}_${Number(d.amount).toFixed(6)}`;
      dividendsMap.set(key, {
        exDate: d.exDate,
        amount: Number(d.amount),
        type: d.type,
      });
    });
    
    // Depois adicionar/sobrescrever com dividendos do Yahoo (mais atualizados)
    yahooDividends.forEach(d => {
      const key = `${d.exDate.toISOString().split('T')[0]}_${d.amount.toFixed(6)}`;
      dividendsMap.set(key, d);
    });
    
    // Converter Map para array e ordenar por data
    const dividends: DividendInfo[] = Array.from(dividendsMap.values()).sort(
      (a, b) => b.exDate.getTime() - a.exDate.getTime()
    );

    // 4. Calcular total e impacto
    const totalAmount = dividends.reduce((sum, d) => sum + d.amount, 0);
    const dividendImpact = previousPrice > 0 ? (totalAmount / previousPrice) * 100 : 0;

    return {
      dividends,
      totalAmount,
      dividendImpact,
      adjustedVariation: 0, // Será calculado depois com a variação real
    };
  } catch (error) {
    console.error(`Erro ao verificar dividendos no período para ${ticker}:`, error);
    // Retornar resultado vazio em caso de erro
    return {
      dividends: [],
      totalAmount: 0,
      dividendImpact: 0,
      adjustedVariation: 0,
    };
  }
}

/**
 * Pesquisa na internet sobre o motivo da queda de preço
 */
export async function researchPriceDropReason(
  ticker: string,
  companyName: string,
  variation: PriceVariationReportParams['variation']
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = `Você é um analista financeiro especializado em mercado brasileiro.

A ação ${ticker} (${companyName}) teve uma queda de ${Math.abs(variation.variation).toFixed(2)}% nos últimos ${variation.days} dias.
Preço anterior: R$ ${variation.previousPrice.toFixed(2)}
Preço atual: R$ ${variation.currentPrice.toFixed(2)}

**INSTRUÇÕES PARA PESQUISA:**

1. Pesquise na internet sobre notícias recentes relacionadas a ${companyName} (${ticker})
2. Foque em:
   - Notícias atípicas ou eventos específicos que possam explicar a queda
   - Movimentos de mercado (correção geral, setor em baixa, etc)
   - Mudanças nos fundamentos da empresa (resultados, gestão, regulatório, etc)
   - Análises de especialistas sobre a empresa

3. **IMPORTANTE**: Seja objetivo e factual. Cite fontes quando possível.

4. Retorne um resumo estruturado com:
   - Principais notícias encontradas
   - Possíveis causas da queda
   - Contexto de mercado (se relevante)

**FORMATO DE RESPOSTA:**
- Use markdown
- Seja conciso (máximo 500 palavras)
- Foque em informações recentes (últimos ${variation.days} dias)
- Se não encontrar informações específicas, indique isso claramente`;

  try {
    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const tools = [{ googleSearch: {} }];

    const response = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        tools,
      },
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
  } catch (error) {
    console.error(`Erro ao pesquisar motivo da queda para ${ticker}:`, error);
    throw error;
  }
}

/**
 * Analisa se a queda de preço indica perda de fundamento
 */
export async function analyzeFundamentalImpact(
  ticker: string,
  companyName: string,
  variation: PriceVariationReportParams['variation'],
  researchData: string,
  companyId?: number
): Promise<FundamentalAnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  // Verificar dividendos no período (com janela extra de 5 dias)
  let dividendsInfo: DividendsInPeriodResult = {
    dividends: [],
    totalAmount: 0,
    dividendImpact: 0,
    adjustedVariation: 0,
  };

  if (companyId) {
    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - variation.days - 5); // Janela extra de 5 dias
    startDate.setHours(0, 0, 0, 0);
    
    dividendsInfo = await checkDividendsInPeriod(
      companyId,
      ticker,
      startDate,
      currentDate,
      variation.previousPrice
    );

    // Calcular variação ajustada
    dividendsInfo.adjustedVariation = variation.variation - dividendsInfo.dividendImpact;
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Construir seção sobre dividendos
  const dividendsSection = dividendsInfo.dividends.length > 0
    ? `**DIVIDENDOS NO PERÍODO:**
- Foram detectados ${dividendsInfo.dividends.length} pagamento(s) de dividendo(s) no período
- Total de dividendos: R$ ${dividendsInfo.totalAmount.toFixed(4)} por ação
- Impacto estimado no preço: ${dividendsInfo.dividendImpact.toFixed(2)}%
- Variação ajustada (sem dividendos): ${dividendsInfo.adjustedVariation.toFixed(2)}%
- Datas ex-dividendo: ${dividendsInfo.dividends.map(d => d.exDate.toISOString().split('T')[0]).join(', ')}

**IMPORTANTE**: A queda observada de ${Math.abs(variation.variation).toFixed(2)}% inclui um ajuste de aproximadamente ${dividendsInfo.dividendImpact.toFixed(2)}% devido aos dividendos pagos. Considere isso ao avaliar se há perda de fundamento.`
    : '**DIVIDENDOS NO PERÍODO:**
Nenhum pagamento de dividendo detectado no período.';

  const prompt = `Você é um analista fundamentalista experiente.

A ação ${ticker} (${companyName}) teve uma queda de ${Math.abs(variation.variation).toFixed(2)}% nos últimos ${variation.days} dias.

${dividendsSection}

**DADOS DA PESQUISA:**
${researchData}

**SUA TAREFA:**

Analise se esta queda de preço indica uma **PERDA DE FUNDAMENTO** ou se é apenas:
- Movimento de mercado (correção geral, volatilidade)
- Notícia atípica (evento pontual, especulação)
- Ajuste técnico (sem relação com fundamentos)
${dividendsInfo.dividends.length > 0 ? '- Ajuste por pagamento de dividendos (normal e esperado)' : ''}

**CRITÉRIOS PARA "PERDA DE FUNDAMENTO":**
- Mudanças negativas nos resultados financeiros
- Problemas operacionais ou de gestão
- Mudanças regulatórias adversas
- Perda de competitividade
- Problemas estruturais na empresa

**CRITÉRIOS PARA "NÃO É PERDA DE FUNDAMENTO":**
- Correção de mercado geral
- Volatilidade normal
- Notícia pontual sem impacto estrutural
- Especulação de curto prazo
- Ajuste técnico
${dividendsInfo.dividends.length > 0 ? '- Ajuste por pagamento de dividendos (quando a variação ajustada é menor que a observada)' : ''}

**FORMATO DE RESPOSTA (JSON):**
\`\`\`json
{
  "isFundamentalLoss": true/false,
  "conclusion": "PERDA_DE_FUNDAMENTO" ou "MOVIMENTO_MERCADO" ou "NOTICIA_ATIPICA" ou "AJUSTE_TECNICO"${dividendsInfo.dividends.length > 0 ? ' ou "AJUSTE_DIVIDENDOS"' : ''},
  "reasoning": "Explicação detalhada do raciocínio (máximo 300 palavras). ${dividendsInfo.dividends.length > 0 ? 'Mencione o impacto dos dividendos na sua análise.' : ''}"
}
\`\`\`

Seja objetivo e baseie sua análise nos dados da pesquisa e nas informações sobre dividendos quando disponíveis.`;

  try {
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

    // Extrair JSON da resposta
    let jsonStr = fullResponse;
    
    // Tentar extrair JSON de code blocks
    const jsonBlockMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    } else {
      // Tentar extrair JSON direto
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }
    
    if (!jsonStr || !jsonStr.trim()) {
      throw new Error('Não foi possível extrair JSON da resposta');
    }

    const analysis = JSON.parse(jsonStr.trim()) as FundamentalAnalysisResult;

    return analysis;
  } catch (error) {
    console.error(`Erro ao analisar impacto fundamental para ${ticker}:`, error);
    // Fallback: assumir que não é perda de fundamento se houver erro
    return {
      isFundamentalLoss: false,
      conclusion: 'ANALISE_INDISPONIVEL',
      reasoning: 'Não foi possível realizar análise completa devido a erro técnico.',
    };
  }
}

/**
 * Gera relatório completo de variação de preço
 */
export async function generatePriceVariationReport(
  params: PriceVariationReportParams,
  companyId?: number
): Promise<string> {
  const { ticker, companyName, variation, researchData } = params;

  // Se não tiver dados de pesquisa, pesquisar agora
  let research = researchData;
  if (!research) {
    research = await researchPriceDropReason(ticker, companyName, variation);
  }

  // Verificar dividendos no período (com janela extra de 5 dias)
  let dividendsInfo: DividendsInPeriodResult = {
    dividends: [],
    totalAmount: 0,
    dividendImpact: 0,
    adjustedVariation: 0,
  };

  if (companyId) {
    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - variation.days - 5); // Janela extra de 5 dias
    startDate.setHours(0, 0, 0, 0);
    
    dividendsInfo = await checkDividendsInPeriod(
      companyId,
      ticker,
      startDate,
      currentDate,
      variation.previousPrice
    );

    // Calcular variação ajustada
    dividendsInfo.adjustedVariation = variation.variation - dividendsInfo.dividendImpact;
  }

  // Analisar impacto fundamental (passando companyId para verificar dividendos)
  const analysis = await analyzeFundamentalImpact(
    ticker, 
    companyName, 
    variation, 
    research,
    companyId
  );

  // Construir seção de dividendos para o relatório
  const dividendsSection = dividendsInfo.dividends.length > 0
    ? `## Ajuste por Dividendos

Durante o período analisado, foram detectados ${dividendsInfo.dividends.length} pagamento(s) de dividendo(s):

${dividendsInfo.dividends.map(d => `- **${d.exDate.toISOString().split('T')[0]}**: R$ ${d.amount.toFixed(4)} por ação${d.type ? ` (${d.type})` : ''}`).join('\n')}

**Impacto no preço**: A queda observada de ${Math.abs(variation.variation).toFixed(2)}% inclui um ajuste de aproximadamente ${dividendsInfo.dividendImpact.toFixed(2)}% devido aos dividendos pagos. A variação ajustada (sem considerar dividendos) é de ${dividendsInfo.adjustedVariation.toFixed(2)}%.

> **Nota**: Quando uma empresa paga dividendos, o preço da ação normalmente cai pelo valor do dividendo no dia ex-dividendo. Isso é um ajuste contábil normal e não indica perda de fundamento.`
    : `## Ajuste por Dividendos

Nenhum pagamento de dividendo detectado no período analisado.`;

  // Gerar relatório final
  const report = `# Relatório de Variação de Preço: ${companyName} (${ticker})

## Resumo da Variação

A ação ${ticker} apresentou uma **queda de ${Math.abs(variation.variation).toFixed(2)}%** nos últimos ${variation.days} dias.

- **Preço anterior**: R$ ${variation.previousPrice.toFixed(2)}
- **Preço atual**: R$ ${variation.currentPrice.toFixed(2)}
- **Variação**: ${variation.variation.toFixed(2)}%
${dividendsInfo.dividends.length > 0 ? `- **Variação ajustada (sem dividendos)**: ${dividendsInfo.adjustedVariation.toFixed(2)}%` : ''}

${dividendsSection}

## Pesquisa de Mercado

${research}

## Análise de Impacto Fundamental

**Conclusão**: ${analysis.conclusion === 'PERDA_DE_FUNDAMENTO' ? '⚠️ **PERDA DE FUNDAMENTO DETECTADA**' : analysis.conclusion === 'AJUSTE_DIVIDENDOS' ? '✅ **Ajuste por Dividendos**' : '✅ **Não indica perda de fundamento estrutural**'}

**Raciocínio**:
${analysis.reasoning}

## Recomendações

${analysis.isFundamentalLoss 
  ? '⚠️ **ATENÇÃO**: Esta queda pode indicar problemas estruturais na empresa. Recomenda-se análise mais profunda dos fundamentos antes de tomar decisões de investimento.'
  : dividendsInfo.dividends.length > 0 && Math.abs(dividendsInfo.adjustedVariation) < Math.abs(variation.variation) * 0.5
  ? '✅ **Ajuste Normal**: A maior parte da queda observada pode ser explicada pelo pagamento de dividendos. Continue monitorando os indicadores financeiros e resultados trimestrais.'
  : 'Esta variação parece estar relacionada a movimentos de mercado ou eventos pontuais, sem impacto estrutural nos fundamentos da empresa. Continue monitorando os indicadores financeiros e resultados trimestrais.'}

---
*Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*`;

  return report;
}

/**
 * Cria flag de perda de fundamento se necessário
 */
export async function createFlagIfNeeded(
  companyId: number,
  reportId: string,
  reason: string
): Promise<string | null> {
  const flag = await prisma.companyFlag.create({
    data: {
      companyId,
      reportId,
      flagType: 'FUNDAMENTAL_LOSS',
      reason,
      isActive: true,
    },
  });

  return flag.id;
}

