/**
 * API de Análise AI para Simulação
 * 
 * POST /api/simulation/ai-analysis
 * 
 * Gera análise textual via Gemini sobre os resultados da simulação
 * Apenas para usuários PRO
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Apenas PRO pode acessar
    if (!user.isPremium) {
      return NextResponse.json(
        {
          error: 'Análise com IA é exclusiva para usuários Premium. Faça upgrade para acessar.',
          requiresPremium: true
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      debtName,
      initialDebtBalance,
      debtAnnualRate,
      monthlyPayment,
      monthlyBudget,
      investmentSplit,
      rentabilityRate,
      rentabilitySource,
      sniperResults,
      hybridResults
    } = body

    if (!sniperResults || !hybridResults) {
      return NextResponse.json(
        { error: 'Resultados da simulação são obrigatórios' },
        { status: 400 }
      )
    }

    // Construir prompt para Gemini
    const prompt = `Você é um consultor financeiro especializado em arbitragem de dívida e investimentos.

Analise os seguintes dados de uma simulação financeira comparando duas estratégias:

**DÍVIDA:**
- Nome: ${debtName || 'Dívida Imobiliária'}
- Saldo Inicial: R$ ${initialDebtBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Taxa de Juros Anual: ${((debtAnnualRate || 0) * 100).toFixed(2)}%
- Prestação Mensal: R$ ${monthlyPayment?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}

**ORÇAMENTO:**
- Orçamento Mensal Total: R$ ${monthlyBudget?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Split de Investimento (Híbrido): R$ ${investmentSplit?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}

**RENTABILIDADE ESPERADA:**
- Taxa Anual: ${((rentabilityRate || 0) * 100).toFixed(2)}%
- Fonte: ${rentabilitySource || 'Manual'}

**RESULTADOS - ESTRATÉGIA SNIPER (100% Amortização):**
- Break-even: ${sniperResults.breakEvenMonth ? `Mês ${sniperResults.breakEvenMonth}` : 'Não atingido'}
- Saldo Final da Dívida: R$ ${sniperResults.finalDebtBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Patrimônio Investido Final: R$ ${sniperResults.finalInvestedBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Patrimônio Líquido Final: R$ ${sniperResults.finalNetWorth?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Total de Juros Pagos: R$ ${sniperResults.totalInterestPaid?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Total Investido: R$ ${sniperResults.totalInvestmentContribution?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Retorno dos Investimentos: R$ ${sniperResults.totalInvestmentReturn?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}

**RESULTADOS - ESTRATÉGIA HÍBRIDA (Split Fixo):**
- Break-even: ${hybridResults.breakEvenMonth ? `Mês ${hybridResults.breakEvenMonth}` : 'Não atingido'}
- Saldo Final da Dívida: R$ ${hybridResults.finalDebtBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Patrimônio Investido Final: R$ ${hybridResults.finalInvestedBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Patrimônio Líquido Final: R$ ${hybridResults.finalNetWorth?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Total de Juros Pagos: R$ ${hybridResults.totalInterestPaid?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Total Investido: R$ ${hybridResults.totalInvestmentContribution?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Retorno dos Investimentos: R$ ${hybridResults.totalInvestmentReturn?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}

**TAREFA:**
Forneça uma análise detalhada e acionável em português brasileiro, incluindo:

1. **Resumo Executivo**: Qual estratégia é melhor financeiramente e por quê
2. **Análise Comparativa**: Pontos fortes e fracos de cada estratégia
3. **Recomendação Personalizada**: Qual estratégia recomendar e em que cenários
4. **Considerações Importantes**: Fatores psicológicos, riscos, e variáveis que podem afetar os resultados
5. **Próximos Passos**: Ações concretas que o usuário deve tomar

**OBSERVAÇÃO CRÍTICA:**
Se a estratégia Sniper acumula MENOS patrimônio investido final mas resulta em MAIOR patrimônio líquido final (devido à economia de juros), DESTAQUE ISSO CLARAMENTE na análise. Explique que:
- O importante é o PATRIMÔNIO LÍQUIDO FINAL (Investido - Dívida), não apenas o investido
- Pagar menos juros pode resultar em melhor resultado financeiro mesmo acumulando menos
- A economia de juros compensa a diferença de investimento
- Use formatação markdown (negrito, listas) para destacar este insight

Seja objetivo, use dados concretos e forneça insights práticos. Evite jargões técnicos desnecessários. Use formatação markdown adequada (títulos com ##, listas com -, negrito com **).`

    // Configurar Gemini
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    })

    const model = 'gemini-2.5-flash-lite'
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ]

    // Fazer chamada para Gemini API
    const response = await ai.models.generateContentStream({
      model,
      contents
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

    return NextResponse.json({
      success: true,
      analysis: fullResponse
    })
  } catch (error: any) {
    console.error('Erro ao gerar análise AI:', error)
    return NextResponse.json(
      { error: `Erro ao gerar análise: ${error.message}` },
      { status: 500 }
    )
  }
}

