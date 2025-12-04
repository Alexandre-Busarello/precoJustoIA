/**
 * Componente de Rentabilidade em Tempo Real do Índice
 * Mostra variação do dia antes do fechamento oficial
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    async function fetchRealTimeReturn() {
      try {
        setLoading(true);
        const response = await fetch(`/api/indices/${ticker}/realtime-return`);
        
        if (!response.ok) {
          throw new Error('Erro ao buscar rentabilidade em tempo real');
        }

        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar rentabilidade em tempo real:', err);
        setError('Não foi possível calcular a rentabilidade em tempo real');
      } finally {
        setLoading(false);
      }
    }

    fetchRealTimeReturn();

    // Atualizar a cada 30 segundos durante o pregão
    const interval = setInterval(fetchRealTimeReturn, 30000);
    return () => clearInterval(interval);
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

  const lastUpdateDate = new Date(data.lastOfficialDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastUpdateDateOnly = new Date(lastUpdateDate);
  lastUpdateDateOnly.setHours(0, 0, 0, 0);
  const isToday = lastUpdateDateOnly.getTime() === today.getTime();

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
                  {isToday
                    ? 'será atualizada oficialmente após o fechamento do mercado'
                    : `último fechamento oficial de ${lastUpdateDate.toLocaleDateString('pt-BR')}`}
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

