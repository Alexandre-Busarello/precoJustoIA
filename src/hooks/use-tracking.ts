/**
 * Hook para tracking de eventos do usuário
 * Gerencia buffer local e envio assíncrono de eventos
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  generateSessionId,
  getPageMetadata,
  sanitizeEventData,
  getScrollDepth,
  getElementInfo,
  isTrackingOptedOut,
} from '@/lib/tracking-utils';
import { EventType } from '@/lib/tracking-types';
import { useAdminStatus } from './use-admin-status';

const BATCH_SIZE = 50; // Máximo de eventos por batch
const FLUSH_INTERVAL = 5000; // 5 segundos
const API_ENDPOINT = '/api/tracking/events';

interface TrackingEvent {
  eventType: EventType;
  page: string;
  element?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface UseTrackingReturn {
  trackEvent: (eventType: EventType, element?: string, metadata?: Record<string, any>) => void;
  trackClick: (element: HTMLElement | EventTarget, metadata?: Record<string, any>) => void;
  trackPageView: (page?: string, metadata?: Record<string, any>) => void;
  trackScroll: (depth?: number) => void;
  trackTimeOnPage: (seconds: number) => void;
  flush: () => Promise<void>;
}

let eventBuffer: TrackingEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let scrollTracked = false;
let timeOnPageStart: number | null = null;

// Cache para deduplicação de eventos similares
const recentEvents = new Map<string, number>(); // Map<signature, timestamp>

// Janelas de deduplicação por tipo de evento (em milissegundos)
const DEDUP_WINDOWS = {
  [EventType.PAGE_VIEW]: 5000, // 5 segundos - evita refreshs múltiplos
  [EventType.CLICK]: 1000, // 1 segundo - evita cliques duplos acidentais
  [EventType.SCROLL]: 3000, // 3 segundos - evita scrolls muito frequentes
  [EventType.TIME_ON_PAGE]: 10000, // 10 segundos - evita múltiplos time tracking
  [EventType.ASSET_VIEWED]: 3000, // 3 segundos - evita múltiplas visualizações do mesmo ativo
  [EventType.NAVIGATION]: 2000, // 2 segundos
  [EventType.FORM_SUBMIT]: 5000, // 5 segundos - evita duplo submit
  [EventType.FEATURE_USED]: 2000, // 2 segundos
  [EventType.RANKING_CREATED]: 10000, // 10 segundos - evita criação duplicada
  [EventType.BACKTEST_RUN]: 10000, // 10 segundos
  [EventType.COMPARISON_STARTED]: 5000, // 5 segundos
  [EventType.SEARCH]: 2000, // 2 segundos
  [EventType.DOWNLOAD]: 5000, // 5 segundos
  [EventType.ERROR]: 1000, // 1 segundo
};

const DEDUP_CLEANUP_INTERVAL = 60000; // Limpa cache a cada minuto

/**
 * Gera uma assinatura única para um evento (para deduplicação)
 */
function getEventSignature(
  eventType: EventType,
  page: string,
  element?: string,
  metadata?: Record<string, any>
): string {
  // Para eventos de clique, usa visibleLabel + coordenadas aproximadas
  if (eventType === EventType.CLICK && metadata) {
    const visibleLabel = metadata.visibleLabel || '';
    const x = metadata.x ? Math.floor(metadata.x / 100) * 100 : null; // Grid maior: 100px
    const y = metadata.y ? Math.floor(metadata.y / 100) * 100 : null;
    // Usa visibleLabel como parte da chave para evitar cliques duplicados no mesmo elemento
    return `${eventType}:${page}:${visibleLabel || element || ''}:${x || ''}:${y || ''}`;
  }
  
  // Para scroll, usa depth arredondado (marcos de 25%)
  if (eventType === EventType.SCROLL && metadata?.depth) {
    const depth = Math.floor(metadata.depth / 25) * 25;
    return `${eventType}:${page}:${depth}`;
  }
  
  // Para ASSET_VIEWED, inclui ticker na assinatura
  if (eventType === EventType.ASSET_VIEWED && metadata?.ticker) {
    return `${eventType}:${page}:${metadata.ticker}`;
  }
  
  // Para PAGE_VIEW, usa apenas tipo + página (mais agressivo)
  if (eventType === EventType.PAGE_VIEW) {
    return `${eventType}:${page}`;
  }
  
  // Para TIME_ON_PAGE, agrupa por página
  if (eventType === EventType.TIME_ON_PAGE) {
    const pageKey = metadata?.page || page;
    return `${eventType}:${pageKey}`;
  }
  
  // Para outros eventos, usa tipo + página + elemento
  return `${eventType}:${page}:${element || ''}`;
}

/**
 * Verifica se um evento é duplicado (muito similar a um evento recente)
 */
