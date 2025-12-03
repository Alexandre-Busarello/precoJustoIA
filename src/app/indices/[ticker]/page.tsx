/**
 * Página de Detalhes do Índice
 * Exibe performance, gráfico comparativo, composição e timeline
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IndexPerformanceHeader } from '@/components/indices/index-performance-header';
import { IndexComparisonChart } from '@/components/indices/index-comparison-chart';
import { IndexCompositionTable } from '@/components/indices/index-composition-table';
import { IndexRebalanceTimeline } from '@/components/indices/index-rebalance-timeline';
import { IndexDisclaimer } from '@/components/indices/index-disclaimer';
import { IndexAssetPerformance } from '@/components/indices/index-asset-performance';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownRenderer } from '@/components/markdown-renderer';

interface IndexDetail {
  id: string;
  ticker: string;
  name: string;
  description: string;
  color: string;
  methodology: string;
  currentPoints: number;
  accumulatedReturn: number;
  currentYield: number | null;
  dailyChange: number | null;
  lastUpdate: string | null;
  totalDividendsReceived: number;
  composition: Array<{
    ticker: string;
    name: string;
    logoUrl: string | null;
    sector: string | null;
    targetWeight: number;
    entryPrice: number;
    entryDate: string;
    currentPrice: number;
    entryReturn: number;
    dividendYield: number | null;
  }>;
}

interface IndexHistory {
  date: string;
  points: number;
  dailyChange: number;
  currentYield: number | null;
  dividendsReceived: number | null;
  dividendsByTicker: Record<string, number> | null;
}

interface RebalanceLog {
  id: string;
  date: string;
  action: 'ENTRY' | 'EXIT' | 'REBALANCE';
  ticker: string;
  reason: string;
}

async function fetchIndexDetail(ticker: string): Promise<IndexDetail> {
  const response = await fetch(`/api/indices/${ticker}`);
  if (!response.ok) {
    throw new Error('Erro ao buscar índice');
  }
  const data = await response.json();
  return data.index;
}

async function fetchIndexHistory(ticker: string): Promise<IndexHistory[]> {
  const response = await fetch(`/api/indices/${ticker}/history`);
  if (!response.ok) {
    throw new Error('Erro ao buscar histórico');
  }
  const data = await response.json();
  return data.history || [];
}

async function fetchRebalanceLog(ticker: string): Promise<RebalanceLog[]> {
  const response = await fetch(`/api/indices/${ticker}/rebalance-log?limit=50`);
  if (!response.ok) {
    throw new Error('Erro ao buscar log de rebalanceamento');
  }
  const data = await response.json();
  return data.logs || [];
}

async function fetchBenchmarks(startDate: string, endDate: string) {
  const response = await fetch(`/api/benchmarks?startDate=${startDate}&endDate=${endDate}`);
  if (!response.ok) {
    return { ibov: [], cdi: [] };
  }
  const data = await response.json();
  return { ibov: data.ibov || [], cdi: data.cdi || [] };
}

export default function IndexDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = (params.ticker as string)?.toUpperCase();

  const { data: index, isLoading: indexLoading } = useQuery<IndexDetail>({
    queryKey: ['index-detail', ticker],
    queryFn: () => fetchIndexDetail(ticker),
    enabled: !!ticker
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<IndexHistory[]>({
    queryKey: ['index-history', ticker],
    queryFn: () => fetchIndexHistory(ticker),
    enabled: !!ticker
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<RebalanceLog[]>({
    queryKey: ['index-rebalance-log', ticker],
    queryFn: () => fetchRebalanceLog(ticker),
    enabled: !!ticker
  });

  // Buscar benchmarks se tivermos histórico
  const startDate = history.length > 0 ? history[0].date : new Date().toISOString().split('T')[0];
  const endDate = history.length > 0 
    ? history[history.length - 1].date 
    : new Date().toISOString().split('T')[0];

  const { data: benchmarks = { ibov: [], cdi: [] } } = useQuery({
    queryKey: ['benchmarks', startDate, endDate],
    queryFn: () => fetchBenchmarks(startDate, endDate),
    enabled: history.length > 0
  });

  if (indexLoading || historyLoading || logsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!index) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400 text-center">
              Índice não encontrado.
            </p>
            <Button 
              onClick={() => router.push('/indices')}
              className="mt-4 w-full"
            >
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80 overflow-x-hidden">
      <div className="container mx-auto px-4 py-8 max-w-7xl w-full">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/indices')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{index.name}</h1>
                <Badge 
                  variant="outline"
                  style={{ borderColor: index.color, color: index.color }}
                >
                  {index.ticker}
                </Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {index.description}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mb-6">
          <IndexDisclaimer />
        </div>

        {/* Performance Header */}
        <div className="mb-6">
          <IndexPerformanceHeader
            currentPoints={index.currentPoints}
            accumulatedReturn={index.accumulatedReturn}
            currentYield={index.currentYield}
            totalDividendsReceived={index.totalDividendsReceived}
            color={index.color}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="performance" className="space-y-6">
          {/* Mobile: Scroll horizontal apenas nas tabs | Desktop: Normal */}
          <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:overflow-visible md:mx-0 md:px-0">
            <TabsList className="inline-flex md:inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-max min-w-full md:min-w-0">
              <TabsTrigger value="performance" className="whitespace-nowrap flex-shrink-0">Performance</TabsTrigger>
              <TabsTrigger value="composition" className="whitespace-nowrap flex-shrink-0">Composição</TabsTrigger>
              <TabsTrigger value="asset-performance" className="whitespace-nowrap flex-shrink-0">
                <span className="hidden sm:inline">Performance Individual</span>
                <span className="sm:hidden">Individual</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="whitespace-nowrap flex-shrink-0">Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="performance" className="space-y-6">
            {/* Gráfico Comparativo */}
            <IndexComparisonChart
              indexHistory={history.map(h => ({ 
                date: h.date, 
                points: h.points,
                dividendsReceived: h.dividendsReceived,
                dividendsByTicker: h.dividendsByTicker
              }))}
              ibovData={benchmarks.ibov}
              cdiData={benchmarks.cdi}
              indexColor={index.color}
            />

            {/* Metodologia */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Metodologia</h3>
                <MarkdownRenderer content={index.methodology} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="composition">
            <IndexCompositionTable composition={index.composition} />
          </TabsContent>

          <TabsContent value="asset-performance">
            <IndexAssetPerformance ticker={index.ticker} />
          </TabsContent>

          <TabsContent value="history">
            <IndexRebalanceTimeline logs={logs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

