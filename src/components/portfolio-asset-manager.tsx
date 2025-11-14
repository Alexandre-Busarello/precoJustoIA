"use client";

import { useState, useEffect, cache } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  TrendingUp,
  Bot,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortfolioAIAssistant } from "@/components/portfolio-ai-assistant";
import { PortfolioBulkAssetInput } from "@/components/portfolio-bulk-asset-input";
import { usePremiumStatus } from "@/hooks/use-premium-status";

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

export function PortfolioAssetManager({
  portfolioId,
  onUpdate,
}: PortfolioAssetManagerProps) {
  const { toast } = useToast();
  const { isPremium } = usePremiumStatus();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newAllocation, setNewAllocation] = useState("");
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

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

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

          // Adicionar highlight temporário
          replaceSection.classList.add(
            "ring-2",
            "ring-blue-500",
            "ring-opacity-50",
            "rounded-lg"
          );
          setTimeout(() => {
            replaceSection.classList.remove(
              "ring-2",
              "ring-blue-500",
              "ring-opacity-50",
              "rounded-lg"
            );
          }, 2000);
        }
      }, 300);
    }
  }, [loading]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}`))();

      if (!response.ok) {
        throw new Error("Erro ao carregar ativos");
      }

      const data = await response.json();
      setAssets(data.portfolio.assets || []);
    } catch (error) {
      console.error("Erro ao carregar ativos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os ativos",
        variant: "destructive",
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

  const totalAllocation = assets.reduce(
    (sum, a) => sum + a.targetAllocation,
    0
  );
  const totalPercent = totalAllocation * 100;
  const isValid = totalPercent >= 99.5 && totalPercent <= 100.5;

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

    if (assets.some((a) => a.ticker === ticker)) {
      toast({
        title: "Ativo já existe",
        description: "Este ativo já está na carteira",
        variant: "destructive",
      });
      return;
    }

    // Validate allocation if provided
    let newAllocValue: number;

    if (newAllocation && newAllocation.trim() !== "") {
      const parsedAlloc = parseFloat(newAllocation) / 100;

      if (isNaN(parsedAlloc) || parsedAlloc <= 0 || parsedAlloc > 1) {
        toast({
          title: "Alocação inválida",
          description: "A alocação deve ser entre 0.1% e 100%",
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
        description: `Sem % informado. Será distribuído igualmente: ${(
          newAllocValue * 100
        ).toFixed(1)}% para cada ativo`,
        variant: "default",
      });
    }

    try {
      setSaving(true);

      // Redistribute existing assets proportionally
      const currentTotal = assets.reduce(
        (sum, a) => sum + a.targetAllocation,
        0
      );
      const remainingAllocation = 1 - newAllocValue;

      const updatedAssets = assets.map((a) => ({
        ticker: a.ticker,
        targetAllocation:
          currentTotal > 0
            ? (a.targetAllocation / currentTotal) * remainingAllocation
            : remainingAllocation / assets.length,
      }));

      // Add new asset
      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, targetAllocation: newAllocValue }),
      }))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao adicionar ativo");
      }

      // Update existing assets with new allocations
      if (updatedAssets.length > 0) {
        const updateResponse = await cache(async() => fetch(
          `/api/portfolio/${portfolioId}/assets`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assets: updatedAssets }),
          }
        ))();

        if (!updateResponse.ok) {
          console.error("Failed to update existing assets allocations");
        }
      }

      toast({
        title: "Ativo adicionado!",
        description: `${ticker} foi adicionado com ${(
          newAllocValue * 100
        ).toFixed(1)}% e as demais alocações foram redistribuídas`,
      });

      setNewTicker("");
      setNewAllocation("");
      setShowAddModal(false);
      loadAssets();
      onUpdate();
    } catch (error) {
      console.error("Erro ao adicionar ativo:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao adicionar ativo",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAsset = async (ticker: string) => {
    if (
      !confirm(
        `Remover ${ticker} da carteira?\n\nSe você possui ações deste ativo, uma transação de venda será sugerida.`
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      // Find the asset being removed
      const removedAsset = assets.find((a) => a.ticker === ticker);
      if (!removedAsset) return;

      // Remove the asset
      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      }))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao remover ativo");
      }

      // Redistribute the removed allocation proportionally to remaining assets
      const remainingAssets = assets.filter((a) => a.ticker !== ticker);
      if (remainingAssets.length > 0) {
        const remainingTotal = remainingAssets.reduce(
          (sum, a) => sum + a.targetAllocation,
          0
        );
        const removedAllocation = removedAsset.targetAllocation;

        const updatedAssets = remainingAssets.map((a) => ({
          ticker: a.ticker,
          targetAllocation:
            remainingTotal > 0
              ? a.targetAllocation +
                (a.targetAllocation / remainingTotal) * removedAllocation
              : 1 / remainingAssets.length,
        }));

        // Update remaining assets with redistributed allocations
        const updateResponse = await cache(async() => fetch(
          `/api/portfolio/${portfolioId}/assets`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assets: updatedAssets }),
          }
        ))();

        if (!updateResponse.ok) {
          console.error("Failed to update remaining assets allocations");
        }
      }

      toast({
        title: "Ativo removido!",
        description: `${ticker} foi removido e as demais alocações foram redistribuídas`,
      });

      loadAssets();
      onUpdate();
    } catch (error) {
      console.error("Erro ao remover ativo:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao remover ativo",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllocations = async () => {
    if (!isValid) {
      toast({
        title: "Alocação inválida",
        description: "A soma das alocações deve estar entre 99.5% e 100.5%",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Normalize allocations to sum exactly 100% if needed
      const currentTotal = assets.reduce(
        (sum, a) => sum + a.targetAllocation,
        0
      );
      const normalizedAssets = assets.map((asset) => ({
        ticker: asset.ticker,
        targetAllocation:
          currentTotal !== 1
            ? asset.targetAllocation / currentTotal
            : asset.targetAllocation,
      }));

      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: normalizedAssets }),
      }))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar alocações");
      }

      toast({
        title: "Alocações salvas!",
        description:
          currentTotal !== 1
            ? "As alocações foram normalizadas para 100% e salvas com sucesso"
            : "As alterações foram aplicadas com sucesso",
      });

      loadAssets(); // Reload to show normalized values
      onUpdate();
    } catch (error) {
      console.error("Erro ao salvar alocações:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao salvar alocações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssetsFromAI = async (
    generatedAssets: { ticker: string; targetAllocation: number }[]
  ) => {
    try {
      setSaving(true);

      // Replace all current assets with AI generated ones using replaceAll flag
      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: generatedAssets,
          replaceAll: true, // 🤖 Flag para IA: deletar todos os ativos e recriar
        }),
      }))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao aplicar ativos da IA");
      }

      const result = await response.json();

      toast({
        title: "Carteira reconstruída pela IA!",
        description:
          result.message ||
          `${generatedAssets.length} ativos foram configurados pela IA`,
      });

      loadAssets();
      onUpdate();
    } catch (error) {
      console.error("Erro ao aplicar ativos da IA:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao aplicar ativos",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssetsFromBulk = async (
    bulkAssets: { ticker: string; targetAllocation: number }[]
  ) => {
    try {
      setSaving(true);

      // Replace all current assets with bulk input ones using replaceAll flag
      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/assets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: bulkAssets,
          replaceAll: true, // 📝 Flag para bulk: deletar todos os ativos e recriar
        }),
      }))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao aplicar ativos em lote");
      }

      const result = await response.json();

      toast({
        title: "Ativos aplicados!",
        description:
          result.message || `${bulkAssets.length} ativos foram configurados`,
      });

      loadAssets();
      onUpdate();
    } catch (error) {
      console.error("Erro ao aplicar ativos em lote:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro ao aplicar ativos",
        variant: "destructive",
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Gerenciamento de Ativos
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Ativo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Quick Actions for Adding Multiple Assets */}
            {assets.length === 0 && (
              <div className="space-y-4">
                <Tabs defaultValue="manual" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger
                      value="manual"
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Manual
                    </TabsTrigger>
                    <TabsTrigger
                      value="bulk"
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Lista
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      IA
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="mt-6">
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum ativo configurado</p>
                      <p className="text-sm mt-1">
                        Use o botão &quot;Adicionar Ativo&quot; acima
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="bulk" className="mt-6">
                    <PortfolioBulkAssetInput
                      onAssetsGenerated={handleAssetsFromBulk}
                    />
                  </TabsContent>

                  <TabsContent value="ai" className="mt-6">
                    <PortfolioAIAssistant
                      onAssetsGenerated={handleAssetsFromAI}
                      disabled={!isPremium || saving}
                      currentAssets={assets.map((a) => ({
                        ticker: a.ticker,
                        targetAllocation: a.targetAllocation,
                      }))}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {assets.length > 0 && (
              <>
                <div className="space-y-3">
                  {assets.map((asset, index) => (
                    <div
                      key={`asset-${asset.id}`}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 border rounded-lg bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{asset.ticker}</p>
                      </div>
                      <div className="w-full sm:w-32">
                        <Label
                          htmlFor={`allocation-${index}`}
                          className="text-xs"
                        >
                          Alocação (%)
                        </Label>
                        <Input
                          id={`allocation-${index}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={(asset.targetAllocation * 100).toFixed(2)}
                          onChange={(e) =>
                            updateAllocation(index, e.target.value)
                          }
                          className="mt-1"
                          disabled={saving}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAsset(asset.ticker)}
                        className="text-destructive hover:text-destructive flex-shrink-0 self-start sm:self-center"
                        disabled={saving}
                        title={saving ? "Aguarde..." : "Remover ativo"}
                      >
                        {saving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Total Alocado
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-2xl font-bold ${
                            isValid ? "text-green-600" : "text-destructive"
                          }`}
                        >
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
                      className="gap-2 w-full sm:w-auto flex-shrink-0"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Salvando..." : "Salvar Alocações"}
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

                {/* Quick Replace Options for Existing Assets */}
                <div className="border-t pt-4" data-replace-section="true">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Substituir Todos os Ativos
                  </h4>
                  <Tabs
                    value={activeReplaceTab}
                    onValueChange={setActiveReplaceTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        value="bulk"
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Lista de Tickers
                      </TabsTrigger>
                      <TabsTrigger
                        value="ai"
                        className="flex items-center gap-2"
                      >
                        <Bot className="h-4 w-4" />
                        Assistente IA
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="bulk" className="mt-4">
                      <PortfolioBulkAssetInput
                        onAssetsGenerated={handleAssetsFromBulk}
                      />
                    </TabsContent>

                    <TabsContent value="ai" className="mt-4">
                      <PortfolioAIAssistant
                        onAssetsGenerated={handleAssetsFromAI}
                        disabled={!isPremium || saving}
                        currentAssets={assets.map((a) => ({
                          ticker: a.ticker,
                          targetAllocation: a.targetAllocation,
                        }))}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Asset Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => !saving && setShowAddModal(open)}
      >
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
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="newAllocation">
                Alocação (%){" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="newAllocation"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={newAllocation}
                onChange={(e) => setNewAllocation(e.target.value)}
                placeholder="Deixe vazio para distribuição automática"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 Se não informar, o ativo será incluído com distribuição
                igualitária entre todos os ativos
              </p>
            </div>

            {saving && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="font-medium">Processando alterações...</span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                  Adicionando ativo e redistribuindo alocações
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNewTicker("");
                  setNewAllocation("");
                  setShowAddModal(false);
                }}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button onClick={handleAddAsset} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adicionando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
