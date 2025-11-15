"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Globe, Layers, ArrowRight } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

type AssetType = 'b3' | 'bdr' | 'both'

interface AssetTypeHubProps {
  pageType: 'screening' | 'ranking'
  title: string
  description: string
}

const assetTypeOptions = [
  {
    id: 'b3' as AssetType,
    name: 'Ações B3',
    description: 'Apenas empresas brasileiras listadas na B3',
    icon: Building2,
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    hoverColor: 'hover:border-green-400 dark:hover:border-green-600'
  },
  {
    id: 'bdr' as AssetType,
    name: 'BDRs',
    description: 'Apenas Brazilian Depositary Receipts (empresas estrangeiras)',
    icon: Globe,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    hoverColor: 'hover:border-blue-400 dark:hover:border-blue-600'
  },
  {
    id: 'both' as AssetType,
    name: 'Ambos',
    description: 'Ações B3 e BDRs juntos',
    icon: Layers,
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    hoverColor: 'hover:border-purple-400 dark:hover:border-purple-600'
  }
]

function AssetTypeHubContent({ pageType, title, description }: AssetTypeHubProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSelect = (assetType: AssetType) => {
    const currentPath = pageType === 'screening' ? '/screening-acoes' : '/ranking'
    const params = new URLSearchParams(searchParams.toString())
    params.set('assetType', assetType)
    router.push(`${currentPath}?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background flex items-center justify-center p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent mb-4">
            {title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {assetTypeOptions.map((option) => {
            const Icon = option.icon
            return (
              <Card
                key={option.id}
                className={`${option.bgColor} ${option.borderColor} ${option.hoverColor} transition-all cursor-pointer border-2 hover:shadow-lg hover:scale-105`}
                onClick={() => handleSelect(option.id)}
              >
                <CardHeader>
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center mb-4 mx-auto`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-center text-xl">{option.name}</CardTitle>
                  <CardDescription className="text-center mt-2">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className={`w-full bg-gradient-to-r ${option.color} text-white hover:opacity-90`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelect(option.id)
                    }}
                  >
                    Selecionar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Info Box */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Sobre os tipos de ativos</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <strong>Ações B3:</strong> Empresas brasileiras listadas na Bolsa de Valores de São Paulo. 
                    Análise baseada em indicadores do mercado brasileiro.
                  </li>
                  <li>
                    <strong>BDRs:</strong> Brazilian Depositary Receipts representam ações de empresas estrangeiras. 
                    Critérios ajustados para refletir padrões do mercado internacional (principalmente americano).
                  </li>
                  <li>
                    <strong>Ambos:</strong> Inclui ações B3 e BDRs na mesma análise. 
                    Os critérios são ajustados automaticamente para cada tipo de ativo.
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function AssetTypeHub({ pageType, title, description }: AssetTypeHubProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <AssetTypeHubContent pageType={pageType} title={title} description={description} />
    </Suspense>
  )
}

