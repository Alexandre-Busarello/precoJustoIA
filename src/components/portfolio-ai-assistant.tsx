'use client';

import { useState, useEffect, cache } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Lightbulb,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface Asset {
  ticker: string;
  targetAllocation: number;
}

interface PortfolioAIAssistantProps {
  onAssetsGenerated: (assets: Asset[]) => void;
  disabled?: boolean;
  currentAssets?: Asset[];
}

export function PortfolioAIAssistant({ onAssetsGenerated, disabled, currentAssets = [] }: PortfolioAIAssistantProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<Asset[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('');
  const [modifications, setModifications] = useState<Array<{
    action: string;
    ticker: string;
    reason: string;
  }>>([]);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  const examplePrompts = currentAssets.length > 0 ? [
    // Exemplos para iteração (quando há carteira atual)
    `Troque o ${currentAssets[0]?.ticker || 'SMAL11'} por BOVA11`,
    "Adicione WEGE3 e RENT3 na carteira",
    "Troque todos os bancos por seguradoras",
    "Remova os FIIs e adicione mais ações",
    "Substitua as ações de commodities por empresas de tecnologia",
    "Adicione 20% em empresas de energia renovável"
  ] : [
    // Exemplos para criação nova (quando não há carteira)
    "Carteira conservadora com empresas sólidas e bom dividend yield",
    "Portfolio agressivo focado em small caps com alto crescimento",
    "Carteira de dividendos com empresas de qualidade do setor financeiro",
    "Mix balanceado entre ações blue chips e fundos imobiliários",
    "Carteira setorial focada em empresas de energia renovável e saneamento",
    "Empresas baratas com P/VP baixo e boa rentabilidade"
  ];

  const handleGeneratePortfolio = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt obrigatório',
        description: 'Descreva como você quer sua carteira',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setShowResults(false);

    try {
      const response = await cache(async() => fetch('/api/portfolio/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt.trim(),
          currentAssets: currentAssets.length > 0 ? currentAssets : undefined
        })
      }))();

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar carteira');
      }

      const data = await response.json();
      
      if (!data.success || !data.assets || data.assets.length === 0) {
        throw new Error('Nenhum ativo foi gerado pela IA');
      }

      setGeneratedAssets(data.assets);
      setAiReasoning(data.reasoning || 'Carteira configurada pela IA');
      setDataSource(data.dataSource || 'general');
      setModifications(data.modifications || []);
      setShowResults(true);

      const screeningInfo = data.screeningUsed 
        ? ` (${data.screeningResults} empresas analisadas pelo screening)`
        : '';

      toast({
        title: 'Carteira gerada!',
        description: `${data.assets.length} ativos configurados pela IA${screeningInfo}`,
      });

    } catch (error) {
      console.error('Erro ao gerar carteira:', error);
      toast({
        title: 'Erro na geração',
        description: error instanceof Error ? error.message : 'Erro ao processar com IA',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAssets = () => {
    onAssetsGenerated(generatedAssets);
    setShowResults(false);
    setPrompt('');
    setGeneratedAssets([]);
    setAiReasoning('');
    setDataSource('');
    setModifications([]);
    setIsReasoningOpen(false);
    
    toast({
      title: 'Ativos aplicados!',
      description: 'Os ativos foram adicionados à sua carteira',
    });
  };

  const totalAllocation = generatedAssets.reduce((sum, asset) => sum + asset.targetAllocation, 0);

  // Scroll to component when hash is present
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#ai-assistant') {
      setTimeout(() => {
        const element = document.getElementById('ai-assistant');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a subtle highlight effect
          element.classList.add('ring-2', 'ring-primary/50', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary/50', 'ring-offset-2');
          }, 2000);
        }
      }, 500);
    }
  }, []);

  return (
    <Card 
      id="ai-assistant"
      className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Bot className="h-5 w-5" />
          {currentAssets.length > 0 ? 'Modificar Carteira com IA' : 'Assistente IA para Carteiras'}
          <Sparkles className="h-4 w-4 text-amber-500" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {currentAssets.length > 0 
            ? 'Modifique sua carteira atual usando linguagem natural (trocar, adicionar, remover ativos)'
            : 'Descreva sua estratégia em linguagem natural e deixe a IA configurar sua carteira'
          }
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!showResults ? (
          <>
            {/* Prompt Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {currentAssets.length > 0 ? 'Como quer modificar sua carteira?' : 'Como você quer sua carteira?'}
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={currentAssets.length > 0 
                  ? "Ex: Troque o SMAL11 por BOVA11, ou Adicione WEGE3 e RENT3, ou Troque todos os bancos por seguradoras..."
                  : "Ex: Carteira conservadora com 60% blue chips (bancos e petróleo) e 40% FIIs de shoppings..."
                }
                rows={3}
                disabled={loading || disabled}
                className="resize-none"
              />
              
              {currentAssets.length > 0 && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Carteira Atual ({currentAssets.length} ativos):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentAssets.map((asset, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {asset.ticker} ({(asset.targetAllocation * 100).toFixed(1)}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Example Prompts */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {currentAssets.length > 0 ? 'Exemplos de modificações:' : 'Exemplos:'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {examplePrompts.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3 text-left justify-start whitespace-normal"
                    onClick={() => setPrompt(example)}
                    disabled={loading || disabled}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGeneratePortfolio}
              disabled={loading || disabled || !prompt.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando carteira...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Carteira com IA
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {/* Results */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">Carteira Gerada pela IA</h4>
              </div>

              {/* AI Reasoning Section - Collapsible */}
              {aiReasoning && (
                <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-4 h-auto hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      >
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-blue-600" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                              {isReasoningOpen ? 'Racional da IA' : 'Ver Racional da IA'}
                            </span>
                            {!isReasoningOpen && (
                              <span className="text-xs text-blue-700 dark:text-blue-300">
                                Clique para ver a explicação detalhada
                              </span>
                            )}
                          </div>
                          {modifications.length > 0 && currentAssets.length > 0 && (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
                              {modifications.length} modificações
                            </Badge>
                          )}
                        </div>
                        {isReasoningOpen ? (
                          <ChevronDown className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-blue-600" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="px-4 pb-4">
                      <div className="space-y-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                          {aiReasoning}
                        </p>
                        
                        {/* Detailed Modifications */}
                        {modifications.length > 0 && currentAssets.length > 0 && (
                          <div className="space-y-2">
                            <h6 className="font-medium text-blue-900 dark:text-blue-100 text-xs">
                              Modificações Realizadas:
                            </h6>
                            <div className="space-y-1">
                              {modifications.map((mod, index) => (
                                <div key={index} className="flex items-start gap-2 text-xs">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs flex-shrink-0 ${
                                      mod.action === 'added' ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300' :
                                      mod.action === 'removed' ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300' :
                                      mod.action === 'replaced' ? 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300' :
                                      'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300'
                                    }`}
                                  >
                                    {mod.action === 'added' && '+ Adicionado'}
                                    {mod.action === 'removed' && '- Removido'}
                                    {mod.action === 'replaced' && '↔ Substituído'}
                                    {mod.action === 'rebalanced' && '⚖ Rebalanceado'}
                                  </Badge>
                                  <div className="flex-1">
                                    <span className="font-medium text-blue-900 dark:text-blue-100">
                                      {mod.ticker}
                                    </span>
                                    <span className="text-blue-700 dark:text-blue-300 ml-1">
                                      - {mod.reason}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {dataSource && (
                          <div className="flex items-center gap-1 mt-2">
                            <Badge 
                              variant="outline" 
                              className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                            >
                              {dataSource === 'screening' && 'Baseado em screening fundamentalista'}
                              {dataSource === 'specific' && 'Baseado em ativos específicos'}
                              {dataSource === 'general' && 'Baseado em conhecimento geral'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border">
                <div className="space-y-3">
                  {generatedAssets.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="font-medium">{asset.ticker}</span>
                      <Badge variant="outline">
                        {(asset.targetAllocation * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="border-t mt-4 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total:</span>
                    <Badge 
                      variant={Math.abs(totalAllocation - 1) < 0.01 ? 'default' : 'destructive'}
                    >
                      {(totalAllocation * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>

              {Math.abs(totalAllocation - 1) > 0.01 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Alocação será normalizada
                    </p>
                    <p className="text-amber-700 dark:text-amber-300">
                      As porcentagens serão ajustadas automaticamente para somar 100%
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleApplyAssets}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aplicar Ativos
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowResults(false);
                    setGeneratedAssets([]);
                    setAiReasoning('');
                    setDataSource('');
                    setModifications([]);
                    setIsReasoningOpen(false);
                  }}
                >
                  Gerar Novamente
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Premium Notice */}
        {disabled && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Recurso Premium
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              O assistente IA está disponível apenas para usuários Premium
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}