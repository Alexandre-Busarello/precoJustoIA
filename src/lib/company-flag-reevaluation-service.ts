/**
 * COMPANY FLAG REEVALUATION SERVICE
 * 
 * Serviço para reavaliar flags de empresas após 30 dias,
 * verificando se as condições que geraram a flag ainda existem
 */

import { prisma } from './prisma';
import { FlagType } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { executeCompanyAnalysis } from './company-analysis-service';
import { getComprehensiveFinancialData } from './financial-data-service';
import { toNumber } from './strategies';

export interface ReevaluationResult {
  shouldKeepActive: boolean;
  newReason?: string;
  analysisSummary?: string;
}

export interface CurrentConditions {
  financialData: any;
  overallScore?: number | null;
  fundamentalsAssessment?: string;
  recentPriceVariation?: number;
  researchData?: string;
}

/**
 * Função principal de reavaliação de flag
 */
export async function reevaluateFlag(flagId: string): Promise<ReevaluationResult> {
  // 1. Buscar flag original e dados relacionados
  const flag = await prisma.companyFlag.findUnique({
    where: { id: flagId },
    include: {
      company: {
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          industry: true,
        },
      },
      report: {
        select: {
          id: true,
          type: true,
          createdAt: true,
          metadata: true,
        },
      },
    },
  });

  if (!flag) {
    throw new Error(`Flag ${flagId} não encontrada`);
  }

  // 2. Pesquisar condições atuais da empresa
  const currentConditions = await researchCurrentConditions(
    flag.companyId,
    flag.flagType,
    flag.company.ticker
  );

  // 3. Analisar relevância do flag
  const analysis = await analyzeFlagRelevance(
    flag.reason,
    flag.flagType,
    flag.company.ticker,
    flag.company.name,
    currentConditions
  );

  // 4. Avaliar status final
  return evaluateFlagStatus(analysis, flag.reason);
}

/**
 * Pesquisa condições atuais da empresa
 */
