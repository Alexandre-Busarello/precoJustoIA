'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface BacktestProgressIndicatorProps {
  isRunning: boolean;
}

// Mensagens informativas que rotacionam enquanto a simulação roda.
// Não representam o progresso real do backend, apenas dão contexto
// sobre o tipo de processamento em andamento.
const MESSAGES = [
  'Validando configuração',
  'Buscando dados históricos',
  'Calculando aportes mensais',
  'Processando rebalanceamentos',
  'Calculando dividendos',
  'Gerando métricas de risco',
  'Preparando gráficos',
];

const ROTATION_INTERVAL_MS = 800;

export function BacktestProgressIndicator({ isRunning }: BacktestProgressIndicatorProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <Card className="bg-card border shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-4 text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground">
              Executando simulação...
            </h3>
            <p className="text-sm text-muted-foreground">
              Isso pode levar alguns segundos
            </p>
          </div>

          {/* Mensagem informativa rotativa - não é uma barra de progresso real */}
          <p className="text-xs text-muted-foreground">
            {MESSAGES[messageIndex]}...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
