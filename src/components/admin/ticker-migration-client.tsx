/**
 * Componente cliente para Migração de Tickers
 * Permite buscar mudanças via IA, revisar sugestões e aprovar migrações
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  ArrowRight,
} from 'lucide-react';

interface Suggestion {
  oldTicker: string;
  newTicker: string;
  reason: string;
  confidence: 'High' | 'Medium' | 'Low';
}

interface Migration {
  oldTicker: string;
  newTicker: string;
  oldCompanyName: string;
  newCompanyName: string;
  migratedAt: Date;
}

interface MigrationResult {
  success: boolean;
  oldTicker: string;
  newTicker: string;
  oldCompanyId: number;
  newCompanyId: number;
  stats: {
    balanceSheets: number;
    incomeStatements: number;
    cashflowStatements: number;
    dividendHistory: number;
    financialData: number;
    keyStatistics: number;
    dailyQuotes: number;
    historicalPrices: number;
    valueAddedStatements: number;
    quarterlyFinancials: number;
    priceOscillations: number;
    totalRecords: number;
  };
  message: string;
}

export function TickerMigrationClient() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [migrating, setMigrating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carregar histórico de migrações
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/admin/ticker-migration/history');
      if (response.ok) {
        const data = await response.json();
        setMigrations(data.migrations || []);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    setError(null);
    setSuccess(null);
    setSuggestions([]);

    try {
      const response = await fetch('/api/admin/ticker-migration/detect', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao detectar mudanças');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      if (data.suggestions?.length === 0) {
        setSuccess('Nenhuma mudança de ticker detectada nos últimos 12 meses.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setDetecting(false);
    }
  };

  const handleMigrate = async (suggestion: Suggestion) => {
    if (
      !confirm(
        `Tem certeza que deseja migrar o histórico de ${suggestion.oldTicker} para ${suggestion.newTicker}?\n\nEsta ação é irreversível e moverá todos os dados históricos financeiros.`
      )
    ) {
      return;
    }

    const migrationKey = `${suggestion.oldTicker}-${suggestion.newTicker}`;
    setMigrating(migrationKey);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/ticker-migration/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldTicker: suggestion.oldTicker,
          newTicker: suggestion.newTicker,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao executar migração');
      }

      const data = await response.json();
      const result: MigrationResult = data.result;

      // Remover sugestão da lista
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            !(
              s.oldTicker === suggestion.oldTicker &&
              s.newTicker === suggestion.newTicker
            )
        )
      );

      // Atualizar histórico
      await fetchHistory();

      setSuccess(
        `Migração concluída! ${result.stats.totalRecords} registros migrados de ${result.oldTicker} para ${result.newTicker}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setMigrating(null);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      High: { variant: 'default' as const, className: 'bg-green-500' },
      Medium: { variant: 'secondary' as const, className: 'bg-yellow-500' },
      Low: { variant: 'outline' as const, className: 'bg-gray-500' },
    };

    const config = variants[confidence as keyof typeof variants] || variants.Low;

    return (
      <Badge variant={config.variant} className={config.className}>
        {confidence}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <RefreshCw className="w-8 h-8 text-teal-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Migração de Tickers
          </h1>
        </div>
        <p className="text-lg text-gray-600">
          Unifique histórico financeiro quando empresas mudam código de
          negociação na B3
        </p>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Botão de Detecção */}
      <Card>
        <CardHeader>
          <CardTitle>Detectar Mudanças com IA</CardTitle>
          <CardDescription>
            Use Gemini AI para identificar empresas que mudaram seus códigos de
            negociação nos últimos 12 meses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDetect}
            disabled={detecting}
            className="w-full sm:w-auto"
          >
            {detecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Investigando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Investigar Mudanças (IA)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Tabela de Sugestões */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sugestões de Migração</CardTitle>
            <CardDescription>
              {suggestions.length} mudança(s) detectada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker Antigo</TableHead>
                    <TableHead>
                      <ArrowRight className="h-4 w-4 inline" />
                    </TableHead>
                    <TableHead>Ticker Novo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((suggestion, index) => {
                    const migrationKey = `${suggestion.oldTicker}-${suggestion.newTicker}`;
                    const isMigrating = migrating === migrationKey;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-mono font-semibold">
                          {suggestion.oldTicker}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {suggestion.newTicker}
                        </TableCell>
                        <TableCell>{suggestion.reason}</TableCell>
                        <TableCell>
                          {getConfidenceBadge(suggestion.confidence)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => handleMigrate(suggestion)}
                            disabled={isMigrating || !!migrating}
                            size="sm"
                            variant="default"
                          >
                            {isMigrating ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Migrando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Migrar Dados
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Migrações */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <CardTitle>Histórico de Migrações</CardTitle>
          </div>
          <CardDescription>
            {migrations.length} migração(ões) já realizada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {migrations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma migração realizada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker Antigo</TableHead>
                    <TableHead>
                      <ArrowRight className="h-4 w-4 inline" />
                    </TableHead>
                    <TableHead>Ticker Novo</TableHead>
                    <TableHead>Empresa Antiga</TableHead>
                    <TableHead>Empresa Nova</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migrations.map((migration, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono font-semibold">
                        {migration.oldTicker}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {migration.newTicker}
                      </TableCell>
                      <TableCell>{migration.oldCompanyName}</TableCell>
                      <TableCell>{migration.newCompanyName}</TableCell>
                      <TableCell>
                        {new Date(migration.migratedAt).toLocaleDateString(
                          'pt-BR'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}














