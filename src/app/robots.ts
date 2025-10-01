import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://precojusto.ai'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/acao/',
          '/compara-acoes/',
          '/ranking',
          '/comparador',
          '/analise-setorial',
          '/metodologia',
          '/planos',
          '/blog/',
          '/sobre',
          '/contato',
          '/como-funciona',
          '/fundador',
          '/backtesting-carteiras',
        ],
        disallow: [
          '/api/',
          '/dashboard/',
          '/login/',
          '/register/',
          '/_next/',
          '/admin/',
          '/private/',
          '*.json',
          '/test-markdown/',
          '/checkout/',
          '/esqueci-senha/',
          '/redefinir-senha/',
          '/lgpd',
          '/termos-de-uso',
          '/*?*', // Bloquear URLs com parâmetros de query
          '/sitemap-*.xml', // Bloquear sitemaps individuais do crawl direto
        ],
        crawlDelay: 1, // 1 segundo entre requests para preservar crawl budget
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/acao/',
          '/compara-acoes/',
          '/ranking',
          '/comparador',
          '/analise-setorial',
          '/metodologia',
          '/planos',
          '/blog/',
          '/sobre',
          '/contato',
          '/como-funciona',
          '/fundador',
          '/backtesting-carteiras',
        ],
        disallow: [
          '/api/',
          '/dashboard/',
          '/login/',
          '/register/',
          '/_next/',
          '/admin/',
          '/private/',
          '*.json',
          '/test-markdown/',
          '/checkout/',
          '/esqueci-senha/',
          '/redefinir-senha/',
          '/lgpd',
          '/termos-de-uso',
          '/*?*',
        ],
        // Sem crawlDelay para Googlebot para não limitar muito
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
    sitemap: [
      `${baseUrl}/sitemap-index.xml`,
      `${baseUrl}/sitemap.xml`,
    ],
    host: baseUrl,
  }
}