function isDuplicateEvent(
  eventType: EventType,
  page: string,
  element?: string,
  metadata?: Record<string, any>
): boolean {
  const signature = getEventSignature(eventType, page, element, metadata);
  const now = Date.now();
  const lastTime = recentEvents.get(signature);
  
  // Obtém janela de deduplicação específica para o tipo de evento
  const dedupWindow = DEDUP_WINDOWS[eventType] || 2000; // Default: 2 segundos
  
  if (lastTime && (now - lastTime) < dedupWindow) {
    return true; // Evento muito similar ocorreu recentemente
  }
  
  // Atualiza timestamp do evento
  recentEvents.set(signature, now);
  
  // Limpa eventos antigos periodicamente (mais agressivo)
  if (recentEvents.size > 500) {
    const cutoffTime = now - Math.max(...Object.values(DEDUP_WINDOWS));
    for (const [key, timestamp] of recentEvents.entries()) {
      if (timestamp < cutoffTime) {
        recentEvents.delete(key);
      }
    }
  }
  
  return false;
}

/**
 * Hook principal de tracking
 */
export function useTracking(): UseTrackingReturn {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isAdmin } = useAdminStatus();
  const sessionIdRef = useRef<string | null>(null);
  const lastPageRef = useRef<string | null>(null);
  const scrollDepthRef = useRef<number>(0);
  const timeOnPageRef = useRef<number>(0);

  // Inicializa sessão de forma síncrona quando possível (client-side)
  if (typeof window !== 'undefined' && !sessionIdRef.current) {
    sessionIdRef.current = generateSessionId();
    timeOnPageStart = Date.now();
  }

  // Garante inicialização no useEffect também (fallback)
  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionIdRef.current) {
      sessionIdRef.current = generateSessionId();
      if (!timeOnPageStart) {
        timeOnPageStart = Date.now();
      }
    }
  }, []);

  /**
   * Envia eventos pendentes para o servidor
   */
  const flush = useCallback(async () => {
    if (eventBuffer.length === 0 || !sessionIdRef.current) return;

    const eventsToSend = [...eventBuffer];
    eventBuffer = [];

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    try {
      await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToSend,
          sessionId: sessionIdRef.current,
          userId: session?.user?.id || null,
        }),
        // Não bloquear navegação
        keepalive: true,
      });
    } catch (error) {
      console.error('Erro ao enviar eventos de tracking:', error);
      // Recoloca eventos no buffer em caso de erro (até um limite)
      if (eventBuffer.length < BATCH_SIZE * 2) {
        eventBuffer.unshift(...eventsToSend);
      }
    }
  }, [session]);

  /**
   * Agenda flush automático
   */
  const scheduleFlush = useCallback(() => {
    if (flushTimer) return;

    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_INTERVAL);
  }, [flush]);

  /**
   * Função interna para trackear eventos
   */
  const trackEventInternal = useCallback((
    eventType: EventType,
    element?: string,
    metadata?: Record<string, any>
  ) => {
    // Não trackear se usuário for admin
    if (isAdmin) return;
    
    if (isTrackingOptedOut() || !sessionIdRef.current) return;

    const pageMeta = getPageMetadata();
    
    // Verifica se é evento duplicado (evita poluir com refreshs, etc)
    if (isDuplicateEvent(eventType, pageMeta.path, element, metadata)) {
      return; // Ignora evento duplicado
    }

    const event: TrackingEvent = {
      eventType,
      page: pageMeta.path,
      element,
      metadata: sanitizeEventData({
        ...metadata,
        viewport: pageMeta.viewport,
      }),
      timestamp: new Date(),
    };

    eventBuffer.push(event);

    // Envia batch se atingir tamanho máximo
    if (eventBuffer.length >= BATCH_SIZE) {
      flush();
    } else {
      // Agenda flush automático
      scheduleFlush();
    }
  }, [flush, scheduleFlush, isAdmin]);

  // Auto-track de mudanças de página
  useEffect(() => {
    // Garante que sessionId está inicializado antes de tentar trackear
    if (typeof window === 'undefined') return;
    
    // Inicializa sessionId se ainda não foi inicializado
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId();
      if (!timeOnPageStart) {
        timeOnPageStart = Date.now();
      }
    }

    if (isAdmin || !sessionIdRef.current || isTrackingOptedOut()) return;

    const currentPage = pathname;
    
    // Track page view quando muda de página (incluindo primeira carga quando lastPageRef é null)
    if (lastPageRef.current !== currentPage) {
      // Track tempo na página anterior (apenas se passou tempo suficiente e não é primeira carga)
      if (lastPageRef.current && timeOnPageStart) {
        const timeSpent = Math.floor((Date.now() - timeOnPageStart) / 1000);
        // Só tracka se passou pelo menos 2 segundos (evita refreshs rápidos)
        if (timeSpent >= 2) {
          trackEventInternal(
            EventType.TIME_ON_PAGE,
            undefined,
            {
              page: lastPageRef.current,
              seconds: timeSpent,
            }
          );
        }
      }

      // Track nova página (deduplicação já está no trackEventInternal)
      // Na primeira carga, lastPageRef.current é null, então usa document.referrer
      trackEventInternal(EventType.PAGE_VIEW, undefined, {
        referrer: lastPageRef.current || (typeof document !== 'undefined' ? document.referrer : ''),
      });

      lastPageRef.current = currentPage;
      timeOnPageStart = Date.now();
      scrollTracked = false;
      scrollDepthRef.current = 0;
    }
  }, [pathname, trackEventInternal, isAdmin]);

  // Auto-track de cliques (para mapa de calor)
  useEffect(() => {
    if (isAdmin || isTrackingOptedOut() || !sessionIdRef.current) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Ignora cliques em elementos que não são interativos relevantes
      // (pode ser ajustado conforme necessário)
      const ignoredTags = ['script', 'style', 'meta', 'link'];
      if (ignoredTags.includes(target.tagName.toLowerCase())) {
        return;
      }

      // Obtém informações do elemento
      const elementInfo = getElementInfo(target);
      
      // Obtém coordenadas do clique
      const x = event.clientX;
      const y = event.clientY;
      
      // Obtém posição relativa ao elemento
      const rect = target.getBoundingClientRect();
      const relativeX = x - rect.left;
      const relativeY = y - rect.top;

      // Track o clique com todas as informações necessárias para o mapa de calor
      trackEventInternal(
        EventType.CLICK,
        elementInfo.selector || undefined,
        {
          ...elementInfo,
          x, // Coordenada absoluta X
          y, // Coordenada absoluta Y
          relativeX, // Coordenada relativa ao elemento X
          relativeY, // Coordenada relativa ao elemento Y
          pageX: event.pageX,
          pageY: event.pageY,
          button: event.button, // 0 = esquerdo, 1 = meio, 2 = direito
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }
      );
    };

    // Usa capture phase para capturar todos os cliques
    document.addEventListener('click', handleClick, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [trackEventInternal, isAdmin]);

  // Auto-track de scroll
  useEffect(() => {
    if (isAdmin || isTrackingOptedOut()) return;

    const handleScroll = () => {
      const depth = getScrollDepth();
      
      // Track apenas quando atinge marcos (25%, 50%, 75%, 100%)
      if (
        depth >= 25 && scrollDepthRef.current < 25 ||
        depth >= 50 && scrollDepthRef.current < 50 ||
        depth >= 75 && scrollDepthRef.current < 75 ||
        depth >= 100 && scrollDepthRef.current < 100
      ) {
        scrollDepthRef.current = depth;
        trackEventInternal(EventType.SCROLL, undefined, {
          depth,
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [trackEventInternal, isAdmin]);

  // Track tempo na página ao sair
  useEffect(() => {
    if (isAdmin) return;
    
    const handleBeforeUnload = () => {
      if (timeOnPageStart) {
        const timeSpent = Math.floor((Date.now() - timeOnPageStart) / 1000);
        if (timeSpent > 0) {
          trackEventInternal(
            EventType.TIME_ON_PAGE,
            undefined,
            {
              seconds: timeSpent,
            }
          );
        }
        // Envia eventos pendentes antes de sair
        flush();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [trackEventInternal, flush, isAdmin]);

  /**
   * Track evento customizado
   */
  const trackEvent = useCallback((
    eventType: EventType,
    element?: string,
    metadata?: Record<string, any>
  ) => {
    trackEventInternal(eventType, element, metadata);
  }, [trackEventInternal]);

  /**
   * Track clique em elemento
   */
  const trackClick = useCallback((
    element: HTMLElement | EventTarget,
    metadata?: Record<string, any>
  ) => {
    const elementInfo = getElementInfo(element);
    trackEventInternal(
      EventType.CLICK,
      elementInfo.selector || undefined,
      {
        ...elementInfo,
        ...metadata,
      }
    );
  }, [trackEventInternal]);

  /**
   * Track visualização de página
   */
  const trackPageView = useCallback((
    page?: string,
    metadata?: Record<string, any>
  ) => {
    const pageMeta = getPageMetadata();
    trackEventInternal(
      EventType.PAGE_VIEW,
      undefined,
      {
        page: page || pageMeta.path,
        ...metadata,
      }
    );
  }, [trackEventInternal]);

  /**
   * Track scroll depth
   */
  const trackScroll = useCallback((depth?: number) => {
    const currentDepth = depth !== undefined ? depth : getScrollDepth();
    trackEventInternal(
      EventType.SCROLL,
      undefined,
      {
        depth: currentDepth,
      }
    );
  }, [trackEventInternal]);

  /**
   * Track tempo na página
   */
  const trackTimeOnPage = useCallback((seconds: number) => {
    trackEventInternal(
      EventType.TIME_ON_PAGE,
      undefined,
      {
        seconds,
      }
    );
  }, [trackEventInternal]);

  return {
    trackEvent,
    trackClick,
    trackPageView,
    trackScroll,
    trackTimeOnPage,
    flush,
  };
}

