/**
 * PRICE VARIATION REPORT SERVICE
 * 
 * Serviço para gerar relatórios de variação de preço com pesquisa na internet
 * e análise de perda de fundamento
 */

import { GoogleGenAI } from '@google/genai';
import { prisma } from './prisma';

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
  researchData: string
): Promise<FundamentalAnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = `Você é um analista fundamentalista experiente.

A ação ${ticker} (${companyName}) teve uma queda de ${Math.abs(variation.variation).toFixed(2)}% nos últimos ${variation.days} dias.

**DADOS DA PESQUISA:**
${researchData}

**SUA TAREFA:**

Analise se esta queda de preço indica uma **PERDA DE FUNDAMENTO** ou se é apenas:
- Movimento de mercado (correção geral, volatilidade)
- Notícia atípica (evento pontual, especulação)
- Ajuste técnico (sem relação com fundamentos)

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

**FORMATO DE RESPOSTA (JSON):**
\`\`\`json
{
  "isFundamentalLoss": true/false,
  "conclusion": "PERDA_DE_FUNDAMENTO" ou "MOVIMENTO_MERCADO" ou "NOTICIA_ATIPICA" ou "AJUSTE_TECNICO",
  "reasoning": "Explicação detalhada do raciocínio (máximo 300 palavras)"
}
\`\`\`

Seja objetivo e baseie sua análise nos dados da pesquisa.`;

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
  params: PriceVariationReportParams
): Promise<string> {
  const { ticker, companyName, variation, researchData } = params;

  // Se não tiver dados de pesquisa, pesquisar agora
  let research = researchData;
  if (!research) {
    research = await researchPriceDropReason(ticker, companyName, variation);
  }

  // Analisar impacto fundamental
  const analysis = await analyzeFundamentalImpact(ticker, companyName, variation, research);

  // Gerar relatório final
  const report = `# Relatório de Variação de Preço: ${companyName} (${ticker})

## Resumo da Variação

A ação ${ticker} apresentou uma **queda de ${Math.abs(variation.variation).toFixed(2)}%** nos últimos ${variation.days} dias.

- **Preço anterior**: R$ ${variation.previousPrice.toFixed(2)}
- **Preço atual**: R$ ${variation.currentPrice.toFixed(2)}
- **Variação**: ${variation.variation.toFixed(2)}%

## Pesquisa de Mercado

${research}

## Análise de Impacto Fundamental

**Conclusão**: ${analysis.conclusion === 'PERDA_DE_FUNDAMENTO' ? '⚠️ **PERDA DE FUNDAMENTO DETECTADA**' : '✅ **Não indica perda de fundamento estrutural**'}

**Raciocínio**:
${analysis.reasoning}

## Recomendações

${analysis.isFundamentalLoss 
  ? '⚠️ **ATENÇÃO**: Esta queda pode indicar problemas estruturais na empresa. Recomenda-se análise mais profunda dos fundamentos antes de tomar decisões de investimento.'
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

