/**
 * EXEMPLOS: CACHE COM PARÂMETROS CORRIGIDO
 * 
 * Este arquivo demonstra como usar o sistema de cache
 * corrigido que considera parâmetros nas chaves de cache.
 */

import { safeQuery, safeQueryWithParams, createCacheKey } from '@/lib/prisma-wrapper'
import { prisma } from '@/lib/prisma'

// =====================================================
// PROBLEMA ANTERIOR (INCORRETO)
// =====================================================

// ❌ ANTES: Mesma chave de cache para queries diferentes
export async function searchCompaniesOLD(query: string) {
  return await safeQuery('search-companies', () =>
    prisma.company.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' }
      },
      take: 10
    })
  )
  // Problema: 'search-companies' gera a mesma chave para qualquer query
  // "petr" e "vale" usariam o mesmo cache!
}

// =====================================================
// SOLUÇÃO CORRIGIDA (CORRETO)
// =====================================================

// ✅ DEPOIS: Chaves únicas baseadas nos parâmetros
export async function searchCompaniesNEW(query: string) {
  return await safeQueryWithParams('search-companies', () =>
    prisma.company.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' }
      },
      take: 10
    }),
    {
      q: query,
      take: 10,
      mode: 'insensitive'
    }
  )
  // ✅ Agora cada query tem sua própria chave:
  // "petr" → search-companies-q=petr&take=10&mode=insensitive
  // "vale" → search-companies-q=vale&take=10&mode=insensitive
}

// =====================================================
// EXEMPLOS PRÁTICOS DE USO
// =====================================================

// ✅ Busca com paginação
export async function getCompaniesPaginated(page: number, limit: number, sector?: string) {
  return await safeQueryWithParams('companies-paginated', () =>
    prisma.company.findMany({
      where: sector ? { sector } : {},
      skip: page * limit,
      take: limit,
      orderBy: { name: 'asc' }
    }),
    {
      page,
      limit,
      sector: sector || 'all'
    }
  )
  // Chaves diferentes para cada combinação:
  // page=0&limit=10&sector=all
  // page=1&limit=10&sector=all
  // page=0&limit=10&sector=Tecnologia
}

// ✅ Filtros complexos
export async function getCompaniesFiltered(filters: {
  sector?: string
  minMarketCap?: number
  maxPE?: number
  hasData?: boolean
}) {
  return await safeQueryWithParams('companies-filtered', () =>
    prisma.company.findMany({
      where: {
        ...(filters.sector && { sector: filters.sector }),
        ...(filters.hasData && {
          financialData: { some: {} }
        }),
        financialData: {
          some: {
            ...(filters.minMarketCap && {
              marketCap: { gte: filters.minMarketCap }
            }),
            ...(filters.maxPE && {
              pl: { lte: filters.maxPE }
            })
          }
        }
      },
      include: {
        financialData: { take: 1, orderBy: { year: 'desc' } }
      }
    }),
    {
      sector: filters.sector || 'any',
      minMarketCap: filters.minMarketCap || 0,
      maxPE: filters.maxPE || 999,
      hasData: filters.hasData || false
    }
  )
}

// ✅ Busca por usuário específico (deve pular cache)
export async function getUserPortfolios(userId: string) {
  return await safeQuery('user-portfolios', () =>
    prisma.portfolio.findMany({
      where: { userId },
      include: { assets: true }
    }),
    { skipCache: true } // Dados específicos do usuário não devem ser cacheados
  )
}

// ✅ Ranking com parâmetros
export async function getTopCompaniesByMetric(
  metric: 'roe' | 'roic' | 'dy',
  sector?: string,
  limit: number = 20
) {
  return await safeQueryWithParams('top-companies-by-metric', () =>
    prisma.company.findMany({
      where: {
        ...(sector && { sector }),
        financialData: { some: {} }
      },
      include: {
        financialData: {
          take: 1,
          orderBy: { year: 'desc' }
        }
      },
      take: limit
    }),
    {
      metric,
      sector: sector || 'all',
      limit
    }
  )
}

// =====================================================
// USO MANUAL DA FUNÇÃO createCacheKey
// =====================================================

// ✅ Para casos especiais onde você quer controle total
export async function customCacheExample(params: any) {
  const cacheKey = createCacheKey({
    type: 'custom',
    timestamp: Math.floor(Date.now() / (1000 * 60 * 5)), // Renovar a cada 5 minutos
    ...params
  })

  return await safeQuery('custom-query', () =>
    prisma.company.findMany(),
    { cacheKey }
  )
}

// =====================================================
// COMPARAÇÃO DE CHAVES GERADAS
// =====================================================

export function demonstrateCacheKeys() {
  console.log('🔑 Exemplos de chaves de cache geradas:')
  
  // Diferentes queries de busca
  console.log('Search "petr":', createCacheKey({ q: 'petr', take: 10 }))
  console.log('Search "vale":', createCacheKey({ q: 'vale', take: 10 }))
  
  // Diferentes páginas
  console.log('Page 0:', createCacheKey({ page: 0, limit: 10 }))
  console.log('Page 1:', createCacheKey({ page: 1, limit: 10 }))
  
  // Diferentes filtros
  console.log('Tech sector:', createCacheKey({ sector: 'Tecnologia', minMarketCap: 1000000 }))
  console.log('Finance sector:', createCacheKey({ sector: 'Financeiro', minMarketCap: 1000000 }))
  
  // Parâmetros nulos são filtrados
  console.log('With nulls:', createCacheKey({ q: 'test', sector: null, limit: undefined }))
  // Resultado: "limit=undefined&q=test" (sector=null é filtrado)
}

// =====================================================
// LOGS ESPERADOS APÓS CORREÇÃO
// =====================================================

/*
ANTES (INCORRETO):
💾 Query cacheada: search-companies (TTL: 3600s)
GET /api/search-companies?q=petr 200 in 2314ms
💾 Query cacheada: search-companies (TTL: 3600s) // ❌ Mesma chave!
GET /api/search-companies?q=vale 200 in 15ms    // ❌ Retorna dados de "petr"!

DEPOIS (CORRETO):
💾 Query cacheada: search-companies-q=petr&take=10&mode=insensitive (TTL: 3600s)
GET /api/search-companies?q=petr 200 in 2314ms
💾 Query cacheada: search-companies-q=vale&take=10&mode=insensitive (TTL: 3600s)
GET /api/search-companies?q=vale 200 in 1876ms  // ✅ Nova query, dados corretos!
📦 Cache HIT: search-companies-q=petr&take=10&mode=insensitive
GET /api/search-companies?q=petr 200 in 12ms    // ✅ Cache hit correto!
*/

// =====================================================
// MIGRAÇÃO DE APIs EXISTENTES
// =====================================================

// Para migrar APIs existentes, substitua:

// ❌ ANTES:
// await safeQuery('query-name', operation)

// ✅ DEPOIS:
// await safeQueryWithParams('query-name', operation, { param1, param2 })

// Ou para controle manual:
// await safeQuery('query-name', operation, { 
//   cacheKey: createCacheKey({ param1, param2 }) 
// })

export default {
  searchCompaniesNEW,
  getCompaniesPaginated,
  getCompaniesFiltered,
  getUserPortfolios,
  getTopCompaniesByMetric,
  customCacheExample,
  demonstrateCacheKeys
}
