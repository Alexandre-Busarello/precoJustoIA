/**
 * API: Recreate Index from Zero
 * POST /api/admin/indices/[id]/recreate
 * 
 * Recria um índice do zero, removendo toda composição, histórico e logs,
 * executando novo screening e criando primeiro ponto histórico no dia atual
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { runScreening, updateComposition } from '@/lib/index-screening-engine';
import { updateIndexPoints } from '@/lib/index-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar se o índice existe
    const index = await prisma.indexDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            composition: true,
            history: true,
            rebalanceLogs: true
          }
        }
      }
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    console.log(`🔄 [ADMIN INDICES] Recriando índice ${index.ticker} do zero...`);

    // 1. Limpar todos os dados existentes
    console.log(`  → Removendo ${index._count.composition} composições...`);
    await prisma.indexComposition.deleteMany({
      where: { indexId: id }
    });

    console.log(`  → Removendo ${index._count.history} pontos históricos...`);
    await prisma.indexHistoryPoints.deleteMany({
      where: { indexId: id }
    });

    console.log(`  → Removendo ${index._count.rebalanceLogs} logs de rebalanceamento...`);
    await prisma.indexRebalanceLog.deleteMany({
      where: { indexId: id }
    });

    // Deletar checkpoints relacionados
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        OR: [
          { indexId: id },
          { lastProcessedIndexId: id }
        ]
      }
    }).catch(() => {
      // Ignorar erro se a tabela não existir
    });

    console.log(`✅ [ADMIN INDICES] Dados antigos removidos`);

    // 2. Executar novo screening
    console.log(`  → Executando screening...`);
    const selectedCompanies = await runScreening(index);

    if (selectedCompanies.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhuma empresa foi selecionada no screening. Verifique os critérios de qualidade.'
        },
        { status: 400 }
      );
    }

    console.log(`  → ${selectedCompanies.length} empresas selecionadas`);

    // 3. Criar composição inicial
    const initialChanges = selectedCompanies.map(candidate => ({
      action: 'ENTRY' as const,
      ticker: candidate.ticker,
      reason: `Recriação do índice - Ativo selecionado no screening com ${candidate.upside !== null ? `${candidate.upside.toFixed(1)}% de upside` : 'critérios atendidos'}`
    }));

    await updateComposition(id, selectedCompanies, initialChanges, 'Recriação completa do índice do zero');
    console.log(`✅ [ADMIN INDICES] Composição inicial criada com ${selectedCompanies.length} ativos`);

    // 4. Criar primeiro ponto histórico (base 100) no dia atual
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pointCreated = await updateIndexPoints(id, today);

    if (pointCreated) {
      console.log(`✅ [ADMIN INDICES] Primeiro ponto histórico criado (base 100) no dia ${today.toISOString().split('T')[0]}`);
    } else {
      console.warn(`⚠️ [ADMIN INDICES] Não foi possível criar o primeiro ponto histórico`);
      return NextResponse.json(
        {
          success: false,
          error: 'Composição criada mas não foi possível criar o primeiro ponto histórico'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Índice ${index.ticker} recriado com sucesso`,
      details: {
        companiesSelected: selectedCompanies.length,
        firstPointDate: today.toISOString().split('T')[0],
        composition: selectedCompanies.map(c => ({
          ticker: c.ticker,
          name: c.name,
          weight: selectedCompanies.length > 0 ? (1 / selectedCompanies.length) : 0
        }))
      }
    });
  } catch (error) {
    console.error(`❌ [ADMIN INDICES] Error recreating index:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recriar índice'
      },
      { status: 500 }
    );
  }
}

