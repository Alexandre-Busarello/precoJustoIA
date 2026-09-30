'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatBRL, formatDate, formatNumber } from '@/lib/format';
import { portfolioCache } from '@/lib/portfolio-cache';
import { invalidateDashboardPortfoliosCache } from '@/components/dashboard-portfolios';


interface Transaction {
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  date: string;
  notes?: string;
}

interface TransactionAIResult {
  transactions: Transaction[];
  errors: string[];
  warnings: string[];
}

interface PortfolioTransactionAIProps {
  portfolioId: string;
  onTransactionsGenerated: (transactions: Transaction[]) => void;
  disabled?: boolean;
  currentCashBalance?: number;
}

export function PortfolioTransactionAI({ 
  portfolioId, 
  onTransactionsGenerated, 
  disabled,
  currentCashBalance = 0
}: PortfolioTransactionAIProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TransactionAIResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const exampleInputs = [
    'Compra de 100 PETR4 a R$ 32,50 cada',
    'Aporte de R$ 5.000 hoje',
    'Venda de 50 VALE3 por R$ 65,00 cada',
    'Dividendo de ITUB4: R$ 0,25 por ação (tenho 200 ações)',
  ];

  // Mutation for generating transactions with AI
  const generateTransactionsMutation = useMutation({
    mutationFn: async ({ inputText, cashBalance }: { inputText: string; cashBalance: number }) => {
      const response = await fetch('/api/portfolio/transaction-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolioId,
          input: inputText.trim(),
          currentCashBalance: cashBalance
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar transações');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setShowResults(true);

      if (data.transactions.length === 0 && data.errors.length > 0) {
        toast({
          title: 'Não foi possível processar',
          description: 'Verifique os erros abaixo e tente novamente',
          variant: 'destructive'
        });
      } else if (data.transactions.length > 0) {
        toast({
          title: 'Transações identificadas',
          description: `${data.transactions.length} transação(ões) identificada(s)`,
        });
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao processar transações:', error);
      toast({
        title: 'Erro no processamento',
        description: error.message || 'Erro ao processar com IA',
        variant: 'destructive'
      });
    }
  });

  const handleGenerate = () => {
    if (!input.trim()) {
      toast({
        title: 'Entrada vazia',
        description: 'Digite as transações que deseja cadastrar',
        variant: 'destructive'
      });
      return;
    }

    setResult(null);
    setShowResults(false);
    generateTransactionsMutation.mutate({ inputText: input, cashBalance: currentCashBalance });
  };

  // Mutation for applying generated transactions
  const applyTransactionsMutation = useMutation({
    mutationFn: async (transactions: Transaction[]) => {
      const response = await fetch('/api/portfolio/apply-ai-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolioId,
          transactions
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aplicar transações');
      }

      return data;
    },
    onSuccess: (data) => {
      // Sucesso - invalidar cache para atualizar interface
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      invalidateDashboardPortfoliosCache();
      
      // Dispatch events for auto-refresh in suggestions page
      window.dispatchEvent(
        new CustomEvent('portfolio-transaction-updated', {
          detail: { portfolioId, action: 'transaction' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('transaction-cash-flow-changed', {
          detail: {
            transactionType: 'MIXED',
            portfolioId: portfolioId,
            action: 'created',
          },
        })
      );
      
      if (result) {
        onTransactionsGenerated(result.transactions);
      }
      setShowResults(false);
      setInput('');
      setResult(null);
      
      toast({
        title: 'Transações salvas',
        description: data.message || `${data.createdTransactions} transação(ões) criada(s) com sucesso`,
      });

      // Mostrar erros se houver
      if (data.errors && data.errors.length > 0) {
        setTimeout(() => {
          toast({
            title: 'Problemas encontrados',
            description: data.errors[0] || 'Erro ao processar transações',
            variant: 'destructive'
          });
        }, 1000);
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao aplicar transações:', error);
      
      let errorMessage = error.message || 'Erro desconhecido';
      
      // Traduzir erros técnicos para linguagem amigável
      if (errorMessage.includes('INSUFFICIENT_CASH')) {
        errorMessage = 'Saldo insuficiente em caixa para realizar a compra. Faça um aporte primeiro ou use a funcionalidade de aporte automático.';
      }
      
      toast({
        title: 'Erro ao aplicar transações',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  const handleApplyTransactions = () => {
    if (!result?.transactions) return;
    applyTransactionsMutation.mutate(result.transactions);
  };

  // Combined loading state from both mutations
  const loading = generateTransactionsMutation.isPending || applyTransactionsMutation.isPending;

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'Compra';
      case 'SELL_WITHDRAWAL':
        return 'Venda';
      case 'CASH_CREDIT':
        return 'Aporte';
      case 'CASH_DEBIT':
        return 'Saque';
      case 'DIVIDEND':
        return 'Dividendo';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cole o extrato da B3 ou descreva as operações em texto livre. A IA identifica as transações e você revisa
        antes de salvar.
      </p>

      <div className="space-y-2">
        <Label htmlFor="transaction-ai-input">Transações</Label>
        <Textarea
          id="transaction-ai-input"
          placeholder={
            'Ex.: Compra de 100 PETR4 a R$ 32,50 cada\nAporte de R$ 5.000 hoje\nDividendo de ITUB4: R$ 0,25 por ação (tenho 200 ações)\n\nEm compras, informe a quantidade e o preço por ação.'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || loading}
          className="min-h-[140px] resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Saldo atual em caixa: <span className="tabular-nums">{formatBRL(currentCashBalance)}</span>
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Exemplos</p>
        <div className="flex flex-wrap gap-2">
          {exampleInputs.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left text-xs md:min-h-8"
              onClick={() => setInput(example)}
              disabled={disabled || loading}
            >
              {example}
            </Button>
          ))}
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={disabled || generateTransactionsMutation.isPending || !input.trim()}
        className="w-full sm:w-auto"
      >
        {generateTransactionsMutation.isPending ? (
          <>
            <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
            Processando transações
          </>
        ) : (
          'Identificar transações'
        )}
      </Button>

      {showResults && result && (
        <div className="space-y-4 border-t border-border pt-4">
          {result.errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-negative">
                <AlertCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Não foi possível interpretar
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                {result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-warning">
                <AlertCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Avisos
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {result.transactions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Transações identificadas ({result.transactions.length})
              </h4>

              <ul className="divide-y divide-border rounded-lg border border-border">
                {result.transactions.map((transaction, index) => (
                  <li key={index} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral">{getTransactionLabel(transaction.type)}</Badge>
                        {transaction.ticker && (
                          <span className="text-sm font-medium text-foreground">{transaction.ticker}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {transaction.quantity ? `${formatNumber(transaction.quantity)} ações · ` : ''}
                        {transaction.price ? `${formatBRL(transaction.price)} cada · ` : ''}
                        Total {formatBRL(transaction.amount)}
                      </p>
                      {transaction.notes && (
                        <p className="mt-1 text-xs text-muted-foreground break-words">{transaction.notes}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(`${transaction.date}T12:00:00`)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setShowResults(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleApplyTransactions} disabled={applyTransactionsMutation.isPending}>
                  {applyTransactionsMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                      Salvando
                    </>
                  ) : (
                    `Salvar ${result.transactions.length} ${result.transactions.length === 1 ? 'transação' : 'transações'}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {disabled && (
        <p className="text-sm text-muted-foreground">
          O preenchimento por texto está disponível no Premium. Você pode registrar pelo formulário.
        </p>
      )}
    </div>
  );
}
