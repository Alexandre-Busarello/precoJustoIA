#!/usr/bin/env node

/**
 * Script para tornar um usuário administrador
 * 
 * Uso: node scripts/make-admin.js <email>
 * Exemplo: node scripts/make-admin.js admin@precojusto.ai
 */

const { PrismaClient } = require('@prisma/client')

async function makeUserAdmin(email) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`Procurando usuário com email: ${email}`)
    
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ Usuário com email ${email} não encontrado`)
      process.exit(1)
    }

    if (user.isAdmin) {
      console.log(`ℹ️  Usuário ${email} já é administrador`)
      process.exit(0)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true }
    })

    console.log(`✅ Usuário ${email} agora é administrador`)
    console.log(`   - ID: ${user.id}`)
    console.log(`   - Nome: ${user.name || 'N/A'}`)
    console.log(`   - Criado em: ${user.createdAt}`)
    
  } catch (error) {
    console.error('❌ Erro ao tornar usuário admin:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function listAdmins() {
  const prisma = new PrismaClient()
  
  try {
    console.log('📋 Listando administradores atuais:')
    
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    if (admins.length === 0) {
      console.log('   Nenhum administrador encontrado')
    } else {
      admins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.email}`)
        console.log(`      Nome: ${admin.name || 'N/A'}`)
        console.log(`      ID: ${admin.id}`)
        console.log(`      Criado: ${admin.createdAt}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar admins:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('📖 Uso:')
  console.log('   node scripts/make-admin.js <email>     - Tornar usuário admin')
  console.log('   node scripts/make-admin.js --list      - Listar admins atuais')
  console.log('')
  console.log('📝 Exemplos:')
  console.log('   node scripts/make-admin.js admin@precojusto.ai')
  console.log('   node scripts/make-admin.js --list')
  process.exit(1)
}

if (args[0] === '--list' || args[0] === '-l') {
  listAdmins()
} else {
  const email = args[0]
  
  if (!email.includes('@')) {
    console.error('❌ Email inválido. Deve conter @')
    process.exit(1)
  }
  
  makeUserAdmin(email)
}
