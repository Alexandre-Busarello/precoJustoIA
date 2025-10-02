/**
 * EXEMPLOS DE USO: SISTEMA DE CACHE INTELIGENTE
 * 
 * Este arquivo demonstra como usar o novo sistema de cache
 * inteligente implementado no safeQuery().
 */

import { safeQuery, safeWrite, safeTransaction, clearQueryCache } from '@/lib/prisma-wrapper'
import { prisma } from '@/lib/prisma'

// =====================================================
// EXEMPLO 1: QUERIES DE LEITURA (AUTOMATICAMENTE CACHEADAS)
// =====================================================

// ✅ Esta query será automaticamente cacheada por 1 hora
export async function getCompaniesExample() {
  return await safeQuery('get-companies-basic', () =>
    prisma.company.findMany({
      select: {
        ticker: true,
        name: true,
        sector: true
      },
      take: 100
    })
  )
}

// ✅ Query com parâmetros - cada combinação única será cacheada separadamente
export async function getCompanyByTickerExample(ticker: string) {
  return await safeQuery(`get-company-${ticker}`, () =>
    prisma.company.findUnique({
      where: { ticker },
      include: {
        financialData: {
          take: 1,
          orderBy: { year: 'desc' }
        }
      }
    })
  )
}

// ✅ Query complexa - será cacheada automaticamente
export async function getTopCompaniesBySectorExample(sector: string) {
  return await safeQuery(`top-companies-${sector}`, () =>
    prisma.company.findMany({
      where: { sector },
      include: {
        financialData: {
          take: 1,
          orderBy: { year: 'desc' }
        }
      },
      take: 10
    })
  )
}

// =====================================================
// EXEMPLO 2: QUERIES QUE NÃO DEVEM SER CACHEADAS
// =====================================================

// ❌ Query específica do usuário - pular cache
export async function getUserPortfoliosExample(userId: string) {
  return await safeQuery(`user-portfolios-${userId}`, () =>
    prisma.portfolio.findMany({
      where: { userId }
    }),
    { skipCache: true } // Pular cache para dados específicos do usuário
  )
}

// ❌ Query com dados em tempo real - pular cache
export async function getCurrentPricesExample() {
  return await safeQuery('current-prices', () =>
    prisma.dailyQuote.findMany({
      where: {
        date: new Date()
      }
    }),
    { skipCache: true } // Dados em tempo real não devem ser cacheados
  )
}

// =====================================================
// EXEMPLO 3: OPERAÇÕES DE ESCRITA COM INVALIDAÇÃO AUTOMÁTICA
// =====================================================

// ✅ Operação de escrita simples - invalida cache automaticamente
export async function createCompanyExample(companyData: any) {
  return await safeWrite('create-company', () =>
    prisma.company.create({
      data: companyData
    }),
    ['companies'] // Tabelas que serão afetadas
  )
}

// ✅ Operação de atualização - invalida cache relacionado
export async function updateFinancialDataExample(companyId: number, data: any) {
  return await safeWrite('update-financial-data', () =>
    prisma.financialData.update({
      where: { id: companyId },
      data
    }),
    ['financial_data', 'companies', 'key_statistics'] // Múltiplas tabelas afetadas
  )
}

// ✅ Operação de exclusão - invalida cache relacionado
export async function deleteCompanyExample(ticker: string) {
  return await safeWrite('delete-company', () =>
    prisma.company.delete({
      where: { ticker }
    }),
    ['companies', 'financial_data', 'daily_quotes'] // Todas as tabelas relacionadas
  )
}

// =====================================================
// EXEMPLO 4: TRANSAÇÕES COM INVALIDAÇÃO INTELIGENTE
// =====================================================

// ✅ Transação complexa com múltiplas tabelas
export async function createCompanyWithDataExample(companyData: any, financialData: any) {
  return await safeTransaction('create-company-with-data', async () => {
    // Criar empresa
    const company = await prisma.company.create({
      data: companyData
    })

    // Criar dados financeiros
    await prisma.financialData.create({
      data: {
        ...financialData,
        companyId: company.id
      }
    })

    return company
  }, {
    affectedTables: ['companies', 'financial_data', 'key_statistics']
  })
}

