/**
 * Dashboard de Índices IPJ
 * Lista todos os índices disponíveis
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndexCard } from '@/components/indices/index-card';
import { IndexDisclaimer } from '@/components/indices/index-disclaimer';
import { TrendingUp, Loader2 } from 'lucide-react';

interface IndexData {
  id: string;
  ticker: string;
  name: string;
  description: string;
  color: string;
  currentPoints: number;
  accumulatedReturn: number;
  currentYield: number | null;
  assetCount: number;
  lastUpdate: string | null;
}

async function fetchIndices(): Promise<IndexData[]> {
  const response = await fetch('/api/indices');
  if (!response.ok) {
    throw new Error('Erro ao buscar índices');
  }
  const data = await response.json();
  return data.indices || [];
}

export default function IndicesPage() {
  const { data: indices, isLoading, error } = useQuery<IndexData[]>({
    queryKey: ['indices'],
    queryFn: fetchIndices,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000 // 5 minutos
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400">
              Erro ao carregar índices. Tente novamente mais tarde.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold">Índices Preço Justo</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Carteiras teóricas automatizadas baseadas em algoritmos quantitativos
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-6">
          <IndexDisclaimer />
        </div>

        {/* Lista de Índices */}
        {indices && indices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {indices.map((index) => (
              <IndexCard
                key={index.id}
                ticker={index.ticker}
                name={index.name}
                color={index.color}
                currentPoints={index.currentPoints}
                accumulatedReturn={index.accumulatedReturn}
                currentYield={index.currentYield}
                assetCount={index.assetCount}
                sparklineData={[]} // Será preenchido quando tivermos histórico
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                Nenhum índice disponível no momento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

