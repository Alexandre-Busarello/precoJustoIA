/**
 * EXEMPLO DE USO E TESTE DO SMART QUERY CACHE
 * 
 * Este arquivo demonstra como o sistema de cache funciona com os
 * diferentes formatos de queries do Prisma Client e como validar
 * os mapeamentos de models para tabelas.
 */

import { SmartQueryCache } from '@/lib/smart-query-cache'

// ============================================================================
// EXEMPLOS DE QUERIES QUE SÃO CORRETAMENTE DETECTADAS
// ============================================================================

/**
 * Exemplo 1: Query com AIReport
 * 
 * Query original:
 * prisma.aIReport.findFirst({ where: { companyId: 1, status: 'GENERATING' } })
 * 
 * No Turbopack/webpack:
 * ["prisma"].aIReport.findFirst(...)
 * 
 * Resultado esperado:
 * - Model detectado: aIReport
 * - Tabela mapeada: ai_reports
 */
function exemploAIReport() {
  const operationString = `["prisma"].aIReport.findFirst({
    where: {
      companyId: 1,
      status: 'GENERATING'
    }
  })`
  
  const tables = SmartQueryCache.extractTableNames(operationString)
  console.log('Exemplo AIReport:', tables) // ['ai_reports']
}

/**
 * Exemplo 2: Query com User
 * 
 * Query original:
 * prisma.user.findUnique({ where: { id: userId } })
 * 
 * No Turbopack/webpack:
 * ["prisma"].user.findUnique(...)
 * 
 * Resultado esperado:
 * - Model detectado: user
 * - Tabela mapeada: users
 */
function exemploUser() {
  const operationString = `()=>__TURBOPACK__imported__module__["prisma"].user.findUnique({
    where: { id: userId },
    select: { id: true }
  })`
  
  const tables = SmartQueryCache.extractTableNames(operationString)
  console.log('Exemplo User:', tables) // ['users']
}

/**
 * Exemplo 3: Query com FinancialData
 * 
 * Query original:
 * prisma.financialData.findMany({ where: { companyId: 1 } })
 * 
 * Resultado esperado:
 * - Model detectado: financialData
 * - Tabela mapeada: financial_data
 */
function exemploFinancialData() {
  const operationString = `["prisma"].financialData.findMany({
    where: { companyId: 1 }
  })`
  
  const tables = SmartQueryCache.extractTableNames(operationString)
  console.log('Exemplo FinancialData:', tables) // ['financial_data']
}

// ============================================================================
// VALIDAÇÃO DE MAPEAMENTOS
// ============================================================================

/**
 * Valida se todos os models comuns estão corretamente mapeados
 */
function validarMapeamentos() {
  const modelsParaTestar = [
    'aIReport',           // ai_reports
    'aIReportFeedback',   // ai_report_feedbacks
    'user',               // users
    'company',            // companies
    'financialData',      // financial_data
    'backtestConfig',     // backtest_configs
    'portfolioAsset',     // portfolio_assets
  ]
  
  console.log('\n=== VALIDAÇÃO DE MAPEAMENTOS ===\n')
  
  modelsParaTestar.forEach(modelName => {
    const result = SmartQueryCache.validateModelMapping(modelName)
    
    if (result.isMapped) {
      console.log(`✅ ${modelName.padEnd(20)} -> ${result.tableName}`)
    } else {
      console.log(`⚠️  ${modelName.padEnd(20)} -> ${result.tableName} (fallback)`)
      if (result.warning) {
        console.log(`   ${result.warning}`)
      }
    }
  })
  
  console.log('\n================================\n')
}

// ============================================================================
// TESTES DE INVALIDAÇÃO DE CACHE
// ============================================================================

/**
 * Testa se uma operação de escrita invalida corretamente o cache
 */
async function testarInvalidacaoCache() {
  // Simular uma operação de escrita
  const writeOperation = `["prisma"].aIReport.create({
    data: {
      companyId: 1,
      content: 'Test report',
      status: 'GENERATING'
    }
  })`
  
  const isWrite = SmartQueryCache.isWriteQuery(writeOperation)
  console.log('É query de escrita?', isWrite) // true
  
  if (isWrite) {
    const affectedTables = SmartQueryCache.extractTableNames(writeOperation)
    console.log('Tabelas afetadas:', affectedTables) // ['ai_reports']
    
    // Invalidar cache (assíncrono, não bloqueia)
    await SmartQueryCache.invalidateCacheForTables(affectedTables)
    console.log('Cache invalidado para:', affectedTables)
  }
}

// ============================================================================
// TESTES DE FORMATOS DIFERENTES
// ============================================================================

/**
 * Testa diferentes formatos de queries
 */
function testarDiferentesFormatos() {
  const formatos = [
    // Formato tradicional
    `prisma.user.findUnique({ where: { id: '123' } })`,
    
    // Formato Turbopack
    `["prisma"].user.findUnique({ where: { id: '123' } })`,
    
    // Formato com acesso dinâmico
    `prisma['user'].findUnique({ where: { id: '123' } })`,
    
    // Formato complexo do Turbopack
    `()=>__TURBOPACK__imported__module__["prisma"].user.findUnique({ where: { id: '123' } })`,
  ]
  
  console.log('\n=== TESTE DE DIFERENTES FORMATOS ===\n')
  
  formatos.forEach((operationString, index) => {
    const tables = SmartQueryCache.extractTableNames(operationString)
    console.log(`Formato ${index + 1}:`, tables)
  })
  
  console.log('\n====================================\n')
}

// ============================================================================
// EXECUTAR EXEMPLOS
// ============================================================================

/**
 * Execute esta função para testar o sistema
 */
export async function executarTestes() {
  console.log('\n🧪 INICIANDO TESTES DO SMART QUERY CACHE\n')
  console.log('==========================================\n')
  
  // Validar mapeamentos
  validarMapeamentos()
  
  // Testar diferentes formatos
  testarDiferentesFormatos()
  
  // Exemplos específicos
  console.log('\n=== EXEMPLOS ESPECÍFICOS ===\n')
  exemploAIReport()
  exemploUser()
  exemploFinancialData()
  console.log('\n============================\n')
  
  // Testar invalidação
  console.log('\n=== TESTE DE INVALIDAÇÃO ===\n')
  await testarInvalidacaoCache()
  console.log('\n============================\n')
  
  console.log('\n✅ TESTES CONCLUÍDOS\n')
}

// Para executar no terminal:
// npx tsx examples/smart-cache-model-mapping.ts
if (require.main === module) {
  executarTestes().catch(console.error)
}


