"use client"

import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { 
  Search, 
  X, 
  BarChart3, 
  Target, 
  DollarSign, 
  TrendingUp, 
  Building2, 
  Building, 
  Factory,
  Crown,
  Lock
} from "lucide-react"
import React, { useState, useEffect } from "react"
import Link from "next/link"

interface ScreeningFilter {
  enabled: boolean;
  min?: number;
  max?: number;
}

interface ScreeningParams {
  limit?: number;
  companySize?: 'all' | 'small_caps' | 'mid_caps' | 'blue_chips';
  useTechnicalAnalysis?: boolean;
  assetTypeFilter?: 'b3' | 'bdr' | 'both';
  plFilter?: ScreeningFilter;
  pvpFilter?: ScreeningFilter;
  evEbitdaFilter?: ScreeningFilter;
  psrFilter?: ScreeningFilter;
  roeFilter?: ScreeningFilter;
  roicFilter?: ScreeningFilter;
  roaFilter?: ScreeningFilter;
  margemLiquidaFilter?: ScreeningFilter;
  margemEbitdaFilter?: ScreeningFilter;
  cagrLucros5aFilter?: ScreeningFilter;
  cagrReceitas5aFilter?: ScreeningFilter;
  dyFilter?: ScreeningFilter;
  payoutFilter?: ScreeningFilter;
  dividaLiquidaPlFilter?: ScreeningFilter;
  liquidezCorrenteFilter?: ScreeningFilter;
  dividaLiquidaEbitdaFilter?: ScreeningFilter;
  marketCapFilter?: ScreeningFilter;
  overallScoreFilter?: ScreeningFilter;
  grahamUpsideFilter?: ScreeningFilter;
  selectedSectors?: string[];
  selectedIndustries?: string[];
}

interface ScreeningConfiguratorProps {
  params: ScreeningParams;
  onParamsChange: (params: ScreeningParams) => void;
  showTechnicalAnalysis?: boolean;
  isPremium?: boolean;
  isLoggedIn?: boolean;
}

