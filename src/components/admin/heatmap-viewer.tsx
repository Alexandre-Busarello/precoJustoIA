/**
 * Componente para visualização de mapa de calor
 * Mostra onde os usuários clicam mais em cada página
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MousePointer2,
  Search,
  RefreshCw,
} from 'lucide-react';
import { UserEmailFilter } from './user-email-filter';

interface HeatmapData {
  page: string;
  totalClicks: number;
  topElements: Array<{
    element: string; // Label visível ou seletor
    selector: string; // Seletor CSS original
    visibleLabel?: string; // Label visível na tela
    count: number;
  }>;
  coordinateData: Array<{
    x: number;
    y: number;
    count: number;
    element: string;
    visibleLabel?: string;
  }>;
  period: {
    start: string;
    end: string;
  };
}

export function HeatmapViewer() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState('');
  const [currentPage, setCurrentPage] = useState('');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  const fetchHeatmap = async (page?: string) => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const url = `/api/admin/analytics/heatmap?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${page ? `&page=${encodeURIComponent(page)}` : ''}${filterUserId ? `&userId=${filterUserId}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Erro ao buscar dados de heatmap');
      }

      const heatmapData = await response.json();
      setData(heatmapData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap(currentPage || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserId]);

  const handleSearch = () => {
    if (pageFilter.trim()) {
      fetchHeatmap(pageFilter.trim());
      setCurrentPage(pageFilter.trim());
    } else {
      fetchHeatmap();
      setCurrentPage('');
    }
  };

  const handleUserFilterChange = (userId: string | null) => {
    setFilterUserId(userId);
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => fetchHeatmap(currentPage)}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Agrupar coordenadas por intensidade para visualização
  const maxCount = Math.max(...data.coordinateData.map(d => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MousePointer2 className="w-5 h-5" />
          Mapa de Calor de Cliques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtro por Usuário */}
        <UserEmailFilter onUserChange={handleUserFilterChange} />
        
        {/* Filtro por Página */}
        <div className="flex gap-2">
          <Input
            placeholder="Filtrar por página (ex: /acao/PETR4)"
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4 mr-2" />
            Buscar Página
          </Button>
        </div>
        
        <div className="space-y-6">
          {/* Informações gerais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Página</p>
              <p className="text-lg font-semibold font-mono">
                {data.page === 'all' ? 'Todas as páginas' : data.page}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total de Cliques</p>
              <p className="text-lg font-semibold">{data.totalClicks.toLocaleString()}</p>
            </div>
          </div>

          {/* Top elementos clicados */}
          <div>
            <h4 className="font-semibold mb-4">Elementos Mais Clicados</h4>
            <div className="space-y-2">
              {data.topElements.slice(0, 20).map((item, index) => {
                const percentage = (item.count / data.totalClicks) * 100;
                const displayLabel = item.visibleLabel || item.element;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted"
                  >
                    <Badge variant="outline">{index + 1}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" title={displayLabel}>
                        {displayLabel}
                      </p>
                      {item.visibleLabel && item.selector !== item.visibleLabel && (
                        <p className="font-mono text-xs text-muted-foreground truncate" title={item.selector}>
                          {item.selector}
                        </p>
                      )}
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge>{item.count.toLocaleString()}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visualização de coordenadas (simplificada) */}
          {data.coordinateData.length > 0 && (
            <div>
              <h4 className="font-semibold mb-4">Distribuição de Cliques por Posição</h4>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-4">
                  {data.coordinateData.length} pontos de clique registrados
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {data.coordinateData.slice(0, 20).map((point, index) => {
                    const intensity = (point.count / maxCount) * 100;
                    const displayLabel = point.visibleLabel || point.element;
                    return (
                      <div
                        key={index}
                        className="p-2 rounded border text-center"
                        style={{
                          backgroundColor: `rgba(59, 130, 246, ${intensity / 100})`,
                        }}
                        title={`${displayLabel} - (${point.x}, ${point.y})`}
                      >
                        <p className="text-xs font-semibold truncate" title={displayLabel}>
                          {displayLabel}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          ({point.x}, {point.y})
                        </p>
                        <Badge variant="secondary" className="mt-1">
                          {point.count}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {data.coordinateData.length > 20 && (
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Mostrando 20 de {data.coordinateData.length} pontos
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

