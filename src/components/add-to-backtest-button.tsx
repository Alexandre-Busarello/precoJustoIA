'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Plus, 
  Check, 
  Crown,
  Loader2
} from 'lucide-react';

// Interface para o ativo
interface AssetData {
  ticker: string;
  companyName?: string;
  sector?: string;
  currentPrice?: number;
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
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar se já está na lista
  const checkIfAdded = () => {
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
  };

  // Adicionar/remover ativo
  const handleToggleAsset = async () => {
    // Verificar se usuário está logado
    if (!session?.user?.id) {
      router.push('/login?redirect=/backtest');
      return;
    }

    // Verificar se é Premium (simulação - em produção usar hook real)
    const isPremium = true; // Substituir por verificação real
    if (!isPremium) {
      router.push('/dashboard?upgrade=backtest');
      return;
    }

    setIsLoading(true);

    try {
      const stored = localStorage.getItem('backtest-preconfigured-assets');
      const assets: AssetData[] = stored ? JSON.parse(stored) : [];

      const existingIndex = assets.findIndex(a => a.ticker === asset.ticker);

      if (existingIndex >= 0) {
        // Remover se já existe
        assets.splice(existingIndex, 1);
        setIsAdded(false);
      } else {
        // Adicionar se não existe
        if (assets.length >= 20) {
          alert('Máximo de 20 ativos por carteira de backtesting');
          return;
        }
        
        assets.push({
          ticker: asset.ticker,
          companyName: asset.companyName,
          sector: asset.sector,
          currentPrice: asset.currentPrice
        });
        setIsAdded(true);
      }

      localStorage.setItem('backtest-preconfigured-assets', JSON.stringify(assets));

      // Feedback visual
      setTimeout(() => {
        setIsAdded(checkIfAdded());
      }, 100);

    } catch (error) {
      console.error('Erro ao gerenciar ativo no backtest:', error);
      alert('Erro ao adicionar ativo ao backtest');
    } finally {
      setIsLoading(false);
    }
  };

  // Navegar para página de backtest
  const handleGoToBacktest = () => {
    router.push('/backtest');
  };

  // Verificar estado inicial
  useEffect(() => {
    setIsAdded(checkIfAdded());
  }, []);

  // Se não há sessão, mostrar botão de login
  if (!session?.user?.id) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => router.push('/login?redirect=/backtest')}
        className={className}
      >
        <BarChart3 className="w-4 h-4 mr-2" />
        {showLabel && 'Fazer Login'}
      </Button>
    );
  }

  // Se não é Premium, mostrar botão de upgrade
  const isPremium = true; // Substituir por verificação real
  if (!isPremium) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => router.push('/dashboard?upgrade=backtest')}
        className={`${className} border-yellow-300 text-yellow-700 hover:bg-yellow-50`}
      >
        <Crown className="w-4 h-4 mr-2" />
        {showLabel && 'Premium'}
      </Button>
    );
  }

  // Botão principal
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isAdded ? 'default' : variant}
        size={size}
        onClick={handleToggleAsset}
        disabled={isLoading}
        className={`${className} ${isAdded ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : isAdded ? (
          <Check className="w-4 h-4 mr-2" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        
        {showLabel && (
          <span>
            {isLoading ? 'Processando...' : isAdded ? 'Adicionado' : 'Backtest'}
          </span>
        )}
      </Button>

      {/* Contador de ativos (se houver) */}
      {isAdded && (
        <BacktestCounter onGoToBacktest={handleGoToBacktest} />
      )}
    </div>
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
    <Button
      variant="ghost"
      size="sm"
      onClick={onGoToBacktest}
      className="text-xs px-2 py-1 h-auto"
    >
      <Badge variant="default" className="bg-blue-600 text-white">
        {count}
      </Badge>
      <span className="ml-1">Ver Carteira</span>
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
