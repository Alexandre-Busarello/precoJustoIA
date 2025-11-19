/**
 * Script de Migração: Marcar usuários existentes como verificados e criar UserSecurity
 * 
 * Este script:
 * 1. Marca todos os usuários existentes como emailVerified = createdAt
 * 2. Cria registros em user_security para todos os usuários que não têm
 * 
 * IMPORTANTE: IPs não podem ser recuperados para usuários já cadastrados,
 * então registrationIp e lastLoginIp ficarão como null (compliance LGPD)
 * 
 * Executar: npx tsx scripts/migrate-existing-users.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateExistingUsers() {
  try {
    console.log('🔄 Iniciando migração de usuários existentes...')

    // 1. Buscar todos os usuários onde emailVerified é null
    const usersToVerify = await prisma.user.findMany({
      where: {
        emailVerified: null
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    })

    console.log(`📊 Encontrados ${usersToVerify.length} usuários para marcar como verificados`)

    // 2. Buscar todos os usuários que não têm registro em user_security
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true
      }
    })

    const usersWithSecurity = await prisma.userSecurity.findMany({
      select: {
        userId: true
      }
    })

    const userIdsWithSecurity = new Set(usersWithSecurity.map(us => us.userId))
    const usersWithoutSecurity = allUsers.filter(user => !userIdsWithSecurity.has(user.id))

    console.log(`📊 Encontrados ${usersWithoutSecurity.length} usuários sem registro em user_security`)

    if (usersToVerify.length === 0 && usersWithoutSecurity.length === 0) {
      console.log('✅ Nenhum usuário precisa ser migrado')
      return
    }

    // 3. Marcar emails como verificados
    let verifiedCount = 0
    let verifiedErrors = 0

    for (const user of usersToVerify) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: user.createdAt // Marcar como verificado na data de criação
          }
        })
        verifiedCount++
        
        if (verifiedCount % 100 === 0) {
          console.log(`⏳ Verificados ${verifiedCount}/${usersToVerify.length} emails...`)
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar email do usuário ${user.id} (${user.email}):`, error)
        verifiedErrors++
      }
    }

    // 4. Criar registros em user_security
    let securityCreated = 0
    let securityErrors = 0

    for (const user of usersWithoutSecurity) {
      try {
        await prisma.userSecurity.create({
          data: {
            userId: user.id
            // registrationIp e lastLoginIp ficam null (não temos IP original)
            // Isso está em compliance com LGPD - não armazenamos dados que não temos
          }
        })
        securityCreated++
        
        if (securityCreated % 100 === 0) {
          console.log(`⏳ Criados ${securityCreated}/${usersWithoutSecurity.length} registros de segurança...`)
        }
      } catch (error) {
        console.error(`❌ Erro ao criar user_security para usuário ${user.id} (${user.email}):`, error)
        securityErrors++
      }
    }

    console.log(`\n✅ Migração concluída!`)
    console.log(`\n📧 Verificação de Email:`)
    console.log(`   - Emails marcados como verificados: ${verifiedCount}`)
    console.log(`   - Erros: ${verifiedErrors}`)
    console.log(`\n🔒 User Security:`)
    console.log(`   - Registros criados: ${securityCreated}`)
    console.log(`   - Erros: ${securityErrors}`)
    console.log(`\n📝 Nota sobre IPs:`)
    console.log(`   - IPs de registro não foram armazenados (não temos IP original)`)
    console.log(`   - IPs de login serão atualizados automaticamente no próximo login`)
    console.log(`   - Todos os IPs são armazenados como hash SHA-256 (compliance LGPD)`)

  } catch (error) {
    console.error('❌ Erro fatal na migração:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar migração
migrateExistingUsers()
  .then(() => {
    console.log('✨ Script finalizado com sucesso')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erro ao executar script:', error)
    process.exit(1)
  })

