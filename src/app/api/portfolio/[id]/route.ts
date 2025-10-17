/**
 * Portfolio Detail API Routes
 * 
 * GET /api/portfolio/[id] - Get portfolio details
 * PATCH /api/portfolio/[id] - Update portfolio
 * DELETE /api/portfolio/[id] - Delete portfolio (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioService } from '@/lib/portfolio-service';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/portfolio/[id]
 * Get portfolio details with assets, metrics, and recent transactions
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const portfolio = await PortfolioService.getPortfolioDetails(resolvedParams.id, currentUser.id);

    if (!portfolio) {
      return NextResponse.json(
        { error: 'Carteira não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      portfolio: {
        ...portfolio,
        monthlyContribution: Number(portfolio.monthlyContribution)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar carteira:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar carteira' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/portfolio/[id]
 * Update portfolio configuration
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Prepare updates
    const updates: any = {};
    
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.monthlyContribution) updates.monthlyContribution = Number(body.monthlyContribution);
    if (body.rebalanceFrequency) updates.rebalanceFrequency = body.rebalanceFrequency;

    await PortfolioService.updatePortfolio(resolvedParams.id, currentUser.id, updates);

    return NextResponse.json({
      success: true,
      message: 'Carteira atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar carteira:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar carteira' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/[id]
 * Soft delete portfolio
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    await PortfolioService.deletePortfolio(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      message: 'Carteira excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir carteira:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir carteira' },
      { status: 500 }
    );
  }
}

