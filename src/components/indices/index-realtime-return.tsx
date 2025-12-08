/**
 * Componente de Rentabilidade em Tempo Real do Índice
 * Mostra variação do dia antes do fechamento oficial
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { fetchRealTimeReturnWithCache, getCachedRealTimeReturn } from '@/lib/index-realtime-cache';

interface RealTimeReturnData {
  realTimePoints: number;
  realTimeReturn: number;
  dailyChange: number;
  lastOfficialPoints: number;
  lastOfficialDate: string;
  isMarketOpen: boolean;
}

interface IndexRealTimeReturnProps {
  ticker: string;
  color: string;
}

export function IndexRealTimeReturn({
  ticker,
  color,
}: IndexRealTimeReturnProps) {
  const [data, setData] = useState<RealTimeReturnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false); // Evitar múltiplos fetches

  useEffect(() => {
    // Se já fez fetch, não fazer novamente
    if (hasFetchedRef.current) {
      return;
    }

    async function fetchRealTimeReturn() {
      try {
        // Verificar cache primeiro (síncrono) antes de mostrar loading
        const cached = getCachedRealTimeReturn(ticker);
        if (cached) {
          hasFetchedRef.current = true; // Marcar como já processado
          setData(cached);
          setError(null);
          setLoading(false);
          return;
        }
        
        // Se não há cache, marcar como processado e fazer request
        hasFetchedRef.current = true;
        setLoading(true);
        
        // Usar função com cache automático
        const result = await fetchRealTimeReturnWithCache(ticker);
        
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar rentabilidade em tempo real:', err);
        setError('Não foi possível calcular a rentabilidade em tempo real');
      } finally {
        setLoading(false);
      }
    }

    // Buscar apenas uma vez quando o componente montar
    fetchRealTimeReturn();
  }, [ticker]);

  if (loading) {
    return (
      <Card className="border-2 border-dashed" style={{ borderColor: color }}>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Clock className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculando rentabilidade em tempo real...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Não mostrar nada se houver erro ou sem dados
  }

  const isPositive = data.dailyChange >= 0;
  const ReturnIcon = isPositive ? TrendingUp : TrendingDown;
  const returnColor = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  // IMPORTANTE: data.lastOfficialDate vem como string ISO do servidor
  // Precisamos interpretá-la corretamente usando timezone de Brasília
  // A string ISO pode estar em UTC, então precisamos extrair apenas a parte da data
  // e criar uma data local usando timezone de Brasília
  
  // Extrair componentes da data ISO (assumindo formato YYYY-MM-DD ou ISO string)
  let lastUpdateDate: Date;
  if (data.lastOfficialDate.includes('T')) {
    // É uma ISO string completa - extrair apenas a parte da data
    const dateOnly = data.lastOfficialDate.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    // Criar data usando componentes locais (será interpretada no timezone do cliente)
    // Mas vamos formatar usando timezone de Brasília para garantir consistência
    lastUpdateDate = new Date(year, month - 1, day);
  } else {
    // Já é apenas a data (YYYY-MM-DD)
    const [year, month, day] = data.lastOfficialDate.split('-').map(Number);
    lastUpdateDate = new Date(year, month - 1, day);
  }
  
  // Verificar se o último fechamento é de hoje (horário de Brasília)
  // IMPORTANTE: Se não for de hoje, significa que estamos usando dados do dia anterior
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const now = new Date();
  const todayParts = formatter.formatToParts(now);
  const todayYear = parseInt(todayParts.find(p => p.type === 'year')?.value || '0', 10);
  const todayMonth = parseInt(todayParts.find(p => p.type === 'month')?.value || '0', 10) - 1;
  const todayDay = parseInt(todayParts.find(p => p.type === 'day')?.value || '0', 10);
  
  const lastParts = formatter.formatToParts(lastUpdateDate);
  const lastYear = parseInt(lastParts.find(p => p.type === 'year')?.value || '0', 10);
  const lastMonth = parseInt(lastParts.find(p => p.type === 'month')?.value || '0', 10) - 1;
  const lastDay = parseInt(lastParts.find(p => p.type === 'day')?.value || '0', 10);
  
  const isToday = todayYear === lastYear && todayMonth === lastMonth && todayDay === lastDay;
  
  // Verificar se já temos dados oficiais de hoje
  // Se o último fechamento é de hoje E o mercado está fechado, provavelmente já temos dados oficiais
  // Caso contrário, se é hoje mas mercado aberto, ainda não temos dados oficiais
  const hasOfficialDataToday = isToday && !data.isMarketOpen;
  
  // Formatar data usando timezone de Brasília para exibição
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const formattedDate = dateFormatter.format(lastUpdateDate);

  return (
    <Card className="border-2 border-dashed" style={{ borderColor: color }}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header com badge de tempo real */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-sm">Rentabilidade em Tempo Real</h3>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.isMarketOpen ? 'Mercado Aberto' : 'Mercado Fechado'}
            </Badge>
          </div>

          {/* Variação do dia */}
          <div className="text-center space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Variação do Dia
            </p>
            <div className={`flex items-center justify-center gap-2 ${returnColor}`}>
              <ReturnIcon className="h-6 w-6" />
              <span className="text-3xl font-bold">
                {isPositive ? '+' : ''}
                {data.dailyChange.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Pontos em tempo real */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Pontos em Tempo Real
              </p>
              <p className="text-xl font-semibold">
                {data.realTimePoints.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Último Fechamento
              </p>
              <p className="text-xl font-semibold text-gray-500 dark:text-gray-400">
                {data.lastOfficialPoints.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">⚠️ Dados Não Oficiais</p>
                <p>
                  Esta rentabilidade é calculada em tempo real usando preços
                  atuais dos ativos e{' '}
                  {hasOfficialDataToday
                    ? `último fechamento oficial de ${formattedDate}`
                    : isToday && data.isMarketOpen
                    ? 'será atualizada oficialmente após o fechamento do mercado'
                    : `último fechamento oficial de ${formattedDate}`}
                  . A pontuação oficial do índice é atualizada diariamente às
                  19h via processo automatizado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

