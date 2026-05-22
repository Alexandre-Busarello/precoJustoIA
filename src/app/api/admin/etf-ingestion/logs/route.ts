import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer privilégios de administrador.' },
        { status: 403 }
      );
    }

    const logs = await prisma.etfIngestionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const summary = {
      totalRuns: logs.length,
      lastRun: logs[0] ?? null,
      phase1LastSuccess: logs.find((l) => l.phase === 1 && l.status === 'success') ?? null,
      phase2LastSuccess: logs.find((l) => l.phase === 2 && l.status === 'success') ?? null,
      recentFailures: logs.filter((l) => l.status === 'failed').slice(0, 5),
    };

    return NextResponse.json({ summary, logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
