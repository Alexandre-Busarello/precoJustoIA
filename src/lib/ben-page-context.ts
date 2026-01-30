/**
 * Ben Page Context - Helper para extrair contexto da página atual
 * 
 * Extrai informações relevantes da página para contextualizar o Ben
 */

import { prisma } from './prisma'

export interface PageContext {
  pageType: 'action' | 'bdr' | 'radar' | 'dashboard' | 'fii' | 'etf' | 'index' | 'dividend_radar' | 'technical_analysis' | 'other'
  ticker?: string
  companyName?: string
  radarTickers?: string[]
}

/**
 * Extrai contexto da página baseado no pathname
 * 
 * @param pathname - Pathname da página atual (ex: /acao/PETR4)
 * @param pageData - Dados opcionais da página (para evitar busca adicional)
 * @returns Contexto da página estruturado
 */
export async function extractPageContext(
  pathname: string,
  pageData?: {
    ticker?: string
    companyName?: string
  }
): Promise<PageContext> {
  const context: PageContext = {
    pageType: 'other'
  }

  // Detectar tipo de página e extrair ticker se aplicável
  if (pathname.startsWith('/acao/')) {
    // Verificar se é análise técnica
    if (pathname.includes('/analise-tecnica')) {
      context.pageType = 'technical_analysis'
      const tickerMatch = pathname.match(/^\/acao\/([^/]+)\/analise-tecnica/)
      if (tickerMatch) {
        const ticker = tickerMatch[1].toUpperCase()
        context.ticker = ticker
        
        if (!pageData?.companyName) {
          try {
            const company = await prisma.company.findUnique({
              where: { ticker },
              select: { name: true }
            })
            if (company) {
              context.companyName = company.name
            }
          } catch (error) {
            console.error(`[Ben] Erro ao buscar nome da empresa para ${ticker}:`, error)
          }
        } else {
          context.companyName = pageData.companyName
        }
      }
    } else {
      context.pageType = 'action'
      const tickerMatch = pathname.match(/^\/acao\/([^/]+)/)
      if (tickerMatch) {
        const ticker = tickerMatch[1].toUpperCase()
        context.ticker = ticker
        
        // Buscar nome da empresa se não fornecido
        if (!pageData?.companyName) {
          try {
            const company = await prisma.company.findUnique({
              where: { ticker },
              select: { name: true }
            })
            if (company) {
              context.companyName = company.name
            }
          } catch (error) {
            console.error(`[Ben] Erro ao buscar nome da empresa para ${ticker}:`, error)
          }
        } else {
          context.companyName = pageData.companyName
        }
      }
    }
  } else if (pathname.startsWith('/bdr/')) {
    // Verificar se é análise técnica
    if (pathname.includes('/analise-tecnica')) {
      context.pageType = 'technical_analysis'
      const tickerMatch = pathname.match(/^\/bdr\/([^/]+)\/analise-tecnica/)
      if (tickerMatch) {
        const ticker = tickerMatch[1].toUpperCase()
        context.ticker = ticker
        
        if (!pageData?.companyName) {
          try {
            const company = await prisma.company.findUnique({
              where: { ticker },
              select: { name: true }
            })
            if (company) {
              context.companyName = company.name
            }
          } catch (error) {
            console.error(`[Ben] Erro ao buscar nome da empresa para ${ticker}:`, error)
          }
        } else {
          context.companyName = pageData.companyName
        }
      }
    } else {
      context.pageType = 'bdr'
      const tickerMatch = pathname.match(/^\/bdr\/([^/]+)/)
      if (tickerMatch) {
        const ticker = tickerMatch[1].toUpperCase()
        context.ticker = ticker
        
        if (!pageData?.companyName) {
          try {
            const company = await prisma.company.findUnique({
              where: { ticker },
              select: { name: true }
            })
            if (company) {
              context.companyName = company.name
            }
          } catch (error) {
            console.error(`[Ben] Erro ao buscar nome da empresa para ${ticker}:`, error)
          }
        } else {
          context.companyName = pageData.companyName
        }
      }
    }
  } else if (pathname.startsWith('/fii/')) {
    context.pageType = 'fii'
    const tickerMatch = pathname.match(/^\/fii\/([^/]+)/)
    if (tickerMatch) {
      context.ticker = tickerMatch[1].toUpperCase()
    }
  } else if (pathname.startsWith('/etf/')) {
    context.pageType = 'etf'
    const tickerMatch = pathname.match(/^\/etf\/([^/]+)/)
    if (tickerMatch) {
      context.ticker = tickerMatch[1].toUpperCase()
    }
  } else if (pathname.startsWith('/indices/')) {
    context.pageType = 'index'
    const tickerMatch = pathname.match(/^\/indices\/([^/]+)/)
    if (tickerMatch) {
      context.ticker = tickerMatch[1].toUpperCase()
    }
  } else if (pathname.startsWith('/radar-dividendos/')) {
    context.pageType = 'dividend_radar'
    const tickerMatch = pathname.match(/^\/radar-dividendos\/([^/]+)/)
    if (tickerMatch) {
      const ticker = tickerMatch[1].toUpperCase()
      context.ticker = ticker
      
      if (!pageData?.companyName) {
        try {
          const company = await prisma.company.findUnique({
            where: { ticker },
            select: { name: true }
          })
          if (company) {
            context.companyName = company.name
          }
        } catch (error) {
          console.error(`[Ben] Erro ao buscar nome da empresa para ${ticker}:`, error)
        }
      } else {
        context.companyName = pageData.companyName
      }
    }
  } else if (pathname === '/radar' || pathname.startsWith('/radar')) {
    context.pageType = 'radar'
    // Não buscamos tickers do radar aqui para evitar overhead
    // O Ben pode usar getUserRadar() se necessário
  } else if (pathname === '/dashboard' || pathname === '/') {
    context.pageType = 'dashboard'
  }

  return context
}

