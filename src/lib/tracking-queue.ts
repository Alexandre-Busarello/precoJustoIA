/**
 * Sistema de fila para processamento assíncrono de eventos de tracking
 * Processa eventos em batch para melhor performance
 */

import { prisma } from '@/lib/prisma';
import { getIPHashFromRequest } from './tracking-utils';
import { EventType } from './tracking-types';

interface QueuedEvent {
  sessionId: string;
  userId: string | null;
  eventType: EventType;
  page: string;
  element?: string | null;
  metadata?: any;
  timestamp: Date;
  userAgent?: string | null;
  ipHash?: string | null;
  referrer?: string | null;
}

// Fila em memória (fallback se não usar Redis)
let eventQueue: QueuedEvent[] = [];
let processing = false;
const BATCH_SIZE = 100; // Processa até 100 eventos por vez
const PROCESS_INTERVAL = 10000; // Processa a cada 10 segundos

/**
 * Adiciona eventos à fila
 */
export function enqueueEvents(events: QueuedEvent[]): void {
  eventQueue.push(...events);
  
  // Inicia processamento se não estiver rodando
  if (!processing && eventQueue.length > 0) {
    scheduleProcessing();
  }
}

/**
 * Agenda processamento da fila
 */
function scheduleProcessing(): void {
  if (processing) return;
  
  setTimeout(() => {
    processQueue();
  }, PROCESS_INTERVAL);
}

/**
 * Processa eventos da fila em batch
 */
async function processQueue(): Promise<void> {
  if (processing || eventQueue.length === 0) {
    return;
  }

  processing = true;

  try {
    // Pega batch de eventos
    const batch = eventQueue.splice(0, BATCH_SIZE);
    
    if (batch.length === 0) {
      processing = false;
      return;
    }

    // Insere no banco em batch
    await prisma.userEvent.createMany({
      data: batch.map(event => ({
        sessionId: event.sessionId,
        userId: event.userId,
        eventType: event.eventType,
        page: event.page,
        element: event.element,
        metadata: event.metadata || {},
        timestamp: event.timestamp,
        userAgent: event.userAgent,
        ipHash: event.ipHash,
        referrer: event.referrer,
      })),
      skipDuplicates: true,
    });

    console.log(`✅ Processados ${batch.length} eventos de tracking`);

    // Continua processando se ainda houver eventos
    if (eventQueue.length > 0) {
      scheduleProcessing();
    }
  } catch (error) {
    console.error('❌ Erro ao processar eventos de tracking:', error);
    
    // Recoloca eventos na fila em caso de erro (até um limite)
    if (eventQueue.length < BATCH_SIZE * 10) {
      // Não recoloca para evitar loop infinito
      // Em produção, considerar usar Redis ou fila externa
    }
  } finally {
    processing = false;
  }
}

/**
 * Processa eventos imediatamente (para casos críticos)
 */
export async function processEventsImmediately(events: QueuedEvent[]): Promise<void> {
  if (events.length === 0) return;

  try {
    await prisma.userEvent.createMany({
      data: events.map(event => ({
        sessionId: event.sessionId,
        userId: event.userId,
        eventType: event.eventType,
        page: event.page,
        element: event.element,
        metadata: event.metadata || {},
        timestamp: event.timestamp,
        userAgent: event.userAgent,
        ipHash: event.ipHash,
        referrer: event.referrer,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.error('❌ Erro ao processar eventos imediatamente:', error);
    // Em caso de erro, adiciona à fila para retry
    enqueueEvents(events);
  }
}

/**
 * Prepara eventos para inserção a partir de dados do request
 */
export function prepareEventsFromRequest(
  events: Array<{
    eventType: EventType;
    page: string;
    element?: string;
    metadata?: any;
    timestamp: Date | string;
  }>,
  sessionId: string,
  userId: string | null,
  request: Request
): QueuedEvent[] {
  const ipHash = getIPHashFromRequest(request);
  const userAgent = request.headers.get('user-agent') || null;
  const referrer = request.headers.get('referer') || null;

  return events.map(event => ({
    sessionId,
    userId,
    eventType: event.eventType,
    page: event.page,
    element: event.element || null,
    metadata: event.metadata || {},
    timestamp: typeof event.timestamp === 'string' 
      ? new Date(event.timestamp) 
      : event.timestamp,
    userAgent,
    ipHash,
    referrer,
  }));
}

// Inicia processamento periódico se houver eventos na fila
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (eventQueue.length > 0 && !processing) {
      processQueue();
    }
  }, PROCESS_INTERVAL);
}

