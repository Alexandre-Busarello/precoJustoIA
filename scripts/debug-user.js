#!/usr/bin/env node

/**
 * Script para debugar problemas de usuário
 * 
 * Uso: node scripts/debug-user.js <email>
 */

const { PrismaClient } = require('@prisma/client')

async function debugUser(email) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`🔍 Procurando usuário com email: ${email}`)
    
    // Buscar por email
    const userByEmail = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        premiumExpiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        isAdmin: true
      }
    })

    if (!userByEmail) {
      console.log(`❌ Usuário com email ${email} não encontrado`)
      
      // Listar todos os usuários para debug
      console.log('\n📋 Listando todos os usuários:')
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          premiumExpiresAt: true
        },
        take: 10
      })
      
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.subscriptionTier})`)
        console.log(`      ID: ${user.id}`)
        console.log(`      Nome: ${user.name || 'N/A'}`)
        console.log(`      Premium até: ${user.premiumExpiresAt || 'N/A'}`)
        console.log('')
      })
      
      return
    }

    console.log(`✅ Usuário encontrado:`)
    console.log(`   ID: ${userByEmail.id}`)
    console.log(`   Email: ${userByEmail.email}`)
    console.log(`   Nome: ${userByEmail.name || 'N/A'}`)
    console.log(`   Tier: ${userByEmail.subscriptionTier}`)
    console.log(`   Premium até: ${userByEmail.premiumExpiresAt || 'N/A'}`)
    console.log(`   Stripe Customer: ${userByEmail.stripeCustomerId || 'N/A'}`)
    console.log(`   Stripe Subscription: ${userByEmail.stripeSubscriptionId || 'N/A'}`)
    console.log(`   Admin: ${userByEmail.isAdmin}`)
    
    // Verificar se é Premium
    const isPremium = userByEmail.subscriptionTier === 'PREMIUM' && 
                     (!userByEmail.premiumExpiresAt || userByEmail.premiumExpiresAt > new Date())
    
    console.log(`\n🎯 Status Premium: ${isPremium ? '✅ ATIVO' : '❌ INATIVO'}`)
    
    if (!isPremium && userByEmail.subscriptionTier === 'FREE') {
      console.log('\n💡 Para tornar este usuário Premium:')
      console.log(`   1. Manualmente: UPDATE users SET subscription_tier = 'PREMIUM', premium_expires_at = '2025-12-31' WHERE email = '${email}';`)
      console.log(`   2. Ou execute: node scripts/make-premium.js ${email}`)
    }
    
  } catch (error) {
    console.error('❌ Erro ao debugar usuário:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Processar argumentos
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('📖 Uso: node scripts/debug-user.js <email>')
  console.log('📝 Exemplo: node scripts/debug-user.js usuario@email.com')
  process.exit(1)
}

const email = args[0]
debugUser(email)
