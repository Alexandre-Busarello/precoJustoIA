import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const baseUrl = 'https://precojusto.ai'
  
  try {
    // Buscar apenas ações (STOCK) para análise técnica
    const companies = await prisma.company.findMany({
      where: {
        assetType: 'STOCK'
      },
      select: {
        ticker: true,
        updatedAt: true,
      },
      orderBy: {
        ticker: 'asc'
      }
    })

    // Gerar XML do sitemap de análises técnicas
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${companies.map(company => `  <url>
    <loc>${baseUrl}/acao/${company.ticker.toLowerCase()}/analise-tecnica</loc>
    <lastmod>${(company.updatedAt || new Date('2025-09-01')).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
      },
    })
  } catch (error) {
    console.error('Erro ao gerar sitemap de análises técnicas:', error)
    return new NextResponse('Erro interno', { status: 500 })
  }
}

