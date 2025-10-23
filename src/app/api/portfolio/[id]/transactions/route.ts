/**
 * Portfolio Transactions API Routes
 * 
 * GET /api/portfolio/[id]/transactions - List transactions
 * POST /api/portfolio/[id]/transactions - Create manual transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioTransactionService } from '@/lib/portfolio-transaction-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/portfolio/[id]/transactions
 * List portfolio transactions with filters
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    const filters: any = {};
    
    if (searchParams.get('status')) {
      const statuses = searchParams.get('status')!.split(',');
      filters.status = statuses.length > 1 ? statuses : statuses[0];
    }
    
    if (searchParams.get('type')) {
      const types = searchParams.get('type')!.split(',');
      filters.type = types.length > 1 ? types : types[0];
    }
    
    if (searchParams.get('ticker')) {
      filters.ticker = searchParams.get('ticker');
    }
    
    if (searchParams.get('startDate')) {
      filters.startDate = new Date(searchParams.get('startDate')!);
    }
    
    if (searchParams.get('endDate')) {
      filters.endDate = new Date(searchParams.get('endDate')!);
    }

    const transactions = await PortfolioTransactionService.getPortfolioTransactions(
      resolvedParams.id,
      currentUser.id,
      filters
    );

    return NextResponse.json({
      transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('Erro ao listar transações:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar transações' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/[id]/transactions
 * Create manual transaction
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.date || !body.type || !body.amount) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: date, type, amount' },
        { status: 400 }
      );
    }

    let transactionId: string;
    let cashCreditId: string | undefined;

    // Check if should create with auto cash credit
    if (body.autoAddCashCredit && body.cashCreditAmount) {
      const result = await PortfolioTransactionService.createTransactionWithAutoCashCredit(
        resolvedParams.id,
        currentUser.id,
        {
          date: new Date(body.date),
          type: body.type,
          ticker: body.ticker,
          amount: Number(body.amount),
          price: body.price ? Number(body.price) : undefined,
          quantity: body.quantity ? Number(body.quantity) : undefined,
          notes: body.notes
        },
        Number(body.cashCreditAmount)
      );
      transactionId = result.transactionId;
      cashCreditId = result.cashCreditId;
    } else {
      transactionId = await PortfolioTransactionService.createManualTransaction(
        resolvedParams.id,
        currentUser.id,
        {
          date: new Date(body.date),
          type: body.type,
          ticker: body.ticker,
          amount: Number(body.amount),
          price: body.price ? Number(body.price) : undefined,
          quantity: body.quantity ? Number(body.quantity) : undefined,
          notes: body.notes
        }
      );
    }

    // Recalculate all cash balances (important for retroactive transactions)
    await PortfolioTransactionService.recalculateCashBalances(resolvedParams.id);

    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      transactionId,
      cashCreditId,
      message: cashCreditId 
        ? 'Aporte e compra criados com sucesso' 
        : 'Transação criada com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao criar transação:', error);
    
    // Handle insufficient cash error specifically
    if (error.code === 'INSUFFICIENT_CASH' && error.details) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INSUFFICIENT_CASH',
          details: error.details
        },
        { status: 400 }
      );
    }
    
    // Handle invalid ticker error
    if (error.message && error.message.includes('Invalid ticker')) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INVALID_TICKER'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar transação' },
      { status: 500 }
    );
  }
}

