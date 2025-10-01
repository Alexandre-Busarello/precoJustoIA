'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Loader2, Circle } from 'lucide-react';

interface BacktestProgressIndicatorProps {
  isRunning: boolean;
}

export function BacktestProgressIndicator({ isRunning }: BacktestProgressIndicatorProps) {
  if (!isRunning) return null;

  const steps = [
    { label: 'Validando configuração', duration: 500 },
    { label: 'Buscando dados históricos', duration: 1000 },
    { label: 'Calculando aportes mensais', duration: 1500 },
    { label: 'Processando rebalanceamentos', duration: 2000 },
    { label: 'Calculando dividendos', duration: 2500 },
    { label: 'Gerando métricas de risco', duration: 3000 },
    { label: 'Preparando gráficos', duration: 3500 }
  ];

  return (
    <Card className="border-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 shadow-xl">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Executando Simulação...
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Isso pode levar alguns segundos
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div 
                key={step.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 transition-all duration-300"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  opacity: 0.5 + (index * 0.05),
                  animation: 'fadeIn 0.5s forwards'
                }}
              >
                <div className="flex-shrink-0">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
              Estamos processando seus dados históricos e simulando aportes mensais com rebalanceamento automático
            </p>
          </div>
        </div>
      </CardContent>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </Card>
  );
}

