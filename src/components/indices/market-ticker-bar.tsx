/**
 * Faixa de índices do mercado. Usada em /dashboard e /indices.
 * No desktop (≥ md) desliza devagar quando os índices não cabem, pausa com o mouse ou o foco e fica parada para quem
 * pede menos movimento no sistema. No mobile rola com o dedo.
 */

'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDeltaPct, formatNumber } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketIndex {
  name: string;
  ticker: string;
  value: number;
  change: number;
  changePercent: number;
  isCustom?: boolean; // Índice próprio do site
  color?: string;
  url?: string;
}

interface MarketTickerBarProps {
  className?: string;
}

const CACHE_KEY = 'market-indices-cache-v5';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora em milissegundos (quando mercado aberto)

interface CachedData {
  indices: MarketIndex[];
  timestamp: number;
  marketClosed?: boolean;
  hasClosingPrice?: boolean;
  dataTimestamp?: string; // Timestamp ISO da API quando os dados foram gerados
}

/**
 * Verifica se duas datas são do mesmo dia útil (horário de Brasília)
 * Retorna true se forem do mesmo dia útil, false caso contrário
 */
function isSameTradingDay(date1: Date | string, date2: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = date2;
  
  const parts1 = formatter.formatToParts(d1);
  const parts2 = formatter.formatToParts(d2);
  
  const year1 = parts1.find(p => p.type === 'year')?.value;
  const month1 = parts1.find(p => p.type === 'month')?.value;
  const day1 = parts1.find(p => p.type === 'day')?.value;
  
  const year2 = parts2.find(p => p.type === 'year')?.value;
  const month2 = parts2.find(p => p.type === 'month')?.value;
  const day2 = parts2.find(p => p.type === 'day')?.value;
  
  return year1 === year2 && month1 === month2 && day1 === day2;
}

/**
 * Verifica se o mercado B3 está fechado (horário de Brasília)
 */
function isBrazilMarketClosed(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  
  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
  };
  
  const dayOfWeek = dayMap[weekday] ?? 0;
  
  // Mercado B3: Segunda a Sexta, 10h às 18h (horário de Brasília)
  // Fechado: fim de semana OU antes das 10h OU após 18h
  return dayOfWeek < 1 || dayOfWeek > 5 || hour < 10 || hour >= 18;
}

function readCache(): CachedData | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedData) : null;
  } catch {
    return null;
  }
}

function writeCache(data: CachedData) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage indisponível: segue sem cache
  }
}

function clearCache() {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignorado
  }
}

/** Cache utilizável: tem timestamp da API, é do mesmo dia útil, tem menos de 24 h e ainda está dentro da validade. */
function usableCache(cached: CachedData | null, marketClosed: boolean): CachedData | null {
  if (!cached?.dataTimestamp) return null;
  const now = Date.now();
  if (now - cached.timestamp > 24 * 60 * 60 * 1000) return null;
  if (!isSameTradingDay(new Date(cached.dataTimestamp), new Date())) return null;
  if (marketClosed && cached.hasClosingPrice === false) return null;
  if (now - cached.timestamp >= CACHE_DURATION) return null;
  return cached;
}

function IndexItem({ index }: { index: MarketIndex }) {
  const delta = index.changePercent / 100;
  const content = (
    <>
      <span className="font-medium text-foreground">{index.name}</span>
      <span data-num className="tabular-nums text-muted-foreground">
        {formatNumber(index.value, { digits: 2 })}
      </span>
      <span
        data-num
        className={cn(
          'font-medium tabular-nums',
          delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-muted-foreground'
        )}
      >
        {formatDeltaPct(delta, { digits: 2 })}
      </span>
    </>
  );
  const itemClass = 'inline-flex min-h-10 items-center gap-2 whitespace-nowrap';

  if (index.url && index.isCustom) {
    return (
      <Link href={index.url} className={cn(itemClass, 'hover:underline underline-offset-4')}>
        {content}
      </Link>
    );
  }
  if (index.url) {
    return (
      <a href={index.url} target="_blank" rel="noopener noreferrer" className={cn(itemClass, 'hover:underline underline-offset-4')}>
        {content}
      </a>
    );
  }
  return <span className={itemClass}>{content}</span>;
}

export function MarketTickerBar({ className }: MarketTickerBarProps) {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  /** Largura de uma cópia da lista quando ela não cabe no contêiner (só então a faixa desliza). */
  const [overflowWidth, setOverflowWidth] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const copy = copyRef.current;
    if (!container || !copy || loading) return;
    const measure = () => {
      const width = copy.scrollWidth;
      setOverflowWidth(width > container.clientWidth ? width : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [loading, indices]);

  useEffect(() => {
    let cancelled = false;

    async function fetchIndices() {
      const marketClosed = isBrazilMarketClosed();
      const cached = readCache();
      const valid = usableCache(cached, marketClosed);
      if (valid) {
        setIndices(valid.indices);
        setLoading(false);
        return;
      }
      if (cached && !valid) clearCache();

      try {
        const response = await fetch('/api/market-indices', { cache: 'no-store' });
        if (!response.ok) throw new Error('Erro ao buscar índices');
        const data = await response.json();
        const fetched: MarketIndex[] = data.indices || [];
        writeCache({
          indices: fetched,
          timestamp: Date.now(),
          marketClosed,
          hasClosingPrice: data.hasClosingPrice !== false,
          dataTimestamp: data.timestamp || new Date().toISOString(),
        });
        if (!cancelled) setIndices(fetched);
      } catch (error) {
        console.error('Erro ao buscar índices do mercado:', error);
        // Em caso de erro, usa o último cache mesmo vencido
        if (!cancelled && cached) setIndices(cached.indices);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIndices();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && indices.length === 0) return null;

  const animate = !loading && overflowWidth !== null;

  return (
    <div
      ref={containerRef}
      className={cn('market-ticker no-scrollbar overflow-x-auto rounded-lg border border-border bg-card', className)}
      data-animate={animate ? '' : undefined}
      aria-label="Índices do mercado"
      role="region"
    >
      <div
        className="market-ticker__track flex w-max min-w-full text-sm"
        data-marquee
        // ~40 px por segundo, qualquer que seja a quantidade de índices
        style={animate ? ({ '--ticker-duration': `${Math.round(overflowWidth / 40)}s` } as CSSProperties) : undefined}
      >
        <div ref={copyRef} className="flex shrink-0 items-center gap-6 px-4">
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex min-h-10 items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))
            : indices.map((index) => <IndexItem key={index.ticker} index={index} />)}
        </div>
        {animate && (
          // Segunda cópia só para o laço contínuo da animação; leitores de tela e teclado ignoram.
          <div className="market-ticker__copy flex shrink-0 items-center gap-6 px-4" aria-hidden inert>
            {indices.map((index) => <IndexItem key={index.ticker} index={index} />)}
          </div>
        )}
      </div>
    </div>
  );
}
