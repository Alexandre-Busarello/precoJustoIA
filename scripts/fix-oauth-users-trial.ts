/**
 * Script para corrigir usuários OAuth que não tiveram trial iniciado
 * 
 * Este script:
 * 1. Marca emails como verificados para usuários OAuth (Google) que não têm emailVerified
 * 2. Inicia trial para usuários OAuth que não têm trial iniciado mas deveriam ter
 * 
 * Executar: npx tsx scripts/fix-oauth-users-trial.ts
 */

import { PrismaClient } from '@prisma/client'
import { startTrialAfterEmailVerification } from '../src/lib/trial-service'

const prisma = new PrismaClient()

async function fixOAuthUsersTrial() {
  try {
    console.log('🔄 Iniciando correção de usuários OAuth...')

    // Buscar usuários OAuth (que têm Account do Google mas não têm emailVerified)
    const oauthUsers = await prisma.user.findMany({
      where: {
        emailVerified: null,
        accounts: {
          some: {
            provider: 'google'
          }
        }
      },
      include: {
        accounts: {
          where: {
            provider: 'google'
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        emailVerified: true,
        trialStartedAt: true,
        trialEndsAt: true,
        subscriptionTier: true,
        accounts: {
          select: {
            provider: true,
            providerAccountId: true
          }
        }
      }
    })

    console.log(`📊 Encontrados ${oauthUsers.length} usuários OAuth sem email verificado`)

    let verifiedCount = 0
    let trialStartedCount = 0
    let errors = 0

    for (const user of oauthUsers) {
      try {
        // 1. Marcar email como verificado
        if (!user.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: user.createdAt || new Date() }
          })
          verifiedCount++
          console.log(`✅ Email marcado como verificado para ${user.email} (${user.id})`)
        }

        // 2. Iniciar trial se ainda não iniciado
        if (!user.trialStartedAt && user.subscriptionTier === 'FREE') {
          const now = new Date()
          const userCreatedAt = user.createdAt
          const timeDiff = now.getTime() - userCreatedAt.getTime()
          const minutesDiff = timeDiff / (1000 * 60)

          // Só iniciar trial se foi criado há menos de 5 minutos OU se foi criado recentemente (últimas 24 horas)
          // Isso permite corrigir usuários que acabaram de criar conta
          if (minutesDiff < 5 || (minutesDiff < 24 * 60 && userCreatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000))) {
            const trialStarted = await startTrialAfterEmailVerification(user.id)
            if (trialStarted) {
              trialStartedCount++
              console.log(`✅ Trial iniciado para ${user.email} (${user.id})`)
            } else {
              console.warn(`⚠️ Falha ao iniciar trial para ${user.email} (${user.id})`)
            }
          } else {
            console.log(`⏭️ Usuário ${user.email} criado há ${minutesDiff.toFixed(2)} minutos - não iniciando trial automaticamente`)
          }
        } else if (user.trialStartedAt) {
          console.log(`ℹ️ Usuário ${user.email} já possui trial iniciado`)
        } else if (user.subscriptionTier === 'PREMIUM') {
          console.log(`ℹ️ Usuário ${user.email} já é Premium`)
        }
      } catch (error) {
        console.error(`❌ Erro ao processar usuário ${user.email} (${user.id}):`, error)
        errors++
      }
    }

    console.log(`\n✅ Correção concluída!`)
    console.log(`   - Emails marcados como verificados: ${verifiedCount}`)
    console.log(`   - Trials iniciados: ${trialStartedCount}`)
    console.log(`   - Erros: ${errors}`)
    console.log(`   - Total processado: ${oauthUsers.length}`)

  } catch (error) {
    console.error('❌ Erro fatal na correção:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar correção
fixOAuthUsersTrial()
  .then(() => {
    console.log('✨ Script finalizado com sucesso')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erro ao executar script:', error)
    process.exit(1)
  })

