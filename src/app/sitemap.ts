import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { blogPosts } from '@/lib/blog-data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://precojusto.ai'
  
  // URLs estáticas com lastModified realista
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date('2025-09-30'), // Data atual - última grande atualização
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified: new Date('2025-09-30'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/backtesting-carteiras`,
      lastModified: new Date('2025-09-15'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/planos`,
      lastModified: new Date('2025-09-01'),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/comparador`,
      lastModified: new Date('2025-09-30'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/analise-setorial`,
      lastModified: new Date('2025-10-01'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/metodologia`,
      lastModified: new Date('2025-08-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/como-funciona`,
      lastModified: new Date('2025-08-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sobre`,
      lastModified: new Date('2025-08-01'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/fundador`,
      lastModified: new Date('2025-07-01'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contato`,
      lastModified: new Date('2025-07-01'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date('2025-09-01'),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // URLs do blog - artigos individuais
  const blogUrls: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishDate),
    changeFrequency: 'monthly' as const,
    priority: post.featured ? 0.8 : 0.6, // Posts em destaque têm prioridade maior
  }))

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

    // URLs das páginas individuais de ações - ALTA PRIORIDADE
    const companyUrls: MetadataRoute.Sitemap = companies.map((company) => ({
      url: `${baseUrl}/acao/${company.ticker.toLowerCase()}`,
      lastModified: company.updatedAt || new Date('2025-09-01'),
      changeFrequency: 'weekly' as const, // Mudou de daily para weekly
      priority: 0.8,
    }))

    // ESTRATÉGIA OTIMIZADA DE COMPARAÇÕES - APENAS AS MAIS RELEVANTES
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

    // Filtrar apenas empresas com market cap significativo (> 1 bilhão)
    const validCompanies = companiesForComparison
      .filter(company => {
        const marketCap = Number(company.financialData[0]?.marketCap || 0)
        return marketCap > 1000000000 // Apenas empresas com market cap > 1 bi
      })
      .map(company => ({
        ...company,
        marketCap: Number(company.financialData[0]?.marketCap || 0)
      }))
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 150) // Limitar a top 150 empresas por market cap

    console.log(`📈 Gerando comparações para ${validCompanies.length} empresas principais`)

    const comparisonUrls: MetadataRoute.Sitemap = []

    // 1. APENAS LÍDERES SETORIAIS - MÁXIMA QUALIDADE
    const companiesBySector = validCompanies.reduce((acc, company) => {
      if (!company.sector) return acc
      if (!acc[company.sector]) acc[company.sector] = []
      acc[company.sector].push(company)
      return acc
    }, {} as Record<string, typeof validCompanies>)

    // Apenas top 3 empresas por setor para comparações 2x2
    Object.entries(companiesBySector).forEach(([, sectorCompanies]) => {
      if (sectorCompanies.length >= 2) {
        const topCompanies = sectorCompanies.slice(0, 3) // Apenas top 3 por setor
        
        // Comparações 2x2 apenas entre top empresas do setor
        for (let i = 0; i < topCompanies.length; i++) {
          for (let j = i + 1; j < topCompanies.length; j++) {
            const ticker1 = topCompanies[i].ticker.toLowerCase()
            const ticker2 = topCompanies[j].ticker.toLowerCase()
            
            comparisonUrls.push({
              url: `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`,
              lastModified: new Date('2025-09-15'), // Data fixa realista
              changeFrequency: 'monthly' as const, // Mudou de weekly para monthly
              priority: 0.8, // Alta prioridade apenas para líderes setoriais
            })
          }
        }
      }
    })

    // 2. COMPARAÇÕES CROSS-SETORIAIS - APENAS TOP 20 EMPRESAS
    const topCompaniesOverall = validCompanies.slice(0, 20) // Apenas top 20
    
    // Comparações entre as maiores empresas do Brasil
    for (let i = 0; i < Math.min(10, topCompaniesOverall.length); i++) {
      for (let j = i + 1; j < Math.min(15, topCompaniesOverall.length); j++) {
        const ticker1 = topCompaniesOverall[i].ticker.toLowerCase()
        const ticker2 = topCompaniesOverall[j].ticker.toLowerCase()
        
        const url = `${baseUrl}/compara-acoes/${ticker1}/${ticker2}`
        const exists = comparisonUrls.some(existing => existing.url === url)
        
        if (!exists) {
          comparisonUrls.push({
            url,
            lastModified: new Date('2025-09-15'),
            changeFrequency: 'monthly' as const,
            priority: 0.9, // Prioridade máxima para gigantes
          })
        }
      }
    }

    // LIMITE RÍGIDO: Máximo 800 URLs de comparação
    const maxComparisonUrls = 800
    const finalComparisonUrls = comparisonUrls
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, maxComparisonUrls)

    console.log(`🔗 Geradas ${comparisonUrls.length} URLs de comparação (limitadas a ${finalComparisonUrls.length})`)

    // Combinar todas as URLs
    const allUrls = [
      ...staticUrls,
      ...blogUrls,
      ...companyUrls,
      ...finalComparisonUrls,
    ]

    console.log(`✅ Sitemap otimizado gerado com ${allUrls.length} URLs total`)
    console.log(`📊 Breakdown: ${staticUrls.length} estáticas + ${blogUrls.length} blog + ${companyUrls.length} empresas + ${finalComparisonUrls.length} comparações`)
    
    // Estatísticas por prioridade
    const priorityStats = allUrls.reduce((acc, url) => {
      const priority = url.priority || 0
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    console.log(`🎯 URLs por prioridade:`, priorityStats)

    return allUrls

  } catch (error) {
    console.error('❌ Erro ao gerar sitemap:', error)
    
    // Retornar URLs estáticas + blog em caso de erro
    return [...staticUrls, ...blogUrls]
  }
}