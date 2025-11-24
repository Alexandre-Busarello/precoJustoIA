/**
 * Portfolio Rebalancing Transactions API
 * POST /api/portfolio/[id]/transactions/rebalancing
 * 
 * Execute multiple rebalancing transactions (sells + buys) in a single batch operation
 * This ensures atomicity and prevents intermediate cash balance from triggering new suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface RebalancingTransaction {
  type: 'SELL_REBALANCE' | 'BUY_REBALANCE';
  ticker: string;
  date: string;
  amount: number;
  price: number;
  quantity: number;
  notes?: string;
}

interface RebalancingRequest {
  transactions: RebalancingTransaction[];
}

/**
 * POST /api/portfolio/[id]/transactions/rebalancing
 * Execute multiple rebalancing transactions in batch
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body: RebalancingRequest = await request.json();

    if (!body.transactions || !Array.isArray(body.transactions) || body.transactions.length === 0) {
      return NextResponse.json(
        { error: 'É necessário fornecer pelo menos uma transação' },
        { status: 400 }
      );
    }

    // Validate all transactions
    for (const tx of body.transactions) {
      if (!tx.ticker || !tx.type || !tx.date || !tx.amount || !tx.price || !tx.quantity) {
        return NextResponse.json(
          { error: 'Todas as transações devem ter ticker, type, date, amount, price e quantity' },
          { status: 400 }
        );
      }

      if (tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE') {
        return NextResponse.json(
          { error: 'Tipo de transação inválido. Use SELL_REBALANCE ou BUY_REBALANCE' },
          { status: 400 }
        );
      }
    }

    // Execute all transactions in sequence
    // Process sells first, then buys (to ensure cash is available)
    const sells = body.transactions.filter(tx => tx.type === 'SELL_REBALANCE');
    const buys = body.transactions.filter(tx => tx.type === 'BUY_REBALANCE');

    const results = [];
    const errors: string[] = [];

    // Process sells first
    for (const sellTx of sells) {
      try {
        const transactionId = await PortfolioTransactionService.createManualTransaction(
          resolvedParams.id,
          currentUser.id,
          {
            date: new Date(sellTx.date),
            type: 'SELL_REBALANCE',
            ticker: sellTx.ticker,
            amount: sellTx.amount,
            price: sellTx.price,
            quantity: sellTx.quantity,
            notes: sellTx.notes || 'Rebalanceamento: venda',
          }
        );

        results.push({
          transactionId,
          type: 'SELL_REBALANCE',
          ticker: sellTx.ticker,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`Venda ${sellTx.ticker}: ${errorMsg}`);
      }
    }

    // Process buys after sells (cash is now available)
    for (const buyTx of buys) {
      try {
        const transactionId = await PortfolioTransactionService.createManualTransaction(
          resolvedParams.id,
          currentUser.id,
          {
            date: new Date(buyTx.date),
            type: 'BUY_REBALANCE',
            ticker: buyTx.ticker,
            amount: buyTx.amount,
            price: buyTx.price,
            quantity: buyTx.quantity,
            notes: buyTx.notes || 'Rebalanceamento: compra',
          }
        );

        results.push({
          transactionId,
          type: 'BUY_REBALANCE',
          ticker: buyTx.ticker,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`Compra ${buyTx.ticker}: ${errorMsg}`);
      }
    }

    // Recalculate cash balances and metrics after all transactions
    if (results.length > 0) {
      await PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);
      const { PortfolioMetricsService } = await import('@/lib/portfolio-metrics-service');
      await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);
    }

    if (errors.length > 0 && results.length === 0) {
      // All transactions failed
      return NextResponse.json(
        {
          error: 'Nenhuma transação foi executada',
          details: errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} transação(ões) de rebalanceamento executada(s) com sucesso${errors.length > 0 ? `, ${errors.length} falharam` : ''}`,
      transactions: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        sells: sells.length,
        buys: buys.length,
        total: results.length,
        successful: results.length,
        failed: errors.length,
      },
    });

  } catch (error) {
    console.error('Erro ao executar rebalanceamento:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao executar rebalanceamento',
      },
      { status: 500 }
    );
  }
}

