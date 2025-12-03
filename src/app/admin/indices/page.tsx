/**
 * Admin Panel: Gerenciamento de Índices IPJ
 * Criar, editar e gerenciar índices
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Sparkles, Trash2, Edit2, RefreshCw, Clock, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { JsonEditor } from '@/components/admin/json-editor';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IndexDefinition {
  id: string;
  ticker: string;
  name: string;
  description: string;
  color: string;
  methodology: string;
  config: any;
  createdAt: string;
}

async function fetchIndices(): Promise<IndexDefinition[]> {
  const response = await fetch('/api/admin/indices');
  if (!response.ok) {
    throw new Error('Erro ao buscar índices');
  }
  const data = await response.json();
  return data.indices || [];
}

async function generateConfigWithAI(prompt: string): Promise<any> {
  const response = await fetch('/api/admin/indices/generate-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao gerar configuração');
  }
  const data = await response.json();
  return data;
}

async function createIndex(indexData: any): Promise<void> {
  const response = await fetch('/api/admin/indices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(indexData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao criar índice');
  }
}

async function deleteIndex(id: string): Promise<void> {
  const response = await fetch(`/api/admin/indices/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao deletar índice');
  }
}

async function recreateIndex(id: string): Promise<any> {
  const response = await fetch(`/api/admin/indices/${id}/recreate`, {
    method: 'POST'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao recriar índice');
  }
  return response.json();
}

async function fetchIndexStatus(id: string): Promise<any> {
  const response = await fetch(`/api/admin/indices/${id}/status`);
  if (!response.ok) {
    throw new Error('Erro ao buscar status do índice');
  }
  const data = await response.json();
  return data;
}

async function runIndexJob(id: string, jobType: 'mark-to-market' | 'screening', fillMissing: boolean = true): Promise<any> {
  const response = await fetch(`/api/admin/indices/${id}/run-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobType, fillMissing })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao executar job');
  }
  const data = await response.json();
  return data;
}

async function recalculateDividends(id: string, startDate?: string, dryRun: boolean = false): Promise<any> {
  const response = await fetch(`/api/admin/indices/${id}/recalculate-dividends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, dryRun })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao recalcular dividendos');
  }
  const data = await response.json();
  return data;
}

export default function AdminIndicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<IndexDefinition | null>(null);
  const [recreatingIndex, setRecreatingIndex] = useState<IndexDefinition | null>(null);
  const [statusIndex, setStatusIndex] = useState<IndexDefinition | null>(null);
  const [indexStatus, setIndexStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isRunningJob, setIsRunningJob] = useState<string | null>(null);
  const [showRecalculateDialog, setShowRecalculateDialog] = useState(false);
  const [recalculateStartDate, setRecalculateStartDate] = useState('');
  const [recalculateDryRun, setRecalculateDryRun] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [screeningResult, setScreeningResult] = useState<{
    count: number;
    tickers: string[];
    companies: Array<{
      ticker: string;
      name: string;
      sector: string | null;
      currentPrice: number;
      upside: number | null;
      overallScore: number | null;
      dividendYield: number | null;
      marketCap: number | null;
    }>;
  } | null>(null);
  const [isTestingScreening, setIsTestingScreening] = useState(false);
  const [formData, setFormData] = useState({
    ticker: '',
    name: '',
    description: '',
    color: '#10b981',
    methodology: '',
    config: null as any
  });

  const { data: indices, isLoading } = useQuery<IndexDefinition[]>({
    queryKey: ['admin-indices'],
    queryFn: fetchIndices
  });

  const generateConfigMutation = useMutation({
    mutationFn: generateConfigWithAI,
    onSuccess: (data) => {
      const { config, ticker, name, description, methodology } = data;
      setFormData(prev => ({
        ...prev,
        ticker: ticker || prev.ticker,
        name: name || prev.name,
        description: description || prev.description,
        methodology: methodology || prev.methodology,
        config
      }));
      toast.success('Configuração gerada com sucesso! Campos preenchidos automaticamente.');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const createIndexMutation = useMutation({
    mutationFn: createIndex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-indices'] });
      setShowCreateForm(false);
      setFormData({
        ticker: '',
        name: '',
        description: '',
        color: '#10b981',
        methodology: '',
        config: null
      });
      setAiPrompt('');
      setScreeningResult(null);
      toast.success('Índice criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const deleteIndexMutation = useMutation({
    mutationFn: deleteIndex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-indices'] });
      setDeletingIndex(null);
      toast.success('Índice deletado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const recreateIndexMutation = useMutation({
    mutationFn: recreateIndex,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-indices'] });
      toast.success(`Índice recriado com sucesso! ${data.details?.companiesSelected || 0} empresas selecionadas.`);
      setRecreatingIndex(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao recriar índice: ${error.message}`);
    }
  });

  const handleViewStatus = async (index: IndexDefinition) => {
    setStatusIndex(index);
    setIsLoadingStatus(true);
    try {
      const status = await fetchIndexStatus(index.id);
      setIndexStatus(status);
    } catch (error) {
      toast.error(`Erro ao buscar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setStatusIndex(null);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleRunJob = async (indexId: string, jobType: 'mark-to-market' | 'screening', fillMissing: boolean = true) => {
    setIsRunningJob(`${indexId}-${jobType}`);
    try {
      const result = await runIndexJob(indexId, jobType, fillMissing);
      toast.success(result.result?.message || 'Job executado com sucesso!');
      // Atualizar status após execução
      if (statusIndex?.id === indexId) {
        const status = await fetchIndexStatus(indexId);
        setIndexStatus(status);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-indices'] });
    } catch (error) {
      toast.error(`Erro ao executar job: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsRunningJob(null);
    }
  };

  const handleRecalculateDividends = async () => {
    if (!statusIndex) return;
    
    setIsRecalculating(true);
    try {
      const result = await recalculateDividends(
        statusIndex.id,
        recalculateStartDate || undefined,
        recalculateDryRun
      );
      
      if (recalculateDryRun) {
        toast.info(`Simulação: ${result.wouldRecalculate} pontos seriam recalculados`);
      } else {
        toast.success(
          `Recálculo concluído: ${result.recalculated} pontos recalculados, ` +
          `${result.dividendsFound} dividendos encontrados`
        );
        // Atualizar status após recálculo
        const status = await fetchIndexStatus(statusIndex.id);
        setIndexStatus(status);
        queryClient.invalidateQueries({ queryKey: ['admin-indices'] });
      }
      setShowRecalculateDialog(false);
    } catch (error) {
      toast.error(`Erro ao recalcular dividendos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleGenerateConfig = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Digite um prompt para gerar a configuração');
      return;
    }

    setIsGenerating(true);
    try {
      await generateConfigMutation.mutateAsync(aiPrompt);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestScreening = async () => {
    if (!formData.config) {
      toast.error('Configure o JSON antes de testar o screening');
      return;
    }

    setIsTestingScreening(true);
    setScreeningResult(null);
    
    try {
      const response = await fetch('/api/admin/indices/test-screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: formData.config })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao executar screening');
      }

      const result = await response.json();
      setScreeningResult(result);
      
      if (result.count === 0) {
        toast.warning('Nenhum ativo foi selecionado. Ajuste os critérios de qualidade.');
      } else {
        toast.success(`${result.count} ativos selecionados!`);
      }
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsTestingScreening(false);
    }
  };

  const handleCreateIndex = async () => {
    if (!formData.ticker || !formData.name || !formData.config) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    await createIndexMutation.mutateAsync(formData);
  };

  const handleEditClick = (index: IndexDefinition) => {
    router.push(`/admin/indices/${index.id}/edit`);
  };


  const handleDeleteClick = (index: IndexDefinition) => {
    setDeletingIndex(index);
  };

  const handleConfirmDelete = async () => {
    if (!deletingIndex) return;
    await deleteIndexMutation.mutateAsync(deletingIndex.id);
  };

  const handleRecreateClick = (index: IndexDefinition) => {
    setRecreatingIndex(index);
  };

  const handleConfirmRecreate = async () => {
    if (!recreatingIndex) return;
    await recreateIndexMutation.mutateAsync(recreatingIndex.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Gerenciar Índices IPJ</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Crie e gerencie índices automatizados usando IA
              </p>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Índice
            </Button>
          </div>
        </div>

        {/* Formulário de Criação */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Criar Novo Índice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Geração via IA */}
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <Label className="text-base font-semibold">Gerar Configuração com IA</Label>
                </div>
                <Textarea
                  placeholder="Ex: Índice de empresas de valor com ROE acima de 15%, top 15 empresas ordenadas por upside, liquidez mínima de R$ 2 milhões..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleGenerateConfig}
                  disabled={isGenerating || !aiPrompt.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Configuração
                    </>
                  )}
                </Button>
              </div>

              {/* Campos Básicos */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ticker *</Label>
                  <Input
                    value={formData.ticker}
                    onChange={(e) => setFormData(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                    placeholder="Ex: IPJ-VALUE"
                  />
                </div>
                <div>
                  <Label>Cor (Hex)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-20"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="#10b981"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Índice Preço Justo Value"
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição breve do índice..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Metodologia</Label>
                <Textarea
                  value={formData.methodology}
                  onChange={(e) => setFormData(prev => ({ ...prev, methodology: e.target.value }))}
                  rows={6}
                />
              </div>

              {/* Editor JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Configuração JSON *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestScreening}
                    disabled={isTestingScreening || !formData.config}
                  >
                    {isTestingScreening ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Testar Screening
                      </>
                    )}
                  </Button>
                </div>
                <JsonEditor
                  value={formData.config}
                  onChange={(config) => {
                    setFormData(prev => ({ ...prev, config }));
                    // Limpar resultado anterior quando config mudar
                    if (screeningResult) {
                      setScreeningResult(null);
                    }
                  }}
                  label="Configuração do Índice"
                  placeholder='{\n  "type": "VALUE",\n  "universe": "B3",\n  ...\n}'
                  minHeight="500px"
                />
              </div>

              {/* Resultado do Screening */}
              {screeningResult && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Resultado do Screening
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Ativos Selecionados</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {screeningResult.count}
                        </p>
                      </div>
                      {screeningResult.count > 0 && (
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Tickers:</p>
                          <div className="flex flex-wrap gap-2">
                            {screeningResult.tickers.map((ticker) => (
                              <Badge
                                key={ticker}
                                variant="outline"
                                className="font-mono"
                              >
                                {ticker}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {screeningResult.count > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold mb-2">Detalhes dos Ativos:</p>
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Ticker</th>
                                <th className="text-left p-2">Nome</th>
                                <th className="text-left p-2">Setor</th>
                                <th className="text-right p-2">Preço</th>
                                <th className="text-right p-2">Upside</th>
                                <th className="text-right p-2">Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {screeningResult.companies.map((company) => (
                                <tr key={company.ticker} className="border-b">
                                  <td className="p-2 font-mono font-semibold">{company.ticker}</td>
                                  <td className="p-2">{company.name}</td>
                                  <td className="p-2 text-gray-600 dark:text-gray-400">
                                    {company.sector || '-'}
                                  </td>
                                  <td className="p-2 text-right">
                                    R$ {company.currentPrice.toFixed(2)}
                                  </td>
                                  <td className={`p-2 text-right ${
                                    company.upside !== null && company.upside > 0
                                      ? 'text-green-600 dark:text-green-400'
                                      : company.upside !== null && company.upside < 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : ''
                                  }`}>
                                    {company.upside !== null ? `${company.upside.toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="p-2 text-right">
                                    {company.overallScore !== null ? company.overallScore.toFixed(1) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {screeningResult.count === 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Nenhum ativo foi selecionado. Verifique:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Critérios de qualidade não estão muito restritivos</li>
                            <li>Liquidez mínima não está muito alta</li>
                            <li>Market Cap mínimo não está muito alto</li>
                            <li>Estratégia selecionada retorna resultados</li>
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Botões */}
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateIndex}
                  disabled={createIndexMutation.isPending || !formData.config}
                >
                  {createIndexMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Índice'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
                      ticker: '',
                      name: '',
                      description: '',
                      color: '#10b981',
                      methodology: '',
                      config: null
                    });
                    setAiPrompt('');
                    setScreeningResult(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Índices */}
        <div className="space-y-4">
          {indices && indices.length > 0 ? (
            indices.map((index) => (
              <Card key={index.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle>{index.name}</CardTitle>
                        <Badge 
                          variant="outline"
                          style={{ borderColor: index.color, color: index.color }}
                        >
                          {index.ticker}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {index.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/indices/${index.ticker}`)}
                      >
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewStatus(index)}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(index)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecreateClick(index)}
                        title="Recriar índice do zero"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-500">
                    Criado em: {new Date(index.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-600 dark:text-gray-400">
                  Nenhum índice criado ainda.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={!!deletingIndex} onOpenChange={(open) => !open && setDeletingIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o índice <strong>{deletingIndex?.ticker}</strong> ({deletingIndex?.name})?
                <br /><br />
                Esta ação não pode ser desfeita e irá remover:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Toda a composição atual</li>
                  <li>Todo o histórico de pontos</li>
                  <li>Todos os logs de rebalanceamento</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteIndexMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteIndexMutation.isPending}
              >
                {deleteIndexMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Confirmação de Recriação */}
        <AlertDialog open={!!recreatingIndex} onOpenChange={(open) => !open && setRecreatingIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recriar Índice do Zero</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja recriar o índice <strong>{recreatingIndex?.ticker}</strong> ({recreatingIndex?.name})?
                <br /><br />
                Esta ação irá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Remover</strong> toda a composição atual</li>
                  <li><strong>Remover</strong> todo o histórico de pontos</li>
                  <li><strong>Remover</strong> todos os logs de rebalanceamento</li>
                  <li><strong>Executar</strong> novo screening com os critérios atuais</li>
                  <li><strong>Criar</strong> nova composição e primeiro ponto histórico (base 100) no dia atual</li>
                </ul>
                <br />
                <strong className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ Todo o histórico será perdido e o índice começará do zero hoje.
                </strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={recreateIndexMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmRecreate}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={recreateIndexMutation.isPending}
              >
                {recreateIndexMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recriando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Recriar Índice
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Status */}
        <Dialog open={!!statusIndex} onOpenChange={(open) => !open && setStatusIndex(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Status do Índice: {statusIndex?.ticker}</DialogTitle>
              <DialogDescription>
                Última atualização e pendências
              </DialogDescription>
            </DialogHeader>
            {isLoadingStatus ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : indexStatus ? (
              <div className="space-y-4 py-4">
                {/* Status Geral */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    {indexStatus.status.isUpToDate ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className="font-semibold">
                      {indexStatus.status.isUpToDate ? 'Atualizado' : 'Pendências Encontradas'}
                    </span>
                  </div>
                  <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <div>
                      <strong>Última atualização:</strong>{' '}
                      {indexStatus.status.lastUpdateDate 
                        ? new Date(indexStatus.status.lastUpdateDate).toLocaleString('pt-BR')
                        : 'Nunca atualizado'}
                    </div>
                    {indexStatus.status.daysSinceLastUpdate !== null && (
                      <div>
                        <strong>Dias desde última atualização:</strong> {indexStatus.status.daysSinceLastUpdate}
                      </div>
                    )}
                    <div>
                      <strong>Dias pendentes:</strong> {indexStatus.status.pendingDaysCount}
                    </div>
                    <div>
                      <strong>Total de pontos históricos:</strong> {indexStatus.status.totalHistoryPoints}
                    </div>
                    <div>
                      <strong>Composição atual:</strong> {indexStatus.status.compositionCount} ativos
                    </div>
                    {indexStatus.status.totalDividendsReceived !== undefined && (
                      <div>
                        <strong>Dividendos recebidos:</strong>{' '}
                        {indexStatus.status.totalDividendsReceived.toFixed(2)} pontos
                      </div>
                    )}
                    {indexStatus.status.pendingDividends?.hasPending && (
                      <div className="mt-2 p-2 rounded bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
                        <strong className="text-yellow-800 dark:text-yellow-200">
                          ⚠️ {indexStatus.status.pendingDividends.count} dividendo(s) pendente(s)
                        </strong>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          Há dividendos no banco que ainda não foram processados. Use &quot;Recalcular Dividendos&quot; para atualizar.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dias Pendentes */}
                {indexStatus.status.pendingDaysCount > 0 && (
                  <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
                    <div className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                      Dias Pendentes ({indexStatus.status.pendingDaysCount})
                    </div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 max-h-40 overflow-y-auto">
                      {indexStatus.status.pendingDays.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {indexStatus.status.pendingDays.map((day: string) => (
                            <Badge key={day} variant="outline" className="text-xs">
                              {new Date(day).toLocaleDateString('pt-BR')}
                            </Badge>
                          ))}
                          {indexStatus.status.hasMorePendingDays && (
                            <Badge variant="outline" className="text-xs">
                              +{indexStatus.status.pendingDaysCount - indexStatus.status.pendingDays.length} mais...
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span>Nenhum dia pendente nos últimos 30 dias</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Cron Status */}
                {indexStatus.cron && (
                  <div className="p-4 rounded-lg border">
                    <div className="font-semibold mb-2">Última Execução do Cron</div>
                    <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                      <div>
                        <strong>Tipo:</strong> {indexStatus.cron.jobType}
                      </div>
                      <div>
                        <strong>Última execução:</strong>{' '}
                        {new Date(indexStatus.cron.lastRunAt).toLocaleString('pt-BR')}
                      </div>
                      <div>
                        <strong>Progresso:</strong> {indexStatus.cron.processedCount}/{indexStatus.cron.totalCount}
                      </div>
                      {indexStatus.cron.hasErrors && (
                        <div className="text-red-600 dark:text-red-400">
                          <strong>Erros:</strong> {indexStatus.cron.errors.length}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => handleRunJob(statusIndex!.id, 'mark-to-market', true)}
                    disabled={isRunningJob === `${statusIndex!.id}-mark-to-market`}
                    className="flex-1"
                  >
                    {isRunningJob === `${statusIndex!.id}-mark-to-market` ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Executando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Executar Mark-to-Market
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRunJob(statusIndex!.id, 'screening', false)}
                    disabled={isRunningJob === `${statusIndex!.id}-screening`}
                    className="flex-1"
                  >
                    {isRunningJob === `${statusIndex!.id}-screening` ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Executando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Executar Screening
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Dialog de Recalcular Dividendos */}
        <Dialog open={showRecalculateDialog} onOpenChange={setShowRecalculateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recalcular Dividendos: {statusIndex?.ticker}</DialogTitle>
              <DialogDescription>
                Recalcula pontos históricos considerando dividendos atualizados no banco de dados.
                Útil quando dividendos são adicionados após a execução do CRON.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="startDate">Data Inicial (opcional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={recalculateStartDate}
                  onChange={(e) => setRecalculateStartDate(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco para recalcular desde o início do histórico
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="dryRun"
                  checked={recalculateDryRun}
                  onChange={(e) => setRecalculateDryRun(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="dryRun" className="cursor-pointer">
                  Apenas simular (Dry Run)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRecalculateDialog(false);
                  setRecalculateStartDate('');
                  setRecalculateDryRun(false);
                }}
                disabled={isRecalculating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRecalculateDividends}
                disabled={isRecalculating}
              >
                {isRecalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recalculando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {recalculateDryRun ? 'Simular' : 'Recalcular'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

