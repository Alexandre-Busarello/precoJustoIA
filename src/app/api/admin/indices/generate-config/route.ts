/**
 * API: Generate Index Config with AI
 * POST /api/admin/indices/generate-config
 * 
 * Gera configuração de índice usando Gemini AI a partir de prompt em linguagem natural
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GoogleGenAI } from '@google/genai';
import { requireAdminUser } from '@/lib/user-service';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação e admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt é obrigatório' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API key do Gemini não configurada' },
        { status: 500 }
      );
    }

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    });

    const systemPrompt = `Você é um especialista em criação de índices de ações brasileiras.

Sua tarefa é converter instruções em linguagem natural em uma configuração JSON para um índice automatizado.

**INSTRUÇÃO DO USUÁRIO**: "${prompt}"

Você deve retornar APENAS um objeto JSON válido (sem markdown, sem explicações) com a seguinte estrutura:

{
  "ticker": "IPJ-XXXX",
  "name": "Nome Completo do Índice",
  "description": "Descrição breve do índice",
  "methodology": "Descrição detalhada da metodologia em markdown",
  "type": "VALUE|DIVIDEND|GROWTH|QUALITY|etc",
  "universe": "B3",
  "assetTypes": ["STOCK"] | ["BDR"] | ["STOCK", "BDR"],
  "excludedTickers": ["SOND5", "PETR6"],
  "excludedTickerPatterns": ["*5", "*6"],
  "liquidity": {
    "minAverageDailyVolume": 2000000
  },
  "quality": {
    "roe": { "gte": 0.10 },
    "margemLiquida": { "gte": 0.05 },
    "dividaLiquidaEbitda": { "lte": 3.0 },
    "payout": { "lte": 0.30 },
    "marketCap": { "gte": 1000000000 },
    "overallScore": { "gte": 60 },
    "pl": { "lte": 15 },
    "pvp": { "lte": 2.0 },
    "strategy": {
      "type": "graham|fcd|dividendYield|lowPE|magicFormula|gordon|fundamentalist|barsi|ai|screening",
      "params": {}
    }
  },
  "selection": {
    "topN": 10,
    "orderBy": "upside|dy|overallScore|marketCap|technicalMargin",
    "orderDirection": "desc|asc",
    "scoreBands": [
      { "min": 50, "max": 60, "maxCount": 3 },
      { "min": 60, "max": 70, "maxCount": 5 }
    ]
  },
  "filters": {
    "requirePositiveUpside": true,
    "minUpside": 10,
    "technicalFairValue": {
      "enabled": true,
      "requireBelowFairPrice": true,
      "requireAboveMinPrice": true
    }
  },
  "weights": {
    "type": "equal|marketCap",
    "value": 0.10
  },
  "rebalance": {
    "threshold": 0.05,
    "checkQuality": true,
    "upsideType": "best"
  },
  "diversification": {
    "type": "allocation|maxCount",
    "sectorAllocation": { "Financeiro": 0.20, "Energia": 0.15 },
    "maxCountPerSector": { "Financeiro": 3, "Energia": 2 }
  }
}

**UNIVERSO E TIPOS DE ATIVOS**:

- universe: "B3" (atualmente apenas B3 é suportado)
- assetTypes: Array de tipos de ativos permitidos (opcional)
  - Valores possíveis: "STOCK" (ações B3), "BDR" (Brazilian Depositary Receipts), "ETF", "FII", "INDEX", "OTHER"
  - Exemplos:
    - ["STOCK"] - Apenas ações B3 (padrão quando universe é "B3")
    - ["BDR"] - Apenas BDRs
    - ["STOCK", "BDR"] - Ações B3 e BDRs
  - Se não especificado e universe for "B3", o padrão é ["STOCK"]

**EXCLUSÕES DE TICKERS**:

- excludedTickers: Array de tickers específicos a excluir (ex: ["SOND5", "PETR6"])
- excludedTickerPatterns: Array de padrões de exclusão
  - "*5" ou "*6": Exclui tickers terminados em 5 ou 6
  - "PET*": Exclui tickers que começam com PET
  - Padrão exato: Exclui ticker específico

**CAMPOS DISPONÍVEIS PARA FILTROS DE QUALIDADE**:

IMPORTANTE: Sempre inclua filtros básicos de qualidade além de marketCap quando apropriado. Use estratégias apenas quando o usuário solicitar especificamente uma estratégia de investimento conhecida.

**Filtros Básicos (SEMPRE incluir quando apropriado)**:
- roe: ROE mínimo/máximo (decimal, ex: 0.10 = 10%) - Use para empresas de qualidade
- margemLiquida: Margem Líquida mínimo/máximo (decimal, ex: 0.05 = 5%) - Use para empresas lucrativas
- dividaLiquidaEbitda: Dívida Líquida/EBITDA máximo (decimal, ex: 3.0 = 3x) - Use para empresas com baixo endividamento
- overallScore: Score Geral mínimo/máximo (0-100) - Use para garantir qualidade mínima (ex: gte: 50)
- payout: Payout mínimo/máximo (decimal, ex: 0.30 = 30%) - Use para empresas de crescimento (payout baixo) ou dividendos (payout alto)
- marketCap: Market Cap mínimo/máximo em R$ (ex: 500000000 = R$ 500 milhões, 5000000000 = R$ 5 bilhões)
- pl: P/L (Price to Earnings) mínimo/máximo (decimal, ex: { "lte": 15 } = P/L <= 15) - Use para empresas baratas em relação ao lucro
- pvp: P/VP (Price to Book Value) mínimo/máximo (decimal, ex: { "lte": 2.0 } = P/VP <= 2.0) - Use para empresas baratas em relação ao patrimônio

**Estratégias (Use APENAS quando o usuário solicitar explicitamente)**:
- strategy: Seleção por estratégia específica (OPCIONAL)
  - type: "graham" (value investing), "fcd" (fluxo de caixa descontado), "dividendYield" (dividendos), "lowPE" (P/L baixo), "magicFormula" (fórmula mágica de Greenblatt), "gordon" (crescimento de dividendos), "fundamentalist" (análise fundamentalista), "barsi" (dividendos crescentes), "ai" (análise com IA)
  - NÃO use "screening" como estratégia - use filtros diretos em vez disso
  - params: Parâmetros específicos da estratégia (ver documentação)
  - Quando usar estratégia: Combine com filtros básicos de qualidade. A estratégia ranqueia, os filtros garantem qualidade mínima.

**REGRAS IMPORTANTES**:
1. Se o usuário não mencionar uma estratégia específica, NÃO inclua o campo "strategy"
2. Sempre inclua filtros básicos de qualidade (roe, margemLiquida, dividaLiquidaEbitda, overallScore) quando apropriado para o tipo de índice
3. Para índices de crescimento: use payout baixo (lte: 0.30), roe alto (gte: 0.15), overallScore alto (gte: 70)
4. Para índices de valor: use roe moderado (gte: 0.10), dividaLiquidaEbitda baixo (lte: 3.0), overallScore moderado (gte: 50), pl baixo (lte: 15), pvp baixo (lte: 2.0), requirePositiveUpside: true
5. Para índices de dividendos: use payout alto, dy alto, overallScore moderado
6. Para índices técnicos: use technicalFairValue.enabled: true, requireBelowFairPrice: true, requireAboveMinPrice: true, orderBy: "technicalMargin", orderDirection: "asc"
7. MarketCap deve sempre ser incluído quando mencionado pelo usuário
8. Se o usuário mencionar "upside positivo", "empresas descontadas" ou similar, inclua requirePositiveUpside: true
9. Se o usuário mencionar "análise técnica", "preço justo técnico", "timing" ou "oportunidades técnicas", inclua filtros técnicos apropriados
10. Se o usuário mencionar "P/L baixo", "empresas baratas", "valor justo" ou similar, inclua pl com limite máximo (ex: { "lte": 15 })
11. Se o usuário mencionar "P/VP baixo", "preço abaixo do patrimônio", "valor contábil" ou similar, inclua pvp com limite máximo (ex: { "lte": 2.0 })

**CRITÉRIOS DE SELEÇÃO**:

- topN: Número de empresas a selecionar (padrão: 10)
- orderBy: Critério de ordenação
  - "upside": Maior potencial de valorização (fairValue - currentPrice)
  - "dy": Maior Dividend Yield
  - "overallScore": Maior Score Geral
  - "marketCap": Maior Market Cap
  - "technicalMargin": Margem técnica (diferença percentual entre preço atual e preço justo técnico calculado pela IA)
    - Valores negativos indicam preço abaixo do justo técnico (melhor oportunidade)
    - Use "asc" para ordenar por melhor margem técnica (valores mais negativos primeiro)
- orderDirection: "desc" para maior primeiro, "asc" para menor primeiro
- scoreBands: Limites por faixa de score (opcional)
  - Array de objetos com { min, max, maxCount }
  - Ex: [{ "min": 50, "max": 60, "maxCount": 3 }] = máximo 3 ativos com score entre 50-60
  - Se não especificado, usa topN tradicional

**FILTROS ADICIONAIS**:

- filters: Filtros opcionais para refinar a seleção
  - requirePositiveUpside: Se true, filtra apenas empresas com upside > 0 (recomendado para índices de valor)
    - Use quando o usuário mencionar "upside positivo", "empresas descontadas", "valor justo acima do preço"
    - Padrão: false (não filtrar por upside positivo)
  - minUpside: Upside mínimo em porcentagem (ex: 10 = 10% de upside mínimo)
    - Use quando o usuário especificar um upside mínimo específico
  - technicalFairValue: Filtros baseados em análise técnica com IA (OPCIONAL)
    - enabled: Se true, habilita filtros de análise técnica
    - requireBelowFairPrice: Se true, filtra empresas com preço atual <= preço justo técnico (aiFairEntryPrice)
      - Use quando o usuário mencionar "análise técnica", "preço justo técnico", "timing de entrada", "oportunidades técnicas"
    - requireAboveMinPrice: Se true, filtra empresas com preço atual >= preço mínimo técnico (aiMinPrice)
      - Garante que o preço está dentro da faixa prevista pela análise técnica
    - Quando usar filtros técnicos: Combine com orderBy: "technicalMargin" e orderDirection: "asc" para ordenar por melhor margem técnica

**PESOS**:

- type: "equal" para pesos iguais, "marketCap" para pesos proporcionais ao market cap, "overallScore" para pesos proporcionais ao score geral, "custom" para pesos personalizados
- value: Para equal weight, valor do peso individual (ex: 0.10 = 10% para cada)
- minWeight: Peso mínimo para score-based (ex: 0.02 = 2%)
- maxWeight: Peso máximo para score-based (ex: 0.15 = 15%)
- customWeights: Para custom, objeto com tickers e pesos (ex: { "PETR4": 0.15, "VALE3": 0.10 })

**REBALANCEAMENTO**:

- threshold: Diferença mínima de upside para trocar ativo (decimal, ex: 0.05 = 5%)
  - Aplicado apenas quando não há entrada/saída de ativos na composição
  - Quando há entrada/saída de ativos, o rebalanceamento sempre ocorre (threshold não aplicado)
  - Quando não há mudanças na composição, compara a diferença entre o upside do primeiro ativo novo e o último ativo atual
- checkQuality: Se deve verificar qualidade antes de trocar (boolean)
- upsideType: Tipo de upside a usar no threshold (opcional, padrão: "best")
  - "best": Usa o melhor upside disponível entre todos os tipos (padrão recomendado)
  - "graham": Usa apenas o upside calculado pela estratégia Graham (value investing)
  - "fcd": Usa apenas o upside calculado pelo Fluxo de Caixa Descontado (DCF)
  - "gordon": Usa apenas o upside calculado pelo modelo de crescimento de dividendos de Gordon
  - "barsi": Usa apenas o upside calculado pelo Método Barsi (preço teto baseado em dividendos)
  - "technical": Usa apenas o upside baseado no Preço Justo da Análise Técnica (aiFairEntryPrice)
  - Quando usar tipos específicos:
    - Use "graham" para índices focados em value investing
    - Use "fcd" para índices focados em análise de fluxo de caixa
    - Use "gordon" para índices focados em dividendos crescentes
    - Use "barsi" para índices focados em dividendos com preço teto
    - Use "technical" para índices focados em análise técnica/timing de entrada
    - Use "best" (ou omita) para índices gerais que querem aproveitar o melhor upside disponível

**DIVERSIFICAÇÃO POR SETOR**:

- type: "allocation" para alocação percentual ou "maxCount" para quantidade máxima
- sectorAllocation: Para allocation, objeto com setor e percentual (ex: { "Financeiro": 0.20, "Energia": 0.15 })
- maxCountPerSector: Para maxCount, objeto com setor e quantidade máxima (ex: { "Financeiro": 3, "Energia": 2 })

**Setores disponíveis**: Bens Industriais, Comunicações, Consumo Cíclico, Consumo Não Cíclico, Energia, Financeiro, Imobiliário, Materiais Básicos, Saúde, Tecnologia da Informação, Utilidade Pública

**CAMPOS OBRIGATÓRIOS ADICIONAIS**:

- ticker: Ticker do índice no formato "IPJ-XXXX" (ex: "IPJ-VALUE", "IPJ-DIVIDEND", "IPJ-GROWTH", "IPJ-SMALLCAP")
  - Deve ser único e seguir o padrão IPJ- seguido de um identificador em MAIÚSCULAS
  - Baseado no tipo do índice e características principais
  - OBRIGATÓRIO: Sempre gere um ticker apropriado
- name: Nome completo e descritivo do índice (ex: "Índice Preço Justo Value", "Índice Preço Justo Dividendos", "Índice Preço Justo Small Caps")
  - OBRIGATÓRIO: Sempre gere um nome descritivo
- description: Descrição breve do índice (ex: "Índice focado em empresas de valor com ROE acima de 15%")
  - OBRIGATÓRIO: Sempre gere uma descrição
- methodology: Descrição detalhada da metodologia em formato markdown, incluindo:
  - Universo de seleção e tipos de ativos
  - Critérios de qualidade e liquidez (liste TODOS os filtros aplicados)
  - Filtros adicionais (upside positivo, análise técnica, etc.)
  - Processo de seleção e ordenação
  - Sistema de pesos
  - Regras de rebalanceamento (inclua o tipo de upside usado se diferente de "best")
  - Modelo de cálculo (Total Return com reinvestimento automático de dividendos)
  - OBRIGATÓRIO: Sempre gere uma metodologia completa e detalhada

**EXEMPLOS**:

"Índice de empresas de valor com ROE acima de 15%, top 15 empresas ordenadas por upside"
→ {
  "ticker": "IPJ-VALUE",
  "name": "Índice Preço Justo Value",
  "description": "Índice focado em empresas de valor com alta rentabilidade e potencial de valorização",
  "methodology": "**Metodologia IPJ-VALUE:**\n\n1. **Universo**: Ações listadas na B3 (apenas STOCK)\n2. **Liquidez**: Volume Médio Diário > R$ 2.000.000\n3. **Qualidade**:\n   - ROE >= 15%\n   - Margem Líquida >= 5%\n   - Dívida Líquida/EBITDA <= 3x\n   - Score Geral >= 50\n4. **Filtros**: Apenas empresas com upside positivo (valor justo > preço atual)\n5. **Seleção**: Top 15 empresas ordenadas por maior Upside\n6. **Pesos**: Iguais (6,67% cada)\n7. **Rebalanceamento**: Monitoramento diário com threshold de 5%\n\n**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos.",
  "type": "VALUE",
  "universe": "B3",
  "assetTypes": ["STOCK"],
  "liquidity": { "minAverageDailyVolume": 2000000 },
  "quality": {
    "roe": { "gte": 0.15 },
    "margemLiquida": { "gte": 0.05 },
    "dividaLiquidaEbitda": { "lte": 3.0 },
    "overallScore": { "gte": 50 }
  },
  "selection": { "topN": 15, "orderBy": "upside", "orderDirection": "desc" },
  "weights": { "type": "equal", "value": 0.0667 },
  "rebalance": { "threshold": 0.05, "checkQuality": true, "upsideType": "best" },
  "filters": { "requirePositiveUpside": true }
}

"Índice de dividendos, top 20 empresas com maior DY, mínimo 6% de yield"
→ {
  "ticker": "IPJ-DIVIDEND",
  "name": "Índice Preço Justo Dividendos",
  "description": "Índice focado em empresas pagadoras de dividendos com yield mínimo de 6%",
  "methodology": "**Metodologia IPJ-DIVIDEND:**\n\n1. **Universo**: Ações listadas na B3 (apenas STOCK)\n2. **Liquidez**: Volume Médio Diário > R$ 2.000.000\n3. **Qualidade**:\n   - ROE >= 10%\n   - Margem Líquida >= 5%\n   - Dívida Líquida/EBITDA <= 3x\n   - Score Geral >= 50\n4. **Seleção**: Top 20 empresas ordenadas por maior Dividend Yield\n5. **Pesos**: Iguais (5% cada)\n6. **Rebalanceamento**: Monitoramento diário com threshold de 5%\n\n**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos.",
  "type": "DIVIDEND",
  "universe": "B3",
  "assetTypes": ["STOCK"],
  "liquidity": { "minAverageDailyVolume": 2000000 },
  "quality": {
    "roe": { "gte": 0.10 },
    "margemLiquida": { "gte": 0.05 },
    "dividaLiquidaEbitda": { "lte": 3.0 },
    "overallScore": { "gte": 50 }
  },
  "selection": { "topN": 20, "orderBy": "dy", "orderDirection": "desc" },
  "weights": { "type": "equal", "value": 0.05 },
  "rebalance": { "threshold": 0.05, "checkQuality": true, "upsideType": "best" }
}

"Índice de BOAS SMALL CAPS com potencial de crescimento. Market CAP maior que 500 milhões e menor que 5 Bilhões"
→ {
  "ticker": "IPJ-SMALLCAP",
  "name": "Índice Preço Justo Small Caps",
  "description": "Índice focado em empresas de pequeno porte com potencial de crescimento e qualidade fundamentalista",
  "methodology": "**Metodologia IPJ-SMALLCAP:**\n\n1. **Universo**: Ações listadas na B3 (apenas STOCK)\n2. **Liquidez**: Volume Médio Diário > R$ 2.000.000\n3. **Qualidade**:\n   - ROE >= 15%\n   - Margem Líquida >= 10%\n   - Dívida Líquida/EBITDA <= 2x\n   - Payout <= 30% (empresas que reinvestem lucros)\n   - Score Geral >= 70\n   - Market Cap entre R$ 500 milhões e R$ 5 bilhões\n4. **Seleção**: Top 15 empresas ordenadas por maior Score Geral\n5. **Pesos**: Proporcionais ao Score Geral (mínimo 3%, máximo 12%)\n6. **Rebalanceamento**: Monitoramento diário com threshold de 5%\n\n**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos.",
  "type": "GROWTH",
  "universe": "B3",
  "assetTypes": ["STOCK"],
  "liquidity": { "minAverageDailyVolume": 2000000 },
  "quality": {
    "roe": { "gte": 0.15 },
    "margemLiquida": { "gte": 0.10 },
    "dividaLiquidaEbitda": { "lte": 2.0 },
    "payout": { "lte": 0.30 },
    "marketCap": { "gte": 500000000, "lte": 5000000000 },
    "overallScore": { "gte": 70 }
  },
  "selection": { "topN": 15, "orderBy": "overallScore", "orderDirection": "desc" },
  "weights": { "type": "overallScore", "minWeight": 0.03, "maxWeight": 0.12 },
  "rebalance": { "threshold": 0.05, "checkQuality": true, "upsideType": "best" }
}

"Índice baseado em análise técnica, empresas com score > 50 que estão abaixo do preço justo técnico"
→ {
  "ticker": "IPJ-TECNICO",
  "name": "Índice Preço Justo Técnico",
  "description": "Carteira teórica baseada em análise técnica com IA. Seleciona empresas com score > 50 que estão abaixo do preço justo técnico.",
  "methodology": "**Metodologia IPJ-TECNICO:**\n\n1. **Universo**: Ações listadas na B3 (apenas STOCK)\n2. **Liquidez**: Volume Médio Diário > R$ 2.000.000\n3. **Qualidade**:\n   - Score Geral >= 50\n4. **Filtros**:\n   - Upside positivo (valor justo > preço atual)\n   - Análise técnica: Preço atual <= Preço Justo Técnico (aiFairEntryPrice)\n   - Análise técnica: Preço atual >= Preço Mínimo Técnico (aiMinPrice)\n5. **Seleção**: Top 15 empresas ordenadas por melhor margem técnica (maior desconto em relação ao preço justo técnico)\n6. **Pesos**: Iguais (6,67% cada)\n7. **Rebalanceamento**: Monitoramento diário com threshold de 5%\n\n**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos.\n\n**Sobre a Análise Técnica com IA**: Utiliza análise técnica avançada combinada com inteligência artificial para calcular preços justos de entrada. A margem técnica indica o desconto percentual do preço atual em relação ao preço justo técnico calculado pela IA.",
  "type": "TECHNICAL",
  "universe": "B3",
  "assetTypes": ["STOCK"],
  "liquidity": { "minAverageDailyVolume": 2000000 },
  "quality": {
    "overallScore": { "gte": 50 }
  },
  "filters": {
    "requirePositiveUpside": true,
    "technicalFairValue": {
      "enabled": true,
      "requireBelowFairPrice": true,
      "requireAboveMinPrice": true
    }
  },
  "selection": { "topN": 15, "orderBy": "technicalMargin", "orderDirection": "asc" },
  "weights": { "type": "equal", "value": 0.0667 },
  "rebalance": { "threshold": 0.05, "checkQuality": true, "upsideType": "technical" }
}

Analise a instrução e retorne APENAS o JSON válido:`;

    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      }
    ];

    const response = await ai.models.generateContentStream({
      model,
      contents
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

    // Extrair JSON da resposta (pode vir com markdown)
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Não foi possível extrair JSON da resposta');
    }

    const generated = JSON.parse(jsonMatch[0]);

    // Extrair campos de metadados (ticker, name, description, methodology) do objeto gerado
    const { ticker, name, description, methodology, ...config } = generated;

    // Validar estrutura básica
    if (!config.type || !config.universe || !config.selection) {
      throw new Error('Configuração gerada está incompleta');
    }

    // Validar que campos obrigatórios foram gerados
    if (!ticker || !name || !methodology) {
      throw new Error('Configuração gerada está incompleta: faltam ticker, name ou methodology');
    }

    // Gerar ticker padrão se não fornecido
    const indexTicker = ticker || `IPJ-${config.type?.toUpperCase() || 'CUSTOM'}`;
    
    // Gerar nome padrão se não fornecido
    const indexName = name || `Índice Preço Justo ${config.type?.charAt(0).toUpperCase() + config.type?.slice(1) || 'Customizado'}`;
    
    // Gerar descrição padrão se não fornecido
    const indexDescription = description || `Índice ${config.type?.toLowerCase() || 'customizado'} gerado automaticamente via IA`;
    
    // Gerar metodologia padrão se não fornecido
    const indexMethodology = methodology || `Índice gerado automaticamente via IA com base no prompt: "${prompt}"\n\n**Tipo**: ${config.type}\n**Universo**: ${config.universe}\n**Seleção**: Top ${config.selection?.topN || 10} empresas`;

    return NextResponse.json({
      success: true,
      ticker: indexTicker,
      name: indexName,
      description: indexDescription,
      methodology: indexMethodology,
      config
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error generating config:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao gerar configuração'
      },
      { status: 500 }
    );
  }
}

