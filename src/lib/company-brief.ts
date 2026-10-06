import { prisma } from '@/lib/prisma'

export interface CompanyBrief {
  name: string | null
  logoUrl: string | null
  /** `STOCK`, `FII`, `ETF`, `BDR`… (enum `AssetType`). */
  assetType: string
}

/**
 * Nome, logo e tipo de ativo por ticker (chave em maiúsculas), para enriquecer listas com a identidade visual da
 * empresa. Só leitura; tickers sem cadastro ficam fora do mapa (a UI cai no monograma).
 */
export async function getCompanyBriefs(tickers: readonly string[]): Promise<Map<string, CompanyBrief>> {
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))]
  if (unique.length === 0) return new Map()
  const companies = await prisma.company.findMany({
    where: { ticker: { in: unique } },
    select: { ticker: true, name: true, logoUrl: true, assetType: true },
  })
  return new Map(
    companies.map((c) => [c.ticker.toUpperCase(), { name: c.name, logoUrl: c.logoUrl, assetType: c.assetType }])
  )
}
