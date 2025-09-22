import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  
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
    '/admin/:path*',
    '/upgrade',
    '/upgrade/:path*',
    '/webhooks/stripe'
  ]
}
