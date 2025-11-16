'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Info
} from 'lucide-react';

interface Asset {
  ticker: string;
  targetAllocation: number;
}

interface PortfolioBulkAssetInputProps {
  onAssetsGenerated: (assets: Asset[]) => void;
}

export function PortfolioBulkAssetInput({ onAssetsGenerated }: PortfolioBulkAssetInputProps) {
  const { toast } = useToast();
  const [tickersInput, setTickersInput] = useState('');
  const [parsedAssets, setParsedAssets] = useState<Asset[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const parseTickersInput = () => {
    if (!tickersInput.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Digite os tickers separados por vírgula',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Limpar e dividir por vírgula
      const tickers = tickersInput
        .split(',')
        .map(ticker => ticker.trim().toUpperCase())
        .filter(ticker => ticker.length > 0);

      if (tickers.length === 0) {
        throw new Error('Nenhum ticker válido encontrado');
      }

      // Remover duplicatas
      const uniqueTickers = [...new Set(tickers)];
      
      if (uniqueTickers.length !== tickers.length) {
        toast({
          title: 'Tickers duplicados removidos',
          description: `${tickers.length - uniqueTickers.length} ticker(s) duplicado(s) foram removidos`,
        });
      }

      // Validar formato básico dos tickers (4-6 caracteres alfanuméricos)
      const invalidTickers = uniqueTickers.filter(ticker => 
        !/^[A-Z0-9]{4,6}$/.test(ticker)
      );

      if (invalidTickers.length > 0) {
        toast({
          title: 'Tickers inválidos encontrados',
          description: `Formato inválido: ${invalidTickers.join(', ')}`,
          variant: 'destructive'
        });
        return;
      }

      // Criar ativos com distribuição igual
      const equalAllocation = 1 / uniqueTickers.length;
      const assets: Asset[] = uniqueTickers.map(ticker => ({
        ticker,
        targetAllocation: equalAllocation
      }));

      setParsedAssets(assets);
      setShowPreview(true);

      toast({
        title: 'Tickers processados!',
        description: `${assets.length} ativos com ${(equalAllocation * 100).toFixed(1)}% cada`,
      });

    } catch (error) {
      console.error('Erro ao processar tickers:', error);
      toast({
        title: 'Erro no processamento',
        description: error instanceof Error ? error.message : 'Erro ao processar tickers',
        variant: 'destructive'
      });
    }
  };

  const handleApplyAssets = async () => {
    // Validar todos os tickers antes de aplicar
    const invalidTickers: string[] = [];
    const validAssets: Asset[] = [];

    for (const asset of parsedAssets) {
      try {
        const validationResponse = await fetch('/api/ticker/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: asset.ticker }),
        });

        const validationData = await validationResponse.json();

        if (!validationData.valid) {
          invalidTickers.push(asset.ticker);
        } else {
          validAssets.push(asset);
        }
      } catch (error) {
        console.error(`Erro ao validar ticker ${asset.ticker}:`, error);
        invalidTickers.push(asset.ticker);
      }
    }

    // Se há tickers inválidos, mostrar erro
    if (invalidTickers.length > 0) {
      toast({
        title: 'Tickers inválidos encontrados',
        description: `Os seguintes tickers não foram encontrados no Yahoo Finance: ${invalidTickers.join(', ')}`,
        variant: 'destructive',
      });

      // Se há tickers válidos, atualizar a lista apenas com os válidos
      if (validAssets.length > 0) {
        const equalAllocation = 1 / validAssets.length;
        const updatedAssets = validAssets.map(asset => ({
          ...asset,
          targetAllocation: equalAllocation
        }));
        setParsedAssets(updatedAssets);
        toast({
          title: 'Lista atualizada',
          description: `Apenas os tickers válidos foram mantidos (${validAssets.length} ativos)`,
        });
      } else {
        // Se nenhum ticker é válido, limpar tudo
        setShowPreview(false);
        setParsedAssets([]);
      }
      return;
    }

    // Todos os tickers são válidos, aplicar
    onAssetsGenerated(parsedAssets);
    setShowPreview(false);
    setTickersInput('');
    setParsedAssets([]);
    
    toast({
      title: 'Ativos aplicados!',
      description: 'Os ativos foram adicionados à sua carteira',
    });
  };

  const totalAllocation = parsedAssets.reduce((sum, asset) => sum + asset.targetAllocation, 0);

  return (
    <Card className="border-dashed border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <FileText className="h-5 w-5" />
          Adicionar Múltiplos Ativos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Digite os tickers separados por vírgula para adicionar vários ativos de uma vez
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!showPreview ? (
          <>
            {/* Bulk Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Tickers (separados por vírgula)
              </label>
              <Textarea
                value={tickersInput}
                onChange={(e) => setTickersInput(e.target.value)}
                placeholder="PETR4, VALE3, ITUB4, BBDC4, ABEV3, HGLG11, XPML11"
                rows={3}
                className="resize-none font-mono"
              />
              <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-medium">Dicas:</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>• Separe os tickers por vírgula</li>
                    <li>• A alocação será distribuída igualmente entre todos</li>
                    <li>• Você poderá ajustar as % individualmente depois</li>
                    <li>• Tickers duplicados serão removidos automaticamente</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Parse Button */}
            <Button 
              onClick={parseTickersInput}
              disabled={!tickersInput.trim()}
              className="w-full"
              size="lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Processar Tickers
            </Button>
          </>
        ) : (
          <>
            {/* Preview Results */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">Ativos Processados</h4>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {parsedAssets.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="font-mono font-medium">{asset.ticker}</span>
                      <Badge variant="outline">
                        {(asset.targetAllocation * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="border-t mt-3 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total ({parsedAssets.length} ativos):
                    </span>
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

              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Próximos passos
                    </p>
                    <p className="text-green-700 dark:text-green-300">
                      Após aplicar, você poderá ajustar as alocações individuais na aba "Configuração"
                    </p>
                  </div>
                </div>
              </div>

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
                    setShowPreview(false);
                    setParsedAssets([]);
                  }}
                >
                  Editar Lista
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}