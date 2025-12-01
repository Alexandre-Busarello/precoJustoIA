"use client"

import { useState, useEffect } from "react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { ScreeningResultsBlur } from "./screening-results-blur"
import { Button } from "@/components/ui/button"
import { Loader2, Info } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScreeningPreset } from "@/lib/screening-presets"
import { SocialShareButton } from "./social-share-button"

interface RankingResponse {
  model: string
  params: any
  rational: string
  results: Array<{
    ticker: string
    name: string
    sector: string | null
    currentPrice: number
    logoUrl?: string | null
    fairValue: number | null
    upside: number | null
    marginOfSafety: number | null
    rational: string
    key_metrics?: Record<string, number | null>
    fairValueModel?: string | null
  }>
  count: number
}

interface ScreeningConversionPageProps {
  preset: ScreeningPreset
}

export function ScreeningConversionPage({ preset }: ScreeningConversionPageProps) {
  const { isPremium } = usePremiumStatus()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<RankingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [shareUrl, setShareUrl] = useState("")

  // Obter URL atual para compartilhamento
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href)
    }
  }, [])

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      setError(null)

      try {
        // Magic Formula usa modelo diferente
        const model = preset.slug === 'ranking-formula-magica-b3' ? 'magicFormula' : 'screening'
        const params = preset.slug === 'ranking-formula-magica-b3' 
          ? { assetTypeFilter: preset.params.assetTypeFilter }
          : {
              ...preset.params,
              includeBDRs: preset.params.assetTypeFilter === 'both' || preset.params.assetTypeFilter === 'bdr',
            }

        const response = await fetch("/api/rank-builder", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            params,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: RankingResponse = await response.json()
        setResults(data)
      } catch (err) {
        console.error("Erro ao gerar screening:", err)
        setError("Erro ao carregar resultados. Tente novamente.")
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [preset])

  const formatFilters = () => {
    const filters: string[] = []
    const params = preset.params

    if (params.plFilter?.enabled) {
      filters.push(`P/L ${params.plFilter.max !== undefined ? `≤ ${params.plFilter.max}` : ''}${params.plFilter.min !== undefined ? ` ≥ ${params.plFilter.min}` : ''}`)
    }
    if (params.pvpFilter?.enabled) {
      filters.push(`P/VP ${params.pvpFilter.max !== undefined ? `≤ ${params.pvpFilter.max}` : ''}${params.pvpFilter.min !== undefined ? ` ≥ ${params.pvpFilter.min}` : ''}`)
    }
    if (params.margemLiquidaFilter?.enabled) {
      filters.push(`Margem Líquida ${params.margemLiquidaFilter.min !== undefined ? `≥ ${(params.margemLiquidaFilter.min * 100).toFixed(1)}%` : ''}`)
    }
    if (params.dyFilter?.enabled) {
      filters.push(`Dividend Yield ${params.dyFilter.min !== undefined ? `≥ ${(params.dyFilter.min * 100).toFixed(1)}%` : ''}`)
    }
    if (params.payoutFilter?.enabled) {
      filters.push(`Payout ${params.payoutFilter.min !== undefined ? `≥ ${(params.payoutFilter.min * 100).toFixed(1)}%` : ''}${params.payoutFilter.max !== undefined ? ` ≤ ${(params.payoutFilter.max * 100).toFixed(1)}%` : ''}`)
    }
    if (params.marketCapFilter?.enabled) {
      const maxBi = params.marketCapFilter.max ? (params.marketCapFilter.max / 1_000_000_000).toFixed(2) : null
      filters.push(`Market Cap ${maxBi ? `≤ R$ ${maxBi}bi` : ''}`)
    }
    if (params.cagrReceitas5aFilter?.enabled) {
      filters.push(`CAGR Receitas ${params.cagrReceitas5aFilter.min !== undefined ? `≥ ${(params.cagrReceitas5aFilter.min * 100).toFixed(1)}%` : ''}`)
    }
    if (params.dividaLiquidaEbitdaFilter?.enabled) {
      filters.push(`Dívida Líq/EBITDA ${params.dividaLiquidaEbitdaFilter.max !== undefined ? `≤ ${params.dividaLiquidaEbitdaFilter.max.toFixed(2)}x` : ''}`)
    }
    if (params.grahamUpsideFilter?.enabled) {
      filters.push(`Upside ${params.grahamUpsideFilter.min !== undefined ? `≥ ${params.grahamUpsideFilter.min.toFixed(0)}%` : ''}`)
    }

    return filters
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
        {/* Header com título e botões de ação */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex-1">
              {preset.title}
            </h1>
            {/* Botões de ação - Desktop */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              {shareUrl && (
                <SocialShareButton
                  url={shareUrl}
                  title={preset.title}
                  description={preset.description}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(true)}
              >
                <Info className="w-4 h-4 mr-2" />
                Ver Filtros
              </Button>
            </div>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed mb-4 sm:mb-0">
            {results && results.results.length > 0 ? (
              // Hook dinâmico baseado nos resultados reais
              preset.slug === 'as-acoes-mais-baratas-segundo-graham' 
                ? `O mentor do Warren Buffett tinha uma regra: nunca pagar caro. A IA aplicou a regra dele na B3 hoje e encontrou ${results.count} empresas que passam no teste de segurança e valor.`
                : preset.slug === 'top-vacas-leiteiras-dividendos'
                ? `Esqueça a poupança. A IA encontrou ${results.count} empresas que são verdadeiras "Vacas Leiteiras" da bolsa, pagando dividendos acima da Selic. Veja o Yield da primeira da lista...`
                : preset.slug === 'small-caps-crescimento-explosivo'
                ? `As gigantes já cresceram. O dinheiro grosso está nas pequenas. A IA filtrou ${results.count} empresas que estão crescendo a receita a mais de 20% ao ano. Essa aqui pode ser a próxima WEG...`
                : preset.slug === 'oportunidades-desconto-excessivo'
                ? `O mercado bateu demais nessas ações e errou a mão. A IA encontrou ${results.count} empresas com desconto excessivo em relação ao valor justo. Veja o potencial de valorização da primeira da lista...`
                : preset.slug === 'ranking-formula-magica-b3'
                ? `Existe uma fórmula matemática que bateu o mercado por 20 anos seguidos. Ela cruza qualidade com preço baixo. Hoje, o Ranking da Fórmula Mágica na B3 tem ${results.count} empresas ranqueadas. Veja o novo líder...`
                : preset.hook
            ) : preset.hook}
          </p>
          {/* Botões de ação - Mobile (abaixo do texto) */}
          <div className="sm:hidden flex gap-2 mt-4">
            {shareUrl && (
              <SocialShareButton
                url={shareUrl}
                title={preset.title}
                description={preset.description}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(true)}
              className="flex-1 justify-center"
            >
              <Info className="w-4 h-4 mr-2" />
              Ver Filtros
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-muted-foreground">Analisando empresas da B3...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div>
            <h2 className="hidden sm:block text-xl font-semibold mb-4">
              Resultados ({results.count} empresas encontradas)
            </h2>
            <ScreeningResultsBlur
              results={results.results}
              totalCount={results.count}
              isPremium={isPremium ?? false}
            />
          </div>
        )}

        {/* Modal de Configuração */}
        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Filtros Aplicados</DialogTitle>
              <DialogDescription>
                Esta estratégia usa os seguintes critérios para encontrar as melhores ações:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold mb-2">Filtros Ativos:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {formatFilters().map((filter, index) => (
                    <li key={index}>{filter}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Descrição:</h3>
                <p className="text-sm text-muted-foreground">{preset.description}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

