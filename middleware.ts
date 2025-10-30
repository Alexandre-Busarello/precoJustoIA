import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Permitir que as páginas de ação, FII, BDR e ETF façam seus próprios redirects
  // O middleware não interfere, deixando que as páginas individuais decidam
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/acao/:ticker*',
    '/fii/:ticker*', 
    '/bdr/:ticker*',
    '/etf/:ticker*'
  ]
}