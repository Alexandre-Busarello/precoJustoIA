import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getAllPresetSlugs } from '@/lib/screening-presets'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://precojusto.ai'

  const [fiis, etfs] = await Promise.all([
    prisma.company.findMany({
      where: { assetType: 'FII', isActive: true },
      select: { ticker: true, updatedAt: true },
      orderBy: { ticker: 'asc' },
    }),
    prisma.company.findMany({
      where: { assetType: 'ETF', isActive: true },
      select: { ticker: true, updatedAt: true },
      orderBy: { ticker: 'asc' },
    }),
  ])

  const fiiEntries: MetadataRoute.Sitemap = fiis.map((c) => ({
    url: `${baseUrl}/fii/${c.ticker.toLowerCase()}`,
    lastModified: c.updatedAt ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  const etfEntries: MetadataRoute.Sitemap = etfs.map((c) => ({
    url: `${baseUrl}/etf/${c.ticker.toLowerCase()}`,
    lastModified: c.updatedAt ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.70,
  }))

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/acompanhar-acoes-bolsa-de-valores`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/screening-acoes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/screening-fiis`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...getAllPresetSlugs().map((slug) => ({
      url: `${baseUrl}/screening-acoes/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.85,
    })),
    {
      url: `${baseUrl}/onde-aportar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/metodologia`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/comparador`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/backtest`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/analise-setorial`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/pl-bolsa`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/projecoes-ibov`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/calculadoras`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/calculadoras/dividend-yield`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/calculadoras/recuperacao`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/radar-dividendos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/indices`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/calculadora-dividend-yield-guia-completo`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lgpd`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/parceiros/clube-dos-dividendos`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  return [...staticEntries, ...fiiEntries, ...etfEntries]
}