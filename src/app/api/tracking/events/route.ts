/**
 * API endpoint para receber eventos de tracking
 * Processa eventos de forma assíncrona (não bloqueia)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { enqueueEvents, prepareEventsFromRequest } from '@/lib/tracking-queue';
import { EventType } from '@/lib/tracking-types';

// Valores do enum para validação
const EventTypeValues = Object.values(EventType);

export const maxDuration = 10; // 10 segundos máximo

export async function POST(request: NextRequest) {
  try {
    // Validação básica
    const body = await request.json();
    const { events, sessionId, userId: providedUserId } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Events array is required' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validação de tamanho do batch
    if (events.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 events per batch' },
        { status: 400 }
      );
    }

    // Obtém userId da sessão se disponível (prioriza sessão sobre userId fornecido)
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id || providedUserId || null;
    } catch (error) {
      // Continua mesmo se não conseguir obter sessão
      userId = providedUserId || null;
    }

    // Valida eventos
    const validEvents = events.filter((event: any) => {
      return (
        event.eventType &&
        EventTypeValues.includes(event.eventType) &&
        event.page &&
        typeof event.page === 'string'
      );
    });

    if (validEvents.length === 0) {
      return NextResponse.json(
        { error: 'No valid events found' },
        { status: 400 }
      );
    }

    // Prepara eventos para inserção
    const preparedEvents = prepareEventsFromRequest(
      validEvents,
      sessionId,
      userId,
      request
    );

    // Adiciona à fila de processamento (assíncrono)
    enqueueEvents(preparedEvents);

    // Retorna 202 Accepted imediatamente (não bloqueia)
    return NextResponse.json(
      { 
        success: true, 
        queued: preparedEvents.length,
        message: 'Events queued for processing' 
      },
      { status: 202 }
    );

  } catch (error) {
    console.error('❌ Erro ao processar eventos de tracking:', error);
    
    // Retorna erro mas não bloqueia a aplicação
    return NextResponse.json(
      { 
        error: 'Failed to process events',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Permitir apenas POST
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

