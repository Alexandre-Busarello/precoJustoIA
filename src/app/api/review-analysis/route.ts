import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Validar se a API key do Gemini está configurada
function validateGeminiConfig() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }
}

// Construir o prompt de revisão
function buildReviewPrompt(analysis: string, ticker: string, name: string) {
  return `# Sistema de Revisão de Análise Fundamentalista

## IMPORTANTE: RESPONDA SEMPRE EM PORTUGUÊS BRASILEIRO

## OBJETIVO
Você é um **Revisor Técnico Especializado** responsável por validar se uma análise fundamentalista gerada por IA está no formato correto e atende aos critérios de qualidade estabelecidos.

## DADOS DA ANÁLISE A SER REVISADA
**Empresa:** ${name} (${ticker})
**Análise a ser revisada:**

---
${analysis}
---

## CRITÉRIOS DE APROVAÇÃO

### 1. ESTRUTURA OBRIGATÓRIA
A análise DEVE conter todas as seções na ordem correta:
- ✅ Título: "Análise Fundamentalista: [Nome] ([Ticker])"
- ✅ Data da Análise
- ✅ 1. Resumo Executivo e Tese de Investimento
- ✅ 2. Cenário Atual e Notícias Relevantes
- ✅ 3. Análise Financeira Detalhada (com subseções 3.1 a 3.4)
- ✅ 4. Valuation e Preço Justo (com subseções 4.1 e 4.2)
- ✅ 5. Riscos e Oportunidades
- ✅ 6. Conclusão do Analista
- ✅ Aviso Legal no final

### 2. QUALIDADE DO CONTEÚDO
- ✅ **IDIOMA:** Análise completamente em português brasileiro (OBRIGATÓRIO)
- ✅ Linguagem profissional e didática
- ✅ Baseada em dados concretos (não especulativa)
- ✅ Sem exposição do "pensamento interno" da IA
- ✅ Sem frases como "vou analisar", "preciso verificar", "como IA eu..."
- ✅ Conclusões fundamentadas nos dados apresentados
- ✅ Riscos e oportunidades específicos e relevantes

### 3. FORMATAÇÃO
- ✅ Markdown bem estruturado
- ✅ Títulos e subtítulos corretos
- ✅ Bullet points onde apropriado
- ✅ Texto fluido e coerente

### 4. PROBLEMAS QUE REPROVAM A ANÁLISE
- ❌ **IDIOMA INCORRETO:** Análise em inglês ou outro idioma que não seja português brasileiro
- ❌ Estrutura incompleta ou fora de ordem
- ❌ Seções vazias ou com conteúdo genérico
- ❌ Exposição do processo de pensamento da IA
- ❌ Linguagem muito técnica sem explicação
- ❌ Conclusões sem fundamentação
- ❌ Ausência do aviso legal
- ❌ Formatação markdown incorreta
- ❌ Descarte qualquer relatório que tenha pensamentos internos da IA

## INSTRUÇÕES DE RESPOSTA

Analise a análise fornecida e responda APENAS com um JSON no seguinte formato:

\`\`\`json
{
  "approved": true/false,
  "score": 0-100,
  "issues": [
    "Lista de problemas encontrados (se houver)"
  ],
  "suggestions": [
    "Sugestões de melhoria (se houver)"
  ],
  "summary": "Resumo da avaliação em 1-2 frases"
}
\`\`\`

### CRITÉRIOS DE PONTUAÇÃO:
- **90-100:** Excelente - Atende todos os critérios perfeitamente
- **80-89:** Bom - Pequenos ajustes necessários, mas aprovável
- **70-79:** Regular - Problemas moderados, precisa de revisão
- **60-69:** Ruim - Problemas significativos, não aprovável
- **0-59:** Muito ruim - Estrutura inadequada, não aprovável

**APROVAÇÃO:** Score >= 80 = approved: true | Score < 80 = approved: false

Seja rigoroso mas justo na avaliação. O objetivo é garantir qualidade profissional para o usuário final.`;
}

export async function POST(request: NextRequest) {
  try {
    validateGeminiConfig();

    const body = await request.json();
    const { analysis, ticker, name } = body;

    // Validar dados obrigatórios
    if (!analysis || !ticker || !name) {
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes: analysis, ticker, name' },
        { status: 400 }
      );
    }

    // Construir prompt de revisão
    const prompt = buildReviewPrompt(analysis, ticker, name);

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
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

    // Tentar extrair JSON da resposta
    let reviewResult;
    try {
      // Procurar por JSON na resposta
      const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                       fullResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        reviewResult = JSON.parse(jsonString);
      } else {
        throw new Error('JSON não encontrado na resposta');
      }
    } catch (parseError) {
      console.error('Erro ao parsear resposta da revisão:', parseError);
      // Fallback: aprovar se não conseguir parsear (evitar loop infinito)
      reviewResult = {
        approved: true,
        score: 75,
        issues: ['Erro na revisão automática'],
        suggestions: [],
        summary: 'Revisão automática falhou, análise aprovada por fallback'
      };
    }

    return NextResponse.json({
      success: true,
      ...reviewResult,
      rawResponse: fullResponse // Para debug se necessário
    });

  } catch (error) {
    console.error('Erro na revisão da análise:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro ao revisar análise', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
