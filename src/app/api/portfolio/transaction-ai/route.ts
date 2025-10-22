import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { getCurrentUser } from "@/lib/user-service";

interface TransactionAIRequest {
  portfolioId: string;
  input: string;
  currentCashBalance?: number;
}

interface Transaction {
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  date: string;
  notes?: string;
}

interface TransactionAIResult {
  transactions: Transaction[];
  errors: string[];
  warnings: string[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se é Premium
    const isPremium = user.isPremium;
    if (!isPremium) {
      return NextResponse.json(
        { error: "Recurso exclusivo Premium" },
        { status: 403 }
      );
    }

    const body: TransactionAIRequest = await request.json();
    const { portfolioId, input, currentCashBalance = 0 } = body;

    if (!portfolioId || !input?.trim()) {
      return NextResponse.json(
        { error: "Portfolio ID e entrada são obrigatórios" },
        { status: 400 }
      );
    }

    // Processar com IA
    const result = await processTransactionsWithAI(input, currentCashBalance);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro na API de transações IA:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

async function processTransactionsWithAI(
  input: string,
  currentCashBalance: number
): Promise<TransactionAIResult> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("API key do Gemini não configurada");
    }

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const prompt = `
Você é um assistente especializado em processar transações financeiras de carteiras de investimento.

CONTEXTO:
- Saldo atual em caixa: R$ ${currentCashBalance.toFixed(2)}
- Data atual: ${new Date().toISOString().split("T")[0]}

TIPOS DE TRANSAÇÃO VÁLIDOS:
1. CASH_CREDIT - Aporte de dinheiro na carteira
2. CASH_DEBIT - Saque de dinheiro da carteira  
3. BUY - Compra de ativo (ações, FIIs, ETFs)
4. SELL_WITHDRAWAL - Venda de ativo
5. DIVIDEND - Dividendo recebido

REGRAS IMPORTANTES:
- Para CASH_DEBIT: verificar se há saldo suficiente
- Para BUY: OBRIGATÓRIO ter pelo menos uma dessas combinações:
  * Valor total + Quantidade (sistema calcula preço médio)
  * Quantidade + Preço por ação (sistema calcula valor total)
  * NUNCA aceite "preço de mercado" sem quantidade específica
  * Se não tiver dados suficientes, retorne ERRO explicando o que falta
- Para SELL_WITHDRAWAL: calcular valor total se dado preço e quantidade
- Para DIVIDEND: sempre associar a um ticker
- Datas podem ser "hoje", "ontem", ou formato DD/MM/AAAA
- Tickers devem ter 4-6 caracteres (ex: PETR4, VALE3, BOVA11)
- Valores sempre em reais (R$)
- FOQUE APENAS nas transações solicitadas pelo usuário, aportes automáticos serão criados pelo sistema

ENTRADA DO USUÁRIO:
${input}

RESPONDA APENAS COM UM JSON VÁLIDO no seguinte formato:
{
  "transactions": [
    {
      "type": "TIPO_TRANSACAO",
      "ticker": "TICKER_SE_APLICAVEL",
      "amount": VALOR_TOTAL_NUMERICO,
      "price": PRECO_POR_ACAO_SE_APLICAVEL,
      "quantity": QUANTIDADE_SE_APLICAVEL,
      "date": "AAAA-MM-DD",
      "notes": "OBSERVACOES_SE_HOUVER"
    }
  ],
  "errors": [
    "Lista de erros que impedem o processamento"
  ],
  "warnings": [
    "Lista de avisos ou informações importantes"
  ]
}

EXEMPLOS DE PROCESSAMENTO:

Entrada: "Compra de 100 PETR4 a R$ 32,50 cada"
Saída: {
  "transactions": [{
    "type": "BUY",
    "ticker": "PETR4", 
    "amount": 3250.00,
    "price": 32.50,
    "quantity": 100,
    "date": "2024-10-22",
    "notes": null
  }],
  "errors": [],
  "warnings": []
}

Entrada: "Saque de R$ 10.000" (com saldo de R$ 5.000)
Saída: {
  "transactions": [],
  "errors": ["Saldo insuficiente. Saldo atual: R$ 5.000,00, valor solicitado: R$ 10.000,00"],
  "warnings": []
}

Entrada: "Aporte de R$ 2.000 de renda extra"
Saída: {
  "transactions": [{
    "type": "CASH_CREDIT",
    "ticker": null,
    "amount": 2000.00,
    "price": null,
    "quantity": null,
    "date": "2024-10-22",
    "notes": "Renda extra"
  }],
  "errors": [],
  "warnings": []
}

Entrada: "Compra de R$ 5.000 em PETR4" (sem quantidade ou preço)
Saída: {
  "transactions": [],
  "errors": ["Transação de compra de PETR4: deve informar quantidade de ações ou preço por ação. Exemplo: 'Compra de 100 PETR4' ou 'Compra de PETR4 a R$ 32,50 cada'"],
  "warnings": []
}

Entrada: "Compra de 100 PETR4 a R$ 32,50 cada"
Saída: {
  "transactions": [{
    "type": "BUY",
    "ticker": "PETR4",
    "amount": 3250.00,
    "price": 32.50,
    "quantity": 100,
    "date": "2024-10-22",
    "notes": null
  }],
  "errors": [],
  "warnings": []
}

Processe a entrada do usuário e retorne o JSON:`;

