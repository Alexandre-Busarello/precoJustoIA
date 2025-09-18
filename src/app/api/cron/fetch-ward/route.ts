import { NextRequest, NextResponse } from 'next/server';
import { main as fetchWardData } from '../../../../../scripts/fetch-data-ward';

// Configurar timeout para 5 minutos (máximo da Vercel)
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    // Verificar se é uma chamada do cron da Vercel
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('🕐 Executando cron job para fetch de dados da Ward...');
    
    const startTime = Date.now();
    
    // Simular argumentos do processo para processar todas as empresas
    const originalArgv = process.argv;
    process.argv = ['node', 'fetch-data-ward.ts']; // Sem tickers = processar todas

    try {
      // Executar o script
      await fetchWardData();
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const minutes = Math.floor(totalTime / 60000);
      const seconds = Math.floor((totalTime % 60000) / 1000);
      
      // Restaurar argv
      process.argv = originalArgv;

      console.log(`✅ Cron job concluído em ${minutes}m ${seconds}s`);

      return NextResponse.json({
        success: true,
        message: 'Cron job executado com sucesso',
        executionTime: `${minutes}m ${seconds}s`,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      // Restaurar argv
      process.argv = originalArgv;

      console.error('Erro no cron job:', error);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const minutes = Math.floor(totalTime / 60000);
      const seconds = Math.floor((totalTime % 60000) / 1000);
      
      return NextResponse.json({
        success: false,
        error: error.message,
        executionTime: `${minutes}m ${seconds}s`,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Erro na API do cron:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
