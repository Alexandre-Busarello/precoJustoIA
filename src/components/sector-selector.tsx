'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Building2,
  Loader2,
  Sparkles,
  Check,
  ChevronRight,
  Landmark,
  Battery,
  Cpu,
  ShoppingCart,
  Home,
  Wrench,
  Heart,
  Zap,
  Globe,
  Package
} from 'lucide-react'

// Mapeamento de ícones por setor
const SECTOR_ICONS: Record<string, any> = {
  'Financeiro': Landmark,
  'Energia': Battery,
  'Tecnologia da Informação': Cpu,
  'Saúde': Heart,
  'Consumo Cíclico': ShoppingCart,
  'Consumo Não Cíclico': Package,
  'Bens Industriais': Wrench,
  'Materiais Básicos': Package,
  'Imobiliário': Home,
  'Utilidade Pública': Zap,
  'Comunicações': Globe,
  'default': Building2
}

// Grupos de setores para melhor organização
const SECTOR_GROUPS = [
  {
    name: 'Principais',
    sectors: [
      'Financeiro',
      'Energia',
      'Tecnologia da Informação',
      'Saúde'
    ]
  },
  {
    name: 'Consumo',
    sectors: [
      'Consumo Cíclico',
      'Consumo Não Cíclico'
    ]
  },
  {
    name: 'Industrial & Materiais',
    sectors: [
      'Bens Industriais',
      'Materiais Básicos'
    ]
  },
  {
    name: 'Infraestrutura & Serviços',
    sectors: [
      'Imobiliário',
      'Utilidade Pública',
      'Comunicações'
    ]
  }
]

interface SectorSelectorProps {
  availableSectors: string[]
  onSelectSectors: (sectors: string[]) => Promise<void>
  loadingSectors: string[]
  loadedSectors: string[]
}

export function SectorSelector({ 
  availableSectors, 
  onSelectSectors,
  loadingSectors,
  loadedSectors
}: SectorSelectorProps) {
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const toggleSector = (sector: string) => {
    setSelectedSectors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sector)) {
        newSet.delete(sector)
      } else {
        newSet.add(sector)
      }
      return newSet
    })
  }

  const selectGroup = (sectors: string[]) => {
    setSelectedSectors(prev => {
      const newSet = new Set(prev)
      sectors.forEach(s => {
        if (availableSectors.includes(s) && !loadedSectors.includes(s)) {
          newSet.add(s)
        }
      })
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedSectors(new Set(
      availableSectors.filter(s => !loadedSectors.includes(s))
    ))
  }

  const clearSelection = () => {
    setSelectedSectors(new Set())
  }

  const handleAnalyze = async () => {
    if (selectedSectors.size === 0) return
    
    setIsAnalyzing(true)
    try {
      await onSelectSectors(Array.from(selectedSectors))
      setSelectedSectors(new Set()) // Limpar seleção após análise
    } catch (error) {
      console.error('Erro ao analisar setores:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getSectorIcon = (sector: string) => {
    const IconComponent = SECTOR_ICONS[sector] || SECTOR_ICONS.default
    return <IconComponent className="w-5 h-5" />
  }

  const getSectorStatus = (sector: string): 'loaded' | 'loading' | 'available' => {
    if (loadedSectors.includes(sector)) return 'loaded'
    if (loadingSectors.includes(sector)) return 'loading'
    return 'available'
  }

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-blue-600 rounded-lg flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Continue explorando todos os setores
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Selecione um ou mais setores abaixo e clique em Analisar para ver as melhores empresas de cada segmento
            </p>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={availableSectors.filter(s => !loadedSectors.includes(s)).length === 0}
          >
            Selecionar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={selectedSectors.size === 0}
          >
            Limpar Seleção
          </Button>
          {SECTOR_GROUPS.map(group => (
            <Button
              key={group.name}
              variant="ghost"
              size="sm"
              onClick={() => selectGroup(group.sectors)}
              className="hidden sm:flex"
            >
              {group.name}
            </Button>
          ))}
        </div>

        {/* Contador e botão de análise */}
        {selectedSectors.size > 0 && (
          <div className="mt-4 flex items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-blue-600">
                {selectedSectors.size} {selectedSectors.size === 1 ? 'setor' : 'setores'} selecionado{selectedSectors.size === 1 ? '' : 's'}
              </Badge>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Tempo estimado: ~{selectedSectors.size * 3}s
              </span>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Analisar Setores
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Grid de setores por grupo */}
      {SECTOR_GROUPS.map(group => {
        const groupSectors = group.sectors.filter(s => availableSectors.includes(s))
        if (groupSectors.length === 0) return null

        return (
          <div key={group.name}>
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              {group.name}
              <Badge variant="secondary" className="text-xs">
                {groupSectors.length}
              </Badge>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {groupSectors.map(sector => {
                const status = getSectorStatus(sector)
                const isSelected = selectedSectors.has(sector)
                const isLoaded = status === 'loaded'
                const isLoading = status === 'loading'
                const isDisabled = isLoaded || isLoading

                return (
                  <Card
                    key={sector}
                    className={`cursor-pointer transition-all ${
                      isDisabled
                        ? 'opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500 dark:ring-blue-600'
                        : 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                    }`}
                    onClick={() => !isDisabled && toggleSector(sector)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {isLoaded ? (
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : isLoading ? (
                            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                          ) : (
                            <Checkbox
                              checked={isSelected}
                              className="w-5 h-5"
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => toggleSector(sector)}
                            />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-md ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {getSectorIcon(sector)}
                            </div>
                          </div>
                          <h5 className="font-medium text-sm text-slate-900 dark:text-white leading-tight">
                            {sector}
                          </h5>
                          {isLoaded && (
                            <Badge variant="outline" className="mt-2 text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                              ✓ Analisado
                            </Badge>
                          )}
                          {isLoading && (
                            <Badge variant="outline" className="mt-2 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                              Processando...
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

