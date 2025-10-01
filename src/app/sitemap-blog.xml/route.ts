import { NextResponse } from 'next/server'
import { blogPosts } from '@/lib/blog-data'

export async function GET() {
  const baseUrl = 'https://precojusto.ai'
  
  try {
    // Gerar XML do sitemap do blog
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>2025-09-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
${blogPosts.map(post => `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${new Date(post.publishDate).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${post.featured ? '0.8' : '0.6'}</priority>
  </url>`).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
      },
    })
  } catch (error) {
    console.error('Erro ao gerar sitemap do blog:', error)
    return new NextResponse('Erro interno', { status: 500 })
  }
}




