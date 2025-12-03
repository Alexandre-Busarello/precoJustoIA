/**
 * API: Run Index Job Manually
 * POST /api/admin/indices/[id]/run-job
 * 
 * Executa manualmente um job específico para um índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/user-service';
import { updateIndexPoints, fillMissingHistory } from '@/lib/index-engine';
import { runScreening, compareComposition, shouldRebalance, updateComposition, generateRebalanceReason } from '@/lib/index-screening-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação e admin
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id: indexId } = await params;
    const body = await request.json();
    const jobType = body.jobType || 'mark-to-market'; // 'mark-to-market' ou 'screening'
    const fillMissing = body.fillMissing !== false; // Por padrão, preencher dias faltantes

    // Buscar índice
    const index = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      include: {
        composition: true
      }
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const results: any = {
      jobType,
      indexId: index.id,
      ticker: index.ticker,
      startTime: new Date().toISOString()
    };

    try {
      if (jobType === 'mark-to-market') {
        // Job de Mark-to-Market
        console.log(`🔧 [MANUAL JOB] Running mark-to-market for ${index.ticker}...`);

        // Preencher dias faltantes se solicitado
        if (fillMissing) {
          const filledDays = await fillMissingHistory(index.id);
          results.filledDays = filledDays;
          console.log(`  ✅ Filled ${filledDays} missing days`);
        }

        // Calcular pontos para hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const success = await updateIndexPoints(index.id, today);
        
        if (success) {
          results.success = true;
          results.message = 'Mark-to-market executado com sucesso';
        } else {
          results.success = false;
          results.message = 'Falha ao atualizar pontos do índice';
        }

      } else if (jobType === 'screening') {
        // Job de Screening
        console.log(`🔧 [MANUAL JOB] Running screening for ${index.ticker}...`);

        // Executar screening
        const idealComposition = await runScreening(index);

        if (idealComposition.length === 0) {
          results.success = true;
          results.message = 'Screening executado, mas nenhuma empresa encontrada';
          results.rebalanced = false;
          results.changes = [];
        } else {
          // Comparar com composição atual
          const currentComposition = index.composition || [];
          const changes = compareComposition(currentComposition, idealComposition);

          // Verificar se deve rebalancear
          const config = index.config as any;
          const threshold = config.rebalance?.threshold || 0.05;
          const upsideType = config.rebalance?.upsideType || 'best';
          const shouldRebalanceResult = shouldRebalance(currentComposition, idealComposition, threshold, upsideType);

          if (shouldRebalanceResult && changes.length > 0) {
            // Gerar motivo detalhado do rebalanceamento
            const rebalanceReason = generateRebalanceReason(
              currentComposition,
              idealComposition,
              threshold,
              config.rebalance?.checkQuality || false,
              upsideType
            );
            
            // Atualizar composição com motivo
            await updateComposition(index.id, idealComposition, changes, rebalanceReason);
            
            results.success = true;
            results.rebalanced = true;
            results.changes = changes;
            results.rebalanceReason = rebalanceReason;
            results.message = `Rebalanced com ${changes.length} mudanças: ${rebalanceReason}`;
          } else {
            results.success = true;
            results.rebalanced = false;
            results.changes = [];
            results.message = 'Screening executado, mas não há necessidade de rebalanceamento';
          }
        }
      } else {
        return NextResponse.json(
          { error: `Tipo de job inválido: ${jobType}. Use 'mark-to-market' ou 'screening'` },
          { status: 400 }
        );
      }

      results.duration = Date.now() - startTime;
      results.endTime = new Date().toISOString();

      return NextResponse.json({
        success: true,
        result: results
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [MANUAL JOB] Error running ${jobType} for ${index.ticker}:`, error);
      
      results.success = false;
      results.error = errorMsg;
      results.duration = Date.now() - startTime;
      results.endTime = new Date().toISOString();

      return NextResponse.json(
        {
          success: false,
          result: results
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error running job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao executar job'
      },
      { status: 500 }
    );
  }
}

