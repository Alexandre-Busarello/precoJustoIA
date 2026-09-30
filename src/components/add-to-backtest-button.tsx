'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BacktestConfigSelector } from '@/components/backtest-config-selector';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { BarChart3, Check, Loader2, Lock, Settings } from 'lucide-react';

const ICON = 'size-4';

// Interface para o ativo
interface AssetData {
  ticker: string;
  companyName?: string;
  sector?: string;
  currentPrice?: number;
  /** Quando FII, backtest fica indisponível */
  assetType?: string;
}

interface AddToBacktestButtonProps {
  asset: AssetData;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function AddToBacktestButton({ 
  asset, 
  variant = 'outline', 
  size = 'sm',
  showLabel = true,
  className = ''
}: AddToBacktestButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { isPremium, isLoading: isPremiumLoading } = usePremiumStatus();
  const [isAdded, setIsAdded] = useState(false);
  const [showConfigSelector, setShowConfigSelector] = useState(false);

  // Verificar se já está na lista
  const checkIfAdded = useCallback(() => {
    try {
      const stored = localStorage.getItem('backtest-preconfigured-assets');
      if (stored) {
        const assets = JSON.parse(stored);
        return assets.some((a: AssetData) => a.ticker === asset.ticker);
      }
    } catch (error) {
      console.error('Erro ao verificar localStorage:', error);
    }
    return false;
  }, [asset.ticker]);

  // Abrir modal de seleção de configuração
  const handleAddToBacktest = () => {
    // Verificar se usuário está logado
    if (!session?.user?.id) {
      router.push('/login?callbackUrl=%2Fbacktest');
      return;
    }

    // Verificar se é Premium
    if (!isPremium) {
      router.push('/checkout?product=backtest');
      return;
    }

    setShowConfigSelector(true);
  };

  // Callback quando configuração é selecionada
  const handleConfigSelected = () => {
    setIsAdded(true);
    setShowConfigSelector(false);
    // Não navegar automaticamente - usuário permanece na página atual
  };

  // Navegar para página de backtest
  const handleGoToBacktest = () => {
    router.push('/backtest');
  };

  // Verificar estado inicial
  useEffect(() => {
    setIsAdded(checkIfAdded());
  }, [checkIfAdded]);

  if (asset.assetType === 'FII') {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
        title="Backtest indisponível para FIIs (sem histórico de preços diário adequado)"
        aria-label={showLabel ? undefined : 'Backtest indisponível para FIIs'}
      >
        <BarChart3 className={ICON} strokeWidth={1.75} aria-hidden="true" />
        {showLabel && 'Backtest indisponível'}
      </Button>
    );
  }

  // Se não há sessão, mostrar botão de login
  if (!session?.user?.id) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => router.push('/login?callbackUrl=%2Fbacktest')}
        className={className}
        aria-label={showLabel ? undefined : 'Entrar para usar o backtest'}
      >
        <BarChart3 className={ICON} strokeWidth={1.75} aria-hidden="true" />
        {showLabel && 'Entrar para testar'}
      </Button>
    );
  }

  // Se não é Premium, mostrar botão de upgrade
  if (isPremiumLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
        aria-label={showLabel ? undefined : 'Carregando'}
      >
        <Loader2 className={`${ICON} animate-spin`} strokeWidth={1.75} aria-hidden="true" />
        {showLabel && 'Carregando'}
      </Button>
    );
  }

  if (!isPremium) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => router.push('/dashboard?upgrade=backtest')}
        className={className}
        aria-label={showLabel ? undefined : 'Backtest (Premium)'}
      >
        <Lock className={ICON} strokeWidth={1.75} aria-hidden="true" />
        {showLabel && 'Backtest (Premium)'}
      </Button>
    );
  }

  // Botão principal
  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant={variant}
          size={size}
          onClick={handleAddToBacktest}
          className={className}
          aria-label={showLabel ? undefined : isAdded ? 'Adicionado ao backtest' : 'Adicionar ao backtest'}
        >
          {isAdded ? (
            <Check className={ICON} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Settings className={ICON} strokeWidth={1.75} aria-hidden="true" />
          )}
          {showLabel && <span>{isAdded ? 'Adicionado ao backtest' : 'Adicionar ao backtest'}</span>}
        </Button>

        {/* Contador de ativos (se houver) */}
        {isAdded && (
          <BacktestCounter onGoToBacktest={handleGoToBacktest} />
        )}
      </div>

      {/* Modal de seleção de configuração */}
      <BacktestConfigSelector
        isOpen={showConfigSelector}
        onClose={() => setShowConfigSelector(false)}
        asset={asset}
        onConfigSelected={handleConfigSelected}
      />
    </>
  );
}

// Componente auxiliar para mostrar contador
function BacktestCounter({ onGoToBacktest }: { onGoToBacktest: () => void }) {
  const [count, setCount] = useState(0);

  // Atualizar contador
  useEffect(() => {
    try {
      const stored = localStorage.getItem('backtest-preconfigured-assets');
      if (stored) {
        const assets = JSON.parse(stored);
        setCount(assets.length);
      }
    } catch (error) {
      console.error('Erro ao contar ativos:', error);
    }
  }, []);

  if (count === 0) return null;

  return (
    <Button variant="ghost" size="sm" onClick={onGoToBacktest}>
      <Badge variant="brand" className="tabular-nums">
        {count}
      </Badge>
      Ver backtest
    </Button>
  );
}

// Hook para gerenciar estado global dos ativos
export function useBacktestAssets() {
  const [assets, setAssets] = useState<AssetData[]>([]);

  const loadAssets = () => {
    try {
      const stored = localStorage.getItem('backtest-preconfigured-assets');
      if (stored) {
        setAssets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar ativos:', error);
      setAssets([]);
    }
  };

  const addAsset = (asset: AssetData) => {
    try {
      const stored = localStorage.getItem('backtest-preconfigured-assets');
      const currentAssets: AssetData[] = stored ? JSON.parse(stored) : [];
      
      if (!currentAssets.find(a => a.ticker === asset.ticker)) {
        currentAssets.push(asset);
        localStorage.setItem('backtest-preconfigured-assets', JSON.stringify(currentAssets));
        setAssets(currentAssets);
      }
    } catch (error) {
      console.error('Erro ao adicionar ativo:', error);
    }
  };

  const removeAsset = (ticker: string) => {
    try {
      const stored = localStorage.getItem('backtest-preconfigured-assets');
      let currentAssets: AssetData[] = stored ? JSON.parse(stored) : [];
      
      currentAssets = currentAssets.filter(a => a.ticker !== ticker);
      localStorage.setItem('backtest-preconfigured-assets', JSON.stringify(currentAssets));
      setAssets(currentAssets);
    } catch (error) {
      console.error('Erro ao remover ativo:', error);
    }
  };

  const clearAssets = () => {
    try {
      localStorage.removeItem('backtest-preconfigured-assets');
      setAssets([]);
    } catch (error) {
      console.error('Erro ao limpar ativos:', error);
    }
  };

  const hasAsset = (ticker: string) => {
    return assets.some(a => a.ticker === ticker);
  };

  return {
    assets,
    loadAssets,
    addAsset,
    removeAsset,
    clearAssets,
    hasAsset,
    count: assets.length
  };
}