    const model = "gemini-2.5-flash-lite";
    const contents = [
      {
        role: "user",
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
    let fullResponse = "";
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    if (!fullResponse.trim()) {
      throw new Error("Resposta vazia da API Gemini");
    }

    // Limpar markdown se presente
    const text = fullResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Extrair JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Resposta da IA não contém JSON válido");
    }

    const aiResult = JSON.parse(jsonMatch[0]);

    // Validar estrutura da resposta
    if (!aiResult.transactions || !Array.isArray(aiResult.transactions)) {
      throw new Error("Estrutura de resposta inválida");
    }

    // Validações adicionais
    const validatedResult: TransactionAIResult = {
      transactions: [],
      errors: aiResult.errors || [],
      warnings: aiResult.warnings || [],
    };

    for (const transaction of aiResult.transactions) {
      // Validar tipo de transação
      const validTypes = [
        "CASH_CREDIT",
        "CASH_DEBIT",
        "BUY",
        "SELL_WITHDRAWAL",
        "DIVIDEND",
      ];
      if (!validTypes.includes(transaction.type)) {
        validatedResult.errors.push(
          `Tipo de transação inválido: ${transaction.type}`
        );
        continue;
      }

      // Validar ticker para transações que precisam
      const needsTicker = ["BUY", "SELL_WITHDRAWAL", "DIVIDEND"];
      if (needsTicker.includes(transaction.type) && !transaction.ticker) {
        validatedResult.errors.push(
          `Ticker é obrigatório para transação do tipo ${transaction.type}`
        );
        continue;
      }

      // Validar valores numéricos
      if (typeof transaction.amount !== "number" || transaction.amount <= 0) {
        validatedResult.errors.push(`Valor inválido: ${transaction.amount}`);
        continue;
      }

      // Validar data
      if (!transaction.date || !isValidDate(transaction.date)) {
        validatedResult.errors.push(`Data inválida: ${transaction.date}`);
        continue;
      }

      // Validações específicas para transações de compra
      if (transaction.type === "BUY") {
        const hasPrice = transaction.price && transaction.price > 0;
        const hasQuantity = transaction.quantity && transaction.quantity > 0;
        const hasAmount = transaction.amount && transaction.amount > 0;

        // Para compras, deve ter pelo menos uma dessas combinações:
        // 1. Valor + Quantidade (para calcular preço médio)
        // 2. Quantidade + Preço (para calcular valor total)
        if (!hasAmount) {
          validatedResult.errors.push(
            `Transação de compra de ${transaction.ticker}: valor total é obrigatório`
          );
          continue;
        }

        if (!hasPrice && !hasQuantity) {
          validatedResult.errors.push(
            `Transação de compra de ${transaction.ticker}: deve informar pelo menos preço por ação OU quantidade de ações. Não é possível comprar "a preço de mercado" sem especificar quantidade ou preço.`
          );
          continue;
        }

        // Se tem valor e quantidade, calcular e validar preço
        if (hasAmount && hasQuantity && !hasPrice) {
          transaction.price = transaction.amount / transaction.quantity;
          if (transaction.price <= 0) {
            validatedResult.errors.push(
              `Transação de compra de ${transaction.ticker}: preço calculado inválido (R$ ${transaction.price.toFixed(2)})`
            );
            continue;
          }
        }

        // Se tem quantidade e preço, calcular e validar valor
        if (hasQuantity && hasPrice && transaction.amount !== hasQuantity * hasPrice) {
          const calculatedAmount = transaction.quantity * transaction.price;
          transaction.amount = calculatedAmount;
        }

        // Validação final: deve ter todos os três valores
        if (!transaction.price || !transaction.quantity || !transaction.amount) {
          validatedResult.errors.push(
            `Transação de compra de ${transaction.ticker}: dados insuficientes. Informe valor total + quantidade OU quantidade + preço por ação.`
          );
          continue;
        }
      }

      // Validação específica para saque
      if (
        transaction.type === "CASH_DEBIT" &&
        transaction.amount > currentCashBalance
      ) {
        validatedResult.errors.push(
          `Saldo insuficiente para saque. Saldo atual: R$ ${currentCashBalance.toFixed(
            2
          )}, valor solicitado: R$ ${transaction.amount.toFixed(2)}`
        );
        continue;
      }

      // Compras serão processadas na função de transações casadas

      validatedResult.transactions.push({
        type: transaction.type,
        ticker: transaction.ticker || undefined,
        amount: Number(transaction.amount),
        price: transaction.price ? Number(transaction.price) : undefined,
        quantity: transaction.quantity
          ? Number(transaction.quantity)
          : undefined,
        date: transaction.date,
        notes: transaction.notes || undefined,
      });
    }

    // Processar transações casadas automaticamente
    const finalResult = processAutomaticCashCredits(validatedResult, currentCashBalance);

    return finalResult;
  } catch (error) {
    console.error("Erro ao processar com IA:", error);
    return {
      transactions: [],
      errors: [
        "Erro ao processar entrada com IA. Verifique o formato e tente novamente.",
      ],
      warnings: [],
    };
  }
}

