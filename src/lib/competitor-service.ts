import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache-service'

// Tipo para valores do Prisma que podem ser Decimal
type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

// Função para converter Decimal para number
function toNumber(value: PrismaDecimal | Date | string | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return parseFloat(String(value))
}

export interface CompetitorData {
  ticker: string
  name: string
  sector: string | null
  logoUrl?: string | null
  marketCap?: any
}

export interface GetSectorCompetitorsParams {
  currentTicker: string
  sector: string | null
  industry: string | null
  currentMarketCap?: number | null
  limit?: number
  assetType?: 'STOCK' | 'BDR' // Filtro por tipo de ativo
}

// Cache para competidores
const COMPETITORS_CACHE_TTL = 1440 * 60 // 1 dia em segundos

// Função para extrair prefixo do ticker (remove números finais)
function getTickerPrefix(ticker: string): string {
  return ticker.replace(/\d+$/, '') // Remove números no final
}

// Função para determinar o tamanho da empresa
function getCompanySize(marketCap: number | null): 'small_caps' | 'mid_caps' | 'blue_chips' | null {
  if (!marketCap) return null
  
  // Valores em bilhões de reais
  const marketCapBillions = marketCap / 1_000_000_000
  
  if (marketCapBillions < 2) {
    return 'small_caps' // Menos de R$ 2 bilhões
  } else if (marketCapBillions >= 2 && marketCapBillions < 10) {
    return 'mid_caps' // R$ 2-10 bilhões
  } else {
    return 'blue_chips' // Mais de R$ 10 bilhões
  }
}

/**
 * Busca concorrentes do mesmo setor com priorização de subsetor
 * Suporta filtro por tipo de ativo (STOCK ou BDR)
 */
