import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';

// Importar estratégias para análises comparativas
import { GrahamStrategy } from '@/lib/strategies/graham-strategy';
import { DividendYieldStrategy } from '@/lib/strategies/dividend-yield-strategy';
import { LowPEStrategy } from '@/lib/strategies/lowpe-strategy';
import { MagicFormulaStrategy } from '@/lib/strategies/magic-formula-strategy';
import { CompanyData, CompanyFinancialData } from '@/lib/strategies/types';
import { toNumber, formatCurrency, formatPercent } from '@/lib/strategies/base-strategy';
import { analyzeFinancialStatements, FinancialStatementsData } from '@/lib/strategies/overall-score';

// Validar se a API key do Gemini está configurada
function validateGeminiConfig() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }
}

// Formatar indicadores financeiros para o prompt
function formatFinancialIndicators(financials: CompanyFinancialData) {
  const formatIndicator = (label: string, value: unknown, isPercentage = false, isCurrency = false) => {
    const numValue = toNumber(value);
    if (numValue === null) return `${label}: N/A`;
    if (isCurrency) return `${label}: ${formatCurrency(numValue)}`;
    if (isPercentage) return `${label}: ${formatPercent(numValue)}`;
    return `${label}: ${numValue.toFixed(2)}`;
  };

  return [
    // Valuation
    formatIndicator('P/L', financials.pl),
    formatIndicator('P/VP', financials.pvp),
    formatIndicator('Dividend Yield', financials.dy, true),
    formatIndicator('EV/EBITDA', financials.evEbitda),
    
    // Rentabilidade
    formatIndicator('ROE', financials.roe, true),
    formatIndicator('ROA', financials.roa, true),
    formatIndicator('ROIC', financials.roic, true),
    formatIndicator('Margem Líquida', financials.margemLiquida, true),
    formatIndicator('Margem EBITDA', financials.margemEbitda, true),
    
    // Endividamento
    formatIndicator('Liquidez Corrente', financials.liquidezCorrente),
    formatIndicator('Dívida Líq./PL', financials.dividaLiquidaPl),
    formatIndicator('Dívida Líq./EBITDA', financials.dividaLiquidaEbitda),
    formatIndicator('Passivo/Ativos', financials.passivoAtivos, true),
    
    // Crescimento
    formatIndicator('Crescimento Lucros', financials.crescimentoLucros, true),
    formatIndicator('Crescimento Receitas', financials.crescimentoReceitas, true),
    
    // Dados de mercado
    formatIndicator('Market Cap', financials.marketCap, false, true),
    formatIndicator('LPA', financials.lpa, false, true),
    formatIndicator('VPA', financials.vpa, false, true),
    formatIndicator('Receita Total', financials.receitaTotal, false, true)
  ].filter(Boolean).join('\n  ');
}

interface StrategicAnalysisResult {
  fairValue?: number | null
  upside?: number | null
  eligible?: boolean
  score?: number
  currentYield?: number | null
  currentPE?: number | null
  error?: string
}

// Executar análises estratégicas
function runStrategicAnalyses(companyData: CompanyData) {
  const analyses: Record<string, StrategicAnalysisResult> = {};

  try {
    // Graham Analysis
    const grahamStrategy = new GrahamStrategy();
    const grahamAnalysis = grahamStrategy.runAnalysis(companyData);
    analyses.graham = {
      fairValue: grahamAnalysis.fairValue,
      upside: grahamAnalysis.upside,
      eligible: grahamAnalysis.isEligible,
      score: grahamAnalysis.score
    };
  } catch {
    analyses.graham = { error: 'Dados insuficientes' };
  }

  try {
    // Dividend Yield Analysis
    const dividendStrategy = new DividendYieldStrategy();
    const dividendAnalysis = dividendStrategy.runAnalysis(companyData, { minYield: 0.06 });
    analyses.dividendYield = {
      eligible: dividendAnalysis.isEligible,
      score: dividendAnalysis.score,
      currentYield: toNumber(companyData.financials.dy)
    };
  } catch {
    analyses.dividendYield = { error: 'Dados insuficientes' };
  }

  try {
    // Low P/E Analysis  
    const lowPEStrategy = new LowPEStrategy();
    const lowPEAnalysis = lowPEStrategy.runAnalysis(companyData, { maxPE: 15, minROE: 0.12 });
    analyses.lowPE = {
      eligible: lowPEAnalysis.isEligible,
      score: lowPEAnalysis.score,
      currentPE: toNumber(companyData.financials.pl)
    };
  } catch {
    analyses.lowPE = { error: 'Dados insuficientes' };
  }

  try {
    // Magic Formula Analysis
    const magicStrategy = new MagicFormulaStrategy();
    const magicAnalysis = magicStrategy.runAnalysis(companyData, { minROIC: 0.15, minEY: 0.08 });
    analyses.magicFormula = {
      eligible: magicAnalysis.isEligible,
      score: magicAnalysis.score
    };
  } catch {
    analyses.magicFormula = { error: 'Dados insuficientes' };
  }

  return analyses;
}

