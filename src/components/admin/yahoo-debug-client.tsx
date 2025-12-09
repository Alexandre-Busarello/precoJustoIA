'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';

interface DebugResult {
  success: boolean;
  method: string;
  symbol?: string;
  endpoint?: string;
  duration: string;
  data?: any;
  error?: any;
  timestamp: string;
}

export function YahooDebugClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [method, setMethod] = useState<'library'>('library');
  const [symbol, setSymbol] = useState('PETR4.SA');
  const [endpoint, setEndpoint] = useState<'quote' | 'quoteSummary' | 'chart'>('quote');
  const [modules, setModules] = useState('price');
  const [interval, setInterval] = useState('1d');

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const body: any = {
        method,
        symbol,
        endpoint,
      };
      
      if (endpoint === 'quoteSummary') {
        body.modules = modules.split(',').map((m: string) => m.trim());
      } else if (endpoint === 'chart') {
        body.period1 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        body.period2 = new Date().toISOString();
        body.interval = interval;
      }

      const response = await fetch('/api/admin/yahoo-debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        method,
        error: {
          message: error.message || String(error),
        },
        duration: '0ms',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Teste</CardTitle>
          <CardDescription>
            Escolha o método e configure os parâmetros para testar requisições ao Yahoo Finance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Método</Label>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Biblioteca yahoo-finance2</strong> - Requisições diretas foram removidas para evitar erros 429.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Symbol (Ticker)</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="PETR4.SA"
            />
            <p className="text-sm text-gray-500">
              Use formato Yahoo Finance (ex: PETR4.SA, ^BVSP, AAPL)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Endpoint</Label>
            <Select
              value={endpoint}
              onValueChange={(value: 'quote' | 'quoteSummary' | 'chart') => setEndpoint(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote (Cotação)</SelectItem>
                <SelectItem value="quoteSummary">Quote Summary (Dados Detalhados)</SelectItem>
                <SelectItem value="chart">Chart (Dados Históricos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {endpoint === 'quoteSummary' && (
            <div className="space-y-2">
              <Label>Módulos (separados por vírgula)</Label>
              <Input
                value={modules}
                onChange={(e) => setModules(e.target.value)}
                placeholder="price,summaryDetail,financialData"
              />
              <p className="text-sm text-gray-500">
                Módulos disponíveis: price, summaryDetail, assetProfile, financialData, defaultKeyStatistics, etc.
              </p>
            </div>
          )}

          {endpoint === 'chart' && (
            <div className="space-y-2">
              <Label>Intervalo</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 minuto</SelectItem>
                  <SelectItem value="5m">5 minutos</SelectItem>
                  <SelectItem value="15m">15 minutos</SelectItem>
                  <SelectItem value="1d">1 dia</SelectItem>
                  <SelectItem value="1wk">1 semana</SelectItem>
                  <SelectItem value="1mo">1 mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleTest} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              'Executar Teste'
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resultado</CardTitle>
                <CardDescription>
                  {result.timestamp && new Date(result.timestamp).toLocaleString('pt-BR')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Sucesso
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Erro
                  </Badge>
                )}
                <Badge variant="outline">{result.duration}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="response" className="w-full">
              <TabsList>
                <TabsTrigger value="response">Resposta</TabsTrigger>
                <TabsTrigger value="raw">JSON Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="response" className="space-y-4">
                {result.success ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Método:</Label>
                      <p className="text-sm">{result.method}</p>
                    </div>
                    {result.symbol && (
                      <div>
                        <Label className="text-sm font-semibold">Symbol:</Label>
                        <p className="text-sm">{result.symbol}</p>
                      </div>
                    )}
                    {result.endpoint && (
                      <div>
                        <Label className="text-sm font-semibold">Endpoint:</Label>
                        <p className="text-sm">{result.endpoint}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-semibold">Dados:</Label>
                      <pre className="mt-2 p-4 bg-gray-50 rounded-md overflow-auto max-h-96 text-xs">
                        {formatJson(result.data)}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => copyToClipboard(formatJson(result.data))}
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        Copiar JSON
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-red-600">Erro:</Label>
                      <pre className="mt-2 p-4 bg-red-50 rounded-md overflow-auto max-h-96 text-xs">
                        {formatJson(result.error)}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => copyToClipboard(formatJson(result.error))}
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        Copiar Erro
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="raw">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold">JSON Completo:</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(formatJson(result))}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="p-4 bg-gray-50 rounded-md overflow-auto max-h-96 text-xs">
                    {formatJson(result)}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Exemplos Rápidos</CardTitle>
          <CardDescription>Clique para preencher automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setMethod('library');
                setSymbol('PETR4.SA');
                setEndpoint('quote');
              }}
            >
              Quote PETR4
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMethod('library');
                setSymbol('^BVSP');
                setEndpoint('quote');
              }}
            >
              Quote IBOVESPA
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMethod('library');
                setSymbol('PETR4.SA');
                setEndpoint('quoteSummary');
                setModules('price,summaryDetail');
              }}
            >
              QuoteSummary PETR4
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMethod('library');
                setSymbol('PETR4.SA');
                setEndpoint('chart');
                setInterval('1d');
              }}
            >
              Chart PETR4 (30 dias)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

