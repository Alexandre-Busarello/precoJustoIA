import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { isCurrentUserPremium } from '@/lib/user-service';

interface ScreeningAIRequest {
  prompt?: string;
  availableSectors?: string[];
  availableIndustries?: string[];
}

interface ScreeningParameters {
  plFilter?: { enabled: boolean; min?: number; max?: number };
  pvpFilter?: { enabled: boolean; min?: number; max?: number };
  evEbitdaFilter?: { enabled: boolean; min?: number; max?: number };
  psrFilter?: { enabled: boolean; min?: number; max?: number };
  roeFilter?: { enabled: boolean; min?: number; max?: number };
  roicFilter?: { enabled: boolean; min?: number; max?: number };
  roaFilter?: { enabled: boolean; min?: number; max?: number };
  margemLiquidaFilter?: { enabled: boolean; min?: number; max?: number };
  margemEbitdaFilter?: { enabled: boolean; min?: number; max?: number };
  cagrLucros5aFilter?: { enabled: boolean; min?: number; max?: number };
  cagrReceitas5aFilter?: { enabled: boolean; min?: number; max?: number };
  dyFilter?: { enabled: boolean; min?: number; max?: number };
  payoutFilter?: { enabled: boolean; min?: number; max?: number };
  dividaLiquidaPlFilter?: { enabled: boolean; min?: number; max?: number };
  liquidezCorrenteFilter?: { enabled: boolean; min?: number; max?: number };
  dividaLiquidaEbitdaFilter?: { enabled: boolean; min?: number; max?: number };
  marketCapFilter?: { enabled: boolean; min?: number; max?: number };
  overallScoreFilter?: { enabled: boolean; min?: number; max?: number };
  grahamUpsideFilter?: { enabled: boolean; min?: number; max?: number };
  selectedSectors?: string[];
  selectedIndustries?: string[];
  companySize?: 'all' | 'small_caps' | 'mid_caps' | 'blue_chips';
  useTechnicalAnalysis?: boolean;
}

const DEFAULT_PROMPT = "Buscar as empresas sólidas mais descontadas";

