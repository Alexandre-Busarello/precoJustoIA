/**
 * Componente cliente para Dashboard de Analytics
 * Busca e exibe métricas de uso
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Users, 
  Eye, 
  TrendingUp,
  Activity,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { FunnelViewer } from './funnel-viewer';
import { JourneyAnalyzer } from './journey-analyzer';
import { HeatmapViewer } from './heatmap-viewer';
import { UserEmailFilter } from './user-email-filter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AnalyticsData {
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalEvents: number;
    uniqueUsers: number;
    uniqueSessions: number;
    pageViews: number;
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
  };
  topPages: Array<{ page: string; count: number }>;
  topEvents: Array<{ eventType: string; count: number }>;
  topAssets: Array<{ ticker: string; count: number }>;
}

export function AnalyticsDashboardClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      const url = `/api/admin/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${filterUserId ? `&userId=${filterUserId}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Erro ao buscar analytics');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, filterUserId]);

  const handleUserFilterChange = (userId: string | null) => {
    setFilterUserId(userId);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchAnalytics}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Filtros de Data e Usuário */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="funnels">Funis</TabsTrigger>
          <TabsTrigger value="journey">Jornada</TabsTrigger>
          <TabsTrigger value="heatmap">Mapa de Calor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Filtro por Usuário */}
          <Card>
            <CardContent className="p-4">
              <UserEmailFilter onUserChange={handleUserFilterChange} />
            </CardContent>
          </Card>

          {/* Filtros de Data */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Período:</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={dateRange === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('7d')}
              >
                7 dias
              </Button>
              <Button
                variant={dateRange === '30d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('30d')}
              >
                30 dias
              </Button>
              <Button
                variant={dateRange === '90d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('90d')}
              >
                90 dias
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.uniqueUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {data.metrics.dailyActiveUsers} DAU • {data.metrics.monthlyActiveUsers} MAU
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Únicas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.uniqueSessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Sessões no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizações de Página</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.pageViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Page views totais
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Páginas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top 10 Páginas Mais Visitadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topPages.map((page, index) => (
              <div
                key={page.page}
                className="flex items-center justify-between p-2 rounded hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="font-mono text-sm">{page.page}</span>
                </div>
                <Badge>{page.count.toLocaleString()}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Eventos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Top 10 Tipos de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topEvents.map((event, index) => (
              <div
                key={event.eventType}
                className="flex items-center justify-between p-2 rounded hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="text-sm">{event.eventType}</span>
                </div>
                <Badge>{event.count.toLocaleString()}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Ativos */}
      {data.topAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top 10 Ativos Mais Visualizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topAssets.map((asset, index) => (
                <div
                  key={asset.ticker}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-mono text-sm font-semibold">{asset.ticker}</span>
                  </div>
                  <Badge>{asset.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}
        </TabsContent>

        <TabsContent value="funnels" className="mt-4">
          <FunnelViewer />
        </TabsContent>

        <TabsContent value="journey" className="mt-4">
          <JourneyAnalyzer />
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <HeatmapViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}

