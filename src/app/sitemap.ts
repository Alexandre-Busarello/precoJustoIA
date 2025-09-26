import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://precojusto.ai'
  
  // URLs estáticas
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/backtesting-carteiras`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/planos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/comparador`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/metodologia`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/como-funciona`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sobre`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/fundador`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contato`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/lgpd`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/termos-de-uso`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]

  try {
    // Buscar todas as empresas para gerar URLs das ações
    const companies = await prisma.company.findMany({
      select: {
        ticker: true,
        updatedAt: true,
      },
      orderBy: {
        ticker: 'asc'
      }
    })

    console.log(`📊 Gerando sitemap com ${companies.length} empresas`)

    // URLs das páginas individuais de ações
    const companyUrls: MetadataRoute.Sitemap = companies.map((company) => ({
      url: `${baseUrl}/acao/${company.ticker.toLowerCase()}`,
      lastModified: company.updatedAt || new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

    // ESTRATÉGIA INTELIGENTE DE COMPARAÇÕES
    // Buscar todas as empresas com dados financeiros, agrupadas por setor e indústria
    const companiesForComparison = await prisma.company.findMany({
      select: {
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        financialData: {
          select: {
            marketCap: true,
          },
          orderBy: {
            year: 'desc'
          },
          take: 1
        }
      },
      where: {
        AND: [
          { sector: { not: null } },
          { industry: { not: null } },
          {
            financialData: {
              some: {
                marketCap: { not: null }
              }
            }
          }
        ]
      }
    })

    // Filtrar empresas com market cap válido
    const validCompanies = companiesForComparison
      .filter(company => company.financialData[0]?.marketCap)
      .map(company => ({
        ...company,
        marketCap: Number(company.financialData[0]?.marketCap || 0)
      }))
      .sort((a, b) => b.marketCap - a.marketCap)

    console.log(`📈 Gerando comparações inteligentes para ${validCompanies.length} empresas`)

    const comparisonUrls: MetadataRoute.Sitemap = []

    // 1. COMPARAÇÕES POR SETOR (Prioridade máxima)
    const companiesBySector = validCompanies.reduce((acc, company) => {
      if (!company.sector) return acc
      if (!acc[company.sector]) acc[company.sector] = []
      acc[company.sector].push(company)
      return acc
    }, {} as Record<string, typeof validCompanies>)

    Object.entries(companiesBySector).forEach(([, sectorCompanies]) => {
      if (sectorCompanies.length >= 2) {
        const sortedCompanies = sectorCompanies.sort((a, b) => b.marketCap - a.marketCap)
        
        // Comparações 2x2 dentro do setor (todas as combinações possíveis)
        for (let i = 0; i < sortedCompanies.length; i++) {
          for (let j = i + 1; j < sortedCompanies.length; j++) {
            const ticker1 = sortedCompanies[i].ticker.toLowerCase()
            const ticker2 = sortedCompanies[j].ticker.toLowerCase()
            
            comparisonUrls.push({
              url: `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`,
              lastModified: new Date(),
              changeFrequency: 'weekly' as const,
              priority: 0.8, // Alta prioridade para comparações setoriais
            })
          }
        }

        // Comparações 3x3 dentro do setor (top empresas)
        if (sortedCompanies.length >= 3) {
          const topInSector = sortedCompanies.slice(0, Math.min(6, sortedCompanies.length))
          
          for (let i = 0; i < topInSector.length - 2; i++) {
            for (let j = i + 1; j < topInSector.length - 1; j++) {
              for (let k = j + 1; k < topInSector.length; k++) {
                const ticker1 = topInSector[i].ticker.toLowerCase()
                const ticker2 = topInSector[j].ticker.toLowerCase()
                const ticker3 = topInSector[k].ticker.toLowerCase()
                
                comparisonUrls.push({
                  url: `${baseUrl}/compara-acoes/${ticker1}/${ticker2}/${ticker3}`,
                  lastModified: new Date(),
                  changeFrequency: 'weekly' as const,
                  priority: 0.7,
                })
              }
            }
          }
        }
      }
    })

    // 2. COMPARAÇÕES POR INDÚSTRIA (Prioridade alta)
    const companiesByIndustry = validCompanies.reduce((acc, company) => {
      if (!company.industry) return acc
      if (!acc[company.industry]) acc[company.industry] = []
      acc[company.industry].push(company)
      return acc
    }, {} as Record<string, typeof validCompanies>)

    Object.entries(companiesByIndustry).forEach(([, industryCompanies]) => {
      if (industryCompanies.length >= 2) {
        const sortedCompanies = industryCompanies.sort((a, b) => b.marketCap - a.marketCap)
        
        // Comparações 2x2 dentro da indústria
        for (let i = 0; i < sortedCompanies.length; i++) {
          for (let j = i + 1; j < sortedCompanies.length; j++) {
            const ticker1 = sortedCompanies[i].ticker.toLowerCase()
            const ticker2 = sortedCompanies[j].ticker.toLowerCase()
            
            // Evitar duplicatas (já criadas por setor)
            const url = `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`
            const exists = comparisonUrls.some(existing => existing.url === url)
            
            if (!exists) {
              comparisonUrls.push({
                url,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.75, // Prioridade alta para comparações por indústria
              })
            }
          }
        }

        // Comparações 3x3 dentro da indústria
        if (sortedCompanies.length >= 3) {
          const topInIndustry = sortedCompanies.slice(0, Math.min(5, sortedCompanies.length))
          
          for (let i = 0; i < topInIndustry.length - 2; i++) {
            for (let j = i + 1; j < topInIndustry.length - 1; j++) {
              for (let k = j + 1; k < topInIndustry.length; k++) {
                const ticker1 = topInIndustry[i].ticker.toLowerCase()
                const ticker2 = topInIndustry[j].ticker.toLowerCase()
                const ticker3 = topInIndustry[k].ticker.toLowerCase()
                
                const url = `${baseUrl}/compara-acoes/${ticker1}/${ticker2}/${ticker3}`
                const exists = comparisonUrls.some(existing => existing.url === url)
                
                if (!exists) {
                  comparisonUrls.push({
                    url,
                    lastModified: new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.65,
                  })
                }
              }
            }
          }
        }
      }
    })

    // 3. COMPARAÇÕES CROSS-SETORIAIS (Top empresas de diferentes setores)
    const topCompaniesOverall = validCompanies.slice(0, 30)
    const sectorLeaders = new Map<string, typeof validCompanies[0]>()
    
    // Identificar líderes de cada setor
    topCompaniesOverall.forEach(company => {
      if (company.sector && (!sectorLeaders.has(company.sector) || 
          company.marketCap > (sectorLeaders.get(company.sector)?.marketCap || 0))) {
        sectorLeaders.set(company.sector, company)
      }
    })

    const leaders = Array.from(sectorLeaders.values()).slice(0, 15)
    
    // Comparações entre líderes setoriais
    for (let i = 0; i < leaders.length; i++) {
      for (let j = i + 1; j < leaders.length; j++) {
        const ticker1 = leaders[i].ticker.toLowerCase()
        const ticker2 = leaders[j].ticker.toLowerCase()
        
        const url = `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`
        const exists = comparisonUrls.some(existing => existing.url === url)
        
        if (!exists) {
          comparisonUrls.push({
            url,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9, // Prioridade máxima para líderes setoriais
          })
        }
      }
    }

    // OTIMIZAÇÃO: Limitar URLs para não impactar performance do sitemap
    const maxComparisonUrls = 5000 // Limite para não sobrecarregar o sitemap
    const finalComparisonUrls = comparisonUrls
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)) // Ordenar por prioridade
      .slice(0, maxComparisonUrls)

    console.log(`🔗 Geradas ${comparisonUrls.length} URLs de comparação (limitadas a ${finalComparisonUrls.length})`)

    // Combinar todas as URLs
    const allUrls = [
      ...staticUrls,
      ...companyUrls,
      ...finalComparisonUrls,
    ]

    console.log(`✅ Sitemap gerado com ${allUrls.length} URLs total`)
    console.log(`📊 Breakdown: ${staticUrls.length} estáticas + ${companyUrls.length} empresas + ${finalComparisonUrls.length} comparações`)
    
    // Estatísticas por prioridade
    const priorityStats = finalComparisonUrls.reduce((acc, url) => {
      const priority = url.priority || 0
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    console.log(`🎯 URLs por prioridade:`, priorityStats)

    return allUrls

  } catch (error) {
    console.error('❌ Erro ao gerar sitemap:', error)
    
    // Retornar apenas URLs estáticas em caso de erro
    return staticUrls
  }
}
