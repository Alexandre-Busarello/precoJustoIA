'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatPct } from '@/lib/format';

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
        title: 'Tickers lidos',
        description: `${assets.length} ativos com ${formatPct(equalAllocation)} cada`,
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
        description: `Tickers não encontrados: ${invalidTickers.join(', ')}`,
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
      title: 'Ativos aplicados',
      description: 'Os ativos foram adicionados à sua carteira',
    });
  };

  const totalAllocation = parsedAssets.reduce((sum, asset) => sum + asset.targetAllocation, 0);

  return (
    <div className="space-y-4">
      {!showPreview ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-tickers">Tickers separados por vírgula</Label>
            <Textarea
              id="bulk-tickers"
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="PETR4, VALE3, ITUB4, BBDC4, HGLG11"
              rows={3}
              autoCapitalize="characters"
              className="resize-none font-mono"
            />
            <p className="text-xs text-muted-foreground">
              O peso é dividido igualmente e pode ser ajustado depois. Tickers repetidos são ignorados.
            </p>
          </div>

          <Button type="button" onClick={parseTickersInput} disabled={!tickersInput.trim()} variant="outline">
            Ler tickers
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border">
            <ul className="max-h-60 divide-y divide-border overflow-y-auto">
              {parsedAssets.map((asset) => (
                <li key={asset.ticker} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono font-medium text-foreground">{asset.ticker}</span>
                  <span className="tabular-nums text-muted-foreground">{formatPct(asset.targetAllocation)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total ({parsedAssets.length} ativos)</span>
              <span className="font-medium tabular-nums text-foreground">{formatPct(totalAllocation)}</span>
            </div>
          </div>

          {Math.abs(totalAllocation - 1) > 0.01 && (
            <p className="text-xs text-muted-foreground">
              As porcentagens serão ajustadas proporcionalmente para somar 100%.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowPreview(false);
                setParsedAssets([]);
              }}
            >
              Editar lista
            </Button>
            <Button type="button" onClick={handleApplyAssets}>
              Aplicar ativos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
