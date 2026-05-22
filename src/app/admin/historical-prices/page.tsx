/**
 * Admin Panel: Recriar Preços Históricos
 * Permite recriar preços históricos de uma empresa desde 2010 usando Yahoo Finance
 */

'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Database, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RecreateResponse {
  success: boolean;
  message: string;
  details?: {
    ticker: string;
    companyName: string;
    recordsProcessed: number;
    recordsDeduplicated: number;
    recordsSaved: number;
    firstDate: string | null;
    lastDate: string | null;
    period: {
      start: string;
      end: string;
    };
  };
  error?: string;
}

interface RecreateAllResponse {
  success: boolean;
  message: string;
  results?: {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
    details: Array<{
      ticker: string;
      status: 'success' | 'failed' | 'skipped';
      message: string;
      recordsProcessed?: number;
      recordsDeduplicated?: number;
      recordsSaved?: number;
    }>;
  };
  error?: string;
}

async function recreateAllEtfHistoricalPrices(): Promise<RecreateAllResponse> {
  const response = await fetch('/api/admin/historical-prices/etf-recreate-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao recriar preços históricos dos ETFs');
  }

  return response.json();
}

async function recreateHistoricalPrices(ticker: string): Promise<RecreateResponse> {
  const response = await fetch(`/api/admin/historical-prices/${encodeURIComponent(ticker)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao recriar preços históricos');
  }

  return response.json();
}

async function recreateAllHistoricalPrices(): Promise<RecreateAllResponse> {
  const response = await fetch('/api/admin/historical-prices/recreate-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao recriar preços históricos de todas as empresas');
  }

  return response.json();
}

export default function AdminHistoricalPricesPage() {
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState<RecreateResponse | null>(null);
  const [allResult, setAllResult] = useState<RecreateAllResponse | null>(null);
  const [etfAllResult, setEtfAllResult] = useState<RecreateAllResponse | null>(null);

  const recreateMutation = useMutation({
    mutationFn: recreateHistoricalPrices,
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'Erro ao recriar preços históricos');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
      setResult({
        success: false,
        message: '',
        error: error.message
      });
    }
  });

  const recreateAllMutation = useMutation({
    mutationFn: recreateAllHistoricalPrices,
    onSuccess: (data) => {
      setAllResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'Erro ao recriar preços históricos');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
      setAllResult({
        success: false,
        message: '',
        error: error.message
      });
    }
  });

  const recreateAllEtfMutation = useMutation({
    mutationFn: recreateAllEtfHistoricalPrices,
    onSuccess: (data) => {
      setEtfAllResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'Erro ao recriar preços históricos dos ETFs');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
      setEtfAllResult({
        success: false,
        message: '',
        error: error.message
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) {
      toast.error('Digite um ticker válido');
      return;
    }

    setResult(null);
    setAllResult(null);
    await recreateMutation.mutateAsync(ticker.toUpperCase().trim());
  };

  const handleRecreateAll = async () => {
    if (!confirm('Tem certeza que deseja recriar preços históricos de TODAS as empresas? Isso pode levar vários minutos.')) {
      return;
    }

    setResult(null);
    setAllResult(null);
    await recreateAllMutation.mutateAsync();
  };

  const handleRecreateAllEtfs = async () => {
    if (!confirm('Tem certeza que deseja recriar preços históricos de TODOS os ETFs? Isso pode levar alguns minutos.')) {
      return;
    }

    setResult(null);
    setEtfAllResult(null);
    await recreateAllEtfMutation.mutateAsync();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold">Recriar Preços Históricos</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Recria todos os preços históricos de uma empresa desde 2000 usando Yahoo Finance como fonte primária
          </p>
        </div>

        {/* Botão Recriar Todas */}
        <Card className="mb-6 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Recriar Todas as Empresas
            </CardTitle>
            <CardDescription>
              Processa todas as empresas do banco de dados de uma vez
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRecreateAll}
              disabled={recreateAllMutation.isPending || recreateMutation.isPending}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {recreateAllMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando todas as empresas...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Recriar Preços Históricos de Todas as Empresas
                </>
              )}
            </Button>
            {recreateAllMutation.isPending && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                ⏳ Isso pode levar vários minutos. Por favor, aguarde...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Botão ETFs */}
        <Card className="mb-6 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Carregar Histórico de Todos os ETFs
            </CardTitle>
            <CardDescription>
              Carrega preços históricos desde 2000 para todos os ETFs cadastrados. Após a primeira carga, o CRON diário atualiza apenas os preços novos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRecreateAllEtfs}
              disabled={recreateAllEtfMutation.isPending || recreateMutation.isPending || recreateAllMutation.isPending}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {recreateAllEtfMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Carregando histórico dos ETFs...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Carregar Histórico de Todos os ETFs (desde 2000)
                </>
              )}
            </Button>
            {recreateAllEtfMutation.isPending && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                ⏳ Buscando dados do Yahoo Finance para todos os ETFs. Aguarde...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Formulário */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recriar Preços Históricos</CardTitle>
            <CardDescription>
              Digite o ticker de qualquer ativo (ação, ETF, FII) para recriar todos os preços históricos desde 2000
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="ticker">Ticker do Ativo *</Label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="Ex: PETR4, BOVA11, IVVB11, HGLG11"
                  disabled={recreateMutation.isPending}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  O ticker será convertido para maiúsculas automaticamente
                </p>
              </div>

              <Button
                type="submit"
                disabled={recreateMutation.isPending || recreateAllMutation.isPending || !ticker.trim()}
                className="w-full"
              >
                {recreateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recriar Preços Históricos
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultado */}
        {result && (
          <Card className={result.success ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <CardTitle className="text-green-600 dark:text-green-400">
                      Sucesso
                    </CardTitle>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <CardTitle className="text-red-600 dark:text-red-400">
                      Erro
                    </CardTitle>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {result.success && result.details ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {result.message}
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Ticker</p>
                      <p className="text-lg font-semibold font-mono">{result.details.ticker}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Empresa</p>
                      <p className="text-lg font-semibold">{result.details.companyName}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Registros Recebidos</p>
                      <p className="text-lg font-semibold">{result.details.recordsProcessed.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Após Processamento</p>
                      <p className="text-lg font-semibold">{result.details.recordsDeduplicated?.toLocaleString('pt-BR') || result.details.recordsProcessed.toLocaleString('pt-BR')}</p>
                      {result.details.recordsDeduplicated && result.details.recordsProcessed > result.details.recordsDeduplicated && (
                        <p className="text-xs text-gray-500 mt-1">
                          (mantém fechamento de meses fechados + todos do mês atual)
                        </p>
                      )}
                    </div>
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Registros Salvos</p>
                      <p className="text-lg font-semibold">{result.details.recordsSaved.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Primeira Data</p>
                      <p className="text-lg font-semibold">
                        {result.details.firstDate 
                          ? new Date(result.details.firstDate).toLocaleDateString('pt-BR')
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Última Data</p>
                      <p className="text-lg font-semibold">
                        {result.details.lastDate 
                          ? new Date(result.details.lastDate).toLocaleDateString('pt-BR')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-sm font-semibold mb-2">Período Processado</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      De <strong>{new Date(result.details.period.start).toLocaleDateString('pt-BR')}</strong> até{' '}
                      <strong>{new Date(result.details.period.end).toLocaleDateString('pt-BR')}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {result.error || 'Erro ao recriar preços históricos'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resultado - Recriar Todas */}
        {allResult && (
          <Card className={allResult.success ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {allResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <CardTitle className="text-green-600 dark:text-green-400">
                      Processamento Concluído
                    </CardTitle>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <CardTitle className="text-red-600 dark:text-red-400">
                      Erro
                    </CardTitle>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {allResult.success && allResult.results ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {allResult.message}
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                      <p className="text-lg font-semibold">{allResult.results.total.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Sucesso</p>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {allResult.results.success.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Falhas</p>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                        {allResult.results.failed.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Ignoradas</p>
                      <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                        {allResult.results.skipped.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* Lista de detalhes (limitada a 50 primeiras) */}
                  {allResult.results.details.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold mb-2">
                        Detalhes ({Math.min(allResult.results.details.length, 50)} de {allResult.results.details.length}):
                      </p>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                            <tr>
                              <th className="text-left p-2">Ticker</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Mensagem</th>
                              <th className="text-right p-2">Registros</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allResult.results.details.slice(0, 50).map((detail, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2 font-mono font-semibold">{detail.ticker}</td>
                                <td className="p-2">
                                  {detail.status === 'success' && (
                                    <span className="text-green-600 dark:text-green-400">✓ Sucesso</span>
                                  )}
                                  {detail.status === 'failed' && (
                                    <span className="text-red-600 dark:text-red-400">✗ Falha</span>
                                  )}
                                  {detail.status === 'skipped' && (
                                    <span className="text-yellow-600 dark:text-yellow-400">⊘ Ignorado</span>
                                  )}
                                </td>
                                <td className="p-2 text-xs text-gray-600 dark:text-gray-400">
                                  {detail.message}
                                </td>
                                <td className="p-2 text-right">
                                  {detail.recordsSaved ? detail.recordsSaved.toLocaleString('pt-BR') : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {allResult.results.details.length > 50 && (
                          <p className="text-xs text-gray-500 p-2 text-center">
                            Mostrando apenas os primeiros 50 resultados de {allResult.results.details.length} total
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {allResult.error || 'Erro ao recriar preços históricos'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resultado - ETF Recriar Todas */}
        {etfAllResult && (
          <Card className={`mb-6 ${etfAllResult.success ? 'border-teal-200 dark:border-teal-800' : 'border-red-200 dark:border-red-800'}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {etfAllResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    <CardTitle className="text-teal-600 dark:text-teal-400">ETFs — Processamento Concluído</CardTitle>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <CardTitle className="text-red-600 dark:text-red-400">Erro</CardTitle>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {etfAllResult.success && etfAllResult.results ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{etfAllResult.message}</AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                      <p className="text-lg font-semibold">{etfAllResult.results.total.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-teal-50 dark:bg-teal-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Sucesso</p>
                      <p className="text-lg font-semibold text-teal-600 dark:text-teal-400">{etfAllResult.results.success.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Falhas</p>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">{etfAllResult.results.failed.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Ignoradas</p>
                      <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{etfAllResult.results.skipped.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  {etfAllResult.results.details.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold mb-2">
                        Detalhes ({etfAllResult.results.details.length} ETFs):
                      </p>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                            <tr>
                              <th className="text-left p-2">Ticker</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Mensagem</th>
                              <th className="text-right p-2">Registros</th>
                            </tr>
                          </thead>
                          <tbody>
                            {etfAllResult.results.details.map((detail, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2 font-mono font-semibold">{detail.ticker}</td>
                                <td className="p-2">
                                  {detail.status === 'success' && <span className="text-teal-600 dark:text-teal-400">✓ Sucesso</span>}
                                  {detail.status === 'failed' && <span className="text-red-600 dark:text-red-400">✗ Falha</span>}
                                  {detail.status === 'skipped' && <span className="text-yellow-600 dark:text-yellow-400">⊘ Ignorado</span>}
                                </td>
                                <td className="p-2 text-xs text-gray-600 dark:text-gray-400">{detail.message}</td>
                                <td className="p-2 text-right">{detail.recordsSaved ? detail.recordsSaved.toLocaleString('pt-BR') : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{etfAllResult.error || 'Erro ao carregar histórico dos ETFs'}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Informações */}
        <Card className="mt-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-base">ℹ️ Informações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              • Os preços históricos serão buscados do <strong>Yahoo Finance</strong> desde 2000 até hoje
            </p>
            <p>
              • Os dados existentes serão <strong>removidos</strong> e substituídos pelos novos dados do Yahoo Finance
            </p>
            <p>
              • O intervalo usado é <strong>mensal (1mo)</strong> para otimizar o armazenamento
            </p>
            <p>
              • A empresa deve existir no banco de dados antes de recriar os preços históricos
            </p>
            <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="font-semibold mb-2">📅 Estratégia de armazenamento:</p>
              <div className="space-y-2 text-sm mt-3">
                <div className="p-2 bg-white dark:bg-gray-800 rounded">
                  <p className="font-semibold mb-2">Meses Fechados:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Mantém apenas o <strong>último registro</strong> de cada mês fechado</li>
                    <li>Representa o <strong>fechamento mensal</strong> (último dia útil do mês)</li>
                    <li>Exemplo: Para novembro/2025, mantém apenas <strong>2025-12-01</strong> (fechamento de novembro)</li>
                  </ul>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                  <p className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Mês Atual (em aberto):</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-green-700 dark:text-green-300">
                    <li>Mantém <strong>TODOS os registros diários</strong> do mês atual</li>
                    <li>Permite atualizações frequentes durante o mês</li>
                    <li>Exemplo: Dezembro/2025 terá <strong>2025-12-01, 2025-12-02, 2025-12-03...</strong> (todos os dias)</li>
                  </ul>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded">
                  <p className="font-semibold text-purple-800 dark:text-purple-200 mb-1">📊 Fontes de Dados:</p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    • <strong>Dados mensais:</strong> Yahoo Finance desde 2000 até hoje<br />
                    • <strong>Dados diários:</strong> Yahoo Finance apenas do mês atual<br />
                    • Ambos são combinados e processados automaticamente
                  </p>
                </div>
              </div>
            </div>
            <p className="text-yellow-700 dark:text-yellow-300 font-semibold mt-2">
              ⚠️ Esta operação pode levar alguns minutos dependendo da quantidade de dados disponíveis
            </p>
            <div className="mt-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
              <p className="font-semibold text-teal-800 dark:text-teal-200 mb-1">🤖 CRON automático para ETFs:</p>
              <p className="text-xs text-teal-700 dark:text-teal-300">
                Roda diariamente às 08:30 — após a primeira carga manual, atualiza apenas os preços novos de forma incremental. ETFs sem histórico recebem carga automática dos últimos 20 anos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

