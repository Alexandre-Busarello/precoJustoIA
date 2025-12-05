/**
 * Badge de Retorno em Tempo Real
 * Busca e exibe o retorno em tempo real do índice em background
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Clock, TrendingUp, TrendingDown, Radio } from 'lucide-react';
import { fetchRealTimeReturnWithCache, getCachedRealTimeReturn } from '@/lib/index-realtime-cache';

interface RealTimeReturnData {
  dailyChange: number;
  realTimeReturn: number;
  isMarketOpen: boolean;
}

interface IndexRealTimeBadgeProps {
  ticker: string;
}

export function IndexRealTimeBadge({
  ticker,
}: IndexRealTimeBadgeProps) {
  const [realTimeData, setRealTimeData] = useState<RealTimeReturnData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasFetchedRef = useRef(false); // Evitar múltiplos fetches

  useEffect(() => {
    // Se já fez fetch, não fazer novamente
    if (hasFetchedRef.current) {
      return;
    }

    let mounted = true;

    async function fetchRealTimeReturn() {
      try {
        // Verificar cache primeiro (síncrono) antes de mostrar loading
        const cached = getCachedRealTimeReturn(ticker);
        if (cached) {
          hasFetchedRef.current = true; // Marcar como já processado
          if (mounted) {
            setRealTimeData({
              dailyChange: cached.dailyChange,
              realTimeReturn: cached.realTimeReturn,
              isMarketOpen: cached.isMarketOpen,
            });
            setIsLoading(false);
          }
          return;
        }
        
        // Se não há cache, marcar como processado e fazer request
        hasFetchedRef.current = true;
        setIsLoading(true);
        setError(false);
        
        // Usar função com cache automático
        const data = await fetchRealTimeReturnWithCache(ticker);
        
        if (mounted) {
          setRealTimeData({
            dailyChange: data.dailyChange,
            realTimeReturn: data.realTimeReturn,
            isMarketOpen: data.isMarketOpen,
          });
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`Erro ao buscar rentabilidade em tempo real para ${ticker}:`, err);
        if (mounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    }

    // Buscar apenas uma vez quando o componente montar
    fetchRealTimeReturn();

    return () => {
      mounted = false;
    };
  }, [ticker]);

  // Se ainda está carregando, mostrar badge de "Calculando"
  if (isLoading) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1 animate-pulse" />
              <span className="hidden sm:inline">Calculando...</span>
              <span className="sm:hidden">Calc...</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">
            <p>Calculando rentabilidade em tempo real antes do fechamento oficial</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Se houve erro, não mostrar nada (usar retorno oficial)
  if (error || !realTimeData) {
    return null;
  }

  // Se mercado está fechado, não mostrar badge de tempo real
  if (!realTimeData.isMarketOpen) {
    return null;
  }

  // Mostrar variação do dia em tempo real
  const isPositive = realTimeData.dailyChange >= 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
  const changeColor = isPositive
    ? 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
    : 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20';

  const tooltipText = `Variação em tempo real: ${isPositive ? '+' : ''}${realTimeData.dailyChange.toFixed(2)}% hoje. Dados calculados antes do fechamento oficial do mercado. A pontuação oficial será atualizada às 19h.`;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-xs ${changeColor} relative group flex items-center gap-1`}
          >
            {/* Indicador de tempo real - ícone de rádio pulsante */}
            <Radio className="h-2.5 w-2.5 text-blue-500 dark:text-blue-400 animate-pulse flex-shrink-0" />
            <ChangeIcon className="h-3 w-3 flex-shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">
              {isPositive ? '+' : ''}
              {realTimeData.dailyChange.toFixed(2)}% hoje
            </span>
            <span className="md:hidden whitespace-nowrap">
              {isPositive ? '+' : ''}
              {realTimeData.dailyChange.toFixed(2)}%
            </span>
            {/* Badge pequeno indicando "Tempo Real" - visível mas discreto */}
            <span className="hidden lg:inline text-[10px] opacity-70 ml-0.5 font-normal">
              • tempo real
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs p-2">
          <p className="font-semibold mb-1.5 flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-blue-500 animate-pulse" />
            Dados em Tempo Real
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {tooltipText}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

