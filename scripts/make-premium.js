#!/usr/bin/env node

/**
 * Script para tornar um usuário Premium
 * 
 * Uso: node scripts/make-premium.js <email> [dias]
 * Exemplo: node scripts/make-premium.js usuario@email.com 365
 */

const { PrismaClient } = require('@prisma/client')

async function makePremium(email, days = 365) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`🔍 Procurando usuário com email: ${email}`)
    
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ Usuário com email ${email} não encontrado`)
      process.exit(1)
    }

    // Calcular data de expiração
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + days)

    // Atualizar usuário
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: expiresAt,
        wasPremiumBefore: true,
        firstPremiumAt: user.firstPremiumAt || new Date(),
        lastPremiumAt: new Date(),
        premiumCount: user.premiumCount + 1
      }
    })

    console.log(`✅ Usuário ${email} agora é Premium!`)
    console.log(`   - ID: ${updatedUser.id}`)
    console.log(`   - Nome: ${updatedUser.name || 'N/A'}`)
    console.log(`   - Tier: ${updatedUser.subscriptionTier}`)
    console.log(`   - Expira em: ${updatedUser.premiumExpiresAt}`)
    console.log(`   - Dias de Premium: ${days}`)
    
  } catch (error) {
    console.error('❌ Erro ao tornar usuário Premium:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Processar argumentos
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('📖 Uso: node scripts/make-premium.js <email> [dias]')
  console.log('📝 Exemplos:')
  console.log('   node scripts/make-premium.js usuario@email.com')
  console.log('   node scripts/make-premium.js usuario@email.com 30')
  process.exit(1)
}

const email = args[0]
const days = parseInt(args[1]) || 365

makePremium(email, days)
