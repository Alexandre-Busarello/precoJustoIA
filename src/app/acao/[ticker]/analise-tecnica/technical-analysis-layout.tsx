import { AssetPriceHeader } from './asset-price-header'
import { priceStatItems, type PriceStats } from './price-stats'

export interface TechnicalAnalysisLayoutProps {
  ticker: string
  name: string
  sector?: string | null
  logoUrl?: string | null
  /** Página do ativo (ex.: /acao/petr4), destino do "Voltar". */
  assetPath: string
  stats: PriceStats
  /** Conteúdo extra no cabeçalho (ex.: link para o ticker anterior). */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

/** Contêiner e cabeçalho comuns das páginas de análise técnica (ação, BDR e ETF). */
export function TechnicalAnalysisLayout({
  ticker,
  name,
  sector,
  logoUrl,
  assetPath,
  stats,
  headerExtra,
  children,
}: TechnicalAnalysisLayoutProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pt-4 pb-12">
      <AssetPriceHeader
        ticker={ticker}
        name={name}
        pageLabel="Análise técnica"
        subtitle={sector ? `${name} · ${sector}` : name}
        logoUrl={logoUrl}
        back={{ href: assetPath, label: `Voltar para ${ticker}` }}
        stats={priceStatItems(stats)}
      >
        {headerExtra}
      </AssetPriceHeader>
      {children}
    </div>
  )
}
