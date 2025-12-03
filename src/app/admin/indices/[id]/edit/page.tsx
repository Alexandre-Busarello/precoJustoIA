/**
 * Admin Panel: Editar Índice IPJ
 * Página dedicada para edição completa de um índice
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Save, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { JsonEditor } from '@/components/admin/json-editor';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

async function fetchIndex(id: string): Promise<IndexDefinition> {
  const response = await fetch(`/api/admin/indices/${id}`);
  if (!response.ok) {
    throw new Error('Erro ao buscar índice');
  }
  const data = await response.json();
  return data.index;
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

async function updateIndex(id: string, indexData: any): Promise<void> {
  const response = await fetch(`/api/admin/indices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(indexData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao atualizar índice');
  }
}

export default function EditIndexPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const indexId = params.id as string;

  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
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

  const { data: index, isLoading } = useQuery<IndexDefinition>({
    queryKey: ['admin-index', indexId],
    queryFn: () => fetchIndex(indexId),
    enabled: !!indexId
  });

  // Preencher formulário quando índice for carregado
  useEffect(() => {
    if (index) {
      setFormData({
        ticker: index.ticker,
        name: index.name,
        description: index.description || '',
        color: index.color || '#10b981',
        methodology: index.methodology || '',
        config: index.config || null
      });
    }
  }, [index]);

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

  const updateIndexMutation = useMutation({
    mutationFn: (data: any) => updateIndex(indexId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-indices'] });
      queryClient.invalidateQueries({ queryKey: ['admin-index', indexId] });
      toast.success('Índice atualizado com sucesso!');
      router.push('/admin/indices');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

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

  const handleSave = async () => {
    if (!formData.ticker || !formData.name || !formData.config) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    await updateIndexMutation.mutateAsync(formData);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!index) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400 text-center">
              Índice não encontrado.
            </p>
            <Button 
              onClick={() => router.push('/admin/indices')}
              className="mt-4 w-full"
            >
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/indices')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Editar Índice: {index.ticker}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Atualize as configurações do índice
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={updateIndexMutation.isPending || !formData.config}
            >
              {updateIndexMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Formulário */}
        <div className="space-y-6">
          {/* Geração via IA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Gerar Configuração com IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Campos Básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  placeholder="Metodologia detalhada do índice..."
                  rows={8}
                />
              </div>
            </CardContent>
          </Card>

          {/* Editor JSON */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Configuração JSON *</CardTitle>
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
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

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

          {/* Botões de Ação */}
          <div className="flex justify-end gap-4 pb-8">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/indices')}
              disabled={updateIndexMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateIndexMutation.isPending || !formData.config}
            >
              {updateIndexMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

