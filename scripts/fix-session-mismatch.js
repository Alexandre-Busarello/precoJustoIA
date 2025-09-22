#!/usr/bin/env node

/**
 * Script para corrigir problemas de ID de sessão que não correspondem ao usuário real
 * 
 * Uso: node scripts/fix-session-mismatch.js
 */

const { PrismaClient } = require('@prisma/client')

async function fixSessionMismatch() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Verificando problemas de sessão...')
    
    // 1. Buscar todas as sessões ativas
    const sessions = await prisma.session.findMany({
      where: {
        expires: { gt: new Date() }
      },
      select: {
        id: true,
        userId: true,
        sessionToken: true,
        expires: true
      }
    })
    
    console.log(`📊 Encontradas ${sessions.length} sessões ativas`)
    
    let orphanSessions = 0
    
    // 2. Verificar se cada sessão tem um usuário válido
    for (const session of sessions) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true }
      })
      
      if (!user) {
        console.log(`❌ Sessão órfã encontrada: ${session.id} (userId: ${session.userId})`)
        orphanSessions++
        
        // Remover sessão órfã
        await prisma.session.delete({
          where: { id: session.id }
        })
        console.log(`🗑️  Sessão órfã removida: ${session.id}`)
      } else {
        console.log(`✅ Sessão válida: ${session.id} (user: ${user.email})`)
      }
    }
    
    // 3. Buscar contas órfãs
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        providerAccountId: true
      }
    })
    
    console.log(`📊 Encontradas ${accounts.length} contas`)
    
    let orphanAccounts = 0
    
    for (const account of accounts) {
      const user = await prisma.user.findUnique({
        where: { id: account.userId },
        select: { id: true, email: true }
      })
      
      if (!user) {
        console.log(`❌ Conta órfã encontrada: ${account.id} (userId: ${account.userId})`)
        orphanAccounts++
        
        // Remover conta órfã
        await prisma.account.delete({
          where: { id: account.id }
        })
        console.log(`🗑️  Conta órfã removida: ${account.id}`)
      } else {
        console.log(`✅ Conta válida: ${account.id} (user: ${user.email}, provider: ${account.provider})`)
      }
    }
    
    console.log('\n📋 RESUMO:')
    console.log(`   Sessões órfãs removidas: ${orphanSessions}`)
    console.log(`   Contas órfãs removidas: ${orphanAccounts}`)
    
    if (orphanSessions > 0 || orphanAccounts > 0) {
      console.log('\n✅ Limpeza concluída! Faça logout e login novamente para gerar uma nova sessão válida.')
    } else {
      console.log('\n✅ Nenhum problema encontrado!')
    }
    
  } catch (error) {
    console.error('❌ Erro ao corrigir problemas de sessão:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixSessionMismatch()
