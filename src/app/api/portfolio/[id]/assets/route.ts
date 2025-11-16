/**
 * Portfolio Assets API Routes
 * 
 * POST /api/portfolio/[id]/assets - Add asset to portfolio
 * PATCH /api/portfolio/[id]/assets/[ticker] - Update asset allocation
 * DELETE /api/portfolio/[id]/assets/[ticker] - Remove asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioService } from '@/lib/portfolio-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';
import { AssetRegistrationService } from '@/lib/asset-registration-service';
import { validateTicker } from '@/lib/quote-service';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Helper function to delete all pending transactions
 */
async function deletePendingTransactions(portfolioId: string): Promise<number> {
  const result = await prisma.portfolioTransaction.deleteMany({
    where: {
      portfolioId,
      status: 'PENDING'
    }
  });
  return result.count;
}

/**
 * POST /api/portfolio/[id]/assets
 * Add asset to portfolio
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
    
    if (!body.ticker || !body.targetAllocation) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ticker, targetAllocation' },
        { status: 400 }
      );
    }

    const ticker = body.ticker.toUpperCase().trim();

    // Validar ticker antes de tentar registrar
    try {
      await validateTicker(ticker);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ticker inválido';
      console.error(`❌ [PORTFOLIO ADD ASSET] Ticker inválido: ${ticker} - ${errorMessage}`);
      return NextResponse.json(
        { 
          error: errorMessage.includes('not found') 
            ? `Ticker "${ticker}" não encontrado no Yahoo Finance. Verifique se o ticker está correto.`
            : errorMessage,
          code: 'INVALID_TICKER'
        },
        { status: 400 }
      );
    }

    // NOVO: Registrar ativo se não existir
    console.log(`📝 [PORTFOLIO ADD ASSET] Verificando cadastro de ${ticker}...`);
    const registrationResult = await AssetRegistrationService.registerAsset(ticker);
    
    if (!registrationResult.success) {
      return NextResponse.json(
        { error: registrationResult.message || 'Erro ao cadastrar ativo' },
        { status: 400 }
      );
    }

    const assetId = await PortfolioService.addAsset(
      resolvedParams.id,
      currentUser.id,
      ticker,
      Number(body.targetAllocation)
    );

    // Delete all pending transactions as allocations have changed
    const deletedCount = await deletePendingTransactions(resolvedParams.id);
    
    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      assetId,
      deletedPendingTransactions: deletedCount,
      message: deletedCount > 0 
        ? `Ativo adicionado. ${deletedCount} transações pendentes foram removidas para recálculo.`
        : 'Ativo adicionado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao adicionar ativo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao adicionar ativo' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/portfolio/[id]/assets
 * Update multiple asset allocations or replace all assets (for AI integration)
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.assets || !Array.isArray(body.assets)) {
      return NextResponse.json(
        { error: 'Campo obrigatório: assets (array)' },
        { status: 400 }
      );
    }

    // Check if this is a "replace all" operation (for AI integration)
    const replaceAll = body.replaceAll === true;
    
    if (replaceAll) {
      console.log(`🤖 [AI PORTFOLIO UPDATE] Substituindo todos os ativos da carteira ${resolvedParams.id}`);
      
      // 1. First, let's see what assets exist before deletion
      const existingAssets = await prisma.portfolioConfigAsset.findMany({
        where: {
          portfolioId: resolvedParams.id,
          portfolio: {
            userId: currentUser.id
          }
        },
        select: {
          id: true,
          ticker: true,
          targetAllocation: true
        }
      });
      
      console.log(`🗑️ [AI PORTFOLIO UPDATE] Assets existentes antes da deleção:`, existingAssets);
      
      // 2. Remove all existing assets from portfolio (simplified query)
      const deleteResult = await prisma.portfolioConfigAsset.deleteMany({
        where: {
          portfolioId: resolvedParams.id
        }
      });
      
      console.log(`🗑️ [AI PORTFOLIO UPDATE] ${deleteResult.count} assets deletados de ${existingAssets.length} existentes`);
      
      // 3. Validate and register all new assets
      let addedAssets = 0;
      const invalidTickers: string[] = [];
      
      for (const asset of body.assets) {
        const ticker = asset.ticker.toUpperCase().trim();
        
        // Validar ticker antes de tentar registrar
        try {
          await validateTicker(ticker);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Ticker inválido';
          console.warn(`⚠️ [AI PORTFOLIO UPDATE] Ticker inválido: ${ticker} - ${errorMessage}`);
          invalidTickers.push(ticker);
          continue; // Skip this asset but continue with others
        }
        
        // Register asset if it doesn't exist
        console.log(`📝 [AI PORTFOLIO UPDATE] Registrando ativo ${ticker}...`);
        const registrationResult = await AssetRegistrationService.registerAsset(ticker);
        
        if (!registrationResult.success) {
          console.warn(`⚠️ [AI PORTFOLIO UPDATE] Falha ao registrar ${ticker}: ${registrationResult.message}`);
          invalidTickers.push(ticker);
          continue; // Skip this asset but continue with others
        }
        
        // Add asset to portfolio
        await PortfolioService.addAsset(
          resolvedParams.id,
          currentUser.id,
          ticker,
          Number(asset.targetAllocation)
        );
        console.log(`✅ [AI PORTFOLIO UPDATE] Adicionado ${ticker} com ${(asset.targetAllocation * 100).toFixed(2)}%`);
        addedAssets++;
      }
      
      // Delete all pending transactions as portfolio structure changed completely
      const deletedCount = await deletePendingTransactions(resolvedParams.id);
      
      // Recalculate metrics
      await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

      // 4. Verify final state
      const finalAssets = await prisma.portfolioConfigAsset.findMany({
        where: {
          portfolioId: resolvedParams.id,
          portfolio: {
            userId: currentUser.id
          }
        },
        select: {
          ticker: true,
          targetAllocation: true
        }
      });
      
      console.log(`✅ [AI PORTFOLIO UPDATE] Estado final da carteira:`, finalAssets);

      const responseMessage = invalidTickers.length > 0
        ? `Carteira reconstruída pela IA: ${addedAssets} ativos configurados. ${invalidTickers.length} ticker(s) inválido(s) foram ignorados: ${invalidTickers.join(', ')}. ${deletedCount} transações pendentes foram removidas.`
        : `Carteira reconstruída pela IA: ${addedAssets} ativos configurados. ${deletedCount} transações pendentes foram removidas.`;

      return NextResponse.json({
        success: true,
        replacedAssets: true,
        addedAssets,
        totalAssets: body.assets.length,
        invalidTickers: invalidTickers.length > 0 ? invalidTickers : undefined,
        deletedPendingTransactions: deletedCount,
        message: responseMessage
      });
      
    } else {
      // Standard update operation (existing functionality)
      console.log(`📝 [PORTFOLIO UPDATE] Atualizando alocações da carteira ${resolvedParams.id}`);
      
      // Update each asset allocation
      for (const asset of body.assets) {
        await PortfolioService.updateAssetAllocation(
          resolvedParams.id,
          currentUser.id,
          asset.ticker,
          Number(asset.targetAllocation)
        );
      }

      // Delete all pending transactions as allocations have changed
      const deletedCount = await deletePendingTransactions(resolvedParams.id);
      
      // Recalculate metrics
      await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

      return NextResponse.json({
        success: true,
        replacedAssets: false,
        updatedAssets: body.assets.length,
        deletedPendingTransactions: deletedCount,
        message: deletedCount > 0
          ? `Alocações atualizadas. ${deletedCount} transações pendentes foram removidas para recálculo.`
          : 'Alocações atualizadas com sucesso'
      });
    }

  } catch (error) {
    console.error('Erro ao atualizar alocações:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar alocações' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/portfolio/[id]/assets
 * Update single asset allocation
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.ticker || !body.targetAllocation) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ticker, targetAllocation' },
        { status: 400 }
      );
    }

    await PortfolioService.updateAssetAllocation(
      resolvedParams.id,
      currentUser.id,
      body.ticker,
      Number(body.targetAllocation)
    );

    // Delete all pending transactions as allocations have changed
    const deletedCount = await deletePendingTransactions(resolvedParams.id);
    
    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      deletedPendingTransactions: deletedCount,
      message: deletedCount > 0
        ? `Alocação atualizada. ${deletedCount} transações pendentes foram removidas para recálculo.`
        : 'Alocação atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar alocação:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar alocação' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/[id]/assets
 * Remove asset from portfolio
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Try to get ticker from body first, fallback to query params
    let ticker: string | null = null;
    try {
      const body = await request.json();
      ticker = body.ticker;
    } catch {
      const { searchParams } = new URL(request.url);
      ticker = searchParams.get('ticker');
    }

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker é obrigatório' },
        { status: 400 }
      );
    }

    await PortfolioService.removeAsset(resolvedParams.id, currentUser.id, ticker);

    // Delete all pending transactions as allocations have changed
    const deletedCount = await deletePendingTransactions(resolvedParams.id);
    
    // Recalculate metrics
    await PortfolioMetricsService.updateMetrics(resolvedParams.id, currentUser.id);

    return NextResponse.json({
      success: true,
      deletedPendingTransactions: deletedCount,
      message: deletedCount > 0
        ? `Ativo removido. ${deletedCount} transações pendentes foram removidas para recálculo.`
        : 'Ativo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover ativo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover ativo' },
      { status: 500 }
    );
  }
}

