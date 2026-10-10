'use client';

import { PortfolioTransactionForm } from '@/components/portfolio-transaction-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SuggestedTransaction {
  date: string;
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  notes?: string;
  reason?: string;
}

interface PortfolioTransactionFormSuggestedProps {
  portfolioId: string;
  suggestion: SuggestedTransaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function dialogTitle(type: string): string {
  if (type === 'BUY_REBALANCE' || type === 'BUY') return 'Registrar compra da sugestão';
  if (type === 'SELL_REBALANCE') return 'Registrar venda da sugestão';
  if (type === 'MONTHLY_CONTRIBUTION' || type === 'CASH_CREDIT') return 'Registrar aporte sugerido';
  if (type === 'DIVIDEND') return 'Registrar dividendo';
  return 'Registrar transação sugerida';
}

function formType(type: string): string {
  if (type === 'BUY_REBALANCE') return 'BUY';
  if (type === 'SELL_REBALANCE') return 'SELL_WITHDRAWAL';
  if (type === 'MONTHLY_CONTRIBUTION') return 'CASH_CREDIT';
  return type;
}

/** Formulário de transação já preenchido com os valores de uma sugestão (editáveis antes de salvar). */
export function PortfolioTransactionFormSuggested({
  portfolioId,
  suggestion,
  open,
  onOpenChange,
  onSuccess,
}: PortfolioTransactionFormSuggestedProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{dialogTitle(suggestion.type)}</DialogTitle>
          <DialogDescription>
            Revise os valores e registre a transação. Todos os campos podem ser editados.
          </DialogDescription>
        </DialogHeader>
        {suggestion.reason && (
          <div className="rounded-md border border-border bg-surface p-3 text-sm">
            <p className="font-medium text-foreground">Por quê</p>
            <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
              {suggestion.reason.split(' · ').map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-1">
          <PortfolioTransactionForm
            portfolioId={portfolioId}
            initialData={{
              type: formType(suggestion.type),
              date: new Date(suggestion.date).toISOString().split('T')[0],
              ticker: suggestion.ticker || '',
              amount: suggestion.amount.toString(),
              price: suggestion.price?.toString() || '',
              quantity: suggestion.quantity?.toString() || '',
              notes: suggestion.notes || suggestion.reason || '',
            }}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
