import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  
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
    '/upgrade',
    '/upgrade/:path*',
    '/webhooks/stripe'
  ]
}
