'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Building2, ChevronDown, ChevronUp, Settings, Crown } from 'lucide-react';
import { TriggerConfig } from '@/lib/custom-trigger-service';
import { AssetSearchInput } from '@/components/asset-search-input';
import { Card, CardContent } from '@/components/ui/card';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { MonitorLimitBanner } from '@/components/monitor-limit-banner';
import Link from 'next/link';

interface CustomMonitorFormProps {
  initialData?: {
    id: string;
    companyId: number;
    ticker: string;
    companyName: string;
    triggerConfig: TriggerConfig;
    isActive: boolean;
  };
}

export default function CustomMonitorForm({ initialData }: CustomMonitorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium, isLoading: isPremiumLoading } = usePremiumStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [limits, setLimits] = useState<{ current: number; max: number | null; isPremium: boolean } | null>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<{
    id: number;
    ticker: string;
    name: string;
  } | null>(
    initialData
      ? {
          id: initialData.companyId,
          ticker: initialData.ticker,
          name: initialData.companyName,
        }
      : null
  );

  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>(
    initialData?.triggerConfig || {}
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Buscar limites ao carregar componente (apenas para criação, não edição)
  useEffect(() => {
    if (!initialData && !isPremiumLoading) {
      fetch('/api/user-asset-monitor')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.limits) {
            setLimits(data.limits);
          }
        })
        .catch(err => {
          console.error('Erro ao buscar limites:', err);
        })
        .finally(() => {
          setIsLoadingLimits(false);
        });
    } else {
      setIsLoadingLimits(false);
    }
  }, [initialData, isPremiumLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompany) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma empresa.',
        variant: 'destructive',
      });
      return;
    }

    // Validar que pelo menos um critério foi definido
    // Verificar todos os campos possíveis do triggerConfig
    const hasAnyCriteria = Object.values(triggerConfig).some(
      value => value !== undefined && value !== null
    );

    if (!hasAnyCriteria) {
      toast({
        title: 'Erro',
        description: 'Por favor, defina pelo menos um critério para o monitoramento.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData
        ? `/api/user-asset-monitor/${initialData.id}`
        : '/api/user-asset-monitor';
      const method = initialData ? 'PATCH' : 'POST';

      const body: any = {
        companyId: selectedCompany.id,
        triggerConfig,
      };

      if (initialData) {
        body.isActive = isActive;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Tratar erro de limite atingido
        if (response.status === 403 && data.error === 'LIMIT_REACHED') {
          toast({
            title: 'Limite Atingido',
            description: data.message || 'Você atingiu o limite de monitores no plano gratuito.',
            variant: 'destructive',
            duration: 5000,
          });
          
          // Atualizar limites se fornecidos
          if (data.limits) {
            setLimits(data.limits);
          }
          
          // Scroll para o topo para mostrar banner de upgrade
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        
        throw new Error(data.error || data.message || 'Erro ao salvar monitoramento');
      }

      toast({
        title: initialData ? 'Monitoramento atualizado' : 'Monitoramento criado',
        description: initialData
          ? 'Monitoramento atualizado com sucesso.'
          : 'Monitoramento criado com sucesso.',
      });

      // Aguardar um pouco para garantir que o toast seja exibido
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Forçar atualização completa da página para garantir que os dados sejam atualizados
      router.push('/dashboard/monitoramentos-customizados');
      // Usar setTimeout para garantir que o refresh aconteça após a navegação
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error) {
      console.error('Erro ao salvar monitoramento:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar monitoramento.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar se pode criar (não é edição e não atingiu limite)
  const canCreate = initialData || (limits && (limits.max === null || limits.current < limits.max));
  const isLimitReached = !initialData && limits && limits.max !== null && limits.current >= limits.max;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Banner de Limite */}
      {!initialData && !isLoadingLimits && limits && (
        <MonitorLimitBanner
          current={limits.current}
          max={limits.max}
          showUpgrade={isLimitReached}
        />
      )}

      {/* Card de Conversão quando limite atingido */}
      {isLimitReached && !initialData && (
        <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 text-yellow-900 dark:text-yellow-100">
                  Desbloqueie Monitores Ilimitados
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                  Faça upgrade para Premium e crie quantos monitores customizados você precisar.
                </p>
                <ul className="text-sm space-y-2 mb-4 text-yellow-700 dark:text-yellow-300">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Monitores customizados ilimitados
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Alertas em tempo real sem delay
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Relatórios completos de IA
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Acesso a todas as estratégias de investimento
                  </li>
                </ul>
                <Button asChild className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white">
                  <Link href="/checkout">
                    <Crown className="w-4 h-4 mr-2" />
                    Fazer Upgrade Premium
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seleção de Empresa */}
      <div className="space-y-2">
        <Label htmlFor="company">Empresa *</Label>
        {selectedCompany ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{selectedCompany.ticker}</p>
                    <p className="text-sm text-muted-foreground">{selectedCompany.name}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCompany(null)}
                  disabled={!!initialData}
                >
                  Alterar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AssetSearchInput
            placeholder="Buscar empresa por ticker ou nome..."
            onCompanySelect={(company) =>
              setSelectedCompany({
                id: company.id,
                ticker: company.ticker,
                name: company.name,
              })
            }
          />
        )}
        {initialData && (
          <p className="text-xs text-muted-foreground">
            A empresa não pode ser alterada após a criação do monitoramento.
          </p>
        )}
      </div>

      {/* Critérios de Screening */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-4">Critérios de Screening</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* P/L */}
            <div className="space-y-2">
              <Label htmlFor="minPl">P/L Mínimo</Label>
              <Input
                id="minPl"
                type="number"
                step="0.1"
                placeholder="Ex: 5"
                value={triggerConfig.minPl ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    minPl: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPl">P/L Máximo</Label>
              <Input
                id="maxPl"
                type="number"
                step="0.1"
                placeholder="Ex: 20"
                value={triggerConfig.maxPl ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    maxPl: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>

            {/* P/VP */}
            <div className="space-y-2">
              <Label htmlFor="minPvp">P/VP Mínimo</Label>
              <Input
                id="minPvp"
                type="number"
                step="0.1"
                placeholder="Ex: 0.5"
                value={triggerConfig.minPvp ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    minPvp: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPvp">P/VP Máximo</Label>
              <Input
                id="maxPvp"
                type="number"
                step="0.1"
                placeholder="Ex: 2"
                value={triggerConfig.maxPvp ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    maxPvp: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>

            {/* Score */}
            <div className="space-y-2">
              <Label htmlFor="minScore">Score Mínimo</Label>
              <Input
                id="minScore"
                type="number"
                step="1"
                placeholder="Ex: 60"
                value={triggerConfig.minScore ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    minScore: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxScore">Score Máximo</Label>
              <Input
                id="maxScore"
                type="number"
                step="1"
                placeholder="Ex: 90"
                value={triggerConfig.maxScore ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    maxScore: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Alertas de Preço */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Alertas de Preço</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceReached">Preço Atingiu (R$)</Label>
              <Input
                id="priceReached"
                type="number"
                step="0.01"
                placeholder="Ex: 50.00"
                value={triggerConfig.priceReached ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    priceReached: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceBelow">Preço Abaixo de (R$)</Label>
              <Input
                id="priceBelow"
                type="number"
                step="0.01"
                placeholder="Ex: 30.00"
                value={triggerConfig.priceBelow ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    priceBelow: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceAbove">Preço Acima de (R$)</Label>
              <Input
                id="priceAbove"
                type="number"
                step="0.01"
                placeholder="Ex: 100.00"
                value={triggerConfig.priceAbove ?? ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    priceAbove: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Configurações Avançadas */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary" />
            <div className="text-left">
              <h3 className="text-lg font-semibold">Configurações Avançadas</h3>
              <p className="text-sm text-muted-foreground">
                Configure indicadores adicionais que oscilam com preço e outros indicadores fundamentais
              </p>
            </div>
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
            {/* Indicadores que Oscilam com Preço */}
            <div>
              <h4 className="text-base font-semibold mb-3 text-primary">
                Indicadores que Oscilam com Preço
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Forward P/E */}
                <div className="space-y-2">
                  <Label htmlFor="minForwardPE" className="text-sm">Forward P/E Mínimo</Label>
                  <Input
                    id="minForwardPE"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={triggerConfig.minForwardPE ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minForwardPE: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxForwardPE" className="text-sm">Forward P/E Máximo</Label>
                  <Input
                    id="maxForwardPE"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 20"
                    value={triggerConfig.maxForwardPE ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxForwardPE: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                {/* Earnings Yield */}
                <div className="space-y-2">
                  <Label htmlFor="minEarningsYield" className="text-sm">Earnings Yield Mínimo (%)</Label>
                  <Input
                    id="minEarningsYield"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={triggerConfig.minEarningsYield !== undefined ? triggerConfig.minEarningsYield * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minEarningsYield: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxEarningsYield" className="text-sm">Earnings Yield Máximo (%)</Label>
                  <Input
                    id="maxEarningsYield"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 20"
                    value={triggerConfig.maxEarningsYield !== undefined ? triggerConfig.maxEarningsYield * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxEarningsYield: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* Dividend Yield */}
                <div className="space-y-2">
                  <Label htmlFor="minDy" className="text-sm">Dividend Yield Mínimo (%)</Label>
                  <Input
                    id="minDy"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={triggerConfig.minDy !== undefined ? triggerConfig.minDy * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minDy: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDy" className="text-sm">Dividend Yield Máximo (%)</Label>
                  <Input
                    id="maxDy"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 15"
                    value={triggerConfig.maxDy !== undefined ? triggerConfig.maxDy * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxDy: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* EV/EBITDA */}
                <div className="space-y-2">
                  <Label htmlFor="minEvEbitda" className="text-sm">EV/EBITDA Mínimo</Label>
                  <Input
                    id="minEvEbitda"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={triggerConfig.minEvEbitda ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minEvEbitda: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxEvEbitda" className="text-sm">EV/EBITDA Máximo</Label>
                  <Input
                    id="maxEvEbitda"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 15"
                    value={triggerConfig.maxEvEbitda ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxEvEbitda: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                {/* P/S */}
                <div className="space-y-2">
                  <Label htmlFor="minPsr" className="text-sm">P/S Mínimo</Label>
                  <Input
                    id="minPsr"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 0.5"
                    value={triggerConfig.minPsr ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minPsr: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPsr" className="text-sm">P/S Máximo</Label>
                  <Input
                    id="maxPsr"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={triggerConfig.maxPsr ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxPsr: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                {/* LPA */}
                <div className="space-y-2">
                  <Label htmlFor="minLpa" className="text-sm">LPA Mínimo</Label>
                  <Input
                    id="minLpa"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1.00"
                    value={triggerConfig.minLpa ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minLpa: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLpa" className="text-sm">LPA Máximo</Label>
                  <Input
                    id="maxLpa"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 10.00"
                    value={triggerConfig.maxLpa ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxLpa: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                {/* VPA */}
                <div className="space-y-2">
                  <Label htmlFor="minVpa" className="text-sm">VPA Mínimo</Label>
                  <Input
                    id="minVpa"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 10.00"
                    value={triggerConfig.minVpa ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minVpa: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxVpa" className="text-sm">VPA Máximo</Label>
                  <Input
                    id="maxVpa"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 50.00"
                    value={triggerConfig.maxVpa ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxVpa: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Indicadores de Rentabilidade */}
            <div>
              <h4 className="text-base font-semibold mb-3 text-primary">
                Indicadores de Rentabilidade
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* ROE */}
                <div className="space-y-2">
                  <Label htmlFor="minRoe" className="text-sm">ROE Mínimo (%)</Label>
                  <Input
                    id="minRoe"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 15"
                    value={triggerConfig.minRoe !== undefined ? triggerConfig.minRoe * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minRoe: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRoe" className="text-sm">ROE Máximo (%)</Label>
                  <Input
                    id="maxRoe"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 50"
                    value={triggerConfig.maxRoe !== undefined ? triggerConfig.maxRoe * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxRoe: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* ROIC */}
                <div className="space-y-2">
                  <Label htmlFor="minRoic" className="text-sm">ROIC Mínimo (%)</Label>
                  <Input
                    id="minRoic"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 10"
                    value={triggerConfig.minRoic !== undefined ? triggerConfig.minRoic * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minRoic: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRoic" className="text-sm">ROIC Máximo (%)</Label>
                  <Input
                    id="maxRoic"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 40"
                    value={triggerConfig.maxRoic !== undefined ? triggerConfig.maxRoic * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxRoic: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* ROA */}
                <div className="space-y-2">
                  <Label htmlFor="minRoa" className="text-sm">ROA Mínimo (%)</Label>
                  <Input
                    id="minRoa"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={triggerConfig.minRoa !== undefined ? triggerConfig.minRoa * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minRoa: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRoa" className="text-sm">ROA Máximo (%)</Label>
                  <Input
                    id="maxRoa"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 20"
                    value={triggerConfig.maxRoa !== undefined ? triggerConfig.maxRoa * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxRoa: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Indicadores de Margem */}
            <div>
              <h4 className="text-base font-semibold mb-3 text-primary">
                Indicadores de Margem
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Margem Bruta */}
                <div className="space-y-2">
                  <Label htmlFor="minMargemBruta" className="text-sm">Margem Bruta Mínima (%)</Label>
                  <Input
                    id="minMargemBruta"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 20"
                    value={triggerConfig.minMargemBruta !== undefined ? triggerConfig.minMargemBruta * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minMargemBruta: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxMargemBruta" className="text-sm">Margem Bruta Máxima (%)</Label>
                  <Input
                    id="maxMargemBruta"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 80"
                    value={triggerConfig.maxMargemBruta !== undefined ? triggerConfig.maxMargemBruta * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxMargemBruta: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* Margem EBITDA */}
                <div className="space-y-2">
                  <Label htmlFor="minMargemEbitda" className="text-sm">Margem EBITDA Mínima (%)</Label>
                  <Input
                    id="minMargemEbitda"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 15"
                    value={triggerConfig.minMargemEbitda !== undefined ? triggerConfig.minMargemEbitda * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minMargemEbitda: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxMargemEbitda" className="text-sm">Margem EBITDA Máxima (%)</Label>
                  <Input
                    id="maxMargemEbitda"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 50"
                    value={triggerConfig.maxMargemEbitda !== undefined ? triggerConfig.maxMargemEbitda * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxMargemEbitda: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* Margem Líquida */}
                <div className="space-y-2">
                  <Label htmlFor="minMargemLiquida" className="text-sm">Margem Líquida Mínima (%)</Label>
                  <Input
                    id="minMargemLiquida"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 10"
                    value={triggerConfig.minMargemLiquida !== undefined ? triggerConfig.minMargemLiquida * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minMargemLiquida: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxMargemLiquida" className="text-sm">Margem Líquida Máxima (%)</Label>
                  <Input
                    id="maxMargemLiquida"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 30"
                    value={triggerConfig.maxMargemLiquida !== undefined ? triggerConfig.maxMargemLiquida * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxMargemLiquida: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Indicadores de Endividamento */}
            <div>
              <h4 className="text-base font-semibold mb-3 text-primary">
                Indicadores de Endividamento
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Dívida Líquida/PL */}
                <div className="space-y-2">
                  <Label htmlFor="minDividaLiquidaPl" className="text-sm">Dívida Líquida/PL Mínimo</Label>
                  <Input
                    id="minDividaLiquidaPl"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 0"
                    value={triggerConfig.minDividaLiquidaPl ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minDividaLiquidaPl: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDividaLiquidaPl" className="text-sm">Dívida Líquida/PL Máximo</Label>
                  <Input
                    id="maxDividaLiquidaPl"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 1"
                    value={triggerConfig.maxDividaLiquidaPl ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxDividaLiquidaPl: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>

                {/* Debt to Equity */}
                <div className="space-y-2">
                  <Label htmlFor="minDebtToEquity" className="text-sm">Debt to Equity Mínimo</Label>
                  <Input
                    id="minDebtToEquity"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 0"
                    value={triggerConfig.minDebtToEquity ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minDebtToEquity: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDebtToEquity" className="text-sm">Debt to Equity Máximo</Label>
                  <Input
                    id="maxDebtToEquity"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 1"
                    value={triggerConfig.maxDebtToEquity ?? ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxDebtToEquity: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Indicadores de Crescimento */}
            <div>
              <h4 className="text-base font-semibold mb-3 text-primary">
                Indicadores de Crescimento
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* CAGR Lucros 5a */}
                <div className="space-y-2">
                  <Label htmlFor="minCagrLucros5a" className="text-sm">CAGR Lucros 5a Mínimo (%)</Label>
                  <Input
                    id="minCagrLucros5a"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 10"
                    value={triggerConfig.minCagrLucros5a !== undefined ? triggerConfig.minCagrLucros5a * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minCagrLucros5a: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxCagrLucros5a" className="text-sm">CAGR Lucros 5a Máximo (%)</Label>
                  <Input
                    id="maxCagrLucros5a"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 50"
                    value={triggerConfig.maxCagrLucros5a !== undefined ? triggerConfig.maxCagrLucros5a * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxCagrLucros5a: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>

                {/* Payout */}
                <div className="space-y-2">
                  <Label htmlFor="minPayout" className="text-sm">Payout Mínimo (%)</Label>
                  <Input
                    id="minPayout"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 20"
                    value={triggerConfig.minPayout !== undefined ? triggerConfig.minPayout * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        minPayout: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPayout" className="text-sm">Payout Máximo (%)</Label>
                  <Input
                    id="maxPayout"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 80"
                    value={triggerConfig.maxPayout !== undefined ? triggerConfig.maxPayout * 100 : ''}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        maxPayout: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status (apenas para edição) */}
      {initialData && (
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">Status do Monitoramento</Label>
            <p className="text-sm text-muted-foreground">
              {isActive
                ? 'O monitoramento está ativo e verificando os critérios.'
                : 'O monitoramento está inativo e não verificará os critérios.'}
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || isLimitReached}
          title={isLimitReached ? 'Limite de monitores atingido. Faça upgrade para Premium.' : undefined}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : initialData ? (
            'Atualizar Monitoramento'
          ) : (
            'Criar Monitoramento'
          )}
        </Button>
      </div>
    </form>
  );
}

