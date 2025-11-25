/**
 * Script para validar e corrigir duplicatas em dividend_history
 * 
 * Este script:
 * 1. Identifica duplicatas por companyId + exDate (mesma data com amounts diferentes)
 * 2. Para cada duplicata, busca dados do Yahoo Finance para validar
 * 3. Mantém apenas o registro com o valor correto
 * 
 * Opções:
 * - Sem flags: Busca e corrige apenas duplicatas
 * - --force ou --update: Recria TODOS os dividendos do Yahoo Finance (remove existentes e recria)
 * 
 * Uso: 
 *   npx tsx scripts/validate-dividend-duplicates.ts [ticker] [--force|--update]
 * 
 * Exemplos:
 *   npx tsx scripts/validate-dividend-duplicates.ts VULC3
 *   npx tsx scripts/validate-dividend-duplicates.ts VULC3 --force
 */

import { prisma } from '../src/lib/prisma'
import { DividendService } from '../src/lib/dividend-service'

interface DuplicateGroup {
  companyId: number
  ticker: string
  exDate: Date
  count: number
  recordIds: number[]
  amounts: number[]
}

async function findDuplicateGroups(ticker?: string): Promise<DuplicateGroup[]> {
  console.log('🔍 Buscando duplicatas em dividend_history (mesmo companyId + exDate)...')

  // Buscar duplicatas por companyId + exDate (sem amount)
  // Isso identifica casos onde temos múltiplos registros para a mesma data
  let query = `
    SELECT 
      dh.company_id,
      c.ticker,
      dh.ex_date,
      COUNT(*) as count,
      array_agg(dh.id ORDER BY dh.updated_at DESC, dh.id DESC) as record_ids,
      array_agg(dh.amount ORDER BY dh.updated_at DESC, dh.id DESC) as amounts
    FROM dividend_history dh
    JOIN companies c ON c.id = dh.company_id
    GROUP BY dh.company_id, c.ticker, dh.ex_date
    HAVING COUNT(*) > 1
  `

  if (ticker) {
    query += ` AND c.ticker = '${ticker.toUpperCase()}'`
  }

  query += ` ORDER BY c.ticker, dh.ex_date DESC`

  const duplicates = await prisma.$queryRawUnsafe<Array<{
    company_id: number
    ticker: string
    ex_date: Date
    count: bigint
    record_ids: number[]
    amounts: string[]
  }>>(query)

  return duplicates.map(dup => ({
    companyId: dup.company_id,
    ticker: dup.ticker,
    exDate: new Date(dup.ex_date),
    count: Number(dup.count),
    recordIds: dup.record_ids,
    amounts: dup.amounts.map(a => Number(a))
  }))
}

async function validateWithYahoo(ticker: string, exDate: Date): Promise<{
  valid: boolean
  correctAmount?: number
  error?: string
}> {
  try {
    console.log(`  📡 Buscando dados do Yahoo Finance para ${ticker} na data ${exDate.toISOString().split('T')[0]}...`)
    
    const yahooDividends = await DividendService.fetchDividendsFromYahoo(ticker)
    
    const yahooDividend = yahooDividends.find(d => {
      const divDate = new Date(d.date)
      const targetDate = new Date(exDate)
      return divDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0]
    })

    if (yahooDividend) {
      console.log(`  ✅ Valor encontrado no Yahoo Finance: ${yahooDividend.amount.toFixed(6)}`)
      return {
        valid: true,
        correctAmount: yahooDividend.amount
      }
    }

    return {
      valid: false,
      error: `Dividendo não encontrado no Yahoo Finance para esta data`
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Erro ao buscar dados do Yahoo Finance'
    }
  }
}

