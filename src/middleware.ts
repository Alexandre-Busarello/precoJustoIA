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

// ─── Rate limit de /api/* ─────────────────────────────────────────────────────
// Limite generoso por IP em janela fixa de 1 minuto. As rotas sensíveis (registro, login, calculadoras) mantêm os
// limites próprios. `API_RATE_LIMIT_MODE`: `enforce` (padrão) responde 429 acima do limite; `log` só registra;
// `off` desliga. No dev server o loopback fica de fora (as ferramentas locais dividem o mesmo IP).

export type ApiRateLimitMode = 'enforce' | 'log' | 'off'

export const API_RATE_LIMIT = { limit: 300, windowSeconds: 60 } as const

// Fora do limite global: NextAuth (polling de sessão, limites próprios), webhooks (assinatura própria) e health check
const API_RATE_LIMIT_EXEMPT_PREFIXES = ['/api/auth/', '/api/webhooks/', '/api/health']

export function parseApiRateLimitMode(value: string | undefined): ApiRateLimitMode {
  return value === 'log' || value === 'off' ? value : 'enforce'
}

/** Rotas isentas e chamadas autenticadas com `Authorization: Bearer <CRON_SECRET>` (crons da Vercel e jobs). */
export function isApiRateLimitExempt(pathname: string, authorization: string | null, cronSecret: string | undefined): boolean {
  if (API_RATE_LIMIT_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`
}

/** IP do cliente pelos headers do proxy (primeiro IP do `x-forwarded-for`). */
export function clientIpFromHeaders(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headers.get('x-real-ip')?.trim() || headers.get('cf-connecting-ip')?.trim() || 'unknown'
  return ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip
}

/** IP de loopback (ou ausente, quando não há proxy na frente do servidor). */
export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === 'unknown'
}

/** Chave do contador do IP na janela atual e segundos até a próxima janela. */
export function apiRateLimitWindow(ip: string, now: number, windowSeconds: number = API_RATE_LIMIT.windowSeconds) {
  const windowMs = windowSeconds * 1000
  const windowIndex = Math.floor(now / windowMs)
  return {
    key: `api:${ip}:${windowIndex}`,
    retryAfter: Math.max(1, Math.ceil(((windowIndex + 1) * windowMs - now) / 1000)),
  }
}

async function applyApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const mode = parseApiRateLimitMode(process.env.API_RATE_LIMIT_MODE)
  if (mode === 'off') return null
  if (isApiRateLimitExempt(request.nextUrl.pathname, request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return null
  }

  const ip = clientIpFromHeaders(request.headers)
  // Dev server local: as ferramentas da máquina (navegador, testes, screenshots) dividem o mesmo IP de loopback
  if (process.env.NODE_ENV === 'development' && isLoopbackIp(ip)) return null

  const { key, retryAfter } = apiRateLimitWindow(ip, Date.now())

  let count: number
  try {
    // Import dinâmico: o serviço depende do Redis e só carrega quando a requisição é de API
    const { rateLimitCache } = await import('@/lib/rate-limit-cache-service')
    count = await rateLimitCache.increment(key, { prefix: 'api-global', ttl: API_RATE_LIMIT.windowSeconds * 2 })
  } catch (error) {
    // Falha no contador nunca derruba a API
    console.warn('Rate limit de API indisponível:', error)
    return null
  }

  if (count <= API_RATE_LIMIT.limit) return null

  if (count === API_RATE_LIMIT.limit + 1) {
    console.warn(`[api-rate-limit] ${mode === 'log' ? 'excedido (só log)' : 'bloqueando'} ip=${ip} path=${request.nextUrl.pathname}`)
  }
  if (mode === 'log') return null

  return NextResponse.json(
    { error: 'Muitas requisições. Tente novamente em instantes.', code: 'RATE_LIMIT_EXCEEDED', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(API_RATE_LIMIT.limit),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    return (await applyApiRateLimit(request)) ?? NextResponse.next()
  }

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

// Middleware no runtime Node.js: o rate limiter usa o cliente Redis (indisponível no Edge)
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/fundador',
    '/fundador/:path*',
    '/eu.png',
    '/admin/:path*',
    '/webhooks/stripe',
    '/acao/:path*',
    '/compara-acoes/:path*',
    '/api/:path*',
  ],
}
