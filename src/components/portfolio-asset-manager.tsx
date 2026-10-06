"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PortfolioPercentInput, roundTo } from "@/components/portfolio-money-input";
import { formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PortfolioAIAssistant } from "@/components/portfolio-ai-assistant";
import { PortfolioBulkAssetInput } from "@/components/portfolio-bulk-asset-input";
import { usePremiumStatus } from "@/hooks/use-premium-status";

interface Asset {
  id: string;
  ticker: string;
  targetAllocation: number;
  isActive: boolean;
}

/** Referência estável enquanto carrega (um `[]` novo a cada render dispararia o efeito de sincronização em loop). */
const NO_ASSETS: Asset[] = [];

interface PortfolioAssetManagerProps {
  portfolioId: string;
  onUpdate: () => void;
}

export function PortfolioAssetManager({
  portfolioId,
  onUpdate,
}: PortfolioAssetManagerProps) {
  const { toast } = useToast();
  const { isPremium } = usePremiumStatus();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  /** Alocação em % (15 = 15%). */
  const [newAllocation, setNewAllocation] = useState<number | undefined>(undefined);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [activeReplaceTab, setActiveReplaceTab] = useState(() => {
    // Detectar se deve abrir na aba IA baseado no hash
    if (
      typeof window !== "undefined" &&
      window.location.hash === "#ai-assistant"
    ) {
      return "ai";
    }
    return "bulk";
  });

  // Query for loading portfolio assets
  const fetchPortfolio = async () => {
    const response = await fetch(`/api/portfolio/${portfolioId}`);

    if (!response.ok) {
      throw new Error("Erro ao carregar ativos");
    }

    const data = await response.json();
    const portfolioAssets = data.portfolio?.assets;
    
    // Ensure we return an array and map to the expected format
    if (!Array.isArray(portfolioAssets)) {
      return [];
    }
    
    return portfolioAssets.map((asset: any) => ({
      id: asset.id || `${asset.ticker}-${Date.now()}`,
      ticker: asset.ticker,
      targetAllocation: Number(asset.targetAllocation) || 0,
      isActive: asset.isActive !== undefined ? asset.isActive : true,
    }));
  };

  const {
    data: assets = NO_ASSETS,
    isLoading: loading,
    error: assetsError
  } = useQuery({
    queryKey: ['portfolio-assets', portfolioId],
    queryFn: fetchPortfolio,
  });

  // Show error toast if query fails
  useEffect(() => {
    // toast do sonner direto: o de useToast muda a cada render e repetiria o aviso.
    if (assetsError) sonnerToast.error("Erro", { description: "Não foi possível carregar os ativos" });
  }, [assetsError]);

  // Detectar hash e fazer scroll quando dados carregarem
  useEffect(() => {
    if (
      !loading &&
      typeof window !== "undefined" &&
      window.location.hash === "#ai-assistant"
    ) {
      // Aguardar um pouco mais para garantir que a seção foi renderizada
      setTimeout(() => {
        const replaceSection = document.querySelector(
          '[data-replace-section="true"]'
        );
        if (replaceSection) {
          replaceSection.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Destaque temporário da seção
          replaceSection.classList.add("ring-2", "ring-ring", "rounded-lg");
          setTimeout(() => {
            replaceSection.classList.remove("ring-2", "ring-ring", "rounded-lg");
          }, 2000);
        }
      }, 300);
    }
  }, [loading]);

  // Local state for editing allocations before saving
  const [localAssets, setLocalAssets] = useState<Asset[]>([]);

  // Sync local assets with query data
  useEffect(() => {
    if (Array.isArray(assets)) {
      setLocalAssets(assets);
    } else {
      setLocalAssets([]);
    }
  }, [assets]);

  const updateAllocation = (index: number, percent: number | undefined) => {
    setLocalAssets((current) =>
      current.map((asset, i) => (i === index ? { ...asset, targetAllocation: (percent ?? 0) / 100 } : asset))
    );
  };

  // Use localAssets for display/editing, fallback to assets from query
  // Ensure displayAssets is always an array
  const displayAssets = Array.isArray(localAssets) && localAssets.length > 0 
    ? localAssets 
    : Array.isArray(assets) 
    ? assets 
    : [];

  const totalAllocation = displayAssets.reduce(
    (sum: number, a: Asset) => sum + a.targetAllocation,
    0
  );
  const totalPercent = totalAllocation * 100;
  const isValid = totalPercent >= 99.5 && totalPercent <= 100.5;

  // Mutation for adding asset
  const addAssetMutation = useMutation({
    mutationFn: async ({ ticker, targetAllocation, updatedAssets }: { ticker: string; targetAllocation: number; updatedAssets: Array<{ ticker: string; targetAllocation: number }> }) => {
      // Add new asset
      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, targetAllocation }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao adicionar ativo");
      }

      // Update existing assets with new allocations
      if (updatedAssets.length > 0) {
        const updateResponse = await fetch(
          `/api/portfolio/${portfolioId}/assets`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assets: updatedAssets }),
          }
        );

        if (!updateResponse.ok) {
          console.error("Failed to update existing assets allocations");
        }
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Ativo adicionado",
        description: `${variables.ticker} entrou com ${formatPct(variables.targetAllocation)} e as demais alocações foram redistribuídas`,
      });

      setNewTicker("");
      setNewAllocation(undefined);
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      onUpdate();
    },
    onError: (error: Error) => {
      console.error("Erro ao adicionar ativo:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar ativo",
        variant: "destructive",
      });
    }
  });

  const handleAddAsset = async () => {
    if (!newTicker) {
      toast({
        title: "Ticker obrigatório",
        description: "Preencha o ticker do ativo",
        variant: "destructive",
      });
      return;
    }

    const ticker = newTicker.toUpperCase().trim();

    if (assets.some((a: Asset) => a.ticker === ticker)) {
      toast({
        title: "Ativo já existe",
        description: "Este ativo já está na carteira",
        variant: "destructive",
      });
      return;
    }

    // Validar ticker antes de adicionar
    try {
      const validationResponse = await fetch('/api/ticker/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      const validationData = await validationResponse.json();

      if (!validationData.valid) {
        toast({
          title: "Ticker inválido",
          description: validationData.message || `Ticker "${ticker}" não encontrado no Yahoo Finance`,
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Erro ao validar ticker:', error);
      toast({
        title: "Erro ao validar ticker",
        description: "Não foi possível validar o ticker. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    // Validate allocation if provided
    let newAllocValue: number;

    if (newAllocation !== undefined) {
      const parsedAlloc = newAllocation / 100;

      if (parsedAlloc <= 0 || parsedAlloc > 1) {
        toast({
          title: "Alocação inválida",
          description: "A alocação deve ficar entre 0,1% e 100%",
          variant: "destructive",
        });
        return;
      }

      newAllocValue = parsedAlloc;
    } else {
      // If no allocation provided, calculate equal distribution
      // New asset gets same weight as existing assets
      const totalAssets = assets.length + 1;
      newAllocValue = 1 / totalAssets;

      toast({
        title: "Alocação automática",
        description: `Sem % informado: ${formatPct(newAllocValue)} para cada ativo`,
        variant: "default",
      });
    }

    // Redistribute existing assets proportionally
    const currentTotal = assets.reduce(
      (sum: number, a: Asset) => sum + a.targetAllocation,
      0
    );
    const remainingAllocation = 1 - newAllocValue;

    const updatedAssets = assets.map((a: Asset) => ({
      ticker: a.ticker,
      targetAllocation:
        currentTotal > 0
          ? (a.targetAllocation / currentTotal) * remainingAllocation
          : remainingAllocation / assets.length,
    }));

    addAssetMutation.mutate({ ticker, targetAllocation: newAllocValue, updatedAssets });
  };

  // Mutation for removing asset
  const removeAssetMutation = useMutation({
    mutationFn: async ({ ticker, updatedAssets }: { ticker: string; updatedAssets: Array<{ ticker: string; targetAllocation: number }> }) => {
      // Remove the asset
      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao remover ativo");
      }

      // Update remaining assets with redistributed allocations
      if (updatedAssets.length > 0) {
        const updateResponse = await fetch(
          `/api/portfolio/${portfolioId}/assets`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assets: updatedAssets }),
          }
        );

        if (!updateResponse.ok) {
          console.error("Failed to update remaining assets allocations");
        }
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Ativo removido",
        description: `${variables.ticker} foi removido e as demais alocações foram redistribuídas`,
      });

      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      onUpdate();
    },
    onError: (error: Error) => {
      console.error("Erro ao remover ativo:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover ativo",
        variant: "destructive",
      });
    }
  });

  const handleRemoveAsset = (ticker: string) => setRemoveTarget(ticker);

  const confirmRemoveAsset = (ticker: string) => {
    // Find the asset being removed
    const removedAsset = assets.find((a: Asset) => a.ticker === ticker);
    if (!removedAsset) return;

    // Redistribute the removed allocation proportionally to remaining assets
    const remainingAssets = assets.filter((a: Asset) => a.ticker !== ticker);
    let updatedAssets: Array<{ ticker: string; targetAllocation: number }> = [];
    
    if (remainingAssets.length > 0) {
      const remainingTotal = remainingAssets.reduce(
        (sum: number, a: Asset) => sum + a.targetAllocation,
        0
      );
      const removedAllocation = removedAsset.targetAllocation;

      updatedAssets = remainingAssets.map((a: Asset) => ({
        ticker: a.ticker,
        targetAllocation:
          remainingTotal > 0
            ? a.targetAllocation +
              (a.targetAllocation / remainingTotal) * removedAllocation
            : 1 / remainingAssets.length,
      }));
    }

    removeAssetMutation.mutate({ ticker, updatedAssets });
  };

  // Mutation for saving allocations
  const saveAllocationsMutation = useMutation({
    mutationFn: async (normalizedAssets: Array<{ ticker: string; targetAllocation: number }>) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: normalizedAssets }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar alocações");
      }

      return response.json();
    },
    onSuccess: () => {
      const currentTotal = displayAssets.reduce(
        (sum: number, a: Asset) => sum + a.targetAllocation,
        0
      );

      toast({
        title: "Alocações salvas",
        description:
          currentTotal !== 1
            ? "As alocações foram normalizadas para 100% e salvas com sucesso"
            : "As alterações foram aplicadas com sucesso",
      });

      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      onUpdate();
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar alocações:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar alocações",
        variant: "destructive",
      });
    }
  });

  const handleSaveAllocations = () => {
    if (!isValid) {
      toast({
        title: "Alocação inválida",
        description: "A soma das alocações deve ficar entre 99,5% e 100,5%",
        variant: "destructive",
      });
      return;
    }

    // Normalize allocations to sum exactly 100% if needed
    const currentTotal = displayAssets.reduce(
      (sum: number, a: Asset) => sum + a.targetAllocation,
      0
    );
    const normalizedAssets = displayAssets.map((asset: Asset) => ({
      ticker: asset.ticker,
      targetAllocation:
        currentTotal !== 1
          ? asset.targetAllocation / currentTotal
          : asset.targetAllocation,
    }));

    saveAllocationsMutation.mutate(normalizedAssets);
  };

  // Mutation for replacing all assets (from AI or bulk)
  const replaceAllAssetsMutation = useMutation({
    mutationFn: async ({ assets: newAssets, source }: { assets: Array<{ ticker: string; targetAllocation: number }>; source: 'ai' | 'bulk' }) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: newAssets,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Erro ao aplicar ativos${source === 'ai' ? ' da IA' : ' em lote'}`);
      }

      return response.json();
    },
    onSuccess: (result, variables) => {
      if (variables.source === 'ai') {
        toast({
          title: "Ativos atualizados",
          description:
            result.message ||
            `${variables.assets.length} ativos foram configurados pela IA`,
        });
      } else {
        toast({
          title: "Ativos aplicados",
          description:
            result.message || `${variables.assets.length} ativos foram configurados`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      onUpdate();
    },
    onError: (error: Error) => {
      console.error("Erro ao aplicar ativos:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao aplicar ativos",
        variant: "destructive",
      });
    }
  });

  const handleAssetsFromAI = (generatedAssets: { ticker: string; targetAllocation: number }[]) => {
    replaceAllAssetsMutation.mutate({ assets: generatedAssets, source: 'ai' });
  };

  const handleAssetsFromBulk = (bulkAssets: { ticker: string; targetAllocation: number }[]) => {
    replaceAllAssetsMutation.mutate({ assets: bulkAssets, source: 'bulk' });
  };

  // Combined saving state from all mutations
  const saving = addAssetMutation.isPending || removeAssetMutation.isPending || saveAllocationsMutation.isPending || replaceAllAssetsMutation.isPending;

  const replaceTabs = (
    <>
      <TabsContent value="bulk" className="mt-4">
        <PortfolioBulkAssetInput onAssetsGenerated={handleAssetsFromBulk} />
      </TabsContent>
      <TabsContent value="ai" className="mt-4">
        <PortfolioAIAssistant
          onAssetsGenerated={handleAssetsFromAI}
          disabled={saving}
          locked={!isPremium}
          currentAssets={displayAssets.map((a: Asset) => ({
            ticker: a.ticker,
            targetAllocation: a.targetAllocation,
          }))}
        />
      </TabsContent>
    </>
  );

  return (
    <section aria-labelledby="asset-manager-title" className="space-y-4">
      <SectionHeader
        id="asset-manager-title"
        title="Ativos e alocação-alvo"
        description="O peso de cada ativo define os ajustes sugeridos para a carteira."
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)} disabled={loading}>
            <Plus strokeWidth={1.75} aria-hidden="true" />
            Adicionar ativo
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">Carregando ativos</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : displayAssets.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            Nenhum ativo configurado. Use &quot;Adicionar ativo&quot;, cole uma lista de tickers ou descreva a carteira.
          </p>
          <Tabs value={activeReplaceTab} onValueChange={setActiveReplaceTab}>
            <TabsList variant="underline">
              <TabsTrigger value="bulk">Colar lista</TabsTrigger>
              <TabsTrigger value="ai">Com IA</TabsTrigger>
            </TabsList>
            {replaceTabs}
          </Tabs>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <ul className="divide-y divide-border">
              {displayAssets.map((asset: Asset, index: number) => (
                <li key={`asset-${asset.id}`} className="flex items-center gap-3 px-3 py-2 sm:px-4">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{asset.ticker}</span>
                  <PortfolioPercentInput
                    className="w-28"
                    value={roundTo(asset.targetAllocation * 100)}
                    onChange={(value) => updateAllocation(index, value)}
                    ariaLabel={`Alocação de ${asset.ticker} em %`}
                    suffix="%"
                    disabled={saving}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAsset(asset.ticker)}
                    disabled={saving}
                    aria-label={`Remover ${asset.ticker}`}
                  >
                    <Trash2 className="text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total alocado</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn("text-lg font-semibold tabular-nums", isValid ? "text-foreground" : "text-negative")}>
                    {formatPct(totalAllocation, { digits: 2 })}
                  </p>
                  {!isValid && <Badge variant="negative">Precisa somar 100%</Badge>}
                  {isValid && Math.abs(totalPercent - 100) > 0.001 && (
                    <Badge variant="neutral">Será ajustado para 100%</Badge>
                  )}
                </div>
              </div>
              <Button onClick={handleSaveAllocations} disabled={!isValid || saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                    Salvando
                  </>
                ) : (
                  "Salvar alocações"
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5" data-replace-section="true">
            <div>
              <h3 className="text-sm font-medium text-foreground">Substituir todos os ativos</h3>
              <p className="text-xs text-muted-foreground">Troca a composição inteira por uma nova lista.</p>
            </div>
            <Tabs value={activeReplaceTab} onValueChange={setActiveReplaceTab}>
              <TabsList variant="underline">
                <TabsTrigger value="bulk">Colar lista</TabsTrigger>
                <TabsTrigger value="ai">Com IA</TabsTrigger>
              </TabsList>
              {replaceTabs}
            </Tabs>
          </div>
        </>
      )}

      <Dialog open={showAddModal} onOpenChange={(open) => !saving && setShowAddModal(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar ativo</DialogTitle>
            <DialogDescription>As demais alocações são redistribuídas proporcionalmente.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleAddAsset();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="newTicker">Ticker</Label>
              <Input
                id="newTicker"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder="Ex.: PETR4"
                autoCapitalize="characters"
                autoComplete="off"
                enterKeyHint="go"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Alocação <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <PortfolioPercentInput
                value={newAllocation}
                onChange={setNewAllocation}
                ariaLabel="Alocação do novo ativo em %"
                placeholder="Distribuição automática"
                suffix="%"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Sem valor, o ativo entra com peso igual ao dos demais.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewTicker("");
                  setNewAllocation(undefined);
                  setShowAddModal(false);
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                    Adicionando
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removeTarget} da carteira?</AlertDialogTitle>
            <AlertDialogDescription>
              A alocação dele é redistribuída entre os demais ativos. Se você tem ações deste ativo, uma venda
              aparecerá nas sugestões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => {
                if (removeTarget) confirmRemoveAsset(removeTarget);
                setRemoveTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
