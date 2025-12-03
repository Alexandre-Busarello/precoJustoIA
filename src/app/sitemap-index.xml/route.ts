import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = 'https://precojusto.ai'
  const currentDate = '2025-09-30' // Data atual
  
  // Sitemap Index XML
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-blog.xml</loc>
    <lastmod>2025-11-11</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-companies.xml</loc>
    <lastmod>2025-09-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-comparisons.xml</loc>
    <lastmod>2025-09-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-technical-analysis.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-indices.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`

  return new NextResponse(sitemapIndex, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
    },
  })
}
