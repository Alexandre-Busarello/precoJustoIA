'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, ArrowRight } from 'lucide-react';

interface GenerateBacktestModalProps {
  portfolioId: string;
  portfolioName: string;
  onSuccess?: (backtestId: string) => void;
  onCancel?: () => void;
}

export function GenerateBacktestModal({
  portfolioId,
  portfolioName,
  onSuccess,
  onCancel
}: GenerateBacktestModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [submitting, setSubmitting] = useState(false);
  
  // Default to last 2 years
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  
  const [name, setName] = useState(`Backtest ${portfolioName}`);
  const [description, setDescription] = useState('');
  const [backtestStartDate, setBacktestStartDate] = useState(startDate.toISOString().split('T')[0]);
  const [backtestEndDate, setBacktestEndDate] = useState(endDate.toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      toast({
        title: 'Erro',
        description: 'Nome do backtest é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    // Validate dates
    const start = new Date(backtestStartDate);
    const end = new Date(backtestEndDate);
    
    if (start >= end) {
      toast({
        title: 'Erro',
        description: 'Data de início deve ser anterior à data final',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/portfolio/${portfolioId}/to-backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          startDate: backtestStartDate,
          endDate: backtestEndDate
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar backtest');
      }

      const data = await response.json();
      
      toast({
        title: 'Sucesso!',
        description: 'Backtest gerado a partir da carteira'
      });

      if (onSuccess) {
        onSuccess(data.backtestId);
      } else {
        router.push(`/backtest?id=${data.backtestId}`);
      }
    } catch (error) {
      console.error('Erro ao gerar backtest:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao gerar backtest',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Backtest Name */}
      <div>
        <Label htmlFor="name">Nome do Backtest *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Backtest Carteira Dividendos"
          required
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o objetivo deste backtest..."
          rows={3}
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Data Inicial *</Label>
          <Input
            id="startDate"
            type="date"
            value={backtestStartDate}
            onChange={(e) => setBacktestStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="endDate">Data Final *</Label>
          <Input
            id="endDate"
            type="date"
            value={backtestEndDate}
            onChange={(e) => setBacktestEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <ArrowRight className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-purple-900 dark:text-purple-100">
            <p className="font-medium mb-1">Como funciona:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Usaremos a composição atual da sua carteira</li>
              <li>Simularemos o desempenho no período selecionado</li>
              <li>Você verá como a estratégia teria performado historicamente</li>
            </ul>
            <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
              💡 Use períodos de pelo menos 1 ano para resultados mais significativos
            </p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <p className="text-xs text-amber-900 dark:text-amber-100">
          <strong>⚠️ Importante:</strong> Resultados passados não garantem desempenho futuro. Use backtests como ferramenta de análise, não como previsão.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          <BarChart3 className="h-4 w-4 mr-2" />
          {submitting ? 'Gerando...' : 'Gerar Backtest'}
        </Button>
      </div>
    </form>
  );
}

