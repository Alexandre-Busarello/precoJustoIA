/**
 * Componente para análise de jornada do usuário
 * Mostra fluxos de navegação e caminhos mais comuns
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Route,
  ArrowRight,
  LogIn,
  LogOut,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { UserEmailFilter } from './user-email-filter';

interface JourneyData {
  totalSessions: number;
  topPaths: Array<{ path: string; count: number }>;
  topTransitions: Array<{ transition: string; count: number }>;
  topEntryPages: Array<{ page: string; count: number }>;
  topExitPages: Array<{ page: string; count: number }>;
  avgPageDurations: Record<string, number>;
  period: {
    start: string;
    end: string;
  };
}

export function JourneyAnalyzer() {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  const fetchJourney = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const url = `/api/admin/analytics/journey?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${filterUserId ? `&userId=${filterUserId}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Erro ao buscar dados de jornada');
      }

      const journeyData = await response.json();
      setData(journeyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserId]);

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
            <button onClick={fetchJourney} className="text-primary">Tentar novamente</button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="w-5 h-5" />
          Análise de Jornada do Usuário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtro por Usuário */}
        <UserEmailFilter onUserChange={handleUserFilterChange} />
        
        <Tabs defaultValue="paths" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="paths">Caminhos</TabsTrigger>
            <TabsTrigger value="transitions">Transições</TabsTrigger>
            <TabsTrigger value="entry">Entrada</TabsTrigger>
            <TabsTrigger value="exit">Saída</TabsTrigger>
          </TabsList>

          <TabsContent value="paths" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Caminhos mais comuns ({data.totalSessions.toLocaleString()} sessões analisadas)
              </p>
              {data.topPaths.slice(0, 15).map((path, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="text-sm font-mono truncate">{path.path}</span>
                  </div>
                  <Badge>{path.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transitions" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Transições mais frequentes entre páginas
              </p>
              {data.topTransitions.slice(0, 20).map((transition, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="text-sm truncate">{transition.transition}</span>
                  </div>
                  <Badge>{transition.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="entry" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Páginas de entrada mais comuns
              </p>
              {data.topEntryPages.map((page, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-mono text-sm">{page.page}</span>
                  </div>
                  <Badge>{page.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="exit" className="mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Páginas de saída mais comuns
              </p>
              {data.topExitPages.map((page, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-mono text-sm">{page.page}</span>
                  </div>
                  <Badge>{page.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Tempo médio por página */}
        {Object.keys(data.avgPageDurations).length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo Médio por Página
            </h4>
            <div className="space-y-2">
              {Object.entries(data.avgPageDurations)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([page, seconds]) => (
                  <div
                    key={page}
                    className="flex items-center justify-between p-2 rounded"
                  >
                    <span className="font-mono text-sm">{page}</span>
                    <Badge variant="outline">
                      {Math.floor(seconds / 60)}m {seconds % 60}s
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

