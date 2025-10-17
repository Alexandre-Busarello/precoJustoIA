/**
 * Generate Backtest from Portfolio API
 * POST /api/portfolio/[id]/to-backtest
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioBacktestIntegrationService } from '@/lib/portfolio-backtest-integration';
import { PortfolioService } from '@/lib/portfolio-service';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, startDate, endDate' },
        { status: 400 }
      );
    }

    // Get portfolio data to extract default values
    const portfolio = await PortfolioService.getPortfolioConfig(resolvedParams.id, currentUser.id);
    
    if (!portfolio) {
      return NextResponse.json({ error: 'Carteira não encontrada' }, { status: 404 });
    }

    // Use monthlyContribution from portfolio if not provided
    let monthlyContribution = body.monthlyContribution 
      ? Number(body.monthlyContribution) 
      : Number(portfolio.monthlyContribution);

    // Calculate initialCapital from portfolio if not provided
    let initialCapital = body.initialCapital ? Number(body.initialCapital) : null;
    
    if (!initialCapital) {
      // Get first CASH_CREDIT transaction as initial capital
      const firstCashCredit = await prisma.portfolioTransaction.findFirst({
        where: {
          portfolioId: resolvedParams.id,
          type: 'CASH_CREDIT',
          status: { in: ['CONFIRMED', 'EXECUTED'] }
        },
        orderBy: {
          date: 'asc'
        }
      });

      if (firstCashCredit) {
        initialCapital = Number(firstCashCredit.amount);
        console.log(`💰 Using first CASH_CREDIT as initialCapital: R$ ${initialCapital}`);
      } else {
        // Fallback: use monthlyContribution as initial capital
        initialCapital = monthlyContribution;
        console.log(`💰 No CASH_CREDIT found, using monthlyContribution as initialCapital: R$ ${initialCapital}`);
      }
    }

    console.log(`📊 Creating backtest from portfolio: initialCapital=R$ ${initialCapital}, monthly=R$ ${monthlyContribution}`);

    const backtestId = await PortfolioBacktestIntegrationService.generateBacktestFromPortfolio(
      currentUser.id,
      resolvedParams.id,
      {
        name: body.name,
        description: body.description,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        initialCapital,
        monthlyContribution
      }
    );

    return NextResponse.json({
      success: true,
      backtestId,
      message: 'Backtest criado a partir da carteira com sucesso',
      usedValues: {
        initialCapital,
        monthlyContribution,
        source: {
          initialCapital: body.initialCapital ? 'user-provided' : 'auto-detected',
          monthlyContribution: body.monthlyContribution ? 'user-provided' : 'portfolio-config'
        }
      }
    });

  } catch (error) {
    console.error('Erro ao gerar backtest da carteira:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar backtest' },
      { status: 500 }
    );
  }
}

