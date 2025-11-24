'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronUp, Upload, FileText, Bot } from 'lucide-react';
import { PortfolioTransactionAI } from '@/components/portfolio-transaction-ai';
import { PortfolioTransactionForm } from '@/components/portfolio-transaction-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PortfolioSmartInputProps {
  portfolioId: string;
  currentCashBalance?: number;
  onTransactionsApplied?: () => void;
  defaultCollapsed?: boolean; // Control initial collapsed state
}

export function PortfolioSmartInput({
  portfolioId,
  currentCashBalance = 0,
  onTransactionsApplied,
  defaultCollapsed = false, // Default to open (expanded)
}: PortfolioSmartInputProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showManualForm, setShowManualForm] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader 
        className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Atualizar Custódia / Importar Transações
          </CardTitle>
          <div className="flex-shrink-0">
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">Texto Inteligente</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2" disabled>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload PDF</span>
                <span className="sm:hidden">PDF</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <PortfolioTransactionAI
                portfolioId={portfolioId}
                currentCashBalance={currentCashBalance}
                onTransactionsGenerated={(transactions) => {
                  if (onTransactionsApplied) {
                    onTransactionsApplied();
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="pdf" className="mt-4">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-semibold mb-2">Upload de Nota de Corretagem</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Esta funcionalidade estará disponível em breve
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Por enquanto, use a aba "Texto Inteligente" para cadastrar suas transações
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Prefere cadastrar manualmente? Use o formulário abaixo.
                </p>
                <Button
                  onClick={() => setShowManualForm(true)}
                  className="w-full"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Abrir Formulário Manual
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}

      {/* Manual Form Dialog */}
      <Dialog open={showManualForm} onOpenChange={setShowManualForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Registrar Transação Manual</DialogTitle>
            <DialogDescription>
              Adicione uma transação manualmente à sua carteira
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <PortfolioTransactionForm
              portfolioId={portfolioId}
              onSuccess={() => {
                setShowManualForm(false);
                if (onTransactionsApplied) {
                  onTransactionsApplied();
                }
              }}
              onCancel={() => setShowManualForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

