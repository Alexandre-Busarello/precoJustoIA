'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatBRL } from '@/lib/format';

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
  
  const {
    data: backtests = [],
    isLoading: loading,
    isError: loadError,
    refetch,
  } = useQuery({
    queryKey: ['backtests-for-portfolio'],
    queryFn: async (): Promise<Backtest[]> => {
      const response = await fetch('/api/backtest');
      if (!response.ok) throw new Error('Erro ao carregar backtests');
      const data = await response.json();
      return data.backtests || [];
    },
  });
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedBacktestId, setSelectedBacktestId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

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
        title: 'Carteira criada',
        description: 'A composição do backtest foi copiada para a nova carteira.'
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
      <div className="space-y-3 py-2" aria-busy="true">
        <span className="sr-only">Carregando backtests</span>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="py-6 text-center">
        <p className="text-sm font-medium text-foreground">Não foi possível carregar seus backtests</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (backtests.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-medium text-foreground">Você ainda não tem backtests salvos</p>
        <p className="mt-1 text-sm text-muted-foreground">Salve um backtest para convertê-lo em carteira.</p>
        <Button variant="outline" onClick={() => router.push('/backtest')} className="mt-4">
          Criar um backtest
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="backtest">Backtest</Label>
        <Select value={selectedBacktestId} onValueChange={handleBacktestChange}>
          <SelectTrigger id="backtest" className="w-full">
            <SelectValue placeholder="Escolha um backtest" />
          </SelectTrigger>
          <SelectContent>
            {backtests.map(backtest => (
              <SelectItem key={backtest.id} value={backtest.id}>
                <span className="flex flex-col">
                  <span className="font-medium">{backtest.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Aporte de {formatBRL(backtest.monthlyContribution)}/mês
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="convert-name">Nome da carteira</Label>
        <Input
          id="convert-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Carteira de dividendos"
          enterKeyHint="next"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="convert-description">
          Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="convert-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva sua estratégia"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="convert-start">Data de início</Label>
        <Input
          id="convert-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">A partir de quando você passa a acompanhar esta carteira.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3 text-sm">
        <p className="font-medium text-foreground">O que é copiado do backtest</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
          <li>Ativos e alocação-alvo</li>
          <li>Valor do aporte mensal</li>
          <li>Frequência de rebalanceamento</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          A carteira começa vazia; você registra as transações conforme investir.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting || !selectedBacktestId}>
          {submitting ? 'Criando' : 'Criar carteira'}
        </Button>
      </div>
    </form>
  );
}
