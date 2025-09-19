import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://precojusto.ai'
  
  // allow: '/',
  // disallow: [
  //   '/api/',
  //   '/dashboard/',
  //   '/login/',
  //   '/register/',
  //   '/_next/',
  //   '/admin/',
  //   '/private/',
  //   '*.json',
  //   '/test-markdown/',
  // ],

  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/', // Desabilita indexação durante fase alfa
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
