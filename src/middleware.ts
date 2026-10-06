import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Parâmetros que podem permanecer nas páginas de ativo/comparação: rastreamento de campanhas
// (utm_*, cliques de anúncios) e os fluxos internos que dependem da query string.
const ALLOWED_QUERY_PARAMS = new Set([
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ref',
  'source',
  'subscribe',
  'new_user',
  'feature',
])

function isAllowedQueryParam(key: string) {
  // Parâmetros internos do Next (ex.: _rsc) nunca podem ser removidos
  return key.startsWith('_') || key.startsWith('utm_') || ALLOWED_QUERY_PARAMS.has(key)
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Conteúdo removido permanentemente: 410 Gone acelera a desindexação no Google
  if (pathname === '/fundador' || pathname.startsWith('/fundador/') || pathname === '/eu.png') {
    return new NextResponse('Gone', {
      status: 410,
      headers: { 'X-Robots-Tag': 'noindex, noarchive, noimageindex' },
    })
  }

  // Crawl budget: tickers em maiúsculas viram minúsculas e parâmetros de query sem função
  // são removidos, num único redirect 301 (evita cadeias de redirect e URLs duplicadas)
  if (pathname.startsWith('/acao/') || pathname.startsWith('/compara-acoes/')) {
    const segments = pathname.split('/')
    let pathChanged = false

    for (let i = 2; i < segments.length; i++) {
      const segment = segments[i]
      if (segment && segment !== segment.toLowerCase() && /^[A-Z0-9]+$/.test(segment)) {
        segments[i] = segment.toLowerCase()
        pathChanged = true
      }
    }

    const params = request.nextUrl.searchParams
    const queryChanged = search !== '' && [...params.keys()].some((key) => !isAllowedQueryParam(key))

    if (pathChanged || queryChanged) {
      const url = request.nextUrl.clone()
      url.pathname = segments.join('/')
      if (queryChanged) {
        url.search = ''
        for (const [key, value] of params) {
          if (isAllowedQueryParam(key)) url.searchParams.append(key, value)
        }
      }
      return NextResponse.redirect(url, 301)
    }
  }

  // Rotas administrativas exigem sessão (a verificação de admin acontece nas páginas/APIs)
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Webhook antigo do Stripe aponta para a rota de API correta
  if (pathname === '/webhooks/stripe') {
    return NextResponse.redirect(new URL('/api/webhooks/stripe', request.url), 301)
  }

  return NextResponse.next()
}

// /api/* fica fora do matcher: o rate limiter atual (api-global-protection) depende de APIs
// do Node (process.on, cliente Redis) e não roda no Edge runtime. Proteção de API pendente de
// um limiter compatível com Edge (ou middleware em runtime nodejs) e de decisão sobre limites.
export const config = {
  matcher: [
    '/fundador',
    '/fundador/:path*',
    '/eu.png',
    '/admin/:path*',
    '/webhooks/stripe',
    '/acao/:path*',
    '/compara-acoes/:path*',
  ],
}