async function forceUpdateFromYahoo(ticker: string) {
  console.log(`\n🔄 Forçando recriação completa de dividendos do Yahoo Finance para ${ticker}...`)
  
  try {
    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { ticker }
    })

    if (!company) {
      console.log(`❌ Empresa ${ticker} não encontrada no banco`)
      return
    }

    // Buscar dividendos existentes no banco
    const existingDividends = await prisma.dividendHistory.findMany({
      where: { companyId: company.id },
      orderBy: { exDate: 'desc' }
    })

    console.log(`📊 ${existingDividends.length} dividendos existentes no banco serão removidos`)

    // Deletar TODOS os dividendos existentes
    if (existingDividends.length > 0) {
      const deleteResult = await prisma.dividendHistory.deleteMany({
        where: { companyId: company.id }
      })
      console.log(`🗑️  ${deleteResult.count} dividendos removidos`)
    }

    // Buscar dividendos do Yahoo Finance (histórico completo)
    console.log(`📡 Buscando dividendos do Yahoo Finance...`)
    const yahooDividends = await DividendService.fetchDividendsFromYahoo(ticker)
    
    if (yahooDividends.length === 0) {
      console.log(`⚠️  Nenhum dividendo encontrado no Yahoo Finance para ${ticker}`)
      return
    }

    console.log(`✅ ${yahooDividends.length} dividendos encontrados no Yahoo Finance`)

    // Salvar todos os dividendos do Yahoo Finance
    await DividendService.saveDividendsToDatabase(company.id, yahooDividends)

    // Buscar dividendos finais no banco
    const finalDividends = await prisma.dividendHistory.findMany({
      where: { companyId: company.id },
      orderBy: { exDate: 'desc' }
    })

    console.log(`\n✅ Recriação concluída para ${ticker}:`)
    console.log(`   - Dividendos Yahoo Finance: ${yahooDividends.length}`)
    console.log(`   - Dividendos removidos: ${existingDividends.length}`)
    console.log(`   - Dividendos criados: ${finalDividends.length}`)
    
    // Mostrar alguns exemplos
    if (finalDividends.length > 0) {
      console.log(`\n   📋 Primeiros 10 dividendos (mais recentes):`)
      finalDividends.slice(0, 10).forEach(d => {
        console.log(`     • ${d.exDate.toISOString().split('T')[0]}: ${Number(d.amount).toFixed(6)}`)
      })
      if (finalDividends.length > 10) {
        console.log(`     ... e mais ${finalDividends.length - 10}`)
      }
    }

  } catch (error) {
    console.error(`❌ Erro ao forçar recriação:`, error)
  }
}

