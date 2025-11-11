import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { applyGlobalApiProtection } from '@/lib/api-global-protection'

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  
  // 🛡️ PROTEÇÃO GLOBAL: Rate limiting em todas as rotas /api/*
  // Isso aplica proteção básica automaticamente sem precisar alterar cada rota
  if (pathname.startsWith('/api/')) {
    const rateLimitResponse = await applyGlobalApiProtection(request)
    if (rateLimitResponse) {
      return rateLimitResponse // Rate limit excedido ou IP bloqueado
    }
    // Se não houver problema com rate limit, continuar com o processamento normal
  }
  
  // OTIMIZAÇÃO CRAWL BUDGET: Redirecionar tickers maiúsculos para minúsculos
  if (pathname.startsWith('/acao/') || pathname.startsWith('/compara-acoes/')) {
    const segments = pathname.split('/')
    let needsRedirect = false
    
    // Verificar se há tickers em maiúsculo
    for (let i = 2; i < segments.length; i++) {
      const segment = segments[i]
      if (segment && segment !== segment.toLowerCase() && /^[A-Z0-9]+$/.test(segment)) {
        segments[i] = segment.toLowerCase()
        needsRedirect = true
      }
    }
    
    // Redirecionar se necessário (301 - permanente)
    if (needsRedirect) {
      const newPath = segments.join('/')
      const url = new URL(newPath, request.url)
      if (search) url.search = search
      return NextResponse.redirect(url, 301)
    }
  }
  
  // Bloquear URLs com parâmetros de query desnecessários para SEO
  if (search && (pathname.startsWith('/acao/') || pathname.startsWith('/compara-acoes/'))) {
    const url = new URL(request.url)
    const allowedParams = ['utm_source', 'utm_medium', 'utm_campaign'] // Permitir apenas UTM
    
    let hasDisallowedParams = false
    for (const [key] of url.searchParams) {
      if (!allowedParams.includes(key)) {
        hasDisallowedParams = true
        break
      }
    }
    
    // Redirecionar para versão limpa se houver parâmetros não permitidos
    if (hasDisallowedParams) {
      const cleanUrl = new URL(pathname, request.url)
      // Manter apenas parâmetros UTM
      for (const param of allowedParams) {
        const value = url.searchParams.get(param)
        if (value) cleanUrl.searchParams.set(param, value)
      }
      return NextResponse.redirect(cleanUrl, 301)
    }
  }
  

  
  // Proteger rotas administrativas
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    // Verificar se o usuário é admin (será verificado novamente no servidor)
    // Por segurança, a verificação real de admin é feita nas páginas/APIs
  }
  
  // Redirecionar /upgrade para /checkout
  if (pathname === '/upgrade') {
    const url = new URL('/checkout', request.url)
    
    // Preservar query parameters (como redirect)
    if (search) {
      url.search = search
    }
    
    return NextResponse.redirect(url, 301) // Permanent redirect
  }
  
  // Redirecionar webhook do Stripe para a URL correta da API
  if (pathname === '/webhooks/stripe') {
    const url = new URL('/api/webhooks/stripe', request.url)
    return NextResponse.redirect(url, 301) // Permanent redirect
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',        // 🛡️ Proteger todas as rotas da API
    '/admin/:path*',
    '/upgrade',
    '/upgrade/:path*',
    '/webhooks/stripe',
    '/acao/:path*',
    '/compara-acoes/:path*'
  ]
}
