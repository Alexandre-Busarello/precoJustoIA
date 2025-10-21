/**
 * Cron Job Endpoint: Update Portfolio Assets
 * 
 * Atualiza todos os ativos de todas as carteiras de forma inteligente:
 * - Histórico de preços (incremental)
 * - Histórico de dividendos (incremental)
 * - Dados gerais dos ativos
 * 
 * Designed to run periodically via cron job
 * 
 * GET /api/cron/update-portfolio-assets - Atualização completa
 * GET /api/cron/update-portfolio-assets?mode=prices - Apenas preços
 * GET /api/cron/update-portfolio-assets?mode=dividends - Apenas dividendos
 */

import { NextRequest, NextResponse } from 'next/server';
import { PortfolioAssetUpdateService } from '@/lib/portfolio-asset-update-service';

/**
 * GET /api/cron/update-portfolio-assets
 * 
 * Atualiza dados de todos os ativos de carteiras
 * 
 * Query params:
 * - mode: 'full' | 'prices' | 'dividends' (default: 'full')
 * 
 * Headers required:
 * - Authorization: Bearer <CRON_SECRET> ou x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const isAuthorized = verifyCronAuth(request);
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid cron secret' },
        { status: 401 }
      );
    }

    // 2. Pegar modo de execução
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'full';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🕐 [CRON JOB] Iniciando atualização de ativos - Modo: ${mode}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    let summary;

    // 3. Executar atualização baseada no modo
    switch (mode) {
      case 'prices':
        summary = await PortfolioAssetUpdateService.updateHistoricalPricesOnly();
        break;
      
      case 'dividends':
        summary = await PortfolioAssetUpdateService.updateDividendsOnly();
        break;
      
      case 'full':
      default:
        summary = await PortfolioAssetUpdateService.updateAllPortfolioAssets();
        break;
    }

    // 4. Retornar resumo
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ [CRON JOB] Atualização concluída com sucesso`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      mode,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n❌ [CRON JOB] Erro durante atualização:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Verifica autenticação do cron job
 * Suporta dois métodos:
 * 1. Header Authorization: Bearer <secret>
 * 2. Header x-cron-secret: <secret>
 */
function verifyCronAuth(request: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET;

  // Se não há secret configurado, aceitar em dev (CUIDADO!)
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [CRON AUTH] CRON_SECRET não configurado - permitindo em DEV');
      return true;
    }
    console.error('❌ [CRON AUTH] CRON_SECRET não configurado em produção');
    return false;
  }

  // Método 1: Authorization Bearer
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === CRON_SECRET) {
      return true;
    }
  }

  // Método 2: x-cron-secret header
  const cronSecretHeader = request.headers.get('x-cron-secret');
  if (cronSecretHeader === CRON_SECRET) {
    return true;
  }

  console.warn('⚠️ [CRON AUTH] Tentativa de acesso não autorizado');
  return false;
}

/**
 * POST - Mesmo comportamento do GET (para compatibilidade com alguns serviços de cron)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

