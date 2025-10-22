'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  FileText
} from 'lucide-react';
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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransactionAIResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const exampleInputs = [
    'Compra de 100 PETR4 a R$ 32,50 cada',
    'Aporte de R$ 5.000 hoje',
    'Venda de 50 VALE3 por R$ 65,00 cada',
    'Dividendo de ITUB4: R$ 0,25 por ação (tenho 200 ações)',
    'Saque de R$ 2.000 para emergência',
    'Compra de 50 BOVA11 a R$ 120,00 cada',
  ];

  const handleGenerate = async () => {
    if (!input.trim()) {
      toast({
        title: 'Entrada vazia',
        description: 'Digite as transações que deseja cadastrar',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      setShowResults(false);

      const response = await fetch('/api/portfolio/transaction-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolioId,
          input: input.trim(),
          currentCashBalance
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar transações');
      }

      const data = await response.json();
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
          title: 'Transações processadas!',
          description: `${data.transactions.length} transação(ões) identificada(s)`,
        });
      }
    } catch (error) {
      console.error('Erro ao processar transações:', error);
      toast({
        title: 'Erro no processamento',
        description: error instanceof Error ? error.message : 'Erro ao processar com IA',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTransactions = async () => {
    if (!result?.transactions) return;

    try {
      setLoading(true);

      const response = await fetch('/api/portfolio/apply-ai-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolioId,
          transactions: result.transactions
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aplicar transações');
      }

      // Sucesso - invalidar cache para atualizar interface
      portfolioCache.invalidateAll(portfolioId);
      invalidateDashboardPortfoliosCache();
      
      onTransactionsGenerated(result.transactions);
      setShowResults(false);
      setInput('');
      setResult(null);
      
      toast({
        title: 'Transações aplicadas!',
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

    } catch (error) {
      console.error('Erro ao aplicar transações:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Traduzir erros técnicos para linguagem amigável
      if (errorMessage.includes('INSUFFICIENT_CASH')) {
        errorMessage = 'Saldo insuficiente em caixa para realizar a compra. Faça um aporte primeiro ou use a funcionalidade de aporte automático.';
      }
      
      toast({
        title: 'Erro ao aplicar transações',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'SELL_WITHDRAWAL':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'CASH_CREDIT':
        return <Plus className="h-4 w-4 text-blue-600" />;
      case 'CASH_DEBIT':
        return <Minus className="h-4 w-4 text-orange-600" />;
      case 'DIVIDEND':
        return <DollarSign className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-green-50/50 to-blue-50/50 dark:from-green-950/20 dark:to-blue-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Bot className="h-5 w-5" />
          Assistente IA para Transações
          <Sparkles className="h-4 w-4" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Digite ou cole suas transações em linguagem natural. A IA irá processar e extrair todas as informações necessárias.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            placeholder="Digite suas transações aqui...

Exemplos:
• Compra de 100 PETR4 a R$ 32,50 cada
• Aporte de R$ 5.000 hoje
• Venda de 50 VALE3 por R$ 65,00 cada
• Dividendo de ITUB4: R$ 0,25 por ação (tenho 200 ações)

IMPORTANTE: Para compras, sempre informe quantidade E preço por ação"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={disabled || loading}
            className="min-h-[120px] resize-none"
          />
          
          {currentCashBalance !== undefined && (
            <div className="text-xs text-muted-foreground">
              Saldo atual em caixa: {formatCurrency(currentCashBalance)}
            </div>
          )}
        </div>

        {/* Example Buttons */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Exemplos rápidos:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {exampleInputs.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2 px-3 text-left justify-start"
                onClick={() => setInput(example)}
                disabled={disabled || loading}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate}
          disabled={disabled || loading || !input.trim()}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando transações...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 mr-2" />
              Processar Transações
            </>
          )}
        </Button>

        {/* Results */}
        {showResults && result && (
          <div className="space-y-4 border-t pt-4">
            {/* Errors */}
            {result.errors.length > 0 && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-red-800 dark:text-red-200">Erros encontrados:</p>
                      <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300">
                        {result.errors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Avisos:</p>
                      <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                        {result.warnings.map((warning, index) => (
                          <li key={index} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transactions */}
            {result.transactions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Transações Identificadas ({result.transactions.length})
                  </h4>
                </div>

                <div className="space-y-2">
                  {result.transactions.map((transaction, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {getTransactionLabel(transaction.type)}
                            </Badge>
                            {transaction.ticker && (
                              <Badge variant="secondary">
                                {transaction.ticker}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {transaction.quantity && (
                              <span>{transaction.quantity} ações • </span>
                            )}
                            {transaction.price && (
                              <span>Preço: {formatCurrency(transaction.price)} • </span>
                            )}
                            <span>Total: {formatCurrency(transaction.amount)}</span>
                          </div>
                          {transaction.notes && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {transaction.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(transaction.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleApplyTransactions}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aplicar Transações
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowResults(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Premium Notice */}
        {disabled && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-amber-800 dark:text-amber-200">
                  O Assistente IA para Transações é um recurso exclusivo Premium. 
                  Faça upgrade para usar linguagem natural no cadastro de transações.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}