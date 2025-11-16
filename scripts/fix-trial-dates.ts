/**
 * Script para corrigir trials com datas incorretas
 * 
 * Este script corrige trials onde trialEndsAt < trialStartedAt
 * Recalcula trialEndsAt como trialStartedAt + 7 dias
 * 
 * Uso: npx tsx scripts/fix-trial-dates.ts
 */

import { prisma } from '../src/lib/prisma'

const TRIAL_DURATION_DAYS = 7

async function fixTrialDates() {
  console.log('🔍 Buscando trials com datas incorretas...')

  // Buscar todos os usuários com trial iniciado
  const usersWithTrial = await prisma.user.findMany({
    where: {
      trialStartedAt: {
        not: null
      },
      trialEndsAt: {
        not: null
      }
    },
    select: {
      id: true,
      email: true,
      trialStartedAt: true,
      trialEndsAt: true
    }
  })

  console.log(`📊 Encontrados ${usersWithTrial.length} usuários com trial`)

  let fixedCount = 0
  let errorCount = 0

  for (const user of usersWithTrial) {
    if (!user.trialStartedAt || !user.trialEndsAt) {
      continue
    }

    const trialStartedAt = new Date(user.trialStartedAt)
    const trialEndsAt = new Date(user.trialEndsAt)

    // Verificar se trialEndsAt é anterior a trialStartedAt
    if (trialEndsAt <= trialStartedAt) {
      console.log(`⚠️  Corrigindo trial para ${user.email}`)
      console.log(`   Antes: startedAt=${trialStartedAt.toISOString()}, endsAt=${trialEndsAt.toISOString()}`)

      // Recalcular trialEndsAt como trialStartedAt + 7 dias
      const correctedEndsAt = new Date(trialStartedAt.getTime() + (TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000))

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            trialEndsAt: correctedEndsAt
          }
        })

        console.log(`   ✅ Corrigido: endsAt=${correctedEndsAt.toISOString()}`)
        fixedCount++
      } catch (error) {
        console.error(`   ❌ Erro ao corrigir trial para ${user.email}:`, error)
        errorCount++
      }
    }
  }

  console.log(`\n✅ Correção concluída:`)
  console.log(`   - Trials corrigidos: ${fixedCount}`)
  console.log(`   - Erros: ${errorCount}`)
  console.log(`   - Total processado: ${usersWithTrial.length}`)
}

// Executar
fixTrialDates()
  .then(() => {
    console.log('\n✨ Script concluído com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Erro ao executar script:', error)
    process.exit(1)
  })