export async function researchCurrentConditions(
  companyId: number,
  flagType: FlagType,
  ticker: string
): Promise<CurrentConditions> {
  // Buscar dados financeiros mais recentes
  const financialData = await getComprehensiveFinancialData(ticker, 'YEARLY', 5);

  // Buscar preço atual e variação recente
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 60, // Últimos 60 dias para calcular variação
      },
      priceOscillations: {
        orderBy: { extractionDate: 'desc' },
        take: 1,
      },
    },
  });

  const latestQuote = company?.dailyQuotes[0];
  const currentPrice = toNumber(latestQuote?.price) || 0;

  // Calcular variação de preço nos últimos 30 dias
  let recentPriceVariation: number | undefined;
  if (company?.dailyQuotes && company.dailyQuotes.length >= 2) {
    const quote30DaysAgo = company.dailyQuotes.find((q, index) => {
      const quoteDate = new Date(q.date);
      const daysDiff = Math.floor(
        (Date.now() - quoteDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff >= 25 && daysDiff <= 35; // Aproximadamente 30 dias
    });

    if (quote30DaysAgo && currentPrice > 0) {
      const price30DaysAgo = toNumber(quote30DaysAgo.price);
      if (price30DaysAgo !== null && price30DaysAgo !== undefined && price30DaysAgo > 0) {
        recentPriceVariation = ((currentPrice - price30DaysAgo) / price30DaysAgo) * 100;
      }
    }
  }

  // Buscar análise de fundamentos atual (se disponível)
  let overallScore: number | null = null;
  let fundamentalsAssessment: string | undefined;

  try {
    // Tentar buscar snapshot mais recente
    const latestSnapshot = await prisma.assetSnapshot.findFirst({
      where: {
        companyId,
        isLatest: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestSnapshot) {
      overallScore = toNumber(latestSnapshot.overallScore);
    }

    // Executar análise de fundamentos se necessário
    if (!financialData) {
      throw new Error('Dados financeiros não disponíveis');
    }

    // Preparar dados para análise
    const latestFinancial = financialData.financialData?.[0];
    const historicalFinancials = financialData.financialData?.slice(0, 5).map((fd: any) => ({
      year: fd.year || new Date().getFullYear(),
      roe: fd.roe,
      roic: fd.roic,
      pl: fd.pl,
      pvp: fd.pvp,
      dy: fd.dy,
      margemLiquida: fd.margemLiquida,
      margemEbitda: fd.margemEbitda,
      margemBruta: fd.margemBruta,
      liquidezCorrente: fd.liquidezCorrente,
      liquidezRapida: fd.liquidezRapida,
      dividaLiquidaPl: fd.dividaLiquidaPl,
      dividaLiquidaEbitda: fd.dividaLiquidaEbitda,
      lpa: fd.lpa,
      vpa: fd.vpa,
      marketCap: fd.marketCap,
      earningsYield: fd.earningsYield,
      evEbitda: fd.evEbitda,
      roa: fd.roa,
      passivoAtivos: fd.passivoAtivos,
    })) || [];

    const companyData = {
      ticker,
      name: company?.name || '',
      sector: company?.sector || null,
      currentPrice,
      financials: latestFinancial || {},
      historicalFinancials,
    };

    // Executar análise completa (sem statements para performance)
    const analysisResult = await executeCompanyAnalysis(companyData, {
      isLoggedIn: false,
      isPremium: false,
      includeStatements: false,
      companyId: companyId.toString(),
      industry: company?.industry || null,
    });

    if (analysisResult.overallScore) {
      overallScore = analysisResult.overallScore.score;
      
      // Determinar avaliação de fundamentos baseado no score
      if (overallScore >= 70) {
        fundamentalsAssessment = 'FORTE';
      } else if (overallScore >= 50) {
        fundamentalsAssessment = 'MODERADO';
      } else if (overallScore >= 30) {
        fundamentalsAssessment = 'FRACO';
      } else {
        fundamentalsAssessment = 'MUITO_FRACO';
      }
    }
  } catch (error) {
    console.warn(`⚠️ Erro ao buscar análise de fundamentos para ${ticker}:`, error);
  }

  // Gerar resumo de pesquisa para IA
  const researchData = buildResearchSummary(
    financialData,
    overallScore,
    fundamentalsAssessment,
    recentPriceVariation,
    ticker
  );

  return {
    financialData,
    overallScore,
    fundamentalsAssessment,
    recentPriceVariation,
    researchData,
  };
}

/**
 * Constrói resumo de pesquisa para análise de IA
 */
function buildResearchSummary(
  financialData: any,
  overallScore: number | null | undefined,
  fundamentalsAssessment: string | undefined,
  recentPriceVariation: number | undefined,
  ticker: string
): string {
  const parts: string[] = [];

  parts.push(`**DADOS FINANCEIROS ATUAIS:**`);
  
  if (financialData?.financialData?.[0]) {
    const latest = financialData.financialData[0];
    parts.push(`- P/L: ${latest.pl || 'N/A'}`);
    parts.push(`- P/VP: ${latest.pvp || 'N/A'}`);
    parts.push(`- ROE: ${latest.roe ? `${latest.roe.toFixed(2)}%` : 'N/A'}`);
    parts.push(`- ROIC: ${latest.roic ? `${latest.roic.toFixed(2)}%` : 'N/A'}`);
    parts.push(`- Dívida Líquida/PL: ${latest.dividaLiquidaPl || 'N/A'}`);
    parts.push(`- Margem Líquida: ${latest.margemLiquida ? `${latest.margemLiquida.toFixed(2)}%` : 'N/A'}`);
  }

  if (overallScore !== null && overallScore !== undefined) {
    parts.push(`\n**SCORE GERAL ATUAL:** ${overallScore.toFixed(2)}/100`);
  }

  if (fundamentalsAssessment) {
    parts.push(`**AVALIAÇÃO DE FUNDAMENTOS:** ${fundamentalsAssessment}`);
  }

  if (recentPriceVariation !== undefined) {
    const variationText = recentPriceVariation >= 0 ? '+' : '';
    parts.push(`\n**VARIAÇÃO DE PREÇO (30 DIAS):** ${variationText}${recentPriceVariation.toFixed(2)}%`);
  }

  return parts.join('\n');
}

/**
 * Analisa relevância do flag comparando condições originais vs atuais
 */
export async function analyzeFlagRelevance(
  originalReason: string,
  flagType: FlagType,
  ticker: string,
  companyName: string,
  currentConditions: CurrentConditions
): Promise<any> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
  });

  const prompt = `Você é um analista fundamentalista experiente.

**CONTEXTO:**
A empresa ${ticker} (${companyName}) teve uma flag de "${flagType}" criada há mais de 30 dias com o seguinte motivo:

"${originalReason}"

**CONDIÇÕES ATUAIS DA EMPRESA:**
${currentConditions.researchData || 'Dados não disponíveis'}

**SUA TAREFA:**

Você precisa determinar se o motivo original que gerou a flag ainda é válido hoje. Considere:

1. **Mudanças nos Fundamentos**: Os problemas fundamentais que geraram a flag ainda existem?
2. **Melhoria ou Deterioração**: A situação melhorou, piorou ou permaneceu estável?
3. **Relevância Atual**: O motivo original ainda é relevante para investidores hoje?

**CRITÉRIOS PARA MANTER FLAG ATIVO:**
- Os problemas fundamentais ainda existem
- A situação não melhorou significativamente
- O motivo original ainda é relevante

**CRITÉRIOS PARA DESATIVAR FLAG:**
- Os problemas fundamentais foram resolvidos
- A situação melhorou significativamente
- O motivo original não é mais relevante
- Mudanças estruturais positivas ocorreram

**FORMATO DE RESPOSTA (JSON):**
\`\`\`json
{
  "shouldKeepActive": true/false,
  "reasoning": "Explicação detalhada sobre se o motivo original ainda é válido (máximo 200 palavras)",
  "newReason": "Novo motivo atualizado (se necessário, máximo 100 palavras)",
  "confidence": "ALTA" | "MEDIA" | "BAIXA"
}
\`\`\`

Responda APENAS com o JSON, sem markdown ou texto adicional.`;

  try {
    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user' as const,
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

    const text = fullResponse;

    // Extrair JSON da resposta
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
    const analysis = JSON.parse(jsonText.trim());

    return analysis;
  } catch (error) {
    console.error('Erro ao analisar relevância do flag:', error);
    throw new Error(`Erro na análise de IA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Avalia status final do flag baseado na análise
 */
export async function evaluateFlagStatus(
  analysis: any,
  originalReason: string
): Promise<ReevaluationResult> {
  return {
    shouldKeepActive: analysis.shouldKeepActive ?? false,
    newReason: analysis.newReason || originalReason,
    analysisSummary: analysis.reasoning,
  };
}

