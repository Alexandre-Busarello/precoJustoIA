import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { isCurrentUserPremium } from "@/lib/user-service";
import {
  getSectorsAndIndustries,
  generateScreeningParameters,
} from "@/lib/screening-ai-service";
import { executeScreening } from "@/lib/rank-builder-service";
import { RankBuilderResult } from "@/lib/strategies";

interface PortfolioAIRequest {
  prompt: string;
  currentAssets?: Array<{
    ticker: string;
    targetAllocation: number;
  }>;
}

interface Asset {
  ticker: string;
  targetAllocation: number;
}

// Tipos já definidos nos serviços importados

// Funções movidas para serviços reutilizáveis

export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é Premium
    const isPremium = await isCurrentUserPremium();
    if (!isPremium) {
      return NextResponse.json(
        {
          success: false,
          error: "Recurso disponível apenas para usuários Premium",
          message:
            "O assistente IA para carteiras é um recurso exclusivo Premium. Faça upgrade para acessar.",
        },
        { status: 403 }
      );
    }

    const body: PortfolioAIRequest = await request.json();
    const userPrompt = body.prompt?.trim();
    const currentAssets = body.currentAssets || [];

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Prompt é obrigatório" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API key do Gemini não configurada" },
        { status: 500 }
      );
    }

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    // ETAPA 1: Analisar se precisa fazer screening ou se já tem lista de ativos
    const { sectors, industries } = await getSectorsAndIndustries();

    const analysisPrompt = `Você é um especialista em análise de investimentos brasileiros. 
    Você deve escolher apenas TICKERs válidos que são listados na B3 (ETFs, FIIs, Ações ou BDR), não escolha ativos de outras bolsas ou que não sejam da B3.
    Se necessário consulte na internet com a ferramente de busca para garantir que os TICKERs são válidos. 
    - Exemplos de TICKERs inválidos: "SABESP4", "CESP6" (Ticker não existe mais) e etc...
      - ETF: geralmente o ticker termina em 11;
      - FII: geralmente o ticker termina em 11;
      - BDR: geralmente o ticker termina em 34 para BDRs Não Patrocinados e 32 ou 33 para BDRs Patrocinados;
      - Ações: geralmente ordinárias (ON) terminam em 3, enquanto ações preferenciais (PN) terminam em 4. Já 5, 6, 7, 8: Diferentes classes de ações preferenciais (classe A, B, etc.) e 11: Utilizado para units (pacotes que combinam ações ON e PN), fundos imobiliários (FIIs) e BDRs (Brazilian Depositary Receipts);

Analise a seguinte instrução do usuário e determine se precisa fazer screening de ações ou se já tem uma lista específica de ativos:

**INSTRUÇÃO DO USUÁRIO**: "${userPrompt}"

${currentAssets.length > 0 ? `
**CARTEIRA ATUAL**:
${currentAssets.map(asset => `${asset.ticker}: ${(asset.targetAllocation * 100).toFixed(1)}%`).join('\n')}
` : ''}

Você deve retornar APENAS um objeto JSON válido (sem markdown, sem explicações) com a seguinte estrutura:

{
  "needsScreening": true/false,
  "hasSpecificTickers": true/false,
  "specificTickers": ["TICKER1", "TICKER2"] ou null,
  "screeningCriteria": "descrição dos critérios para screening" ou null,
  "portfolioType": "conservadora|agressiva|dividendos|growth|balanceada|setorial|especifica|iteracao",
  "isIteration": true/false,
  "iterationType": "substituir|adicionar|remover|rebalancear" ou null
}

**REGRAS DE ANÁLISE**:

1. **isIteration = true** quando há carteira atual e usuário quer:
   - Trocar/substituir ativos específicos
   - Adicionar novos ativos
   - Remover ativos existentes
   - Rebalancear alocações
   - Modificar setores/estratégias

2. **needsScreening = true** quando:
   - Usuário menciona critérios como "empresas sólidas", "baratas", "crescimento", "dividendos"
   - Menciona setores específicos sem citar tickers
   - Quer "melhores empresas de X setor"
   - Busca por características fundamentalistas

3. **hasSpecificTickers = true** quando:
   - Usuário cita tickers específicos (ex: "30% PETR4, 20% VALE3")
   - Lista empresas por nome
   - Já tem uma seleção definida

4. **iterationType**:
   - "substituir": trocar ativos específicos
   - "adicionar": incluir novos ativos
   - "remover": excluir ativos existentes
   - "rebalancear": ajustar apenas alocações

**EXEMPLOS**:

"Carteira conservadora com empresas sólidas e baratas"
→ {
  "needsScreening": true,
  "hasSpecificTickers": false,
  "specificTickers": null,
  "screeningCriteria": "empresas sólidas com boa rentabilidade e preços atrativos",
  "portfolioType": "conservadora",
  "isIteration": false,
  "iterationType": null
}

"Troque o SMAL11 por BOVA11" (com carteira atual)
→ {
  "needsScreening": false,
  "hasSpecificTickers": true,
  "specificTickers": ["BOVA11"],
  "screeningCriteria": null,
  "portfolioType": "iteracao",
  "isIteration": true,
  "iterationType": "substituir"
}

"Adicione WEGE3 e RENT3 na carteira" (com carteira atual)
→ {
  "needsScreening": false,
  "hasSpecificTickers": true,
  "specificTickers": ["WEGE3", "RENT3"],
  "screeningCriteria": null,
  "portfolioType": "iteracao",
  "isIteration": true,
  "iterationType": "adicionar"
}

"Troque todos os bancos por seguradoras" (com carteira atual)
→ {
  "needsScreening": true,
  "hasSpecificTickers": false,
  "specificTickers": null,
  "screeningCriteria": "seguradoras de qualidade",
  "portfolioType": "iteracao",
  "isIteration": true,
  "iterationType": "substituir"
}

Analise a instrução e retorne APENAS o JSON:`;

    const model = "gemini-2.5-flash-lite";

    const tools = [
      {
        googleSearch: {},
      },
    ];

    const config = {
      thinkingConfig: {
        thinkingBudget: -1,
      },
      tools,
    };

    // Primeira chamada: Análise da necessidade de screening
    const analysisResponse = await ai.models.generateContentStream({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: analysisPrompt }],
        },
      ],
      config
    });

    let analysisResult = "";
    for await (const chunk of analysisResponse) {
      if (chunk.text) {
        analysisResult += chunk.text;
      }
    }

    const analysis = JSON.parse(
      analysisResult
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()
    );

    let availableTickers: string[] = [];
    let screeningResults: RankBuilderResult[] = [];

    // ETAPA 2: Executar screening se necessário (apenas para ações)
    if (analysis.needsScreening && !analysis.hasSpecificTickers) {
      try {
        // Gerar parâmetros de screening usando IA
        const screeningParameters = await generateScreeningParameters(
          analysis.screeningCriteria,
          sectors,
          industries
        );

        // Executar o screening com os parâmetros gerados
        screeningResults = await executeScreening(screeningParameters);
        availableTickers = screeningResults.map((r) => r.ticker);
      } catch (error) {
        console.error("Erro no screening:", error);
        // Continuar sem screening se houver erro
      }
    }

    // ETAPA 3: Montar a carteira com os dados disponíveis
    const portfolioPrompt = `Você é um especialista em montagem de carteiras de investimento no mercado brasileiro (B3). 
    Você deve escolher apenas TICKERs válidos que são listados na B3 (ETFs, FIIs, Ações ou BDR), não escolha ativos de outras bolsas ou que não sejam da B3.
    Se necessário consulte na internet com a ferramente de busca para garantir que os TICKERs são válidos. 
    - Exemplos de TICKERs inválidos: "SABESP4", "CESP6" (Ticker não existe mais) e etc...
      - ETF: geralmente o ticker termina em 11;
      - FII: geralmente o ticker termina em 11;
      - BDR: geralmente o ticker termina em 34 para BDRs Não Patrocinados e 32 ou 33 para BDRs Patrocinados;
      - Ações: geralmente ordinárias (ON) terminam em 3, enquanto ações preferenciais (PN) terminam em 4. Já 5, 6, 7, 8: Diferentes classes de ações preferenciais (classe A, B, etc.) e 11: Utilizado para units (pacotes que combinam ações ON e PN), fundos imobiliários (FIIs) e BDRs (Brazilian Depositary Receipts);

Sua tarefa é criar uma carteira com alocações específicas baseada nos dados fornecidos.

**INSTRUÇÃO ORIGINAL**: "${userPrompt}"

${currentAssets.length > 0 ? `
**CARTEIRA ATUAL**:
${currentAssets.map(asset => `${asset.ticker}: ${(asset.targetAllocation * 100).toFixed(1)}%`).join('\n')}
Total de ativos atuais: ${currentAssets.length}
` : ''}

**DADOS DISPONÍVEIS**:
${
  analysis.hasSpecificTickers
    ? `Tickers específicos mencionados: ${analysis.specificTickers?.join(", ")}`
    : analysis.needsScreening && availableTickers.length > 0
    ? `Ações selecionadas pelo screening: ${availableTickers
        .slice(0, 15)
        .join(", ")}`
    : "Nenhum screening realizado - use conhecimento geral de tickers brasileiros"
}

${
  screeningResults.length > 0
    ? `