async function fixDuplicatesForTicker(ticker: string, forceUpdate: boolean = false) {
  console.log(`\n📊 Processando ${ticker}...`)
  
  const duplicates = await findDuplicateGroups(ticker)
  
  if (duplicates.length === 0) {
    console.log(`✅ Nenhuma duplicata encontrada para ${ticker}`)
    
    if (forceUpdate) {
      console.log(`\n🔄 Modo --force ativado: recriando todos os dividendos do Yahoo Finance...`)
      await forceUpdateFromYahoo(ticker)
    }
    return
  }

  console.log(`⚠️  Encontradas ${duplicates.length} duplicatas para ${ticker}`)

  let totalFixed = 0
  let totalDeleted = 0
  let errorCount = 0

  for (const dup of duplicates) {
    console.log(`\n📌 Processando duplicata:`)
    console.log(`   - Ticker: ${dup.ticker}`)
    console.log(`   - ExDate: ${dup.exDate.toISOString().split('T')[0]}`)
    console.log(`   - Registros duplicados: ${dup.count}`)
    console.log(`   - Amounts encontrados: ${dup.amounts.map(a => a.toFixed(6)).join(', ')}`)
    console.log(`   - IDs: ${dup.recordIds.join(', ')}`)

    // Buscar todos os registros duplicados
    const records = await prisma.dividendHistory.findMany({
      where: {
        id: {
          in: dup.recordIds
        }
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' }
      ]
    })

    if (records.length <= 1) {
      console.log(`   ⏭️  Apenas um registro encontrado, pulando...`)
      continue
    }

    // Validar com Yahoo Finance
    const validation = await validateWithYahoo(dup.ticker, dup.exDate)

    if (!validation.valid) {
      console.log(`   ⚠️  Validação Yahoo Finance: ${validation.error}`)
      console.log(`   💡 Mantendo apenas o registro mais recente (ID ${records[0].id}, amount: ${records[0].amount})`)
      
      // Manter apenas o mais recente
      const toDelete = records.slice(1)
      const idsToDelete = toDelete.map(r => r.id)
      
      try {
        const deleteResult = await prisma.dividendHistory.deleteMany({
          where: {
            id: {
              in: idsToDelete
            }
          }
        })
        
        totalDeleted += deleteResult.count
        totalFixed++
        console.log(`   ✅ ${deleteResult.count} registros duplicados removidos`)
      } catch (error) {
        console.error(`   ❌ Erro ao deletar registros:`, error)
        errorCount++
      }
      continue
    }

    // Verificar qual registro tem o amount correto do Yahoo Finance
    const correctAmount = validation.correctAmount!
    const tolerance = 0.000001 // Tolerância para comparação de decimais
    
    console.log(`   📡 Valor correto (Yahoo Finance): ${correctAmount.toFixed(6)}`)
    
    // Encontrar o registro que corresponde ao valor correto
    const correctRecord = records.find(r => {
      const amountDiff = Math.abs(Number(r.amount) - correctAmount)
      return amountDiff <= tolerance
    })

    if (!correctRecord) {
      // Nenhum registro corresponde ao valor correto
      console.log(`   ⚠️  Nenhum registro corresponde ao valor correto do Yahoo Finance`)
      console.log(`   💡 Atualizando o registro mais recente com o valor correto`)
      
      try {
        // Atualizar o registro mais recente com o valor correto
        await prisma.dividendHistory.update({
          where: { id: records[0].id },
          data: {
            amount: correctAmount,
            updatedAt: new Date()
          }
        })
        
        // Deletar os demais registros
        const toDelete = records.slice(1)
        const idsToDelete = toDelete.map(r => r.id)
        
        const deleteResult = await prisma.dividendHistory.deleteMany({
          where: {
            id: {
              in: idsToDelete
            }
          }
        })
        
        totalDeleted += deleteResult.count
        totalFixed++
        console.log(`   ✅ Registro atualizado com valor do Yahoo Finance e ${deleteResult.count} duplicatas removidas`)
      } catch (error) {
        console.error(`   ❌ Erro ao atualizar/deletar:`, error)
        errorCount++
      }
    } else {
      // Encontramos um registro correto
      console.log(`   ✅ Registro correto encontrado: ID ${correctRecord.id} (amount: ${correctRecord.amount})`)
      
      // Deletar todos os outros registros
      const idsToDelete = records
        .filter(r => r.id !== correctRecord.id)
        .map(r => r.id)
      
      if (idsToDelete.length > 0) {
        try {
          const deleteResult = await prisma.dividendHistory.deleteMany({
            where: {
              id: {
                in: idsToDelete
              }
            }
          })
          
          totalDeleted += deleteResult.count
          totalFixed++
          console.log(`   ✅ ${deleteResult.count} registros incorretos removidos`)
        } catch (error) {
          console.error(`   ❌ Erro ao deletar registros:`, error)
          errorCount++
        }
      } else {
        console.log(`   ✅ Nenhuma correção necessária (registro correto já é o único)`)
        totalFixed++
      }
    }
  }

  console.log(`\n✅ Correção concluída para ${ticker}:`)
  console.log(`   - Duplicatas processadas: ${duplicates.length}`)
  console.log(`   - Duplicatas corrigidas: ${totalFixed}`)
  console.log(`   - Registros deletados: ${totalDeleted}`)
  console.log(`   - Erros: ${errorCount}`)
}

async function main() {
  const args = process.argv.slice(2)
  const ticker = args.find(arg => !arg.startsWith('--'))?.toUpperCase()
  const forceUpdate = args.includes('--force') || args.includes('--update')

  if (ticker) {
    // Processar apenas um ticker específico
    await fixDuplicatesForTicker(ticker, forceUpdate)
  } else {
    // Processar todos os tickers com duplicatas
    console.log('🔍 Buscando todos os tickers com duplicatas...')
    
    const allDuplicates = await findDuplicateGroups()
    
    if (allDuplicates.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada no banco!')
      return
    }

    // Agrupar por ticker
    const tickersWithDuplicates = new Set(allDuplicates.map(d => d.ticker))
    
    console.log(`\n📊 Encontrados ${tickersWithDuplicates.size} tickers com duplicatas:`)
    tickersWithDuplicates.forEach(t => console.log(`   - ${t}`))
    
    console.log(`\n⚠️  Para processar um ticker específico, use:`)
    console.log(`   npx tsx scripts/validate-dividend-duplicates.ts TICKER`)
    console.log(`\n💡 Exemplos:`)
    console.log(`   npx tsx scripts/validate-dividend-duplicates.ts VULC3`)
    console.log(`   npx tsx scripts/validate-dividend-duplicates.ts VULC3 --force`)
  }
}

// Executar
main()
  .then(() => {
    console.log('\n✨ Script concluído!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Erro ao executar script:', error)
    process.exit(1)
  })

