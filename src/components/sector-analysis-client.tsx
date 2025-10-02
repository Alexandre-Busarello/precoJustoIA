'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CompanyLogo } from '@/components/company-logo'
import { SectorSelector } from '@/components/sector-selector'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Building2, 
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Lock,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface Company {
  ticker: string;
  name: string;
  score: number;
  currentPrice: number;
  logoUrl: string | null;
  recommendation: string;
}

interface SectorData {
  sector: string;
  companyCount: number;
  topCompanies: Company[];
  averageScore: number;
}

interface SectorAnalysisClientProps {
  initialSectors: SectorData[];
  isPremium: boolean;
}

export function SectorAnalysisClient({ initialSectors, isPremium }: SectorAnalysisClientProps) {
  const [sectors, setSectors] = useState<SectorData[]>(initialSectors)
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set())
  const [loadingSectors, setLoadingSectors] = useState<string[]>([])
  
  // Ref para a seção de análises (para scroll automático)
  const analysisHeaderRef = useRef<HTMLDivElement>(null)
  
  // Todos os setores disponíveis na B3 (versão macro)
  const allAvailableSectors = [
    'Financeiro',
    'Energia',
    'Tecnologia da Informação',
    'Saúde',
    'Consumo Cíclico',
    'Consumo Não Cíclico',
    'Bens Industriais',
    'Materiais Básicos',
    'Imobiliário',
    'Utilidade Pública',
    'Comunicações'
  ]
  
  // Setores que ainda não foram carregados
  const remainingSectors = allAvailableSectors.filter(
    s => !sectors.some(loaded => loaded.sector === s)
  )
  
  const loadedSectorNames = sectors.map(s => s.sector)

  const loadSelectedSectors = async (selectedSectors: string[]) => {
    if (!isPremium || selectedSectors.length === 0) return;
    
    try {
      setLoadingSectors(selectedSectors)
      const sectorsQuery = selectedSectors.join(',')
      const response = await fetch(`/api/sector-analysis?sectors=${encodeURIComponent(sectorsQuery)}`)
      
      if (response.ok) {
        const data = await response.json()
        setSectors(prev => {
          // Remover duplicatas e manter ordem por score
          const allSectors = [...prev, ...data.sectors]
          const uniqueSectors = allSectors.filter((sector, index, self) =>
            index === self.findIndex(s => s.sector === sector.sector)
          )
          return uniqueSectors.sort((a, b) => b.averageScore - a.averageScore)
        })
        
        // Scroll suave para o início da seção de análises após carregar
        setTimeout(() => {
          analysisHeaderRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
          })
        }, 300) // Pequeno delay para garantir que o DOM foi atualizado
      }
    } catch (error) {
      console.error('Erro ao buscar setores:', error)
    } finally {
      setLoadingSectors([])
    }
  }

  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sector)) {
        newSet.delete(sector)
      } else {
        newSet.add(sector)
      }
      return newSet
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400'
    if (score >= 70) return 'text-blue-600 dark:text-blue-400'
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-orange-600 dark:text-orange-400'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 dark:bg-green-950/30'
    if (score >= 70) return 'bg-blue-100 dark:bg-blue-950/30'
    if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-950/30'
    return 'bg-orange-100 dark:bg-orange-950/30'
  }

  const getRecommendationIcon = (recommendation: string) => {
    if (recommendation.includes('Compra')) return <TrendingUp className="w-4 h-4" />
    if (recommendation.includes('Venda')) return <TrendingDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }

  const getRecommendationColor = (recommendation: string) => {
    if (recommendation.includes('Compra')) return 'text-green-600 dark:text-green-400'
    if (recommendation.includes('Venda')) return 'text-red-600 dark:text-red-400'
    return 'text-slate-600 dark:text-slate-400'
  }

  if (sectors.length === 0) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          Nenhum setor disponível no momento
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header com estatísticas */}
      <div ref={analysisHeaderRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {sectors.length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Setores Analisados
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {sectors.reduce((sum, s) => sum + s.companyCount, 0)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Empresas Avaliadas
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {Math.round(sectors.reduce((sum, s) => sum + s.averageScore, 0) / sectors.length)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Score Médio Geral
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Setores */}
      <div className="space-y-4">
        {sectors.map((sector) => {
          const isExpanded = expandedSectors.has(sector.sector)
          const displayedCompanies = isExpanded ? sector.topCompanies : sector.topCompanies.slice(0, 3)
          
          return (
            <Card key={sector.sector} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-950/30 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {sector.sector}
                      </CardTitle>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {sector.companyCount} empresas • Score médio: {Math.round(sector.averageScore)}
                      </p>
                    </div>
                  </div>
                  
                  <Badge 
                    variant="outline" 
                    className={`${getScoreBgColor(sector.averageScore)} border-none`}
                  >
                    <span className={`font-bold ${getScoreColor(sector.averageScore)}`}>
                      {Math.round(sector.averageScore)}
                    </span>
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {displayedCompanies.map((company, companyIdx) => {
                  const isTop1 = companyIdx === 0;
                  const shouldBlur = isTop1 && !isPremium;
                  
                  return (
                    <div key={company.ticker} className="relative">
                      <Link
                        href={shouldBlur ? '#' : `/acao/${company.ticker.toLowerCase()}`}
                        className="block"
                        onClick={(e) => {
                          if (shouldBlur) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <div className={`flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 transition-all group ${
                          shouldBlur 
                            ? 'blur-sm pointer-events-none' 
                            : 'hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                        }`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              <CompanyLogo 
                                ticker={company.ticker}
                                companyName={company.name}
                                logoUrl={company.logoUrl}
                                size={48}
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {company.ticker}
                                </span>
                                {isTop1 && (
                                  <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 text-xs">
                                    TOP 1
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                {company.name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <div className={`text-lg font-bold ${getScoreColor(company.score)}`}>
                                {company.score}
                              </div>
                              <div className={`text-xs flex items-center gap-1 ${getRecommendationColor(company.recommendation)}`}>
                                {getRecommendationIcon(company.recommendation)}
                                <span className="hidden sm:inline">{company.recommendation}</span>
                              </div>
                            </div>
                            
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                          </div>
                        </div>
                      </Link>
                      
                      {/* Overlay de conversão para TOP 1 (usuários gratuitos) */}
                      {shouldBlur && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-lg backdrop-blur-[2px]">
                          <div className="text-center px-4 py-3">
                            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                              Melhor Empresa do Setor
                            </p>
                            <Button
                              asChild
                              size="sm"
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg"
                            >
                              <Link href="/checkout?plan=premium">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Desbloquear Premium
                              </Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Botão para expandir/recolher */}
                {sector.topCompanies.length > 3 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2"
                    onClick={() => toggleSector(sector.sector)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Ver Menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Ver Todas ({sector.topCompanies.length} empresas)
                      </>
                    )}
                  </Button>
                )}

                {/* Link para comparar empresas do setor */}
                <Button
                  asChild
                  variant="outline"
                  className="w-full mt-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                >
                  <Link href={`/compara-acoes/${
                    // Se usuário não é Premium, exclui TOP 1 da comparação
                    (isPremium ? sector.topCompanies : sector.topCompanies.slice(1))
                      .map(c => c.ticker)
                      .join('/')
                  }`}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Comparar {isPremium ? sector.topCompanies.length : sector.topCompanies.length - 1} Empresas do Setor
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Seletor de Setores (Premium) ou upgrade (Gratuito) */}
      {remainingSectors.length > 0 && (
        <div className="mt-8">
          {isPremium ? (
            <SectorSelector
              availableSectors={remainingSectors}
              onSelectSectors={loadSelectedSectors}
              loadingSectors={loadingSectors}
              loadedSectors={loadedSectorNames}
            />
          ) : (
            <Card className="border-2 border-dashed border-blue-300 dark:border-blue-700">
              <CardContent className="py-8 text-center">
                <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  Análise Completa Exclusiva Premium
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Desbloqueie a análise de todos os {allAvailableSectors.length} setores da B3 e compare as melhores empresas de cada segmento
                </p>
                <Button 
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Link href="/planos">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Fazer Upgrade Premium
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* CTA Final */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800 mt-8">
        <CardContent className="py-8 text-center">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Análise Personalizada de Empresas
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
            Quer ir além da análise setorial? Crie rankings personalizados com diferentes modelos de análise para escolher as melhores empresas de acordo com sua estratégia.
          </p>
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Link href="/ranking">
              <TrendingUp className="w-5 h-5 mr-2" />
              Criar Ranking Personalizado
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

