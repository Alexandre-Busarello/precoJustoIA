/**
 * Create Portfolio from Backtest API
 * POST /api/portfolio/from-backtest
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isCurrentUserPremium } from '@/lib/user-service';
import { PortfolioBacktestIntegrationService } from '@/lib/portfolio-backtest-integration';
import { PortfolioService } from '@/lib/portfolio-service';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Check portfolio limit for FREE users
    const isPremium = await isCurrentUserPremium();
    
    if (!isPremium) {
      const portfolioCount = await PortfolioService.countUserPortfolios(currentUser.id);
      
      if (portfolioCount >= 1) {
        return NextResponse.json(
          {
            error: 'Usuários gratuitos estão limitados a 1 carteira. Faça upgrade para Premium.',
            requiresPremium: true
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    
    if (!body.backtestId || !body.name || !body.startDate || !body.monthlyContribution) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: backtestId, name, startDate, monthlyContribution' },
        { status: 400 }
      );
    }

    const portfolioId = await PortfolioBacktestIntegrationService.convertBacktestToPortfolio(
      currentUser.id,
      body.backtestId,
      {
        name: body.name,
        description: body.description,
        startDate: new Date(body.startDate),
        monthlyContribution: Number(body.monthlyContribution),
        importTransactionsAsTemplate: body.importTransactionsAsTemplate
      }
    );

    return NextResponse.json({
      success: true,
      portfolioId,
      message: 'Carteira criada a partir do backtest com sucesso'
    });

  } catch (error) {
    console.error('Erro ao converter backtest em carteira:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao converter backtest' },
      { status: 500 }
    );
  }
}

