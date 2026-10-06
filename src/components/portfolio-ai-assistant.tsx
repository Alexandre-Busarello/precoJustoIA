'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2 } from 'lucide-react';

interface Asset {
  ticker: string;
  targetAllocation: number;
}

interface PortfolioAIAssistantProps {
  onAssetsGenerated: (assets: Asset[]) => void;
  /** Bloqueia enquanto a tela salva outra alteração. */
  disabled?: boolean;
  /** Recurso Premium indisponível para o usuário. */
  locked?: boolean;
  currentAssets?: Asset[];
}

export function PortfolioAIAssistant({
  onAssetsGenerated,
  disabled: busy,
  locked = false,
  currentAssets = [],
}: PortfolioAIAssistantProps) {
  const disabled = busy || locked;
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
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
  ] : [
    // Exemplos para criação nova (quando não há carteira)
    "Empresas sólidas com dividend yield acima da Selic",
    "Mix entre ações de grandes empresas e fundos imobiliários",
    "Empresas de energia elétrica e saneamento",
    "Empresas com P/VP baixo e ROE acima de 15%",
  ];

  // Mutation for generating portfolio with AI
  const generatePortfolioMutation = useMutation({
    mutationFn: async ({ promptText, assets }: { promptText: string; assets: Asset[] }) => {
      const response = await fetch('/api/portfolio/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: promptText.trim(),
          currentAssets: assets.length > 0 ? assets : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar carteira');
      }

      const data = await response.json();
      
      if (!data.success || !data.assets || data.assets.length === 0) {
        throw new Error('Nenhum ativo foi gerado pela IA');
      }

      return data;
    },
    onSuccess: (data) => {
      setGeneratedAssets(data.assets);
      setAiReasoning(data.reasoning || 'Carteira configurada pela IA');
      setDataSource(data.dataSource || 'general');
      setModifications(data.modifications || []);
      setShowResults(true);

      const screeningInfo = data.screeningUsed 
        ? ` (${data.screeningResults} empresas analisadas pelo screening)`
        : '';

      toast({
        title: 'Composição sugerida',
        description: `${data.assets.length} ativos sugeridos pela IA${screeningInfo}`,
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao gerar carteira:', error);
      toast({
        title: 'Erro na geração',
        description: error.message || 'Erro ao processar com IA',
        variant: 'destructive'
      });
    }
  });

  const handleGeneratePortfolio = () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt obrigatório',
        description: 'Descreva como você quer sua carteira',
        variant: 'destructive'
      });
      return;
    }

    setShowResults(false);
    generatePortfolioMutation.mutate({ promptText: prompt, assets: currentAssets });
  };

  // Loading state from mutation
  const loading = generatePortfolioMutation.isPending;

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
      title: 'Ativos aplicados',
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
          // Destaque temporário
          element.classList.add('ring-2', 'ring-ring', 'rounded-lg');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-ring', 'rounded-lg');
          }, 2000);
        }
      }, 500);
    }
  }, []);

  const ACTION_LABELS: Record<string, string> = {
    added: 'Adicionado',
    removed: 'Removido',
    replaced: 'Substituído',
    rebalanced: 'Peso ajustado',
  };
  const DATA_SOURCE_LABELS: Record<string, string> = {
    screening: 'Com base em filtros fundamentalistas',
    specific: 'Com base nos ativos citados',
    general: 'Com base em conhecimento geral',
  };
  const isEditing = currentAssets.length > 0;

  return (
    <div id="ai-assistant" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isEditing
          ? 'Descreva a mudança (trocar, adicionar ou remover ativos). A IA sugere uma nova composição para você revisar.'
          : 'Descreva a estratégia em texto livre. A IA sugere uma composição para você revisar antes de aplicar.'}
      </p>

      {!showResults ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ai-assistant-prompt">{isEditing ? 'O que mudar na carteira' : 'Estratégia'}</Label>
            <Textarea
              id="ai-assistant-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isEditing
                  ? 'Ex.: Troque o SMAL11 por BOVA11 e adicione WEGE3'
                  : 'Ex.: 60% em ações de bancos e energia, 40% em FIIs de logística'
              }
              rows={3}
              disabled={loading || disabled}
              className="resize-none"
            />
            {isEditing && (
              <div className="flex flex-wrap gap-1 pt-1">
                {currentAssets.map((asset) => (
                  <Badge key={asset.ticker} variant="neutral" className="tabular-nums">
                    {asset.ticker} {formatPct(asset.targetAllocation)}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Exemplos</p>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left text-xs md:min-h-8"
                  onClick={() => setPrompt(example)}
                  disabled={loading || disabled}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleGeneratePortfolio}
            disabled={loading || disabled || !prompt.trim()}
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Gerando sugestão
              </>
            ) : (
              'Sugerir composição com IA'
            )}
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Composição sugerida pela IA</h4>

          {aiReasoning && (
            <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
              <div className="rounded-lg border border-border">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">Racional da IA</span>
                      {modifications.length > 0 && isEditing && (
                        <Badge variant="neutral">{modifications.length} mudanças</Badge>
                      )}
                    </span>
                    <ChevronDown
                      className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isReasoningOpen && 'rotate-180')}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-3 border-t border-border px-3 py-3 text-sm">
                  <p className="leading-relaxed text-muted-foreground">{aiReasoning}</p>

                  {modifications.length > 0 && isEditing && (
                    <ul className="space-y-1.5">
                      {modifications.map((mod, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs">
                          <Badge variant="neutral" className="shrink-0">
                            {ACTION_LABELS[mod.action] ?? mod.action}
                          </Badge>
                          <span className="min-w-0 text-muted-foreground">
                            <span className="font-medium text-foreground">{mod.ticker}</span> · {mod.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {dataSource && DATA_SOURCE_LABELS[dataSource] && (
                    <p className="text-xs text-muted-foreground">{DATA_SOURCE_LABELS[dataSource]}</p>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          <div className="rounded-lg border border-border">
            <ul className="divide-y divide-border">
              {generatedAssets.map((asset) => (
                <li key={asset.ticker} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{asset.ticker}</span>
                  <span className="tabular-nums text-muted-foreground">{formatPct(asset.targetAllocation)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium tabular-nums text-foreground">{formatPct(totalAllocation)}</span>
            </div>
          </div>

          {Math.abs(totalAllocation - 1) > 0.01 && (
            <p className="text-xs text-muted-foreground">
              As porcentagens serão ajustadas proporcionalmente para somar 100%.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Composição gerada por IA a partir da sua descrição. Não é recomendação de investimento.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
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
              Descrever de novo
            </Button>
            <Button type="button" onClick={handleApplyAssets}>
              Aplicar ativos
            </Button>
          </div>
        </div>
      )}

      {locked && (
        <p className="text-sm text-muted-foreground">A sugestão de composição por IA está disponível no Premium.</p>
      )}
    </div>
  );
}
