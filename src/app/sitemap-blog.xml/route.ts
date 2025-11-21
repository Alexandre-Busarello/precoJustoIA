import { NextResponse } from 'next/server'
import { getAllPosts } from '@/lib/blog-service'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://precojusto.ai'
  
  try {
    // Carregar todos os posts
    const blogPosts = await getAllPosts()
    
    // Obter a data mais recente de atualização
    const lastModDate = blogPosts.length > 0 
      ? new Date(blogPosts[0].publishDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
    
    // Gerar XML do sitemap do blog
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>${lastModDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
${blogPosts.map(post => {
  const postLastMod = post.lastModified || post.publishDate
  return `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${new Date(postLastMod).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${post.featured ? '0.8' : '0.6'}</priority>
  </url>`
}).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar sitemap do blog:', error)
    return new NextResponse('Erro interno', { status: 500 })
  }
}





