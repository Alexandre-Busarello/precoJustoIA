import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const baseUrl = 'https://precojusto.ai'
  
  try {
    // Buscar todos os índices disponíveis
    const indices = await prisma.indexDefinition.findMany({
      select: {
        ticker: true,
        name: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: {
        ticker: 'asc'
      }
    })

    // Gerar XML do sitemap de índices
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/indices</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${indices.map(index => {
  const lastMod = index.updatedAt || index.createdAt || new Date()
  return `  <url>
    <loc>${baseUrl}/indices/${index.ticker.toLowerCase()}</loc>
    <lastmod>${lastMod.toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`
}).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=21600', // Cache por 1 hora, pode servir stale por até 6 horas
      },
    })
  } catch (error) {
    console.error('Erro ao gerar sitemap de índices:', error)
    return new NextResponse('Erro interno', { status: 500 })
  }
}