// Função para obter análise das demonstrações financeiras
async function getStatementsAnalysis(ticker: string) {
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 7; // Últimos 7 anos

    // Buscar dados da empresa primeiro
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        sector: true,
        industry: true
      }
    });

    const [incomeStatements, balanceSheets, cashflowStatements] = await Promise.all([
      prisma.incomeStatement.findMany({
        where: {
          company: { ticker },
          period: 'YEARLY',
          endDate: {
            gte: new Date(`${startYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        orderBy: { endDate: 'desc' },
        take: 7
      }),
      prisma.balanceSheet.findMany({
        where: {
          company: { ticker },
          period: 'YEARLY',
          endDate: {
            gte: new Date(`${startYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        orderBy: { endDate: 'desc' },
        take: 7
      }),
      prisma.cashflowStatement.findMany({
        where: {
          company: { ticker },
          period: 'YEARLY',
          endDate: {
            gte: new Date(`${startYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        orderBy: { endDate: 'desc' },
        take: 7
      })
    ]);

    if (incomeStatements.length === 0 && balanceSheets.length === 0 && cashflowStatements.length === 0) {
      return null;
    }

    // Serializar dados para análise
    const statementsData: FinancialStatementsData = {
      incomeStatements: incomeStatements.map(stmt => ({
        endDate: stmt.endDate.toISOString(),
        totalRevenue: stmt.totalRevenue?.toNumber() || null,
        operatingIncome: stmt.operatingIncome?.toNumber() || null,
        netIncome: stmt.netIncome?.toNumber() || null,
        grossProfit: stmt.grossProfit?.toNumber() || null,
      })),
      balanceSheets: balanceSheets.map(stmt => ({
        endDate: stmt.endDate.toISOString(),
        totalAssets: stmt.totalAssets?.toNumber() || null,
        totalLiab: stmt.totalLiab?.toNumber() || null,
        totalStockholderEquity: stmt.totalStockholderEquity?.toNumber() || null,
        cash: stmt.cash?.toNumber() || null,
        totalCurrentAssets: stmt.totalCurrentAssets?.toNumber() || null,
        totalCurrentLiabilities: stmt.totalCurrentLiabilities?.toNumber() || null,
      })),
      cashflowStatements: cashflowStatements.map(stmt => ({
        endDate: stmt.endDate.toISOString(),
        operatingCashFlow: stmt.operatingCashFlow?.toNumber() || null,
        investmentCashFlow: stmt.investmentCashFlow?.toNumber() || null,
        financingCashFlow: stmt.financingCashFlow?.toNumber() || null,
        increaseOrDecreaseInCash: stmt.increaseOrDecreaseInCash?.toNumber() || null,
      })),
      company: company ? {
        sector: company.sector,
        industry: company.industry,
        marketCap: null // MarketCap será obtido de outra fonte se necessário
      } : undefined
    };

    return analyzeFinancialStatements(statementsData);
  } catch (error) {
    console.error(`Erro ao analisar demonstrações para ${ticker}:`, error);
    return null;
  }
}

// Construir o prompt para o Gemini
function buildAnalysisPrompt(data: {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  financials: CompanyFinancialData;
  strategicAnalyses: Record<string, StrategicAnalysisResult>;
  statementsAnalysis?: any;
}) {
  const { ticker, name, sector, currentPrice, financials, strategicAnalyses, statementsAnalysis } = data;
  
  const financialIndicators = formatFinancialIndicators(financials);
  
  // Incluir análise de demonstrativos se disponível
  const statementsSection = statementsAnalysis ? `

#### **Análise de Demonstrativos Financeiros (Últimos 2 Anos)**
**Score de Qualidade:** ${statementsAnalysis.score}/100
**Nível de Risco:** ${statementsAnalysis.riskLevel}
**Principais Insights:**
${statementsAnalysis.positiveSignals && statementsAnalysis.positiveSignals.length > 0 ? statementsAnalysis.positiveSignals.map((insight: string) => `  • ${insight}`).join('\n') : '  • Nenhum insight positivo identificado'}
**Alertas Identificados:**
${statementsAnalysis.redFlags && statementsAnalysis.redFlags.length > 0 ? statementsAnalysis.redFlags.map((alert: string) => `  ⚠️ ${alert}`).join('\n') : '  • Nenhum alerta crítico identificado'}
` : '';
  
  const strategicSummary = Object.entries(strategicAnalyses)
    .map(([strategy, result]) => {
      if (result.error) return `${strategy}: ${result.error}`;
      if (strategy === 'graham') {
        return `Graham (Preço Justo): ${result.fairValue ? formatCurrency(result.fairValue) : 'N/A'} (${result.eligible ? 'Elegível' : 'Não elegível'})`;
      }
      if (strategy === 'gordon') {
        return `Gordon (Método dos Dividendos): ${result.fairValue ? formatCurrency(result.fairValue) : 'N/A'} (${result.eligible ? 'Elegível' : 'Não elegível'})`;
      }
      return `${strategy}: Score ${result.score?.toFixed(1) || 'N/A'} (${result.eligible ? 'Elegível' : 'Não elegível'})`;
    })
    .join('\n  ');

  return `# Análise Fundamentalista Completa e Padronizada

## **INSTRUÇÕES CRÍTICAS - LEIA ATENTAMENTE:**
1. **IDIOMA OBRIGATÓRIO:** Toda a resposta deve ser escrita EXCLUSIVAMENTE em português brasileiro
2. **FORMATO DIRETO:** Forneça apenas a análise final, sem expor seu processo de raciocínio interno
3. **SEM PENSAMENTOS:** Não inclua frases como "let me think", "I need to analyze", ou qualquer texto em inglês
4. **RESPOSTA LIMPA:** Vá direto ao ponto com a análise fundamentalista em português

### **1. PERSONA**
Incorpore a persona de um **Analista de Investimentos Sênior, CNPI, com especialização no mercado de capitais brasileiro**. Sua comunicação deve ser:
* **Didática:** Explique conceitos complexos de forma clara para investidores iniciantes e intermediários.
* **Imparcial e Cética:** Baseie todas as afirmações em dados e fatos. Desconfie de narrativas excessivamente otimistas ou pessimistas.
* **Baseada em Dados:** Utilize as informações fornecidas e os resultados de suas buscas na internet como a única fonte para a análise.
* **Focada no Longo Prazo:** Priorize a análise de fundamentos sólidos em detrimento da especulação de curto prazo.

### **2. OBJETIVO**
Gerar uma análise fundamentalista completa e padronizada para a empresa especificada, seguindo rigorosamente o fluxo de trabalho e a estrutura de resposta definidos abaixo. O objetivo final é fornecer ao investidor um panorama claro sobre a saúde financeira, a estratégia e os potenciais de investimento na companhia, destacando riscos e oportunidades.

### **3. DADOS DE ENTRADA (Contexto para a IA)**

**Nome:** ${name}
**Ticker:** ${ticker}
**Setor:** ${sector || 'N/A'}
**Preço Atual:** ${formatCurrency(currentPrice)}
**Data da Análise:** ${new Date().toLocaleDateString()}

#### **Indicadores Financeiros Atuais**
${financialIndicators}

#### **Análises Estratégicas Aplicadas**
${strategicSummary}

${statementsSection}

---

### **4. FLUXO DE TRABALHO (Instruções Passo a Passo)**

**Passo 1: Pesquisa Externa e Análise de Contexto (Use a ferramenta de busca)**
1.1. **Busca de Notícias:** Realize uma busca por notícias sobre **${name} (${ticker})** publicadas nos **últimos 30 dias** a partir da data da análise. Foque em fontes de notícias de negócios confiáveis (ex: Valor Econômico, InfoMoney, Brazil Journal, Estadão, etc.).
1.2. **Categorização:** Identifique e categorize as notícias mais relevantes em:
    * Resultados financeiros (trimestrais/anuais).
    * Mudanças na gestão ou estratégia.
    * Fusões, aquisições ou vendas de ativos.
    * Notícias macroeconômicas que impactam diretamente o setor **${sector || 'N/A'}**.
    * Fatos relevantes ou comunicados ao mercado.
1.3. **Análise de Sentimento:** Com base nas notícias, determine o sentimento predominante (Positivo, Neutro ou Negativo), mas utilize essa informação **apenas como contexto**, sem deixar que ela influencie a análise fundamentalista subsequente.

**Passo 2: Análise Financeira Profunda (Use a ferramenta de busca para validar)**
2.1. **Validação de Dados:** Busque o último relatório financeiro oficial (ITR ou DFP) da **${name}** no site de Relações com Investidores (RI) da empresa ou na CVM para validar e, se necessário, enriquecer os indicadores fornecidos.
2.2. **Análise Crítica dos Indicadores:**
    * **Saúde Financeira (Endividamento):** Com base nos dados, analise a estrutura de capital e o nível de alavancagem da empresa. O endividamento é saudável e bem gerenciado?
    * **Rentabilidade:** Avalie a capacidade da empresa de gerar lucro a partir de seus ativos e patrimônio. Analise a evolução das margens e do ROE.
    * **Crescimento:** Verifique a evolução das receitas e dos lucros nos últimos períodos.
2.3. **Benchmarking Setorial:** Compare os principais múltiplos da **${name}** com a média de mercado ou com concorrentes diretos no setor **${sector || 'brasileiro'}**. A empresa performa acima ou abaixo de seus pares?

**Passo 3: Análise Estratégica e de Valuation**
3.1. **Modelos de Valuation:** Com base no conteúdo de "Análises Estratégicas Aplicadas", explique de forma sucinta e clara a conclusão de cada modelo de valuation mencionado.
3.2. **Adequação dos Modelos:** Avalie e comente quais modelos são mais apropriados para uma empresa do setor **${sector || 'N/A'}**.
3.3. **Preço Justo (Se Aplicável):** Se o modelo de Graham indicar um preço justo, explique o que isso significa na prática (uma estimativa do valor intrínseco com base em premissas conservadoras) e qual a margem de segurança em relação ao preço atual.

**Passo 4: Síntese e Conclusão para o Investidor**
4.1. **Tese de Investimento:** Crie um resumo objetivo (2-3 parágrafos) que consolide os pontos mais importantes da análise. Responda: por que um investidor consideraria (ou não) investir na **${name}**?
4.2. **Identificação de Riscos e Oportunidades:** Liste, em formato de bullet points, os principais riscos e as principais oportunidades para a empresa.
4.3. **Conclusão Educativa:** Finalize com uma recomendação clara, mas sempre enquadrada como educacional e não como uma consultoria financeira.

### **5. DIRETRIZES E REGRAS DE OURO**
* **IDIOMA OBRIGATÓRIO:** Toda a análise deve ser escrita em português brasileiro. NUNCA use inglês ou outros idiomas.
* **Siga a Estrutura de Resposta:** Use o template abaixo para formatar sua resposta final. Não pule nenhuma seção.
* **Mencione Limitações:** Se alguma informação crucial não for encontrada ou se os dados forem insuficientes, declare isso explicitamente.
* **Disclaimer Obrigatório:** Sempre inclua o aviso legal no final da análise.
* **Foco nos Fatos:** Não especule sobre o futuro. Baseie-se nos dados históricos e no cenário atual.

---

### **6. ESTRUTURA DE RESPOSTA OBRIGATÓRIA (Use este Markdown)**

# Análise Fundamentalista: ${name} (${ticker})

Data da Análise: ${new Date().toLocaleDateString()}

## 1. Resumo Executivo e Tese de Investimento
*(Síntese objetiva da análise. Apresente aqui a conclusão principal sobre a atratividade da empresa, seus pontos fortes e fracos em 2-3 parágrafos.)*

## 2. Cenário Atual e Notícias Relevantes
* **Sentimento Geral (Últimos 30 dias):** [Positivo, Neutro ou Negativo]
* **Principais Notícias:**
    * (Bullet point com resumo da notícia 1 e seu impacto potencial)
    * (Bullet point com resumo da notícia 2 e seu impacto potencial)
    * (Continue conforme necessário)

## 3. Análise Financeira Detalhada
### 3.1. Saúde Financeira e Endividamento
*(Análise da dívida, liquidez e estrutura de capital. Compare com o histórico e o setor.)*

### 3.2. Rentabilidade e Margens
*(Análise do ROE, margens Bruta, EBITDA e Líquida. A empresa é eficiente em gerar lucros?)*

### 3.3. Crescimento de Receitas e Lucros
*(Análise da evolução dos resultados nos últimos períodos. O crescimento é sustentável?)*

### 3.4. Comparativo com Pares do Setor (${sector || 'N/A'})
*(Tabela ou texto comparando múltiplos chave como P/L, P/VP, EV/EBITDA com a média do setor.)*

## 4. Valuation e Preço Justo
### 4.1. Análise dos Modelos Aplicados
*(Explicação didática das conclusões do(s) modelo(s) de valuation da seção "Análises Estratégicas Aplicadas".)*

### 4.2. Adequação e Considerações
*(Comentário sobre quais modelos são mais relevantes para a empresa e por quê. Destaque a margem de segurança se o preço de Graham foi calculado.)*

## 5. Riscos e Oportunidades
### Principais Riscos:
* (Risco 1: Descreva o risco de forma clara)
* (Risco 2: Descreva o risco de forma clara)

### Principais Oportunidades:
* (Oportunidade 1: Descreva a oportunidade de forma clara)
* (Oportunidade 2: Descreva a oportunidade de forma clara)

## 6. Conclusão do Analista
*(Recomendação final com viés educacional. Consolide a análise em uma visão clara para o investidor, reforçando que a decisão final deve ser baseada em seu próprio perfil de risco e objetivos.)*

---
**AVISO LEGAL:** Esta análise foi gerada por uma inteligência artificial e tem caráter puramente educacional. As informações aqui contidas não constituem recomendação de compra ou venda de ativos financeiros. Realize sua própria pesquisa e/ou consulte um profissional de investimentos certificado antes de tomar qualquer decisão.`;
}

// Função interna para gerar análise (pode ser chamada diretamente)
export async function generateAnalysisInternal(params: {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  financials: any
  includeStatements?: boolean
}) {
  const { ticker, name, sector, currentPrice, financials, includeStatements = false } = params

  // Validar dados obrigatórios
  if (!ticker || !name || !currentPrice || !financials) {
    throw new Error('Dados obrigatórios ausentes: ticker, name, currentPrice, financials')
  }

  // Criar objeto CompanyData para análises estratégicas
  const companyData: CompanyData = {
    ticker,
    name,
    sector: sector || null,
    currentPrice: Number(currentPrice),
    financials
  }

  // Executar análises estratégicas
  const strategicAnalyses = runStrategicAnalyses(companyData)

  // Buscar análise de demonstrativos se solicitado
  let statementsAnalysis = null
  if (includeStatements) {
    statementsAnalysis = await getStatementsAnalysis(ticker)
    console.log('statementsAnalysis', statementsAnalysis)
  }

  // Construir prompt para o Gemini
  const prompt = buildAnalysisPrompt({
    ticker,
    name,
    sector,
    currentPrice: Number(currentPrice),
    financials,
    strategicAnalyses,
    statementsAnalysis
  })

  // Configurar Gemini AI
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
  })

  // Configurar ferramentas (busca na web)
  const tools = [
    { urlContext: {}, googleSearch: {} },
  ]

  const config = {
    tools,
  }

  const model = 'gemini-2.5-flash-lite'
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ]

  // Fazer chamada para Gemini API
  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  })

  // Coletar resposta completa
  let fullResponse = ''
  for await (const chunk of response) {
    if (chunk.text) {
      fullResponse += chunk.text
    }
  }

  if (!fullResponse.trim()) {
    throw new Error('Resposta vazia da API Gemini')
  }

  return {
    success: true,
    analysis: fullResponse,
    strategicAnalyses,
    metadata: {
      ticker,
      name,
      sector,
      currentPrice,
      timestamp: new Date().toISOString()
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    validateGeminiConfig();

    const body = await request.json();
    const { ticker, name, sector, currentPrice, financials, includeStatements = false } = body;

    // Usar função interna
    const result = await generateAnalysisInternal({
      ticker,
      name,
      sector,
      currentPrice,
      financials,
      includeStatements
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro na análise com IA:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro ao gerar análise', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