export async function getSectorCompetitors(params: GetSectorCompetitorsParams): Promise<CompetitorData[]> {
  const {
    currentTicker,
    sector,
    industry,
    currentMarketCap = null,
    limit = 5,
    assetType
  } = params

  if (!sector) return []
  
  try {
    // Determinar o tamanho da empresa atual
    const currentCompanySize = getCompanySize(currentMarketCap)
    
    // Verificar cache primeiro (incluir assetType na chave do cache)
    const cacheKey = `competitors-${currentTicker}-${sector}-${industry}-${currentCompanySize}-${limit}-${assetType || 'all'}-v3`
    const cached = await cache.get<CompetitorData[]>(cacheKey, {
      prefix: 'companies',
      ttl: COMPETITORS_CACHE_TTL
    })
    
    if (cached) {
      console.log('📋 Usando concorrentes do cache para', currentTicker)
      return cached
    }

    const currentPrefix = getTickerPrefix(currentTicker)
    const currentYear = new Date().getFullYear()
    
    // Construir filtro where com suporte a assetType
    const whereClause: any = {
      OR: [
        { industry: industry || undefined },
        { sector: sector }
      ],
      ticker: { not: currentTicker },
      // Filtrar empresas com dados financeiros recentes e com lucro positivo
      financialData: {
        some: {
          year: { gte: currentYear - 1 },
          // Excluir empresas com prejuízo (lucro líquido negativo ou nulo)
          lucroLiquido: {
            gt: 0
          }
        }
      }
    }

    // Adicionar filtro por assetType se especificado
    if (assetType) {
      whereClause.assetType = assetType
    }
    
    const allCompetitors = await prisma.company.findMany({
      where: whereClause,
      select: {
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        logoUrl: true,
        // Incluir dados financiais apenas se for blue chip
        financialData: {
          select: {
            marketCap: true,
            lucroLiquido: true,
            year: true
          },
          where: {
            year: { gte: currentYear - 1 },
            lucroLiquido: {
              gt: 0
            }
          },
          orderBy: { year: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { industry: industry ? 'asc' : 'desc' }, // Priorizar industry se especificado
        { ticker: 'asc' }
      ],
      take: limit * 10 // Buscar mais para ter opções após filtrar prefixos, tamanho e lucro
    })

    // Filtrar empresas com mesmo prefixo e priorizar por industry
    const seenPrefixes = new Set([currentPrefix])
    const competitors: CompetitorData[] = []
    
    // Função auxiliar para verificar se a empresa atende aos critérios
    const isValidCompetitor = (company: any, allowDifferentSizes: boolean = false): boolean => {
      const companyPrefix = getTickerPrefix(company.ticker)
      if (seenPrefixes.has(companyPrefix)) return false
      
      // Verificar se tem dados financeiros válidos
      const financialData = company.financialData?.[0]
      if (!financialData) return false
      
      // Verificar se tem lucro positivo (já filtrado na query, mas double check)
      const lucroLiquido = toNumber(financialData.lucroLiquido)
      if (!lucroLiquido || lucroLiquido <= 0) return false
      
      // Filtrar por tamanho de empresa (comparar com empresa atual)
      if (currentCompanySize && !allowDifferentSizes) {
        const competitorMarketCap = toNumber(financialData.marketCap)
        if (competitorMarketCap) {
          const competitorSize = getCompanySize(competitorMarketCap)
          // Só incluir empresas do mesmo tamanho
          if (competitorSize !== currentCompanySize) return false
        } else {
          return false // Se não tem market cap, não incluir
        }
      } else if (currentCompanySize && allowDifferentSizes) {
        // No modo fallback, ainda precisamos de market cap válido
        const competitorMarketCap = toNumber(financialData.marketCap)
        if (!competitorMarketCap) return false
      }
      
      return true
    }
    
    // Função auxiliar para processar empresas com critério específico
    const processCompanies = (companies: any[], filterFn: (company: any) => boolean, allowDifferentSizes: boolean = false) => {
      for (const company of companies) {
        if (competitors.length >= limit) break
        if (filterFn(company) && isValidCompetitor(company, allowDifferentSizes)) {
          const companyPrefix = getTickerPrefix(company.ticker)
          seenPrefixes.add(companyPrefix)
          competitors.push({
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            logoUrl: company.logoUrl,
            marketCap: company.financialData[0]?.marketCap || null
          } as CompetitorData)
        }
      }
    }

    // PASSADA 1: Empresas do mesmo tamanho
    // Primeiro: empresas do mesmo industry e mesmo tamanho
    if (industry) {
      processCompanies(
        allCompetitors,
        (company) => company.industry === industry,
        false // Só mesmo tamanho
      )
    }
    
    // Depois: empresas do mesmo setor e mesmo tamanho (se ainda precisar)
    if (competitors.length < limit) {
      processCompanies(
        allCompetitors,
        (company) => company.sector === sector,
        false // Só mesmo tamanho
      )
    }

    // PASSADA 2: Fallback para outros tamanhos (se ainda não temos empresas suficientes)
    if (competitors.length < limit) {
      console.log(`🔄 Fallback: apenas ${competitors.length} empresas do mesmo tamanho encontradas, buscando outros tamanhos...`)
      
      // Primeiro: empresas do mesmo industry (qualquer tamanho)
      if (industry) {
        processCompanies(
          allCompetitors,
          (company) => company.industry === industry,
          true // Permitir tamanhos diferentes
        )
      }
      
      // Depois: empresas do mesmo setor (qualquer tamanho)
      if (competitors.length < limit) {
        processCompanies(
          allCompetitors,
          (company) => company.sector === sector,
          true // Permitir tamanhos diferentes
        )
      }
    }

    // Log para debug
    const sameSize = competitors.filter(comp => {
      const financialData = allCompetitors.find(c => c.ticker === comp.ticker)?.financialData?.[0]
      if (!financialData) return false
      const competitorMarketCap = toNumber(financialData.marketCap)
      const competitorSize = getCompanySize(competitorMarketCap)
      return competitorSize === currentCompanySize
    }).length
    
    console.log(`🔍 Empresa ${currentTicker} (${currentCompanySize}, ${assetType || 'all'}): encontrados ${competitors.length} concorrentes válidos (${sameSize} do mesmo tamanho, ${competitors.length - sameSize} de outros tamanhos)`)

    // Armazenar no cache
    await cache.set(cacheKey, competitors, {
      prefix: 'companies',
      ttl: COMPETITORS_CACHE_TTL
    })
    
    return competitors
  } catch (error) {
    console.error('Erro ao buscar concorrentes:', error)
    return []
  }
}

/**
 * Função básica para empresas relacionadas (SEO) - sem inteligência premium
 */
export async function getBasicRelatedCompanies(
  currentTicker: string, 
  sector: string | null, 
  limit: number = 6, 
  excludeTickers: string[] = [],
  assetType?: 'STOCK' | 'BDR'
): Promise<CompetitorData[]> {
  if (!sector) return []
  
  try {
    const whereClause: any = {
      sector: sector,
      ticker: { 
        notIn: excludeTickers.length > 0 ? excludeTickers : [currentTicker]
      },
      // Apenas empresas com dados financeiros básicos
      financialData: {
        some: {
          marketCap: { not: null }
        }
      }
    }

    // Adicionar filtro por assetType se especificado
    if (assetType) {
      whereClause.assetType = assetType
    }

    // Busca simples por setor, ordenada por market cap (sem inteligência premium)
    const companies = await prisma.company.findMany({
      where: whereClause,
      select: {
        ticker: true,
        name: true,
        sector: true,
        logoUrl: true,
        financialData: {
          select: {
            marketCap: true,
          },
          orderBy: { year: 'desc' },
          take: 1
        }
      },
      orderBy: {
        financialData: {
          _count: 'desc' // Priorizar empresas com mais dados
        }
      },
      take: limit
    })

    return companies.map(company => ({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      logoUrl: company.logoUrl,
      marketCap: company.financialData?.[0]?.marketCap || null
    } as CompetitorData))

  } catch (error) {
    console.error('❌ Erro ao buscar empresas relacionadas:', error)
    return []
  }
}

/**
 * Função mista: combina empresas inteligentes (premium) + básicas para SEO
 */
export async function getMixedRelatedCompanies(
  currentTicker: string, 
  sector: string | null, 
  intelligentCompetitors: CompetitorData[], 
  limit: number = 6,
  assetType?: 'STOCK' | 'BDR'
): Promise<CompetitorData[]> {
  if (!sector) return []
  
  try {
    // Pegar 2-3 empresas do comparador inteligente (as melhores)
    const intelligentPick = intelligentCompetitors.slice(0, 3)
    const intelligentTickers = intelligentPick.map(c => c.ticker)
    
    // Completar com empresas básicas do setor (excluindo as já selecionadas)
    const remainingSlots = limit - intelligentPick.length
    const basicCompanies = await getBasicRelatedCompanies(
      currentTicker, 
      sector, 
      remainingSlots + 3, // Buscar mais para ter opções
      [...intelligentTickers, currentTicker], // Excluir empresas já selecionadas
      assetType
    )
    
    // Combinar e limitar ao total desejado
    const mixed = [...intelligentPick, ...basicCompanies.slice(0, remainingSlots)]
    return mixed.slice(0, limit)
    
  } catch (error) {
    console.error('❌ Erro ao buscar empresas relacionadas mistas:', error)
    return []
  }
}

