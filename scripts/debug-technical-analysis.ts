/**
 * Script de Debug para Análise Técnica
 * 
 * Execute com: npx tsx scripts/debug-technical-analysis.ts PETR4
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugTechnicalAnalysis(ticker: string) {
  console.log(`\n🔍 Debugging Technical Analysis for ${ticker}\n`)
  console.log('='.repeat(80))

  try {
    // 1. Buscar empresa
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true, name: true, ticker: true }
    })

    if (!company) {
      console.error(`❌ Empresa ${ticker} não encontrada`)
      return
    }

    console.log(`✅ Empresa encontrada: ${company.name} (${company.ticker})`)
    console.log(`   ID: ${company.id}\n`)

    // 2. Buscar dados históricos mensais
    // IMPORTANTE: Buscar todos os dados e ordenar depois, não limitar antes
    const historicalPrices = await prisma.historicalPrice.findMany({
      where: {
        companyId: company.id,
        interval: '1mo'
      },
      orderBy: {
        date: 'asc'
      }
      // Não usar take aqui - queremos TODOS os dados
    })

    console.log(`📊 Total de registros históricos mensais: ${historicalPrices.length}\n`)

    if (historicalPrices.length === 0) {
      console.error('❌ Nenhum dado histórico encontrado')
      return
    }

    // 3. Mostrar primeiros e últimos registros
    console.log('📅 Primeiros 5 registros:')
    historicalPrices.slice(0, 5).forEach((hp, idx) => {
      console.log(`   ${idx + 1}. ${hp.date.toISOString().split('T')[0]} - Close: R$ ${Number(hp.close).toFixed(2)}`)
    })

    console.log('\n📅 Últimos 20 registros:')
    historicalPrices.slice(-20).forEach((hp, idx) => {
      const dateStr = hp.date.toISOString().split('T')[0]
      const close = Number(hp.close).toFixed(2)
      const open = Number(hp.open).toFixed(2)
      const high = Number(hp.high).toFixed(2)
      const low = Number(hp.low).toFixed(2)
      console.log(`   ${historicalPrices.length - 20 + idx + 1}. ${dateStr} - O: ${open} H: ${high} L: ${low} C: ${close}`)
    })

    // 4. Processar dados como o código faz
    console.log('\n🔄 Processando dados (como o código faz)...\n')

    const priceData = historicalPrices
      .map(hp => {
        const close = Number(hp.close)
        const open = Number(hp.open) || close
        const high = Number(hp.high) || close
        const low = Number(hp.low) || close

        return {
          date: hp.date,
          open: open,
          high: Math.max(high, close),
          low: Math.min(low, close),
          close: close,
          volume: Number(hp.volume) || 0
        }
      })
      .filter(p =>
        p.close > 0 &&
        !isNaN(p.close) &&
        !isNaN(p.high) &&
        !isNaN(p.low) &&
        !isNaN(p.open)
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    console.log(`✅ Dados válidos após processamento: ${priceData.length}`)

    // 5. Verificar últimos 20 meses válidos
    console.log('\n📊 Últimos 20 meses válidos (para SMA 20):')
    const last20 = priceData.slice(-20)
    last20.forEach((p, idx) => {
      const dateStr = p.date.toISOString().split('T')[0]
      console.log(`   ${idx + 1}. ${dateStr} - Close: R$ ${p.close.toFixed(2)}`)
    })

    // 6. Calcular SMA 20 manualmente
    const sma20Closes = last20.map(p => p.close)
    const sma20Manual = sma20Closes.reduce((a, b) => a + b, 0) / sma20Closes.length
    console.log(`\n🧮 SMA 20 (cálculo manual): R$ ${sma20Manual.toFixed(4)}`)
    console.log(`   Soma dos 20 valores: ${sma20Closes.reduce((a, b) => a + b, 0).toFixed(2)}`)
    console.log(`   Quantidade: ${sma20Closes.length}`)

    // 7. Verificar últimos 50 meses válidos
    console.log('\n📊 Últimos 50 meses válidos (para SMA 50):')
    const last50 = priceData.slice(-50)
    console.log(`   Primeiro: ${last50[0]?.date.toISOString().split('T')[0]} - Close: R$ ${last50[0]?.close.toFixed(2)}`)
    console.log(`   Último: ${last50[last50.length - 1]?.date.toISOString().split('T')[0]} - Close: R$ ${last50[last50.length - 1]?.close.toFixed(2)}`)
    const sma50Closes = last50.map(p => p.close)
    const sma50Manual = sma50Closes.reduce((a, b) => a + b, 0) / sma50Closes.length
    console.log(`🧮 SMA 50 (cálculo manual): R$ ${sma50Manual.toFixed(4)}`)

    // 8. Verificar últimos 200 meses válidos
    console.log('\n📊 Últimos 200 meses válidos (para SMA 200):')
    const last200 = priceData.slice(-200)
    console.log(`   Primeiro: ${last200[0]?.date.toISOString().split('T')[0]} - Close: R$ ${last200[0]?.close.toFixed(2)}`)
    console.log(`   Último: ${last200[last200.length - 1]?.date.toISOString().split('T')[0]} - Close: R$ ${last200[last200.length - 1]?.close.toFixed(2)}`)
    const sma200Closes = last200.map(p => p.close)
    const sma200Manual = sma200Closes.reduce((a, b) => a + b, 0) / sma200Closes.length
    console.log(`🧮 SMA 200 (cálculo manual): R$ ${sma200Manual.toFixed(4)}`)

    // 9. Verificar Bollinger Bands
    console.log('\n📊 Bollinger Bands (últimos 20 meses):')
    const bbCloses = last20.map(p => p.close)
    const bbMean = bbCloses.reduce((a, b) => a + b, 0) / bbCloses.length
    const variance = bbCloses.reduce((sum, price) => sum + Math.pow(price - bbMean, 2), 0) / bbCloses.length
    const stdDev = Math.sqrt(variance)
    const bbUpper = bbMean + (stdDev * 2)
    const bbLower = bbMean - (stdDev * 2)
    console.log(`   Média (SMA 20): R$ ${bbMean.toFixed(4)}`)
    console.log(`   Desvio Padrão: ${stdDev.toFixed(4)}`)
    console.log(`   Superior: R$ ${bbUpper.toFixed(4)}`)
    console.log(`   Inferior: R$ ${bbLower.toFixed(4)}`)

    // 10. Verificar Fibonacci (últimos 12 meses)
    console.log('\n📊 Fibonacci (últimos 12 meses):')
    const last12 = priceData.slice(-12)
    const highs = last12.map(p => p.high)
    const lows = last12.map(p => p.low)
    const fibHigh = Math.max(...highs)
    const fibLow = Math.min(...lows)
    const fibDiff = fibHigh - fibLow
    console.log(`   High: R$ ${fibHigh.toFixed(2)}`)
    console.log(`   Low: R$ ${fibLow.toFixed(2)}`)
    console.log(`   Diff: R$ ${fibDiff.toFixed(2)}`)
    console.log(`   23.6%: R$ ${(fibHigh - fibDiff * 0.236).toFixed(2)}`)
    console.log(`   38.2%: R$ ${(fibHigh - fibDiff * 0.382).toFixed(2)}`)
    console.log(`   50%: R$ ${(fibHigh - fibDiff * 0.5).toFixed(2)}`)
    console.log(`   61.8%: R$ ${(fibHigh - fibDiff * 0.618).toFixed(2)}`)
    console.log(`   78.6%: R$ ${(fibHigh - fibDiff * 0.786).toFixed(2)}`)

    // 11. Verificar Ichimoku (últimos 52 meses)
    console.log('\n📊 Ichimoku (últimos 52 meses):')
    const last52 = priceData.slice(-52)
    if (last52.length >= 52) {
      const tenkanPeriod = last52.slice(-9)
      const tenkanHigh = Math.max(...tenkanPeriod.map(p => p.high))
      const tenkanLow = Math.min(...tenkanPeriod.map(p => p.low))
      const tenkanSen = (tenkanHigh + tenkanLow) / 2

      const kijunPeriod = last52.slice(-26)
      const kijunHigh = Math.max(...kijunPeriod.map(p => p.high))
      const kijunLow = Math.min(...kijunPeriod.map(p => p.low))
      const kijunSen = (kijunHigh + kijunLow) / 2

      console.log(`   Tenkan-sen (últimos 9): R$ ${tenkanSen.toFixed(4)}`)
      console.log(`   Kijun-sen (últimos 26): R$ ${kijunSen.toFixed(4)}`)
      console.log(`   Senkou Span A: R$ ${((tenkanSen + kijunSen) / 2).toFixed(4)}`)
    }

    // 12. Verificar se há duplicatas por data
    console.log('\n🔍 Verificando duplicatas por data...')
    const dateMap = new Map<string, number>()
    priceData.forEach(p => {
      const dateKey = p.date.toISOString().split('T')[0]
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
    })
    const duplicates = Array.from(dateMap.entries()).filter(([_, count]) => count > 1)
    if (duplicates.length > 0) {
      console.log(`   ⚠️  Encontradas ${duplicates.length} datas duplicadas:`)
      duplicates.slice(0, 5).forEach(([date, count]) => {
        console.log(`      ${date}: ${count} registros`)
      })
    } else {
      console.log('   ✅ Nenhuma duplicata encontrada')
    }

    // 13. Verificar valores extremos
    console.log('\n🔍 Valores extremos:')
    const allCloses = priceData.map(p => p.close)
    console.log(`   Menor close: R$ ${Math.min(...allCloses).toFixed(2)}`)
    console.log(`   Maior close: R$ ${Math.max(...allCloses).toFixed(2)}`)
    console.log(`   Último close: R$ ${priceData[priceData.length - 1]?.close.toFixed(2)}`)

    console.log('\n' + '='.repeat(80))
    console.log('✅ Debug concluído!\n')

  } catch (error) {
    console.error('❌ Erro durante debug:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
const ticker = process.argv[2] || 'PETR4'
debugTechnicalAnalysis(ticker)
  .catch((error) => {
    console.error('Erro fatal:', error)
    process.exit(1)
  })

