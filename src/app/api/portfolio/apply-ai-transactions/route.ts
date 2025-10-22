import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PortfolioTransactionService } from "@/lib/portfolio-transaction-service";
import { PortfolioMetricsService } from "@/lib/portfolio-metrics-service";
import { TransactionType } from "@prisma/client";
import { revalidateTag } from "next/cache";

interface Transaction {
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  date: string;
  notes?: string;
}

interface ApplyTransactionsRequest {
  portfolioId: string;
  transactions: Transaction[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Verificar se é Premium
    const isPremium = session.user.subscriptionTier === "PREMIUM";
    if (!isPremium) {
      return NextResponse.json(
        { error: "Recurso exclusivo Premium" },
        { status: 403 }
      );
    }

    const body: ApplyTransactionsRequest = await request.json();
    const { portfolioId, transactions } = body;

    if (!portfolioId || !transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Portfolio ID e transações são obrigatórios" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const createdTransactions: string[] = [];
    const errors: string[] = [];

    // Processar transações em ordem
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      try {
        // Validar tipo de transação
        const validTypes = ['CASH_CREDIT', 'CASH_DEBIT', 'BUY', 'SELL_WITHDRAWAL', 'DIVIDEND'];
        if (!validTypes.includes(transaction.type)) {
          errors.push(`Transação ${i + 1}: Tipo inválido '${transaction.type}'`);
          continue;
        }

        // Converter para formato do serviço
        const transactionInput = {
          date: new Date(transaction.date),
          type: transaction.type as TransactionType,
          ticker: transaction.ticker,
          amount: transaction.amount,
          price: transaction.price,
          quantity: transaction.quantity,
          notes: transaction.notes
        };

        // Verificar se é um aporte seguido de compra (transação casada)
        const isNextTransactionBuy = i < transactions.length - 1 && 
          transactions[i + 1].type === 'BUY' &&
          transaction.type === 'CASH_CREDIT' &&
          transaction.notes?.includes('Aporte automático');

        if (isNextTransactionBuy) {
          // Processar transação casada (aporte + compra)
          const buyTransaction = transactions[i + 1];
          const buyInput = {
            date: new Date(buyTransaction.date),
            type: buyTransaction.type as TransactionType,
            ticker: buyTransaction.ticker,
            amount: buyTransaction.amount,
            price: buyTransaction.price,
            quantity: buyTransaction.quantity,
            notes: buyTransaction.notes
          };

          const result = await PortfolioTransactionService.createTransactionWithAutoCashCredit(
            portfolioId,
            userId,
            buyInput,
            transaction.amount
          );

          createdTransactions.push(result.cashCreditId, result.transactionId);
          
          // Pular a próxima transação (já foi processada)
          i++;
        } else {
          // Processar transação individual
          const transactionId = await PortfolioTransactionService.createManualTransaction(
            portfolioId,
            userId,
            transactionInput
          );

          createdTransactions.push(transactionId);
        }

      } catch (error) {
        console.error(`Erro ao criar transação ${i + 1}:`, error);
        
        let errorMessage = 'Erro desconhecido';
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Traduzir erros técnicos para linguagem amigável
          if (errorMessage.includes('INSUFFICIENT_CASH') || errorMessage.includes('saldo insuficiente')) {
            errorMessage = `Saldo insuficiente para ${transaction.type === 'BUY' ? 'compra' : 'saque'}. Saldo atual insuficiente.`;
          } else if (errorMessage.includes('Portfolio not found')) {
            errorMessage = 'Carteira não encontrada ou sem permissão de acesso.';
          } else if (errorMessage.includes('Invalid ticker')) {
            errorMessage = `Ticker "${transaction.ticker}" não é válido ou não foi encontrado.`;
          }
        }
        
        errors.push(`Transação ${i + 1}: ${errorMessage}`);
      }
    }

    // Recalcular e invalidar cache se transações foram criadas
    if (createdTransactions.length > 0) {
      try {
        // Recalcular saldos de caixa (importante para transações retroativas)
        await PortfolioTransactionService.recalculateCashBalances(portfolioId);

        // Recalcular métricas
        await PortfolioMetricsService.updateMetrics(portfolioId, userId);

        // Invalidar cache do Next.js
        revalidateTag(`portfolio-${portfolioId}`);
        revalidateTag(`portfolio-metrics-${portfolioId}`);
        revalidateTag(`portfolio-transactions-${portfolioId}`);
        revalidateTag(`portfolio-analytics-${portfolioId}`);
      } catch (recalcError) {
        console.error('Erro ao recalcular métricas:', recalcError);
        // Não falhar a requisição por erro de recálculo
      }
    }

    // Retornar resultado
    const result = {
      success: createdTransactions.length > 0,
      createdTransactions: createdTransactions.length,
      totalTransactions: transactions.length,
      errors: errors.length > 0 ? errors : undefined
    };

    if (createdTransactions.length === 0) {
      return NextResponse.json(
        { 
          ...result,
          message: "Nenhuma transação foi criada devido a erros"
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ...result,
      message: `${createdTransactions.length} transação(ões) criada(s) com sucesso`
    });

  } catch (error) {
    console.error("Erro na API de aplicar transações:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}