/**
 * Processa transações casadas automaticamente
 * Adiciona aportes automáticos quando necessário para cobrir compras
 */
function processAutomaticCashCredits(
  result: TransactionAIResult,
  initialCashBalance: number
): TransactionAIResult {
  const processedTransactions: any[] = [];
  const warnings: string[] = [...result.warnings];
  let currentBalance = initialCashBalance;

  // Processar transações em ordem cronológica
  const sortedTransactions = [...result.transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const transaction of sortedTransactions) {
    // Atualizar saldo com aportes e dividendos
    if (transaction.type === 'CASH_CREDIT' || transaction.type === 'DIVIDEND') {
      currentBalance += transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Processar saques
    if (transaction.type === 'CASH_DEBIT') {
      currentBalance -= transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Processar compras - verificar se precisa de aporte
    if (transaction.type === 'BUY') {
      const needsAmount = transaction.amount - currentBalance;
      
      if (needsAmount > 0) {
        // Criar aporte automático com mesma precisão decimal da compra
        const autoCredit = {
          type: 'CASH_CREDIT',
          ticker: undefined,
          amount: Number(needsAmount.toFixed(2)), // Manter mesma precisão decimal
          price: undefined,
          quantity: undefined,
          date: transaction.date,
          notes: `Aporte automático para compra de ${transaction.ticker}`
        };

        processedTransactions.push(autoCredit);
        currentBalance += autoCredit.amount;
        
        warnings.push(
          `Aporte automático de R$ ${autoCredit.amount.toFixed(2)} criado para cobrir a compra de ${transaction.ticker}`
        );
      }

      // Adicionar a compra
      currentBalance -= transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Outras transações (vendas)
    if (transaction.type === 'SELL_WITHDRAWAL') {
      currentBalance += transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Transação não reconhecida
    processedTransactions.push(transaction);
  }

  return {
    transactions: processedTransactions,
    errors: result.errors,
    warnings: warnings
  };
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