// ✅ Transação de atualização em lote
export async function updateMultipleCompaniesExample(updates: Array<{ticker: string, data: any}>) {
  return await safeTransaction('bulk-update-companies', async () => {
    const results = []
    
    for (const update of updates) {
      const result = await prisma.company.update({
        where: { ticker: update.ticker },
        data: update.data
      })
      results.push(result)
    }
    
    return results
  }, {
    affectedTables: ['companies']
  })
}

// =====================================================
// EXEMPLO 5: LIMPEZA MANUAL DE CACHE
// =====================================================

// ✅ Limpar cache de tabelas específicas
export async function clearCompanyCacheExample() {
  await clearQueryCache(['companies', 'financial_data'])
  console.log('Cache de empresas limpo')
}

// ✅ Limpar todo o cache
export async function clearAllCacheExample() {
  await clearQueryCache()
  console.log('Todo o cache limpo')
}

// =====================================================
// EXEMPLO 6: PADRÕES AVANÇADOS
// =====================================================

// ✅ Query condicional com cache inteligente
export async function getCompaniesConditionalExample(isPremium: boolean) {
  if (isPremium) {
    // Query premium - cacheada normalmente
    return await safeQuery('companies-premium', () =>
      prisma.company.findMany({
        include: {
          financialData: true,
          dailyQuotes: { take: 30 }
        }
      })
    )
  } else {
    // Query básica - cacheada separadamente
    return await safeQuery('companies-basic', () =>
      prisma.company.findMany({
        select: {
          ticker: true,
          name: true,
          sector: true
        }
      })
    )
  }
}

// ✅ Query com agregação - será cacheada
export async function getCompanyStatsExample() {
  return await safeQuery('company-stats', () =>
    prisma.company.aggregate({
      _count: { ticker: true }
    })
  )
}

// ✅ Query com groupBy - será cacheada
export async function getCompaniesBySectorStatsExample() {
  return await safeQuery('companies-by-sector-stats', () =>
    prisma.company.groupBy({
      by: ['sector'],
      _count: { ticker: true }
    })
  )
}

// =====================================================
// EXEMPLO 7: MONITORAMENTO E DEBUGGING
// =====================================================

// ✅ Query com string de operação customizada para melhor debugging
export async function getCompaniesWithCustomLoggingExample() {
  return await safeQuery('companies-with-logging', () =>
    prisma.company.findMany({
      where: { sector: 'Technology' }
    }),
    {
      operationString: 'SELECT * FROM companies WHERE sector = "Technology"'
    }
  )
}

// ✅ Função para obter estatísticas do cache
export async function getCacheStatsExample() {
  const { getCacheStats } = await import('@/lib/prisma-wrapper')
  const stats = await getCacheStats()
  
  console.log('📊 Estatísticas do Cache:', {
    totalKeys: stats.totalKeys,
    topTables: stats.topTables
  })
  
  return stats
}

// =====================================================
// RESUMO DOS BENEFÍCIOS
// =====================================================

/*
✅ BENEFÍCIOS DO SISTEMA IMPLEMENTADO:

1. **CACHE AUTOMÁTICO**
   - Queries de leitura são automaticamente cacheadas por 1 hora
   - Cada query única tem sua própria entrada no cache
   - TTL configurável e gerenciado automaticamente

2. **INVALIDAÇÃO INTELIGENTE**
   - Operações de escrita invalidam automaticamente o cache relacionado
   - Sistema de dependências entre tabelas
   - Invalidação em cascata para dados relacionados

3. **PERFORMANCE**
   - Redução significativa na carga do banco de dados
   - Queries complexas executadas apenas uma vez por hora
   - Cache distribuído via Redis

4. **FACILIDADE DE USO**
   - API transparente - funciona com código existente
   - Opções para pular cache quando necessário
   - Logs detalhados para debugging

5. **ROBUSTEZ**
   - Fallback automático se cache falhar
   - Tratamento de erros robusto
   - Monitoramento e estatísticas integradas

MIGRAÇÃO SIMPLES:
- Código existente continua funcionando
- Benefícios automáticos sem mudanças
- Controle granular quando necessário
*/
