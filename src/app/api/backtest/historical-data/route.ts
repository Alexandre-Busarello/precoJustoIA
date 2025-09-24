import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQuery } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { toNumber } from '@/lib/strategies/base-strategy';

// GET /api/backtest/historical-data - Obter dados históricos para período específico
export async function GET(request: NextRequest) {
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
        error: 'Acesso a dados históricos exclusivo para usuários Premium',
        upgradeUrl: '/dashboard'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get('tickers');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Validar parâmetros
    if (!tickersParam) {
      return NextResponse.json(
        { error: 'Parâmetro tickers é obrigatório' },
        { status: 400 }
      );
    }

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'Parâmetros startDate e endDate são obrigatórios' },
        { status: 400 }
      );
    }

    const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase());
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // Validar datas
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

    // Limitar número de tickers
    if (tickers.length > 20) {
      return NextResponse.json(
        { error: 'Máximo 20 tickers por consulta' },
        { status: 400 }
      );
    }

    console.log('📊 Buscando dados históricos:', {
      tickers,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      user: currentUser.email
    });

    // Buscar dados históricos
    const historicalData = await safeQuery('get-historical-data-for-backtest', () =>
      prisma.historicalPrice.findMany({
        where: {
          company: { ticker: { in: tickers } },
          interval: '1mo',
          date: { gte: startDate, lte: endDate }
        },
        include: { company: { select: { ticker: true, name: true } } },
        orderBy: [{ company: { ticker: 'asc' } }, { date: 'asc' }]
      })
    );

    // Agrupar dados por ticker
    const groupedData: Record<string, any[]> = {};
    
    // Inicializar arrays vazios para todos os tickers
    tickers.forEach(ticker => {
      groupedData[ticker] = [];
    });

    // Processar dados históricos
    historicalData.forEach(record => {
      const ticker = record.company.ticker;
      groupedData[ticker].push({
        date: record.date.toISOString().split('T')[0],
        open: toNumber(record.open),
        high: toNumber(record.high),
        low: toNumber(record.low),
        close: toNumber(record.close),
        adjustedClose: toNumber(record.adjustedClose),
        volume: Number(record.volume)
      });
    });

    // Calcular estatísticas de disponibilidade
    const availability: Record<string, any> = {};
    
    tickers.forEach(ticker => {
      const data = groupedData[ticker];
      availability[ticker] = {
        totalPoints: data.length,
        firstDate: data.length > 0 ? data[0].date : null,
        lastDate: data.length > 0 ? data[data.length - 1].date : null,
        hasData: data.length > 0
      };
    });

    console.log('✅ Dados históricos obtidos:', {
      totalRecords: historicalData.length,
      tickersWithData: Object.values(availability).filter((a: any) => a.hasData).length
    });

    return NextResponse.json({ 
      data: groupedData,
      availability,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      metadata: {
        totalTickers: tickers.length,
        totalRecords: historicalData.length,
        interval: '1mo'
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dados históricos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
