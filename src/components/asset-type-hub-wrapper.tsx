import { AssetTypeHub } from "./asset-type-hub"
import { SEOContentHub } from "./seo-content-hub"
import { Footer } from "./footer"
import { HubMetadata } from "./hub-metadata"

interface AssetTypeHubWrapperProps {
  pageType: 'screening' | 'ranking'
  title: string
  description: string
}

export function AssetTypeHubWrapper({ pageType, title, description }: AssetTypeHubWrapperProps) {
  return (
    <>
      {/* Metadata SEO */}
      <HubMetadata pageType={pageType} />
      
      {/* Client Component - HUB de seleção */}
      <AssetTypeHub pageType={pageType} title={title} description={description} />
      
      {/* Server Component - Conteúdo SEO */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <SEOContentHub pageType={pageType} />
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </>
  )
}

