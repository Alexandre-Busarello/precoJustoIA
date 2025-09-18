import { NextRequest, NextResponse } from 'next/server';
import { main as fetchWardData } from '../../../../scripts/fetch-data-ward';

// Configurar timeout para 5 minutos (máximo da Vercel)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando fetch de dados da Ward via API...');
    
    // Verificar se há autenticação (opcional - adicione sua lógica de auth aqui)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.FETCH_API_SECRET}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Obter parâmetros do body
    const body = await request.json().catch(() => ({}));
    const { tickers, noBrapi, forceFullUpdate } = body;

    // Simular argumentos do processo para o script
    const originalArgv = process.argv;
    process.argv = ['node', 'fetch-data-ward.ts'];
    
    if (tickers && Array.isArray(tickers)) {
      process.argv.push(...tickers);
    }
    
    if (noBrapi) {
      process.argv.push('--no-brapi');
    }
    
    if (forceFullUpdate) {
      process.argv.push('--force-full');
    }

    // Capturar logs
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog(...args);
    };
    
    console.error = (...args) => {
      const message = `ERROR: ${args.join(' ')}`;
      logs.push(message);
      originalError(...args);
    };

    try {
      // Executar o script
      await fetchWardData();
      
      // Restaurar console e argv
      console.log = originalLog;
      console.error = originalError;
      process.argv = originalArgv;

      return NextResponse.json({
        success: true,
        message: 'Fetch de dados concluído com sucesso',
        logs: logs.slice(-50) // Últimas 50 linhas de log
      });

    } catch (error: any) {
      // Restaurar console e argv
      console.log = originalLog;
      console.error = originalError;
      process.argv = originalArgv;

      console.error('Erro no fetch de dados:', error);
      
      return NextResponse.json({
        success: false,
        error: error.message,
        logs: logs.slice(-50) // Últimas 50 linhas de log
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Erro na API:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API para fetch de dados da Ward',
    usage: 'Use POST com { "tickers": ["PETR4"], "noBrapi": false, "forceFullUpdate": false }',
    auth: 'Requer header Authorization: Bearer <FETCH_API_SECRET>'
  });
}
