'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, ArrowRight } from 'lucide-react';

interface Backtest {
  id: string;
  name: string;
  initialCapital: number;
  monthlyContribution: number;
  createdAt: string;
}

interface ConvertBacktestModalProps {
  onSuccess?: (portfolioId: string) => void;
  onCancel?: () => void;
}

export function ConvertBacktestModal({
  onSuccess,
  onCancel
}: ConvertBacktestModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedBacktestId, setSelectedBacktestId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadBacktests();
  }, []);

  const loadBacktests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/backtest');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar backtests');
      }

      const data = await response.json();
      setBacktests(data.backtests || []);
    } catch (error) {
      console.error('Erro ao carregar backtests:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar seus backtests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBacktestChange = (backtestId: string) => {
    setSelectedBacktestId(backtestId);
    
    const backtest = backtests.find(b => b.id === backtestId);
    if (backtest && !name) {
      setName(`Carteira ${backtest.name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBacktestId) {
      toast({
        title: 'Erro',
        description: 'Selecione um backtest',
        variant: 'destructive'
      });
      return;
    }

    if (!name) {
      toast({
        title: 'Erro',
        description: 'Nome da carteira é obrigatório',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/portfolio/from-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backtestId: selectedBacktestId,
          name,
          description,
          startDate
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao converter backtest');
      }

      const data = await response.json();
      
      toast({
        title: 'Sucesso!',
        description: 'Carteira criada a partir do backtest'
      });

      if (onSuccess) {
        onSuccess(data.portfolioId);
      } else {
        router.push(`/carteira?id=${data.portfolioId}`);
      }
    } catch (error) {
      console.error('Erro ao converter backtest:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar carteira',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (backtests.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          Você ainda não tem backtests salvos
        </p>
        <Button
          variant="link"
          onClick={() => router.push('/backtest')}
          className="mt-2"
        >
          Criar um backtest primeiro
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Backtest Selection */}
      <div>
        <Label htmlFor="backtest">Selecione o Backtest *</Label>
        <Select value={selectedBacktestId} onValueChange={handleBacktestChange}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha um backtest..." />
          </SelectTrigger>
          <SelectContent>
            {backtests.map(backtest => (
              <SelectItem key={backtest.id} value={backtest.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{backtest.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Aporte: R$ {backtest.monthlyContribution.toFixed(2)}/mês
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          A composição de ativos e configurações serão copiadas do backtest
        </p>
      </div>

      {/* Portfolio Name */}
      <div>
        <Label htmlFor="name">Nome da Carteira *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Minha Carteira de Dividendos"
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
          placeholder="Descreva sua estratégia..."
          rows={3}
        />
      </div>

      {/* Start Date */}
      <div>
        <Label htmlFor="startDate">Data de Início *</Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Define quando você começará a usar esta carteira
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">O que será copiado:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Composição de ativos e alocações</li>
              <li>Valor do aporte mensal</li>
              <li>Frequência de rebalanceamento</li>
            </ul>
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Você começará com uma carteira vazia e poderá confirmar transações sugeridas mensalmente.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting || !selectedBacktestId}>
          {submitting ? 'Criando...' : 'Criar Carteira'}
        </Button>
      </div>
    </form>
  );
}