**DADOS FUNDAMENTALISTAS DAS AÇÕES**:
${screeningResults
  .slice(0, 10)
  .map(
    (r) =>
      `${r.ticker} (${r.name}) - Setor: ${r.sector || "N/A"} - Upside: ${
        r.upside ? (r.upside * 100).toFixed(1) + "%" : "N/A"
      }`
  )
  .join("\n")}
`
    : ""
}

Você deve retornar APENAS um objeto JSON válido (sem markdown, sem explicações) com a seguinte estrutura:

{
  "assets": [
    {
      "ticker": "TICKER1",
      "targetAllocation": 0.25
    }
  ],
  "reasoning": "Breve explicação da estratégia (máximo 150 caracteres)",
  "dataSource": "screening|specific|general"
}

**REGRAS CRÍTICAS**:

${analysis.isIteration ? `
**MODO ITERAÇÃO** (modificar carteira existente):
- **Substituir**: Troque apenas os ativos mencionados, mantenha os outros
- **Adicionar**: Inclua novos ativos redistribuindo as alocações proporcionalmente
- **Remover**: Exclua ativos mencionados e redistribua para os restantes
- **Rebalancear**: Ajuste apenas as alocações sem trocar ativos

**Exemplos de iteração**:
- "Troque SMAL11 por BOVA11" → Substitua apenas esse ativo
- "Adicione WEGE3" → Inclua WEGE3 e redistribua as alocações
- "Remova todos os bancos" → Identifique e remova bancos, redistribua
- "Troque bancos por seguradoras" → Use screening para encontrar seguradoras
` : ''}

1. **Prioridade de seleção**:
   - Se há carteira atual E é iteração: MODIFIQUE baseado na instrução
   - Se há tickers específicos mencionados: USE APENAS ESSES
   - Se há resultados de screening: PRIORIZE ESSES (máximo 12 ativos)
   - Caso contrário: Use conhecimento geral (evite exemplos fixos)

2. **Para FIIs, ETFs e BDRs** (não cobertos pelo screening):
   - Use conhecimento geral de mercado
   - FIIs conhecidos: HGLG11, XPML11, KNRI11, MXRF11, BTLG11
   - ETFs: BOVA11, SMAL11, IVVB11

3. **Alocações**: 
   - Use valores decimais (0.25 = 25%)
   - A soma deve estar entre 0.95 e 1.05
   - Mínimo 3 ativos, máximo 20 ativos
   - Distribua de forma inteligente baseada na estratégia

4. **Diversificação**:
   - Evite concentração excessiva em um setor
   - Balance entre diferentes tipos de ativos se solicitado
   - Respeite as proporções mencionadas pelo usuário

**IMPORTANTE**: 
- NÃO use tickers inventados
- PRIORIZE os dados fornecidos pelo screening quando disponíveis
- Para carteiras mistas (ações + FIIs), use proporção adequada
- Mantenha o "reasoning" conciso e objetivo
- Priorize carteira com pelo MENOS 10 ativos (se não for informado um valor exato)

Analise os dados e retorne APENAS o JSON da carteira:`;

    // Segunda chamada: Montar a carteira
    const portfolioResponse = await ai.models.generateContentStream({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: portfolioPrompt }],
        },
      ],
      config
    });

    let portfolioResult = "";
    for await (const chunk of portfolioResponse) {
      if (chunk.text) {
        portfolioResult += chunk.text;
      }
    }

    if (!portfolioResult.trim()) {
      throw new Error("Resposta vazia da API Gemini");
    }

    // Limpar markdown se presente
    const text = portfolioResult
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Parse do JSON
    const result = JSON.parse(text);

    // Validar estrutura da resposta
    if (
      !result.assets ||
      !Array.isArray(result.assets) ||
      result.assets.length === 0
    ) {
      throw new Error("Resposta inválida da IA: nenhum ativo gerado");
    }

    // Validar cada ativo
    for (const asset of result.assets) {
      if (!asset.ticker || typeof asset.ticker !== "string") {
        throw new Error("Ticker inválido encontrado");
      }
      if (
        typeof asset.targetAllocation !== "number" ||
        asset.targetAllocation <= 0
      ) {
        throw new Error("Alocação inválida encontrada");
      }
    }

    // Normalizar alocações para somar exatamente 1
    const totalAllocation = result.assets.reduce(
      (sum: number, asset: Asset) => sum + asset.targetAllocation,
      0
    );

    if (totalAllocation > 0) {
      result.assets = result.assets.map((asset: Asset) => ({
        ...asset,
        targetAllocation: asset.targetAllocation / totalAllocation,
      }));
    }

    return NextResponse.json({
      success: true,
      assets: result.assets,
      reasoning: result.reasoning || "Carteira gerada pela IA",
      dataSource:
        result.dataSource ||
        (screeningResults.length > 0 ? "screening" : "general"),
      screeningUsed: screeningResults.length > 0,
      screeningResults: screeningResults.length,
      prompt: userPrompt,
      message: `Carteira com ${result.assets.length} ativos configurada com sucesso`,
    });
  } catch (error) {
    console.error("Erro ao processar carteira com IA:", error);
    return NextResponse.json(
      {
        error: "Erro ao processar solicitação com IA",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
