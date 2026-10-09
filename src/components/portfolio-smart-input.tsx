'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PortfolioTransactionAI } from '@/components/portfolio-transaction-ai';
import { PortfolioTransactionForm } from '@/components/portfolio-transaction-form';

interface PortfolioSmartInputProps {
  portfolioId: string;
  currentCashBalance?: number;
  onTransactionsApplied?: () => void;
  /** Começa recolhido (visão geral) ou aberto (transações). */
  defaultCollapsed?: boolean;
}

/** Bloco "Registrar transações": texto livre interpretado por IA ou formulário manual. */
export function PortfolioSmartInput({
  portfolioId,
  currentCashBalance = 0,
  onTransactionsApplied,
  defaultCollapsed = false,
}: PortfolioSmartInputProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activeTab, setActiveTab] = useState('ai');
  const [formKey, setFormKey] = useState(0);
  const contentId = useId();

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        data-ben-fab-avoid
        onClick={() => setIsCollapsed((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none sm:px-5"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Registrar transações</span>
          <span className="block text-xs text-muted-foreground">
            Cole o extrato da B3 ou preencha o formulário
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !isCollapsed && 'rotate-180')}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {!isCollapsed && (
        <div id={contentId} className="border-t border-border px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="underline">
              <TabsTrigger value="ai">Colar texto</TabsTrigger>
              <TabsTrigger value="manual">Formulário</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <PortfolioTransactionAI
                portfolioId={portfolioId}
                currentCashBalance={currentCashBalance}
                onTransactionsGenerated={() => onTransactionsApplied?.()}
              />
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <PortfolioTransactionForm
                key={formKey}
                portfolioId={portfolioId}
                onSuccess={() => {
                  // Recria o formulário limpo para a próxima transação.
                  setFormKey((value) => value + 1);
                  onTransactionsApplied?.();
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </section>
  );
}
