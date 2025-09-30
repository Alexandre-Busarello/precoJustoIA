import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const baseUrl = 'https://precojusto.ai'
  
  try {
    // Buscar apenas empresas com dados financeiros relevantes
    const companiesForComparison = await prisma.company.findMany({
      select: {
        ticker: true,
        sector: true,
        financialData: {
          select: {
            marketCap: true,
          },
          orderBy: {
            year: 'desc'
          },
          take: 1
        }
      },
      where: {
        AND: [
          { sector: { not: null } },
          {
            financialData: {
              some: {
                marketCap: { not: null }
              }
            }
          }
        ]
      }
    })

    // Filtrar apenas empresas com market cap > 1 bilhão
    const validCompanies = companiesForComparison
      .filter(company => {
        const marketCap = Number(company.financialData[0]?.marketCap || 0)
        return marketCap > 1000000000
      })
      .map(company => ({
        ...company,
        marketCap: Number(company.financialData[0]?.marketCap || 0)
      }))
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 100) // Top 100 empresas

    const comparisonUrls: Array<{url: string, priority: number}> = []

    // Agrupar por setor
    const companiesBySector = validCompanies.reduce((acc, company) => {
      if (!company.sector) return acc
      if (!acc[company.sector]) acc[company.sector] = []
      acc[company.sector].push(company)
      return acc
    }, {} as Record<string, typeof validCompanies>)

    // Comparações setoriais - apenas top 3 por setor
    Object.entries(companiesBySector).forEach(([, sectorCompanies]) => {
      if (sectorCompanies.length >= 2) {
        const topCompanies = sectorCompanies.slice(0, 3)
        
        for (let i = 0; i < topCompanies.length; i++) {
          for (let j = i + 1; j < topCompanies.length; j++) {
            const ticker1 = topCompanies[i].ticker.toLowerCase()
            const ticker2 = topCompanies[j].ticker.toLowerCase()
            
            comparisonUrls.push({
              url: `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`,
              priority: 0.8
            })
          }
        }
      }
    })

    // Comparações cross-setoriais - top 15 empresas
    const topCompanies = validCompanies.slice(0, 15)
    for (let i = 0; i < Math.min(8, topCompanies.length); i++) {
      for (let j = i + 1; j < Math.min(12, topCompanies.length); j++) {
        const ticker1 = topCompanies[i].ticker.toLowerCase()
        const ticker2 = topCompanies[j].ticker.toLowerCase()
        
        const url = `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`
        const exists = comparisonUrls.some(existing => existing.url === url)
        
        if (!exists) {
          comparisonUrls.push({
            url,
            priority: 0.9
          })
        }
      }
    }

    // Limitar a 500 URLs de comparação
    const finalUrls = comparisonUrls
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 500)

    // Gerar XML do sitemap de comparações
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${finalUrls.map(item => `  <url>
    <loc>${item.url}</loc>
    <lastmod>2025-09-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
      },
    })
  } catch (error) {
    console.error('Erro ao gerar sitemap de comparações:', error)
    return new NextResponse('Erro interno', { status: 500 })
  }
}
