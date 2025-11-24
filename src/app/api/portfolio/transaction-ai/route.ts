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

/**
 * Pré-processa o input removendo transações de opções e futuros
 */
function preprocessInput(input: string): string {
  const lines = input.split('\n');
  const filteredLines: string[] = [];
  let removedCount = 0;
  
  for (const line of lines) {
    // Ignorar linhas vazias ou apenas espaços
    if (!line.trim()) {
      filteredLines.push(line);
      continue;
    }
    
    const upperLine = line.toUpperCase();
    
    // 1. Verificar tipo de movimentação contém palavras-chave de opções
    const hasOptionKeywords = 
      upperLine.includes('OPÇÃO') || 
      upperLine.includes('OPCAO') ||
      upperLine.includes('EXERCÍCIO') ||
      upperLine.includes('EXERCICIO') ||
      upperLine.includes('CALL') ||
      upperLine.includes('PUT');
    
    // 2. Verificar padrão de ticker de opção diretamente na linha
    // Padrões de opções B3 (mais específicos para evitar falsos positivos):
    // - Opções têm padrão: 4 letras + letra K-Z + números + possível E
    //   Exemplos: ABEVK134, ABEVK124E, BBSEK344, CMIGK125, INTBK125
    // - FIIs têm padrão: 4 letras + números (geralmente 11)
    //   Exemplos: HGBS11, KNCR11, HGRE11, XPCI11
    // - IMPORTANTE: A diferença é que opções têm uma letra K-Z DEPOIS das 4 letras iniciais
    
    // Extrair possíveis tickers da linha (códigos de negociação)
    // Padrão: procurar por códigos que parecem tickers B3
    const tickerMatches = upperLine.match(/\b[A-Z]{3,6}[0-9]{2,4}[A-Z]?\b/g) || [];
    
    let hasOptionTickerPattern = false;
    let hasFIIPattern = false;
    
    for (const ticker of tickerMatches) {
      // PRIMEIRO: Verificar se é FII (termina com 10-19 e tem 4 letras)
      // FIIs válidos: HGBS11, KNCR11, HGRE11, XPCI11, etc.
      if (/^[A-Z]{4}1[0-9]$/.test(ticker)) {
        hasFIIPattern = true;
        continue; // FII válido, não é opção - pular para próximo ticker
      }
      
      // SEGUNDO: Verificar se é opção (tem letra K-Z DEPOIS das letras iniciais)
      // Padrão principal: 4 letras + letra K-Z + números + possível E
      // Exemplos: ABEVK134, ABEVK124E, BBSEK344, CMIGK125, INTBK125
      if (/^[A-Z]{4}[K-Z][0-9]{2,4}E?$/.test(ticker)) {
        hasOptionTickerPattern = true;
        break; // Encontrou opção, pode parar
      }
      
      // Padrão alternativo: 3-5 letras + letra K-Z + números + possível E
      // Exemplos: PETRK309E, ITSAK115E
      // Mas NÃO pegar FIIs que começam com K (ex: KNCR11)
      if (/^[A-Z]{3,5}[K-Z][0-9]{2,4}E?$/.test(ticker)) {
        // Verificar se não é um FII (4 letras + 10-19)
        if (!/^[A-Z]{4}1[0-9]$/.test(ticker)) {
          hasOptionTickerPattern = true;
          break;
        }
      }
      
      // Padrão de exercício: termina com E e tem letra K-Z antes dos números
      // Exemplos: ABEVK124E, PETRK309E
      if (/^[A-Z]{3,6}[K-Z][0-9]+E$/.test(ticker)) {
        // Verificar se não é um FII (4 letras + 10-19)
        if (!/^[A-Z]{4}1[0-9]$/.test(ticker)) {
          hasOptionTickerPattern = true;
          break;
        }
      }
    }
    
    // 3. Verificar se é futuro
    const isFuturesPattern = 
      upperLine.includes('WDO') || 
      upperLine.includes('WIN') ||
      upperLine.includes('FUTURO') ||
      /\bWDO\d+\b/.test(upperLine) ||
      /\bWIN\d+\b/.test(upperLine);
    
    // 4. Lógica de remoção:
    // - Remover se tiver palavras-chave de opções (independente do ticker)
    // - Remover se tiver padrão de ticker de opção E não for um FII válido
    // - Remover se for futuro
    // - NÃO remover FIIs válidos (terminam com 11-19 e têm 4 letras)
    const shouldRemove = 
      hasOptionKeywords || // Sempre remover se tiver palavras-chave de opções
      isFuturesPattern || // Sempre remover futuros
      (hasOptionTickerPattern && !hasFIIPattern); // Remover opções, mas não FIIs válidos
    
    if (shouldRemove) {
      removedCount++;
      console.log(`🚫 [PRE-PROCESS] Removida linha (opção/futuro): ${line.substring(0, 80)}...`);
      continue;
    }
    
    // Incluir linha se não for opção nem futuro
    filteredLines.push(line);
  }
  
  const filteredInput = filteredLines.join('\n');
  
  // Log para debug
  if (removedCount > 0) {
    console.log(`🔍 [PRE-PROCESS] Removidas ${removedCount} transação(ões) de opções/futuros do input`);
  }
  
  return filteredInput;
}