export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é Premium
    const isPremium = await isCurrentUserPremium();
    if (!isPremium) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Recurso disponível apenas para usuários Premium',
          message: 'A configuração automática com IA é um recurso exclusivo Premium. Faça upgrade para acessar.'
        },
        { status: 403 }
      );
    }

    const body: ScreeningAIRequest = await request.json();
    const userPrompt = body.prompt?.trim() || DEFAULT_PROMPT;
    const availableSectors = body.availableSectors || [];
    const availableIndustries = body.availableIndustries || [];

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API key do Gemini não configurada' },
        { status: 500 }
      );
    }

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const systemPrompt = `Você é um especialista em análise fundamentalista de ações brasileiras.

Sua tarefa é converter instruções em linguagem natural em parâmetros de screening de ações.

**INSTRUÇÕES DO USUÁRIO**: "${userPrompt}"

Você deve retornar APENAS um objeto JSON válido (sem markdown, sem explicações) com os parâmetros de filtro.

**CAMPOS DISPONÍVEIS E SEUS SIGNIFICADOS**:

**Valuation** (valores absolutos):
- plFilter: P/L (Preço/Lucro) - quanto menor, mais barata
- pvpFilter: P/VP (Preço/Valor Patrimonial) - quanto menor, mais descontada
- evEbitdaFilter: EV/EBITDA - quanto menor, melhor
- psrFilter: PSR (Preço/Receita) - quanto menor, melhor

**Rentabilidade** (valores em decimal, ex: 0.15 = 15%):
- roeFilter: ROE (Retorno sobre Patrimônio) - quanto maior, melhor
- roicFilter: ROIC (Retorno sobre Capital Investido) - quanto maior, melhor
- roaFilter: ROA (Retorno sobre Ativos) - quanto maior, melhor
- margemLiquidaFilter: Margem Líquida (decimal) - quanto maior, melhor
- margemEbitdaFilter: Margem EBITDA (decimal) - quanto maior, melhor

**Crescimento** (valores em decimal, ex: 0.10 = 10%):
- cagrLucros5aFilter: CAGR Lucros 5 anos (decimal)
- cagrReceitas5aFilter: CAGR Receitas 5 anos (decimal)

**Dividendos** (valores em decimal):
- dyFilter: Dividend Yield (decimal, ex: 0.06 = 6%)
- payoutFilter: Payout (decimal, ex: 0.5 = 50%)

**Endividamento & Liquidez**:
- dividaLiquidaPlFilter: Dívida Líquida/PL (decimal) - quanto menor, menos endividada
- liquidezCorrenteFilter: Liquidez Corrente - > 1 é bom
- dividaLiquidaEbitdaFilter: Dívida Líquida/EBITDA - quanto menor, melhor

**Tamanho**:
- marketCapFilter: Market Cap em reais (valores grandes, ex: 1000000000 = 1 bilhão)
- companySize: 'small_caps' | 'mid_caps' | 'blue_chips' | 'all'

**Qualidade & Oportunidade**:
- overallScoreFilter: Score Geral de 0-100 (quanto maior, melhor qualidade)
- grahamUpsideFilter: Upside Graham em % (quanto maior, mais descontada)

**Setorial**:
- selectedSectors: Array de setores disponíveis: ${JSON.stringify(availableSectors)}
- selectedIndustries: Array de indústrias disponíveis: ${JSON.stringify(availableIndustries)}

**IMPORTANTE**: Use APENAS setores e indústrias da lista acima. Não invente nomes.

**Outros**:
- useTechnicalAnalysis: true/false (priorizar sobrevenda)

**REGRAS CRÍTICAS - LEIA COM ATENÇÃO**:

1. Cada filtro tem estrutura: { enabled: true/false, min?: number, max?: number }
2. Use "min" para valores mínimos desejados e "max" para valores máximos
3. Valores em % devem ser convertidos para decimal (6% = 0.06, 15% = 0.15)
4. Market cap em bilhões: 1bi = 1000000000
5. Para Bancos e Financeiras, de preferência a usar o "dividaLiquidaEbitdaFilter" para endividamento

**INTERPRETAÇÃO DE TERMOS DE QUALIDADE** (MUITO IMPORTANTE):

Quando o usuário mencionar qualidade/solidez, SEMPRE combine múltiplos filtros:

- "Boas empresas" / "Empresas de qualidade" / "Empresas sólidas":
  → ROE alto (min: 0.15 ou 15%)
  → ROIC alto (min: 0.12 ou 12%)
  → Margem Líquida positiva (min: 0.05 ou 5%)
  → Overall Score alto (min: 60)
  → Baixo endividamento (dividaLiquidaPlFilter max: 1)

- "Empresas lucrativas" / "Com lucro consistente":
  → ROE positivo (min: 0.10)
  → Margem Líquida positiva (min: 0.05)
  → Overall Score acima de 50

- "Empresas em crescimento":
  → CAGR Lucros positivo (min: 0.05)
  → CAGR Receitas positivo (min: 0.05)

- "Baixo endividamento" / "Pouco endividadas":
  → dividaLiquidaPlFilter (max: 0.5)
  → liquidezCorrenteFilter (min: 1.2)

- "Descontadas" / "Baratas" / "Subvalorizadas":
  → P/VP baixo (max: 1.5)
  → P/L razoável (max: 15)
  → Graham Upside positivo (min: 10)

**IMPORTANTE**: Quando houver MÚLTIPLOS conceitos no prompt (ex: "Boas empresas baratas"), você DEVE combinar TODOS os filtros relevantes de CADA conceito.

**EXEMPLOS DE CONVERSÃO COMPLETOS**:

Exemplo 1: "Boas empresas com P/VP abaixo de 1"
→ {
  "pvpFilter": { "enabled": true, "max": 1 },
  "roeFilter": { "enabled": true, "min": 0.15 },
  "roicFilter": { "enabled": true, "min": 0.12 },
  "margemLiquidaFilter": { "enabled": true, "min": 0.05 },
  "overallScoreFilter": { "enabled": true, "min": 60 },
  "dividaLiquidaPlFilter": { "enabled": true, "max": 1 }
}

Exemplo 2: "Bancos de qualidade negociados abaixo do P/VP"
→ {
  "pvpFilter": { "enabled": true, "max": 1 },
  "roeFilter": { "enabled": true, "min": 0.15 },
  "overallScoreFilter": { "enabled": true, "min": 60 },
  "selectedSectors": ["Financeiro"],
  "selectedIndustries": ["Bancos"]
}

Exemplo 3: "Empresas sólidas mais descontadas"
→ {
  "pvpFilter": { "enabled": true, "max": 1.5 },
  "plFilter": { "enabled": true, "max": 15 },
  "roeFilter": { "enabled": true, "min": 0.15 },
  "roicFilter": { "enabled": true, "min": 0.12 },
  "overallScoreFilter": { "enabled": true, "min": 60 },
  "dividaLiquidaPlFilter": { "enabled": true, "max": 1 },
  "grahamUpsideFilter": { "enabled": true, "min": 10 }
}

Exemplo 4: "Pagadoras de dividendos de qualidade com DY acima de 6%"
→ {
  "dyFilter": { "enabled": true, "min": 0.06 },
  "payoutFilter": { "enabled": true, "min": 0.3, "max": 0.8 },
  "roeFilter": { "enabled": true, "min": 0.12 },
  "overallScoreFilter": { "enabled": true, "min": 55 },
  "dividaLiquidaPlFilter": { "enabled": true, "max": 1.5 }
}

Exemplo 5: "Small caps em crescimento"
→ {
  "companySize": "small_caps",
  "cagrLucros5aFilter": { "enabled": true, "min": 0.10 },
  "cagrReceitas5aFilter": { "enabled": true, "min": 0.08 },
  "roeFilter": { "enabled": true, "min": 0.10 }
}

**LEMBRETE FINAL CRÍTICO**:
- SEMPRE que o usuário mencionar "boas", "qualidade", "sólidas", "confiáveis" ou termos similares, você DEVE incluir MÚLTIPLOS filtros de rentabilidade e qualidade (ROE, ROIC, Margem Líquida, Overall Score, baixo endividamento)
- NÃO retorne apenas 1 ou 2 filtros quando o contexto indicar múltiplos aspectos
- Seja GENEROSO ao interpretar o prompt - melhor incluir filtros de qualidade de mais do que de menos

Agora, analise o prompt do usuário e retorne APENAS o JSON dos parâmetros, sem markdown, sem explicações:`;

    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
    ];

    // Fazer chamada para Gemini API
    const response = await ai.models.generateContentStream({
      model,
      contents,
    });

    // Coletar resposta completa
    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    if (!fullResponse.trim()) {
      throw new Error('Resposta vazia da API Gemini');
    }
    
    // Limpar markdown se presente
    const text = fullResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse do JSON
    const parameters: ScreeningParameters = JSON.parse(text);
    
    // Validar que recebemos um objeto válido
    if (typeof parameters !== 'object' || parameters === null) {
      throw new Error('Resposta inválida da IA');
    }

    return NextResponse.json({
      success: true,
      parameters,
      prompt: userPrompt,
      message: `Parâmetros configurados com base em: "${userPrompt}"`
    });

  } catch (error) {
    console.error('Erro ao processar com IA:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao processar solicitação com IA', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
