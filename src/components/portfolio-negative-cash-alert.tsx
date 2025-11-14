'use client';

import { useState, cache } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Info
} from 'lucide-react';

interface PortfolioNegativeCashAlertProps {
  portfolioId: string;
  cashBalance: number;
  onFixed: () => void;
}

export function PortfolioNegativeCashAlert({
  portfolioId,
  cashBalance,
  onFixed
}: PortfolioNegativeCashAlertProps) {
  const { toast } = useToast();
  const [fixing, setFixing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcBalances, setRecalcBalances] = useState(false);

  // Only show alert for significantly negative cash (more than R$ 0.10)
  // Tiny negative balances (< R$ 0.10) are considered rounding errors
  // Positive balances are now auto-corrected by automatic recalculation
  if (cashBalance >= -0.10) return null;

  const amountNeeded = Math.abs(cashBalance);

  const handleAddCashCredit = async () => {
    try {
      setFixing(true);

      // Get the earliest transaction date to add credit before it
      const transactionsRes = await cache(async() => fetch(
        `/api/portfolio/${portfolioId}/transactions?limit=1&orderBy=date&order=asc`
      ))();
      
      let earliestDate = new Date();
      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        if (data.transactions?.length > 0) {
          earliestDate = new Date(data.transactions[0].date);
          // Subtract one day to be before the first transaction
          earliestDate.setDate(earliestDate.getDate() - 1);
        }
      }

      // Create CASH_CREDIT transaction
      const response = await cache(async() => fetch(
        `/api/portfolio/${portfolioId}/transactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: earliestDate.toISOString().split('T')[0],
            type: 'CASH_CREDIT',
            amount: amountNeeded,
            notes: 'Aporte retroativo para correção de saldo'
          })
        }
      ))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar aporte');
      }

      toast({
        title: 'Aporte adicionado!',
        description: `Crédito de R$ ${amountNeeded.toFixed(2)} registrado com sucesso. Recalculando saldos...`
      });

      // Recalculate all cash balances in chronological order
      const recalcResponse = await cache(async() => fetch(
        `/api/portfolio/${portfolioId}/recalculate-balances`,
        { method: 'POST' }
      ))();

      if (!recalcResponse.ok) {
        console.error('Erro ao recalcular saldos');
      }

      // Recalculate metrics
      await handleRecalculateMetrics();

      onFixed();
    } catch (error) {
      console.error('Erro ao adicionar aporte:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao adicionar aporte',
        variant: 'destructive'
      });
    } finally {
      setFixing(false);
    }
  };

  const handleRecalculateMetrics = async () => {
    try {
      setRecalculating(true);

      const response = await cache(async() => fetch(
        `/api/portfolio/${portfolioId}/metrics`,
        { method: 'POST' }
      ))();

      if (!response.ok) {
        throw new Error('Erro ao recalcular métricas');
      }

      toast({
        title: 'Métricas atualizadas',
        description: 'As métricas foram recalculadas com sucesso.'
      });
    } catch (error) {
      console.error('Erro ao recalcular métricas:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const handleRecalculateBalances = async () => {
    try {
      setRecalcBalances(true);

      // First recalculate balances
      const balancesResponse = await cache(async() => fetch(
        `/api/portfolio/${portfolioId}/recalculate-balances`,
        { method: 'POST' }
      ))();

      if (!balancesResponse.ok) {
        throw new Error('Erro ao recalcular saldos');
      }

      // Then recalculate metrics
      const metricsResponse = await fetch(
        `/api/portfolio/${portfolioId}/metrics`,
        { method: 'POST' }
      );

      if (!metricsResponse.ok) {
        throw new Error('Erro ao recalcular métricas');
      }

      toast({
        title: 'Saldos corrigidos!',
        description: 'Os saldos de caixa foram recalculados em ordem cronológica.'
      });

      onFixed();
    } catch (error) {
      console.error('Erro ao recalcular saldos:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao recalcular saldos',
        variant: 'destructive'
      });
    } finally {
      setRecalcBalances(false);
    }
  };

  return (
    <Card className="border-2 border-destructive bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Saldo de Caixa Negativo Detectado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-destructive/10 p-4 rounded-lg">
            <p className="font-semibold text-base mb-2">
              Saldo atual: <span className="text-destructive">R$ {cashBalance.toFixed(2)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Foram registradas compras sem aportes de caixa correspondentes.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-2">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Como corrigir:
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Opção 1: Adicionar Aporte</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                      <li>Clique em &ldquo;Adicionar Aporte de R$ {amountNeeded.toFixed(2)}&rdquo;</li>
                      <li>Será registrado antes da primeira transação</li>
                      <li>Os saldos e métricas serão recalculados automaticamente</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Opção 2: Corrigir Saldos</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                      <li>Se você já adicionou um aporte manualmente</li>
                      <li>Clique em &ldquo;Corrigir Saldos das Transações&rdquo;</li>
                      <li>Recalculará todos os saldos em ordem cronológica</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleAddCashCredit}
              disabled={fixing || recalculating || recalcBalances}
              className="bg-green-600 hover:bg-green-700"
            >
              {fixing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Aporte de R$ {amountNeeded.toFixed(2)}
                </>
              )}
            </Button>

            <Button
              onClick={handleRecalculateBalances}
              disabled={fixing || recalculating || recalcBalances}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {recalcBalances ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Corrigir Saldos das Transações
                </>
              )}
            </Button>

            <Button
              onClick={handleRecalculateMetrics}
              disabled={fixing || recalculating || recalcBalances}
              variant="outline"
            >
              {recalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recalculando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recalcular Métricas
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> Para transações futuras, sempre registre o aporte (Crédito de Caixa) 
            antes de fazer compras de ativos. Isso mantém o controle correto do fluxo de caixa.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

