/**
 * Timeline de Rebalanceamento
 * Mostra histórico de mudanças na composição do índice
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import Link from 'next/link';

interface RebalanceLog {
  id: string;
  date: string;
  action: 'ENTRY' | 'EXIT' | 'REBALANCE';
  ticker: string;
  reason: string;
}

interface IndexRebalanceTimelineProps {
  logs: RebalanceLog[];
}

export function IndexRebalanceTimeline({ logs }: IndexRebalanceTimelineProps) {
  const { isPremium } = usePremiumStatus();
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  
  // Configuração de paginação
  const ITEMS_PER_PAGE = 10; // Desktop: 10 itens por página
  const ITEMS_PER_PAGE_MOBILE = 5; // Mobile: 5 itens por página
  
  // Detectar tamanho da tela
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Verificar no mount
    checkMobile();
    
    // Adicionar listener para resize
    window.addEventListener('resize', checkMobile);
    
    // Limpar listener ao desmontar
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);
  
  // Resetar para página 1 quando mudar de mobile para desktop ou vice-versa
  useEffect(() => {
    setCurrentPage(1);
  }, [isMobile]);
  
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ENTRY':
        return <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'EXIT':
        return <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'REBALANCE':
        return <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      ENTRY: 'default',
      EXIT: 'destructive',
      REBALANCE: 'secondary'
    };

    const labels: Record<string, string> = {
      ENTRY: 'Entrada',
      EXIT: 'Saída',
      REBALANCE: 'Rebalanceamento'
    };

    return (
      <Badge variant={variants[action] || 'default'}>
        {labels[action] || action}
      </Badge>
    );
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Mudanças</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
            Nenhuma mudança registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Mostrar apenas 3 logs para usuários Free, resto com blur
  // Para usuários Premium, usar paginação
  const visibleLogs = isPremium ? paginatedLogs : logs.slice(0, 3);
  const blurredLogs = isPremium ? [] : logs.slice(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Histórico de Mudanças</span>
          {!isPremium && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleLogs.map((log, index) => {
            // Criar data localmente para evitar problemas de timezone
            // Se log.date é "YYYY-MM-DD", criar Date usando valores locais
            const dateStr = log.date;
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            // Último item visível só não mostra linha se não houver logs com blur
            const isLast = index === visibleLogs.length - 1 && blurredLogs.length === 0;

            return (
              <div key={log.id} className="relative flex gap-4">
                {/* Linha vertical */}
                {!isLast && (
                  <div className="absolute left-[10px] top-[32px] bottom-[-16px] w-0.5 bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Ícone */}
                <div className="flex-shrink-0 z-10">
                  {getActionIcon(log.action)}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{log.ticker}</span>
                      {getActionBadge(log.action)}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {format(date, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {log.reason}
                  </p>
                </div>
              </div>
            );
          })}
          
          {/* Logs com blur para usuários Free */}
          {blurredLogs.map((log, index) => {
            // Último item com blur não mostra linha vertical
            const isLast = index === blurredLogs.length - 1;

            return (
              <div 
                key={`blurred-${log.id}`} 
                className="relative flex gap-4"
                style={{ filter: 'blur(4px)', pointerEvents: 'none' }}
              >
                {/* Linha vertical */}
                {!isLast && (
                  <div className="absolute left-[10px] top-[32px] bottom-[-16px] w-0.5 bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Ícone */}
                <div className="flex-shrink-0 z-10">
                  <div className="w-5 h-5 bg-gray-300 rounded-full" />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-300 h-5 w-16 rounded" />
                      <div className="bg-gray-300 h-5 w-20 rounded" />
                    </div>
                    <div className="bg-gray-300 h-4 w-24 rounded" />
                  </div>
                  <div className="bg-gray-300 h-4 w-full rounded mt-1" />
                </div>
              </div>
            );
          })}
        </div>

        {!isPremium && blurredLogs.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Desbloqueie o Histórico Completo</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Veja todas as {logs.length} mudanças na composição do índice, incluindo entradas, saídas e rebalanceamentos.
                </p>
                <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                  <Link href="/checkout">
                    Fazer Upgrade para Premium
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Paginação para usuários Premium */}
        {isPremium && logs.length > itemsPerPage && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} - {Math.min(endIndex, logs.length)} de {logs.length} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1 sm:mr-0" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              
              {/* Números de página - mostrar apenas em desktop */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Mostrar primeira página, última página, página atual e páginas adjacentes
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="h-9 w-9 p-0"
                      >
                        {page}
                      </Button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={page} className="px-2 text-muted-foreground">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
              
              {/* Indicador de página atual em mobile */}
              <div className="sm:hidden text-sm text-muted-foreground px-2">
                {currentPage} / {totalPages}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-3"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4 ml-1 sm:ml-0" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