async function processTransactionsWithAI(
  input: string,
  currentCashBalance: number
): Promise<TransactionAIResult> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("API key do Gemini não configurada");
    }

    // Pré-processar input removendo opções
    const preprocessedInput = preprocessInput(input);

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const prompt = `
Você é um assistente especializado em processar transações financeiras de carteiras de investimento. 

⚠️ REGRAS CRÍTICAS DE FILTRO - IGNORE COMPLETAMENTE:
1. NUNCA processe transações de OPÇÕES (CALL ou PUT). Exemplos de tickers de opções:
   - ABEVK134, ABEVK124E, BBSEK344, CMIGK125, CMIGL115, INTBK125, INTBL130
   - PETRK309E, PETRK312E, ITSAK115E, GRNDV530
   - Qualquer ticker com padrão: 4 letras + letra (K-Z) + números + possível E no final
   - Qualquer linha contendo "Opção", "Opcao", "Exercício", "Exercicio" no tipo de movimentação
   
2. NUNCA processe TICKERS WDO e WIN (mercado de futuros)

3. Você deve transformar tickers do mercado fracionário (finais F) em tickers de lote padrão quando necessário.

4. APENAS processe transações de:
   - Mercado à Vista (ações, FIIs, ETFs normais)
   - Aportes (CASH_CREDIT)
   - Saques (CASH_DEBIT)
   - Dividendos (DIVIDEND)
   - Compras e vendas normais de ativos (BUY, SELL_WITHDRAWAL)
   
5. IMPORTANTE SOBRE TICKERS VÁLIDOS:
   - ETFs como LFTB11, IVVB11, NASD11 são TICKERS VÁLIDOS e devem ser processados normalmente
   - FIIs terminados em 11 (ex: HGBS11, KNCR11) são TICKERS VÁLIDOS
   - NÃO gere avisos sobre "Renda Fixa" para esses tickers - eles são ativos negociados normalmente
   - Processe ETFs e FIIs da mesma forma que ações normais

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
- Tickers devem ter 4-6 caracteres (ex: PETR4, VALE3, BOVA11, LFTB11, IVVB11, NASD11)
- ETFs e FIIs terminados em 11 são TICKERS VÁLIDOS (ex: LFTB11, HGBS11, KNCR11)
- NÃO gere avisos sobre "Renda Fixa" para ETFs ou FIIs - eles são ativos negociados normalmente
- Valores sempre em reais (R$)
- FOQUE APENAS nas transações solicitadas pelo usuário, aportes automáticos serão criados pelo sistema

ENTRADA DO USUÁRIO (já pré-processada, opções removidas):
${preprocessedInput}

⚠️ IMPORTANTE: Se você identificar qualquer ticker de opção que tenha passado pelo filtro, IGNORE-O COMPLETAMENTE e não o inclua nas transações.

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

    console.log("jsonMatch", jsonMatch[0]);
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
              `Transação de compra de ${
                transaction.ticker
              }: preço calculado inválido (R$ ${transaction.price.toFixed(2)})`
            );
            continue;
          }
        }

        // Se tem quantidade e preço, calcular e validar valor
        if (
          hasQuantity &&
          hasPrice &&
          transaction.amount !== hasQuantity * hasPrice
        ) {
          const calculatedAmount = transaction.quantity * transaction.price;
          transaction.amount = calculatedAmount;
        }

        // Validação final: deve ter todos os três valores
        if (
          !transaction.price ||
          !transaction.quantity ||
          !transaction.amount
        ) {
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
    const finalResult = processAutomaticCashCredits(
      validatedResult,
      currentCashBalance
    );

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
    if (transaction.type === "CASH_CREDIT" || transaction.type === "DIVIDEND") {
      currentBalance += transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Processar saques
    if (transaction.type === "CASH_DEBIT") {
      currentBalance -= transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Processar compras - verificar se precisa de aporte
    if (transaction.type === "BUY") {
      const needsAmount = transaction.amount - currentBalance;

      if (needsAmount > 0) {
        // Criar aporte automático com mesma precisão decimal da compra
        const autoCredit = {
          type: "CASH_CREDIT",
          ticker: undefined,
          amount: Number(needsAmount.toFixed(2)), // Manter mesma precisão decimal
          price: undefined,
          quantity: undefined,
          date: transaction.date,
          notes: `Aporte automático para compra de ${transaction.ticker}`,
        };

        processedTransactions.push(autoCredit);
        currentBalance += autoCredit.amount;

        warnings.push(
          `Aporte automático de R$ ${autoCredit.amount.toFixed(
            2
          )} criado para cobrir a compra de ${transaction.ticker}`
        );
      }

      // Adicionar a compra
      currentBalance -= transaction.amount;
      processedTransactions.push(transaction);
      continue;
    }

    // Outras transações (vendas)
    if (transaction.type === "SELL_WITHDRAWAL") {
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
    warnings: warnings,
  };
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
