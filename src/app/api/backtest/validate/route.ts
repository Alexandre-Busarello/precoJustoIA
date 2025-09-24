import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { BacktestDataValidator } from '@/lib/backtest-data-validator';

// Interface para request de validação
interface ValidateBacktestRequest {
  assets: Array<{ ticker: string; allocation: number }>;
  startDate: string;
  endDate: string;
}

// POST /api/backtest/validate - Validar dados antes de executar backtesting
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Usar o serviço centralizado para obter o usuário válido
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é usuário Premium
    if (!currentUser.isPremium) {
      return NextResponse.json({ 
        error: 'Validação de dados exclusiva para usuários Premium',
        upgradeUrl: '/dashboard'
      }, { status: 403 });
    }

    const body: ValidateBacktestRequest = await request.json();
    
    // Validar parâmetros básicos
    if (!body.assets || !Array.isArray(body.assets) || body.assets.length === 0) {
      return NextResponse.json(
        { error: 'Lista de ativos é obrigatória' },
        { status: 400 }
      );
    }

    if (!body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Datas de início e fim são obrigatórias' },
        { status: 400 }
      );
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Formato de data inválido' },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Data de início deve ser anterior à data de fim' },
        { status: 400 }
      );
    }

    // Validar tickers
    const tickers = body.assets.map(a => a.ticker.toUpperCase());
    const validator = new BacktestDataValidator();
    
    const { validTickers, invalidTickers } = await validator.validateTickers(tickers);
    
    if (invalidTickers.length > 0) {
      return NextResponse.json({
        error: 'Tickers inválidos encontrados',
        invalidTickers,
        validTickers
      }, { status: 400 });
    }

    console.log('🔍 Validando dados para backtesting:', {
      user: currentUser.email,
      assets: tickers,
      period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`
    });

    // Executar validação completa
    const validation = await validator.validateBacktestData(
      body.assets,
      startDate,
      endDate
    );

    // Obter estatísticas gerais de disponibilidade
    const stats = await validator.getDataAvailabilityStats();

    console.log('✅ Validação concluída:', {
      isValid: validation.isValid,
      warnings: validation.globalWarnings.length,
      recommendations: validation.recommendations.length
    });

    return NextResponse.json({
      validation,
      stats,
      summary: {
        isValid: validation.isValid,
        totalAssets: body.assets.length,
        assetsWithData: validation.assetsAvailability.filter(a => a.totalMonths > 0).length,
        averageDataQuality: calculateAverageDataQuality(validation.assetsAvailability),
        adjustedPeriodMonths: getMonthsDifference(validation.adjustedStartDate, validation.adjustedEndDate),
        originalPeriodMonths: getMonthsDifference(startDate, endDate)
      }
    });

  } catch (error) {
    console.error('Erro ao validar dados de backtesting:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Funções auxiliares
function calculateAverageDataQuality(assetsAvailability: any[]): string {
  if (assetsAvailability.length === 0) return 'unknown';
  
  const qualityScores = assetsAvailability.map(asset => {
    switch (asset.dataQuality) {
      case 'excellent': return 4;
      case 'good': return 3;
      case 'fair': return 2;
      case 'poor': return 1;
      default: return 0;
    }
  });
  
  const avgScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  
  if (avgScore >= 3.5) return 'excellent';
  if (avgScore >= 2.5) return 'good';
  if (avgScore >= 1.5) return 'fair';
  return 'poor';
}

function getMonthsDifference(startDate: Date, endDate: Date): number {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
         (endDate.getMonth() - startDate.getMonth()) + 1;
}
