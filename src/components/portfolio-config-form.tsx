'use client';

import { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, TrendingUp } from 'lucide-react';

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
  
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);
  const [monthlyContribution, setMonthlyContribution] = useState(initialData?.monthlyContribution || 1000);
  const [rebalanceFrequency, setRebalanceFrequency] = useState(initialData?.rebalanceFrequency || 'monthly');
  const [assets, setAssets] = useState<Asset[]>(initialData?.assets || []);
  const [newTicker, setNewTicker] = useState('');
  const [newAllocation, setNewAllocation] = useState('');

  const totalAllocation = assets.reduce((sum, asset) => sum + asset.targetAllocation, 0);
  // Allow ±0.5% tolerance (between 99.5% and 100.5%)
  const isValid = name && assets.length > 0 && totalAllocation >= 0.995 && totalAllocation <= 1.005;

  const handleAddAsset = () => {
    if (!newTicker || !newAllocation) {
      toast({
        title: 'Erro',
        description: 'Preencha ticker e alocação',
        variant: 'destructive'
      });
      return;
    }

    const allocation = parseFloat(newAllocation) / 100;
    
    if (allocation <= 0 || allocation > 1) {
      toast({
        title: 'Erro',
        description: 'Alocação deve estar entre 0% e 100%',
        variant: 'destructive'
      });
      return;
    }

    const tickerUpper = newTicker.toUpperCase();
    
    if (assets.some(a => a.ticker === tickerUpper)) {
      toast({
        title: 'Erro',
        description: 'Ativo já adicionado',
        variant: 'destructive'
      });
      return;
    }

    setAssets([...assets, { ticker: tickerUpper, targetAllocation: allocation }]);
    setNewTicker('');
    setNewAllocation('');
  };

  const handleRemoveAsset = (ticker: string) => {
    setAssets(assets.filter(a => a.ticker !== ticker));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast({
        title: 'Erro de validação',
        description: 'Verifique se todos os campos estão preenchidos e a alocação total é 100%',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      if (mode === 'create') {
        const response = await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            startDate,
            monthlyContribution,
            rebalanceFrequency,
            assets
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao criar carteira');
        }

        const data = await response.json();
        
        toast({
          title: 'Sucesso!',
          description: 'Carteira criada com sucesso'
        });

        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/carteira?id=${data.portfolioId}`);
        }
      } else {
        // Edit mode - update portfolio
        if (!initialData?.id) {
          throw new Error('ID da carteira não encontrado');
        }

        const response = await fetch(`/api/portfolio/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            monthlyContribution,
            rebalanceFrequency
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao atualizar carteira');
        }

        toast({
          title: 'Sucesso!',
          description: 'Carteira atualizada com sucesso'
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar carteira:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar carteira',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Carteira *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carteira Dividendos"
              required
            />
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data de Início *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={mode === 'edit'}
                required
              />
            </div>

            <div>
              <Label htmlFor="monthlyContribution">Aporte Mensal (R$) *</Label>
              <Input
                id="monthlyContribution"
                type="number"
                step="0.01"
                min="0"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(parseFloat(e.target.value))}
                placeholder="1000"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rebalanceFrequency">Frequência de Rebalanceamento *</Label>
            <Select value={rebalanceFrequency} onValueChange={setRebalanceFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assets */}
      {mode === 'create' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ativos da Carteira</CardTitle>
              <Badge variant={totalAllocation === 1 ? 'default' : 'destructive'}>
                {(totalAllocation * 100).toFixed(1)}% alocado
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Asset Form */}
            <div className="flex gap-2">
              <Input
                placeholder="Ticker (ex: PETR4)"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="% (ex: 25)"
                value={newAllocation}
                onChange={(e) => setNewAllocation(e.target.value)}
                className="w-32"
                step="0.1"
                min="0"
                max="100"
              />
              <Button type="button" onClick={handleAddAsset} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Assets List */}
            {assets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Adicione ativos à sua carteira</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map(asset => (
                  <div
                    key={asset.ticker}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{asset.ticker}</span>
                      <Badge variant="outline">
                        {(asset.targetAllocation * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAsset(asset.ticker)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {(totalAllocation < 0.995 || totalAllocation > 1.005) && assets.length > 0 && (
              <p className="text-sm text-destructive">
                A alocação total deve estar entre 99,5% e 100,5%. 
                {totalAllocation < 1 ? `Faltam ${((1 - totalAllocation) * 100).toFixed(1)}%` : `Excedeu ${((totalAllocation - 1) * 100).toFixed(1)}%`}
              </p>
            )}
            {totalAllocation >= 0.995 && totalAllocation <= 1.005 && totalAllocation !== 1 && assets.length > 0 && (
              <p className="text-sm text-muted-foreground">
                ℹ️ Alocação será ajustada automaticamente para 100% pela plataforma
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={!isValid || loading}>
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar Carteira' : 'Salvar Alterações'}
        </Button>
      </div>
    </form>
  );
}

