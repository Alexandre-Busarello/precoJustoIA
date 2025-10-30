import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const baseUrl = 'https://precojusto.ai'
  
  try {
    // Buscar todas as empresas com tipo de ativo
    const companies = await prisma.company.findMany({
      select: {
        ticker: true,
        assetType: true,
        updatedAt: true,
      },
      orderBy: {
        ticker: 'asc'
      }
    })

    // Função para determinar a URL correta baseada no tipo de ativo
    const getAssetUrl = (ticker: string, assetType: string) => {
      const lowerTicker = ticker.toLowerCase()
      switch (assetType) {
        case 'FII':
          return `${baseUrl}/fii/${lowerTicker}`
        case 'BDR':
          return `${baseUrl}/bdr/${lowerTicker}`
        case 'ETF':
          return `${baseUrl}/etf/${lowerTicker}`
        case 'STOCK':
        default:
          return `${baseUrl}/acao/${lowerTicker}`
      }
    }

    // Gerar XML do sitemap de empresas
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${companies.map(company => `  <url>
    <loc>${getAssetUrl(company.ticker, company.assetType)}</loc>
    <lastmod>${(company.updatedAt || new Date('2025-09-01')).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
      },
    })
  } catch (error) {
    console.error('Erro ao gerar sitemap de empresas:', error)
    return new NextResponse('Erro interno', { status: 500 })
  }
}
