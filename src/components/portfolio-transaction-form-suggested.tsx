'use client';

import { useState, useEffect } from 'react';
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

/**
 * Component that wraps PortfolioTransactionForm with pre-filled data from a suggestion
 * Note: This is a wrapper that will need to be enhanced to actually pre-fill the form
 * For now, it shows the form and the user can manually enter the suggested values
 */
export function PortfolioTransactionFormSuggested({
  portfolioId,
  suggestion,
  open,
  onOpenChange,
  onSuccess,
}: PortfolioTransactionFormSuggestedProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {suggestion.type === 'BUY_REBALANCE' || suggestion.type === 'BUY'
              ? 'Confirmar Compra Sugerida'
              : suggestion.type === 'SELL_REBALANCE'
              ? 'Confirmar Venda Sugerida'
              : suggestion.type === 'MONTHLY_CONTRIBUTION' || suggestion.type === 'CASH_CREDIT'
              ? 'Confirmar Aporte Sugerido'
              : 'Confirmar Transação Sugerida'}
          </DialogTitle>
          <DialogDescription>
            {suggestion.reason && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">Motivo da sugestão:</p>
                <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
              </div>
            )}
            <p className="mt-2">
              Revise os valores abaixo e confirme a transação. Você pode editar qualquer campo antes de confirmar.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <PortfolioTransactionForm
            portfolioId={portfolioId}
            initialData={{
              type: suggestion.type === 'BUY_REBALANCE' ? 'BUY' : 
                    suggestion.type === 'SELL_REBALANCE' ? 'SELL_WITHDRAWAL' :
                    suggestion.type === 'MONTHLY_CONTRIBUTION' ? 'CASH_CREDIT' :
                    suggestion.type,
              date: new Date(suggestion.date).toISOString().split('T')[0],
              ticker: suggestion.ticker || '',
              amount: suggestion.amount.toString(),
              price: suggestion.price?.toString() || '',
              quantity: suggestion.quantity?.toString() || '',
              notes: suggestion.notes || suggestion.reason || '',
            }}
            onSuccess={() => {
              onOpenChange(false);
              if (onSuccess) {
                onSuccess();
              }
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

