'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTracking } from '@/hooks/use-tracking';
import { EventType } from '@/lib/tracking-types';
import { formatPct } from '@/lib/format';
import { Plus, Trash2 } from 'lucide-react';
import { PortfolioMoneyInput, PortfolioPercentInput } from '@/components/portfolio-money-input';
import { PortfolioAIAssistant } from '@/components/portfolio-ai-assistant';
import { PortfolioBulkAssetInput } from '@/components/portfolio-bulk-asset-input';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { invalidateDashboardPortfoliosCache } from '@/components/dashboard-portfolios';
import { dispatchPortfolioChangeEvent } from '@/hooks/use-cache-invalidation';

interface Asset {
  ticker: string;
  targetAllocation: number;
}

interface PortfolioConfigFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    id?: string;
    name: string;
    description?: string;
    startDate: string;
    monthlyContribution: number;
    rebalanceFrequency: string;
    assets: Asset[];
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PortfolioConfigForm({
  mode,
  initialData,
  onSuccess,
  onCancel
}: PortfolioConfigFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { trackEvent } = useTracking();
  const { isPremium } = usePremiumStatus();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);
  const [monthlyContribution, setMonthlyContribution] = useState<number | undefined>(
    initialData?.monthlyContribution ?? 1000
  );
  const [rebalanceFrequency, setRebalanceFrequency] = useState(initialData?.rebalanceFrequency || 'monthly');
  const [assets, setAssets] = useState<Asset[]>(initialData?.assets || []);
  const [newTicker, setNewTicker] = useState('');
  /** Alocação em % (15 = 15%). */
  const [newAllocation, setNewAllocation] = useState<number | undefined>(undefined);

  const totalAllocation = assets.reduce((sum, asset) => sum + asset.targetAllocation, 0);
  // In create mode, only require name (assets and allocation are optional, can be added later)
  // In edit mode, only validate basic fields (assets are managed separately)
  const isValid = mode === 'create' 
    ? (name && name.trim().length > 0)
    : (name && (monthlyContribution ?? 0) > 0);

  const handleAddAsset = async () => {
    if (!newTicker) {
      toast({
        title: 'Erro',
        description: 'Preencha o ticker do ativo',
        variant: 'destructive'
      });
      return;
    }

    const tickerUpper = newTicker.toUpperCase().trim();
    
    if (assets.some(a => a.ticker === tickerUpper)) {
      toast({
        title: 'Erro',
        description: 'Ativo já adicionado',
        variant: 'destructive'
      });
      return;
    }

    // Validar ticker antes de adicionar
    try {
      const validationResponse = await fetch('/api/ticker/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: tickerUpper }),
      });

      const validationData = await validationResponse.json();

      if (!validationData.valid) {
        toast({
          title: 'Ticker inválido',
          description: validationData.message || `Ticker "${tickerUpper}" não encontrado no Yahoo Finance`,
          variant: 'destructive',
        });
        return;
      }
    } catch (error) {
      console.error('Erro ao validar ticker:', error);
      toast({
        title: 'Erro ao validar ticker',
        description: 'Não foi possível validar o ticker. Tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    // Se alocação foi informada, validar e usar
    // Se não foi informada, calcular distribuição igual entre todos os ativos (incluindo o novo)
    let allocation: number;
    
    if (newAllocation !== undefined) {
      const parsedAlloc = newAllocation / 100;

      if (parsedAlloc <= 0 || parsedAlloc > 1) {
        toast({
          title: 'Erro',
          description: 'Alocação deve estar entre 0% e 100%',
          variant: 'destructive'
        });
        return;
      }
      
      allocation = parsedAlloc;
    } else {
      // Distribuição igual entre todos os ativos (incluindo o novo)
      const totalAssets = assets.length + 1;
      allocation = 1 / totalAssets;
      
      // Redistribuir alocações existentes igualmente
      const equalAllocation = allocation;
      const updatedAssets = assets.map(a => ({
        ...a,
        targetAllocation: equalAllocation
      }));
      
      setAssets([...updatedAssets, { ticker: tickerUpper, targetAllocation: allocation }]);
      setNewTicker('');
      setNewAllocation(undefined);
      
      toast({
        title: 'Ativo adicionado',
        description: `Alocação distribuída igualmente: ${formatPct(allocation)} para cada ativo`,
      });
      return;
    }

    setAssets([...assets, { ticker: tickerUpper, targetAllocation: allocation }]);
    setNewTicker('');
    setNewAllocation(undefined);
  };

  const handleRemoveAsset = (ticker: string) => {
    setAssets(assets.filter(a => a.ticker !== ticker));
  };

  const handleAssetsFromAI = (generatedAssets: Asset[]) => {
    setAssets(generatedAssets);
    toast({
      title: 'Ativos aplicados',
      description: `${generatedAssets.length} ativos sugeridos pela IA foram adicionados`,
    });
  };

  const handleAssetsFromBulk = (bulkAssets: Asset[]) => {
    setAssets(bulkAssets);
    toast({
      title: 'Ativos aplicados',
      description: `${bulkAssets.length} ativos foram adicionados`,
    });
  };

  // Mutation for creating portfolio
  const createPortfolioMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      startDate: string;
      monthlyContribution: number;
      rebalanceFrequency: string;
      assets: Asset[];
    }) => {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar carteira');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Carteira criada',
        description: 'Agora registre suas transações para acompanhar o desempenho.'
      });

      // Track evento de criação de carteira
      trackEvent(EventType.FEATURE_USED, undefined, {
        feature: 'portfolio_created',
        portfolioId: data.portfolioId,
        assetCount: assets.length,
        monthlyContribution: monthlyContribution,
        rebalanceFrequency: rebalanceFrequency,
      });

      // Invalidate dashboard cache
      invalidateDashboardPortfoliosCache();
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      dispatchPortfolioChangeEvent('config', data.portfolioId);

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/carteira?id=${data.portfolioId}`);
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao criar carteira:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar carteira',
        variant: 'destructive'
      });
    }
  });

  // Mutation for updating portfolio
  const updatePortfolioMutation = useMutation({
    mutationFn: async (data: {
      portfolioId: string;
      name: string;
      description?: string;
      monthlyContribution: number;
      rebalanceFrequency: string;
    }) => {
      const response = await fetch(`/api/portfolio/${data.portfolioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          monthlyContribution: data.monthlyContribution,
          rebalanceFrequency: data.rebalanceFrequency
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar carteira');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Carteira atualizada',
        description: 'As alterações foram salvas.'
      });

      // Track evento de atualização de carteira
      trackEvent(EventType.FEATURE_USED, undefined, {
        feature: 'portfolio_updated',
        portfolioId: initialData?.id,
      });

      // Invalidate dashboard cache
      invalidateDashboardPortfoliosCache();
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      if (initialData?.id) {
        queryClient.invalidateQueries({ queryKey: ['portfolio', initialData.id] });
        dispatchPortfolioChangeEvent('config', initialData.id);
      }

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar carteira:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar carteira',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast({
        title: 'Erro de validação',
        description: 'Verifique se todos os campos obrigatórios estão preenchidos',
        variant: 'destructive'
      });
      return;
    }

    if (mode === 'create') {
      // Normalizar alocações se necessário (distribuir igualmente se não somarem 100%)
      // Se não há ativos, enviar array vazio (podem ser adicionados depois)
      let normalizedAssets = [...assets];
      
      if (normalizedAssets.length > 0) {
        const currentTotal = normalizedAssets.reduce((sum, a) => sum + a.targetAllocation, 0);
        
        // Se não há alocação informada ou não soma 100%, distribuir igualmente
        if (currentTotal === 0 || Math.abs(currentTotal - 1.0) > 0.01) {
          const equalAllocation = 1 / normalizedAssets.length;
          normalizedAssets = normalizedAssets.map(a => ({
            ...a,
            targetAllocation: equalAllocation
          }));
        } else if (currentTotal !== 1.0) {
          // Normalizar para somar exatamente 100%
          normalizedAssets = normalizedAssets.map(a => ({
            ...a,
            targetAllocation: a.targetAllocation / currentTotal
          }));
        }
      }

      createPortfolioMutation.mutate({
        name,
        description,
        startDate,
        monthlyContribution: monthlyContribution ?? 0,
        rebalanceFrequency,
        assets: normalizedAssets
      });
    } else {
      // Edit mode - update portfolio
      if (!initialData?.id) {
        toast({
          title: 'Erro',
          description: 'ID da carteira não encontrado',
          variant: 'destructive'
        });
        return;
      }

      updatePortfolioMutation.mutate({
        portfolioId: initialData.id,
        name,
        description,
        monthlyContribution: monthlyContribution ?? 0,
        rebalanceFrequency
      });
    }
  };

  const loading = createPortfolioMutation.isPending || updatePortfolioMutation.isPending;

  const allocationStatus =
    assets.length === 0
      ? null
      : totalAllocation === 0
        ? 'Sem alocação informada: será distribuída igualmente entre os ativos ao criar a carteira.'
        : totalAllocation < 0.995 || totalAllocation > 1.005
          ? `Alocação total de ${formatPct(totalAllocation)}. Será ajustada proporcionalmente para 100% ao criar a carteira.`
          : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da carteira</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Carteira de dividendos"
              enterKeyHint="next"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva sua estratégia"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Data de início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={mode === 'edit'}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthlyContribution">Aporte mensal</Label>
              <PortfolioMoneyInput
                id="monthlyContribution"
                value={monthlyContribution}
                onValueChange={setMonthlyContribution}
                enterKeyHint="go"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rebalanceFrequency">Rebalanceamento</Label>
              <Select value={rebalanceFrequency} onValueChange={setRebalanceFrequency}>
                <SelectTrigger id="rebalanceFrequency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === 'create' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Ativos e alocação-alvo</CardTitle>
              <Badge variant="neutral" className="tabular-nums">
                {totalAllocation === 0 ? 'Sem alocação' : `${formatPct(totalAllocation)} alocado`}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Opcional: você também pode adicionar os ativos depois.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="manual">
              <TabsList variant="underline">
                <TabsTrigger value="manual">Um por vez</TabsTrigger>
                <TabsTrigger value="bulk">Colar lista</TabsTrigger>
                <TabsTrigger value="ai">Com IA</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-4 space-y-2">
                <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-end gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-asset-ticker">Ticker</Label>
                    <Input
                      id="new-asset-ticker"
                      placeholder="Ex.: PETR4"
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                      autoCapitalize="characters"
                      autoComplete="off"
                      enterKeyHint="next"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alocação</Label>
                    <PortfolioPercentInput
                      value={newAllocation}
                      onChange={setNewAllocation}
                      ariaLabel="Alocação do ativo em %"
                      placeholder="Auto"
                      suffix="%"
                    />
                  </div>
                  <Button type="button" onClick={handleAddAsset} variant="outline" aria-label="Adicionar ativo">
                    <Plus strokeWidth={1.75} aria-hidden="true" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sem alocação informada, o peso é distribuído igualmente entre todos os ativos.
                </p>
              </TabsContent>

              <TabsContent value="bulk" className="mt-4">
                <PortfolioBulkAssetInput onAssetsGenerated={handleAssetsFromBulk} />
              </TabsContent>

              <TabsContent value="ai" className="mt-4">
                <PortfolioAIAssistant onAssetsGenerated={handleAssetsFromAI} locked={!isPremium} />
              </TabsContent>
            </Tabs>

            {assets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum ativo adicionado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Ativos ({assets.length})</h4>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {assets.map(asset => (
                    <li key={asset.ticker} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
                      <span className="font-medium text-foreground">{asset.ticker}</span>
                      <span className="flex items-center gap-1">
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatPct(asset.targetAllocation)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${asset.ticker}`}
                          onClick={() => handleRemoveAsset(asset.ticker)}
                        >
                          <Trash2 className="text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
                {allocationStatus && <p className="text-xs text-muted-foreground">{allocationStatus}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={!isValid || loading}>
          {loading ? 'Salvando' : mode === 'create' ? 'Criar carteira' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}