export function ScreeningConfigurator({ 
  params, 
  onParamsChange,
  showTechnicalAnalysis = true,
  isPremium = false,
  isLoggedIn = false
}: ScreeningConfiguratorProps) {
  const isMobile = useIsMobile()
  const [showConfigSheet, setShowConfigSheet] = useState(false)
  
  const setParams = (newParams: ScreeningParams) => {
    onParamsChange(newParams);
  };
  
  // Contar filtros ativos
  const countActiveFilters = () => {
    let count = 0
    const filters = [
      params.plFilter, params.pvpFilter, params.evEbitdaFilter, params.psrFilter,
      params.roeFilter, params.roicFilter, params.roaFilter, params.margemLiquidaFilter, params.margemEbitdaFilter,
      params.cagrLucros5aFilter, params.cagrReceitas5aFilter,
      params.dyFilter, params.payoutFilter,
      params.dividaLiquidaPlFilter, params.liquidezCorrenteFilter, params.dividaLiquidaEbitdaFilter,
      params.marketCapFilter, params.overallScoreFilter, params.grahamUpsideFilter
    ]
    filters.forEach(filter => {
      if (filter?.enabled) count++
    })
    if (params.selectedSectors && params.selectedSectors.length > 0) count++
    if (params.selectedIndustries && params.selectedIndustries.length > 0) count++
    return count
  }

  // Verificar se o usuário pode usar filtros premium
  const canUsePremiumFilters = isLoggedIn && isPremium;

  // Componente de bloqueio para categorias premium
  const PremiumCategoryLock = ({ children }: { children: React.ReactNode }) => {
    if (canUsePremiumFilters) {
      return <>{children}</>;
    }

    return (
      <div className="relative">
        {/* Overlay de bloqueio - apenas UM */}
        <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center min-h-[600px]">
          <div className="text-center p-8 max-w-lg">
            <div className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
              {isLoggedIn ? <Crown className="w-10 h-10 text-white" /> : <Lock className="w-10 h-10 text-white" />}
            </div>
            <h4 className="font-bold text-2xl mb-3">
              {isLoggedIn ? 'Recursos Premium' : 'Login Necessário'}
            </h4>
            <p className="text-muted-foreground mb-4">
              {isLoggedIn 
                ? 'Filtros avançados de Rentabilidade, Crescimento, Dividendos, Endividamento, Tamanho e Filtro Setorial estão disponíveis apenas para usuários Premium.'
                : 'Faça login para acessar filtros avançados de Rentabilidade, Crescimento, Dividendos e muito mais.'
              }
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              ✅ Filtros de <strong>Valuation</strong> (P/L, P/VP, EV/EBITDA, PSR) estão liberados para todos!
            </p>
            <Button asChild size="lg" className={isLoggedIn ? "bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600" : ""}>
              <Link href={isLoggedIn ? "/checkout" : "/register"}>
                {isLoggedIn ? <><Crown className="w-5 h-5 mr-2" /> Fazer Upgrade Premium</> : 'Cadastre-se Grátis'}
              </Link>
            </Button>
          </div>
        </div>
        {/* Conteúdo bloqueado (opacity reduzida) */}
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
      </div>
    );
  };

  // Estado para setores e indústrias
  const [sectors, setSectors] = useState<string[]>([]);
  const [industriesBySector, setIndustriesBySector] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Buscar setores e indústrias ao montar o componente
  useEffect(() => {
    const fetchSectorsAndIndustries = async () => {
      try {
        const response = await fetch('/api/sectors-industries');
        const data = await response.json();
        setSectors(data.sectors || []);
        setIndustriesBySector(data.industriesBySector || {});
      } catch (error) {
        console.error('Erro ao buscar setores e indústrias:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectorsAndIndustries();
  }, []);

  // Filtrar indústrias disponíveis baseado nos setores selecionados
  const availableIndustries = React.useMemo(() => {
    if (!params.selectedSectors || params.selectedSectors.length === 0) {
      // Se nenhum setor selecionado, mostrar todas as indústrias
      return Object.values(industriesBySector).flat().filter((v, i, a) => a.indexOf(v) === i).sort();
    }
    
    // Mostrar apenas indústrias dos setores selecionados
    const industries: string[] = [];
    params.selectedSectors.forEach(sector => {
      const sectorIndustries = industriesBySector[sector] || [];
      industries.push(...sectorIndustries);
    });
    
    return industries.filter((v, i, a) => a.indexOf(v) === i).sort();
  }, [params.selectedSectors, industriesBySector]);

  // Filtrar indústrias selecionadas para mostrar apenas as válidas
  const validSelectedIndustries = React.useMemo(() => {
    if (!params.selectedIndustries || params.selectedIndustries.length === 0) {
      return [];
    }
    return params.selectedIndustries.filter(ind => availableIndustries.includes(ind));
  }, [params.selectedIndustries, availableIndustries]);

  // Componente helper para controle de análise técnica
  const TechnicalAnalysisControl = () => {
    if (!showTechnicalAnalysis) return null;
    
    return (
      <div className="space-y-3 border border-blue-200 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Priorização por Análise Técnica
          </Label>
          <Badge variant={params.useTechnicalAnalysis !== false ? "default" : "outline"} className="text-xs">
            {params.useTechnicalAnalysis !== false ? "Ativada" : "Desativada"}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="technicalAnalysis-screening"
            checked={params.useTechnicalAnalysis !== false}
            onChange={(e) => setParams({ ...params, useTechnicalAnalysis: e.target.checked })}
            className="rounded border-gray-300 w-4 h-4"
          />
          <label htmlFor="technicalAnalysis-screening" className="text-sm text-muted-foreground cursor-pointer">
            Priorizar ativos em sobrevenda (RSI e Estocástico)
          </label>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Quando ativado, ativos em sobrevenda aparecem primeiro no ranking para melhor timing de entrada
        </p>
      </div>
    );
  };

  // Conteúdo do configurador (reutilizável)
  const ConfiguratorContent = () => (
    <div className="space-y-6">
      {/* Filtro de Tamanho */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
        <Select 
          value={params.companySize || 'all'} 
          onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o tamanho das empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
            <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
            <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
            <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Filtre empresas por valor de mercado para focar em segmentos específicos
        </p>
      </div>

      {/* Filtro de Tipo de Ativo */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Filtro por Tipo de Ativo</Label>
        <Select 
          value={params.assetTypeFilter || 'both'} 
          onValueChange={(value) => setParams({ ...params, assetTypeFilter: value as 'b3' | 'bdr' | 'both' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o tipo de ativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">🌎 Todos (B3 + BDRs)</SelectItem>
            <SelectItem value="b3">🇧🇷 Apenas B3</SelectItem>
            <SelectItem value="bdr">🌐 Apenas BDRs</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Escolha se deseja incluir apenas ações da B3, apenas BDRs ou ambos
        </p>
      </div>

      {/* Análise Técnica */}
      <TechnicalAnalysisControl />

      {/* Número de Resultados - Apenas informativo */}
      {!isPremium ? (
        <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Número de Resultados</Label>
            <Badge variant="outline" className="font-mono bg-white dark:bg-gray-800">
              3 empresas
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Plano gratuito mostra até 3 resultados. <Link href="/planos" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Upgrade para Premium</Link> e veja todos os resultados encontrados.
          </p>
        </div>
      ) : (
        <div className="space-y-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Número de Resultados</Label>
            <Badge variant="outline" className="font-mono bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
              Ilimitado
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Como usuário Premium, você verá todos os resultados encontrados que atendem aos seus critérios.
          </p>
        </div>
      )}

      {/* Aviso sobre filtros */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <Search className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1 text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Screening Customizável
            </h4>
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Configure os filtros abaixo por categoria. Apenas empresas que atendem <strong>TODOS</strong> os filtros ativados serão exibidas.
            </p>
          </div>
        </div>
      </div>

      {/* CATEGORIA: VALUATION */}
      <div className="border-2 border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-violet-900 dark:text-violet-100">
          <BarChart3 className="w-5 h-5" />
          Valuation
        </h3>
        
        {/* P/L Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.plFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  plFilter: { ...params.plFilter, enabled: e.target.checked, min: params.plFilter?.min, max: params.plFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              P/L (Preço/Lucro)
            </Label>
            {params.plFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.plFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 0"
                    value={params.plFilter?.min !== undefined ? params.plFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      plFilter: { ...params.plFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 15"
                    value={params.plFilter?.max !== undefined ? params.plFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      plFilter: { ...params.plFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* P/VP Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.pvpFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  pvpFilter: { ...params.pvpFilter, enabled: e.target.checked, min: params.pvpFilter?.min, max: params.pvpFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              P/VP (Preço/Valor Patrimonial)
            </Label>
            {params.pvpFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.pvpFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 0"
                    value={params.pvpFilter?.min !== undefined ? params.pvpFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      pvpFilter: { ...params.pvpFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 3"
                    value={params.pvpFilter?.max !== undefined ? params.pvpFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      pvpFilter: { ...params.pvpFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* EV/EBITDA Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.evEbitdaFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  evEbitdaFilter: { ...params.evEbitdaFilter, enabled: e.target.checked, min: params.evEbitdaFilter?.min, max: params.evEbitdaFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              EV/EBITDA
            </Label>
            {params.evEbitdaFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.evEbitdaFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 0"
                    value={params.evEbitdaFilter?.min !== undefined ? params.evEbitdaFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      evEbitdaFilter: { ...params.evEbitdaFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 10"
                    value={params.evEbitdaFilter?.max !== undefined ? params.evEbitdaFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      evEbitdaFilter: { ...params.evEbitdaFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PSR Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.psrFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  psrFilter: { ...params.psrFilter, enabled: e.target.checked, min: params.psrFilter?.min, max: params.psrFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              PSR (Preço/Receita)
            </Label>
            {params.psrFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.psrFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 0"
                    value={params.psrFilter?.min !== undefined ? params.psrFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      psrFilter: { ...params.psrFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 5"
                    value={params.psrFilter?.max !== undefined ? params.psrFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      psrFilter: { ...params.psrFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CATEGORIA: RENTABILIDADE */}
      {/* <PremiumCategoryLock> */}
      <div className="space-y-6">
      <div className="border-2 border-green-200 dark:border-green-800 rounded-xl p-4 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-900 dark:text-green-100">
          <DollarSign className="w-5 h-5" />
          Rentabilidade
        </h3>
        
        {/* ROE Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.roeFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  roeFilter: { ...params.roeFilter, enabled: e.target.checked, min: params.roeFilter?.min, max: params.roeFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              ROE (Return on Equity) %
            </Label>
            {params.roeFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.roeFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 10"
                    value={params.roeFilter?.min !== undefined ? params.roeFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      roeFilter: { ...params.roeFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 50"
                    value={params.roeFilter?.max !== undefined ? params.roeFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      roeFilter: { ...params.roeFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ROIC Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.roicFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  roicFilter: { ...params.roicFilter, enabled: e.target.checked, min: params.roicFilter?.min, max: params.roicFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              ROIC (Return on Invested Capital) %
            </Label>
            {params.roicFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.roicFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 10"
                    value={params.roicFilter?.min !== undefined ? params.roicFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      roicFilter: { ...params.roicFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 50"
                    value={params.roicFilter?.max !== undefined ? params.roicFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      roicFilter: { ...params.roicFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ROA Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.roaFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  roaFilter: { ...params.roaFilter, enabled: e.target.checked, min: params.roaFilter?.min, max: params.roaFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              ROA (Return on Assets) %
            </Label>
            {params.roaFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.roaFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 5"
                    value={params.roaFilter?.min !== undefined ? params.roaFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      roaFilter: { ...params.roaFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 30"
                    value={params.roaFilter?.max !== undefined ? params.roaFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      roaFilter: { ...params.roaFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Margem Líquida Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.margemLiquidaFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  margemLiquidaFilter: { ...params.margemLiquidaFilter, enabled: e.target.checked, min: params.margemLiquidaFilter?.min, max: params.margemLiquidaFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Margem Líquida %
            </Label>
            {params.margemLiquidaFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.margemLiquidaFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 5"
                    value={params.margemLiquidaFilter?.min !== undefined ? params.margemLiquidaFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      margemLiquidaFilter: { ...params.margemLiquidaFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 40"
                    value={params.margemLiquidaFilter?.max !== undefined ? params.margemLiquidaFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      margemLiquidaFilter: { ...params.margemLiquidaFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Margem EBITDA Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.margemEbitdaFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  margemEbitdaFilter: { ...params.margemEbitdaFilter, enabled: e.target.checked, min: params.margemEbitdaFilter?.min, max: params.margemEbitdaFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Margem EBITDA %
            </Label>
            {params.margemEbitdaFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.margemEbitdaFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 10"
                    value={params.margemEbitdaFilter?.min !== undefined ? params.margemEbitdaFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      margemEbitdaFilter: { ...params.margemEbitdaFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 50"
                    value={params.margemEbitdaFilter?.max !== undefined ? params.margemEbitdaFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      margemEbitdaFilter: { ...params.margemEbitdaFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CATEGORIA: CRESCIMENTO */}
      <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <TrendingUp className="w-5 h-5" />
          Crescimento
        </h3>
        
        {/* CAGR Lucros Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.cagrLucros5aFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  cagrLucros5aFilter: { ...params.cagrLucros5aFilter, enabled: e.target.checked, min: params.cagrLucros5aFilter?.min, max: params.cagrLucros5aFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              CAGR Lucros 5 anos %
            </Label>
            {params.cagrLucros5aFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.cagrLucros5aFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 5"
                    value={params.cagrLucros5aFilter?.min !== undefined ? params.cagrLucros5aFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      cagrLucros5aFilter: { ...params.cagrLucros5aFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 30"
                    value={params.cagrLucros5aFilter?.max !== undefined ? params.cagrLucros5aFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      cagrLucros5aFilter: { ...params.cagrLucros5aFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CAGR Receitas Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.cagrReceitas5aFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  cagrReceitas5aFilter: { ...params.cagrReceitas5aFilter, enabled: e.target.checked, min: params.cagrReceitas5aFilter?.min, max: params.cagrReceitas5aFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              CAGR Receitas 5 anos %
            </Label>
            {params.cagrReceitas5aFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.cagrReceitas5aFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 5"
                    value={params.cagrReceitas5aFilter?.min !== undefined ? params.cagrReceitas5aFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      cagrReceitas5aFilter: { ...params.cagrReceitas5aFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 25"
                    value={params.cagrReceitas5aFilter?.max !== undefined ? params.cagrReceitas5aFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      cagrReceitas5aFilter: { ...params.cagrReceitas5aFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CATEGORIA: DIVIDENDOS */}
      <div className="border-2 border-amber-200 dark:border-amber-800 rounded-xl p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <DollarSign className="w-5 h-5" />
          Dividendos
        </h3>
        
        {/* Dividend Yield Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.dyFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  dyFilter: { ...params.dyFilter, enabled: e.target.checked, min: params.dyFilter?.min, max: params.dyFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Dividend Yield %
            </Label>
            {params.dyFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.dyFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 4"
                    value={params.dyFilter?.min !== undefined ? params.dyFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      dyFilter: { ...params.dyFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 15"
                    value={params.dyFilter?.max !== undefined ? params.dyFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      dyFilter: { ...params.dyFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payout Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.payoutFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  payoutFilter: { ...params.payoutFilter, enabled: e.target.checked, min: params.payoutFilter?.min, max: params.payoutFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Payout %
            </Label>
            {params.payoutFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.payoutFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 30"
                    value={params.payoutFilter?.min !== undefined ? params.payoutFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      payoutFilter: { ...params.payoutFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 80"
                    value={params.payoutFilter?.max !== undefined ? params.payoutFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      payoutFilter: { ...params.payoutFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CATEGORIA: ENDIVIDAMENTO & LIQUIDEZ */}
      <div className="border-2 border-red-200 dark:border-red-800 rounded-xl p-4 bg-gradient-to-br from-red-50/50 to-rose-50/50 dark:from-red-950/20 dark:to-rose-950/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-900 dark:text-red-100">
          <Building2 className="w-5 h-5" />
          Endividamento & Liquidez
        </h3>
        
        {/* Dívida Líq./PL Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.dividaLiquidaPlFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  dividaLiquidaPlFilter: { ...params.dividaLiquidaPlFilter, enabled: e.target.checked, min: params.dividaLiquidaPlFilter?.min, max: params.dividaLiquidaPlFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Dívida Líquida/PL %
            </Label>
            {params.dividaLiquidaPlFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.dividaLiquidaPlFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 0"
                    value={params.dividaLiquidaPlFilter?.min !== undefined ? params.dividaLiquidaPlFilter.min * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      dividaLiquidaPlFilter: { ...params.dividaLiquidaPlFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 100"
                    value={params.dividaLiquidaPlFilter?.max !== undefined ? params.dividaLiquidaPlFilter.max * 100 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      dividaLiquidaPlFilter: { ...params.dividaLiquidaPlFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) / 100 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Liquidez Corrente Filter */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.liquidezCorrenteFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  liquidezCorrenteFilter: { ...params.liquidezCorrenteFilter, enabled: e.target.checked, min: params.liquidezCorrenteFilter?.min, max: params.liquidezCorrenteFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Liquidez Corrente
            </Label>
            {params.liquidezCorrenteFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.liquidezCorrenteFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 1.0"
                    value={params.liquidezCorrenteFilter?.min !== undefined ? params.liquidezCorrenteFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      liquidezCorrenteFilter: { ...params.liquidezCorrenteFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 5.0"
                    value={params.liquidezCorrenteFilter?.max !== undefined ? params.liquidezCorrenteFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      liquidezCorrenteFilter: { ...params.liquidezCorrenteFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dívida Líq./EBITDA Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.dividaLiquidaEbitdaFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  dividaLiquidaEbitdaFilter: { ...params.dividaLiquidaEbitdaFilter, enabled: e.target.checked, min: params.dividaLiquidaEbitdaFilter?.min, max: params.dividaLiquidaEbitdaFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Dívida Líquida/EBITDA (x)
            </Label>
            {params.dividaLiquidaEbitdaFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.dividaLiquidaEbitdaFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 0"
                    value={params.dividaLiquidaEbitdaFilter?.min !== undefined ? params.dividaLiquidaEbitdaFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      dividaLiquidaEbitdaFilter: { ...params.dividaLiquidaEbitdaFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 3"
                    value={params.dividaLiquidaEbitdaFilter?.max !== undefined ? params.dividaLiquidaEbitdaFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      dividaLiquidaEbitdaFilter: { ...params.dividaLiquidaEbitdaFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CATEGORIA: MARKET CAP */}
      <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-gradient-to-br from-slate-50/50 to-gray-50/50 dark:from-slate-950/20 dark:to-gray-950/20">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Building className="w-5 h-5" />
          Tamanho da Empresa
        </h3>
        
        {/* Market Cap Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.marketCapFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  marketCapFilter: { ...params.marketCapFilter, enabled: e.target.checked, min: params.marketCapFilter?.min, max: params.marketCapFilter?.max } 
                })}
                className="rounded border-gray-300 w-4 h-4"
              />
              Market Cap (R$ Bilhões)
            </Label>
            {params.marketCapFilter?.enabled && (
              <Badge variant="default" className="text-xs">Ativo</Badge>
            )}
          </div>
          {params.marketCapFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo (R$ Bi)</Label>
                  <input
                    type="number"
                    placeholder="Ex: 1"
                    value={params.marketCapFilter?.min !== undefined ? params.marketCapFilter.min / 1_000_000_000 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      marketCapFilter: { ...params.marketCapFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) * 1_000_000_000 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo (R$ Bi)</Label>
                  <input
                    type="number"
                    placeholder="Ex: 100"
                    value={params.marketCapFilter?.max !== undefined ? params.marketCapFilter.max / 1_000_000_000 : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      marketCapFilter: { ...params.marketCapFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) * 1_000_000_000 : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="0.5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* === QUALIDADE & OPORTUNIDADE === */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5" />
          Qualidade & Oportunidade
        </h3>
        <p className="text-sm text-muted-foreground">
          Filtros baseados em análises avançadas de qualidade e oportunidade de investimento.
        </p>

        {/* Score Geral */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overallScoreFilter"
                checked={params.overallScoreFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  overallScoreFilter: { ...params.overallScoreFilter, enabled: e.target.checked } 
                })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="overallScoreFilter" className="text-sm font-medium cursor-pointer">
                💯 Score Geral (0-100)
              </Label>
            </div>
            <Badge variant={params.overallScoreFilter?.enabled ? "default" : "outline"} className="text-xs">
              {params.overallScoreFilter?.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Score calculado pela plataforma considerando todas as estratégias e análises fundamentalistas.
          </p>
          {params.overallScoreFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 60"
                    value={params.overallScoreFilter?.min !== undefined ? params.overallScoreFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      overallScoreFilter: { ...params.overallScoreFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    min="0"
                    max="100"
                    step="5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <input
                    type="number"
                    placeholder="Ex: 100"
                    value={params.overallScoreFilter?.max !== undefined ? params.overallScoreFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      overallScoreFilter: { ...params.overallScoreFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    min="0"
                    max="100"
                    step="5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Graham Upside */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="grahamUpsideFilter"
                checked={params.grahamUpsideFilter?.enabled || false}
                onChange={(e) => setParams({ 
                  ...params, 
                  grahamUpsideFilter: { ...params.grahamUpsideFilter, enabled: e.target.checked } 
                })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="grahamUpsideFilter" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Margem de Segurança Graham (%)
              </Label>
            </div>
            <Badge variant={params.grahamUpsideFilter?.enabled ? "default" : "outline"} className="text-xs">
              {params.grahamUpsideFilter?.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Upside calculado pela fórmula de Benjamin Graham (√22.5 × LPA × VPA). Indica o potencial de valorização.
          </p>
          {params.grahamUpsideFilter?.enabled && (
            <div className="pl-6 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Mínimo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 10"
                    value={params.grahamUpsideFilter?.min !== undefined ? params.grahamUpsideFilter.min : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      grahamUpsideFilter: { ...params.grahamUpsideFilter, enabled: true, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo %</Label>
                  <input
                    type="number"
                    placeholder="Ex: 100"
                    value={params.grahamUpsideFilter?.max !== undefined ? params.grahamUpsideFilter.max : ''}
                    onChange={(e) => setParams({ 
                      ...params, 
                      grahamUpsideFilter: { ...params.grahamUpsideFilter, enabled: true, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined } 
                    })}
                    className="w-full p-2 border rounded-md text-sm"
                    step="5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* === FILTRO SETORIAL === */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Factory className="w-5 h-5" />
          Filtro Setorial
        </h3>
        <p className="text-sm text-muted-foreground">
          Selecione setores e indústrias específicas para focar sua busca.
        </p>

        {/* Setores */}
        <div className="border rounded-lg p-4">
          <div className="mb-3">
            <Label className="text-sm font-medium">Setores</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione um ou mais setores. As indústrias serão filtradas automaticamente.
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Carregando setores...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(params.selectedSectors || []).map((sector) => (
                  <Badge key={sector} variant="default" className="cursor-pointer" onClick={() => {
                    const newSectors = params.selectedSectors?.filter(s => s !== sector) || [];
                    setParams({ ...params, selectedSectors: newSectors });
                  }}>
                    {sector} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
              
              <Select value={undefined} onValueChange={(value) => {
                if (value && !params.selectedSectors?.includes(value)) {
                  setParams({ 
                    ...params, 
                    selectedSectors: [...(params.selectedSectors || []), value] 
                  });
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um setor..." />
                </SelectTrigger>
                <SelectContent>
                  {sectors.filter(s => s && s.trim() && !params.selectedSectors?.includes(s)).map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {params.selectedSectors && params.selectedSectors.length > 0 && (
                <button
                  onClick={() => setParams({ ...params, selectedSectors: [] })}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Limpar todos os setores
                </button>
              )}
            </div>
          )}
        </div>

        {/* Indústrias */}
        <div className="border rounded-lg p-4">
          <div className="mb-3">
            <Label className="text-sm font-medium">Indústrias</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {params.selectedSectors && params.selectedSectors.length > 0
                ? `Indústrias disponíveis para os setores selecionados: ${params.selectedSectors.join(', ')}`
                : 'Selecione setores para filtrar as indústrias disponíveis, ou escolha indústrias de todos os setores.'}
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Carregando indústrias...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {validSelectedIndustries.map((industry) => (
                  <Badge key={industry} variant="secondary" className="cursor-pointer" onClick={() => {
                    const newIndustries = params.selectedIndustries?.filter(i => i !== industry) || [];
                    setParams({ ...params, selectedIndustries: newIndustries });
                  }}>
                    {industry} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
              
              <Select value={undefined} onValueChange={(value) => {
                if (value && !validSelectedIndustries.includes(value)) {
                  setParams({ 
                    ...params, 
                    selectedIndustries: [...(params.selectedIndustries || []), value] 
                  });
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma indústria..." />
                </SelectTrigger>
                <SelectContent>
                  {availableIndustries.filter(i => i && i.trim() && !validSelectedIndustries.includes(i)).map(industry => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {validSelectedIndustries.length > 0 && (
                <button
                  onClick={() => setParams({ ...params, selectedIndustries: [] })}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Limpar todas as indústrias
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
      {/* </PremiumCategoryLock> */}
    </div>
  )

  // Mobile: Botão para abrir Sheet
  if (isMobile) {
    return (
      <>
        <Button
          onClick={() => setShowConfigSheet(true)}
          variant="outline"
          size="lg"
          className="w-full"
        >
          <Search className="w-4 h-4 mr-2" />
          Configurar Filtros
          {countActiveFilters() > 0 && (
            <Badge variant="secondary" className="ml-2">
              {countActiveFilters()} ativos
            </Badge>
          )}
        </Button>

        <Sheet open={showConfigSheet} onOpenChange={setShowConfigSheet}>
          <SheetContent side="bottom" className="h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Configurar Filtros
              </SheetTitle>
              <SheetDescription>
                {countActiveFilters() > 0 && (
                  <Badge variant="secondary" className="mt-2">
                    {countActiveFilters()} filtros ativos
                  </Badge>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ConfiguratorContent />
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  // Desktop: layout tradicional
  return <ConfiguratorContent />
}
