'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Asset {
  id: string;
  ticker: string;
  targetAllocation: number;
  isActive: boolean;
}

interface PortfolioAssetManagerProps {
  portfolioId: string;
  onUpdate: () => void;
}

export function PortfolioAssetManager({ portfolioId, onUpdate }: PortfolioAssetManagerProps) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newAllocation, setNewAllocation] = useState('');
  
  useEffect(() => {
    loadAssets();
  }, [portfolioId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portfolio/${portfolioId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar ativos');
      }

      const data = await response.json();
      setAssets(data.portfolio.assets || []);
    } catch (error) {
      console.error('Erro ao carregar ativos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os ativos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAllocation = (index: number, value: string) => {
    const newAssets = [...assets];
    newAssets[index].targetAllocation = parseFloat(value) / 100 || 0;
    setAssets(newAssets);
  };

  const totalAllocation = assets.reduce((sum, a) => sum + a.targetAllocation, 0);
  const totalPercent = totalAllocation * 100;
  const isValid = totalPercent >= 99.5 && totalPercent <= 100.5;

  const handleAddAsset = async () => {
    if (!newTicker || !newAllocation) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o ticker e a alocação',
        variant: 'destructive'
      });
      return;
    }

    const ticker = newTicker.toUpperCase().trim();
    const allocation = parseFloat(newAllocation) / 100;

    if (isNaN(allocation) || allocation <= 0 || allocation > 1) {
      toast({
        title: 'Alocação inválida',
        description: 'A alocação deve ser entre 0.1% e 100%',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, targetAllocation: allocation })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar ativo');
      }

      toast({
        title: 'Ativo adicionado!',
        description: `${ticker} foi adicionado à carteira`
      });

      setNewTicker('');
      setNewAllocation('');
      setShowAddModal(false);
      loadAssets();
      onUpdate();
    } catch (error) {
      console.error('Erro ao adicionar ativo:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao adicionar ativo',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveAsset = async (ticker: string) => {
    if (!confirm(`Remover ${ticker} da carteira?\n\nSe você possui ações deste ativo, uma transação de venda será sugerida.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao remover ativo');
      }

      toast({
        title: 'Ativo removido!',
        description: `${ticker} foi removido da carteira`
      });

      loadAssets();
      onUpdate();
    } catch (error) {
      console.error('Erro ao remover ativo:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao remover ativo',
        variant: 'destructive'
      });
    }
  };

  const handleSaveAllocations = async () => {
    if (!isValid) {
      toast({
        title: 'Alocação inválida',
        description: 'A soma das alocações deve estar entre 99.5% e 100.5%',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      const updates = assets.map(asset => ({
        ticker: asset.ticker,
        targetAllocation: asset.targetAllocation
      }));

      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: updates })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar alocações');
      }

      toast({
        title: 'Alocações salvas!',
        description: 'As alterações foram aplicadas com sucesso'
      });

      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar alocações:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar alocações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Gerenciamento de Ativos
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Ativo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum ativo configurado</p>
                <p className="text-sm mt-1">Adicione ativos para começar</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {assets.map((asset, index) => (
                    <div 
                      key={asset.id}
                      className="flex items-center gap-4 p-3 border rounded-lg bg-card"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{asset.ticker}</p>
                      </div>
                      <div className="w-32">
                        <Label htmlFor={`allocation-${index}`} className="text-xs">
                          Alocação (%)
                        </Label>
                        <Input
                          id={`allocation-${index}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={(asset.targetAllocation * 100).toFixed(2)}
                          onChange={(e) => updateAllocation(index, e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAsset(asset.ticker)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Alocado</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-2xl font-bold ${isValid ? 'text-green-600' : 'text-destructive'}`}>
                          {totalPercent.toFixed(2)}%
                        </p>
                        {!isValid && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Inválido
                          </Badge>
                        )}
                        {isValid && totalPercent !== 100 && (
                          <Badge variant="outline" className="gap-1">
                            Será ajustado para 100%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveAllocations}
                      disabled={!isValid || saving}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Salvando...' : 'Salvar Alocações'}
                    </Button>
                  </div>
                  
                  {!isValid && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                      <p className="font-medium">⚠️ Alocação total inválida</p>
                      <p className="mt-1">
                        A soma das alocações deve estar entre 99.5% e 100.5%.
                        Atualmente: {totalPercent.toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Asset Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Ativo</DialogTitle>
            <DialogDescription>
              Adicione um novo ativo à sua carteira
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newTicker">Ticker *</Label>
              <Input
                id="newTicker"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder="Ex: PETR4"
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="newAllocation">Alocação (%) *</Label>
              <Input
                id="newAllocation"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={newAllocation}
                onChange={(e) => setNewAllocation(e.target.value)}
                placeholder="Ex: 10.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Você pode ajustar as demais alocações depois
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setNewTicker('');
                  setNewAllocation('');
                  setShowAddModal(false);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddAsset}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

