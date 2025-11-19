import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'
import * as crypto from 'crypto'

/**
 * SERVIÇO DE PROTEÇÃO POR IP
 * 
 * Previne criação de múltiplas contas do mesmo IP para burlar o sistema de TRIAL
 * 
 * IMPORTANTE: IPs são armazenados como HASH para compliance com LGPD
 * 
 * Lógica:
 * - 1 conta total: ✅ Permitir normalmente
 * - 2-5 contas total (qualquer período): ⚠️ Permitir mas marcar conta como suspeita
 * - 6+ contas nos últimos 30 dias: 🚫 BLOQUEAR completamente
 */

const BLOCK_WINDOW_DAYS = 30 // Janela de tempo para bloqueio (dias)
const SUSPICIOUS_THRESHOLD = 2 // A partir de quantas contas marcar como suspeita
const BLOCK_THRESHOLD = 6 // Quantas contas nos últimos 30 dias para bloquear

/**
 * Hash do IP para privacidade (LGPD compliance)
 * Usa SHA-256 e retorna apenas os primeiros 32 caracteres para balancear segurança e performance
 */
export function hashIP(ip: string | null | undefined): string | null {
  if (!ip || ip === 'unknown') return null
  
  // Normalizar IPs de localhost primeiro
  let normalizedIP = ip
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    normalizedIP = '127.0.0.1'
  } else if (ip === 'localhost') {
    normalizedIP = '127.0.0.1'
  }
  
  // Remove IPv6 prefix se presente
  normalizedIP = normalizedIP.replace(/^::ffff:/, '')
  
  // Gera hash SHA-256 (irreversível, adequado para LGPD)
  return crypto.createHash('sha256').update(normalizedIP).digest('hex')
}

export interface IPRegistrationCheck {
  allowed: boolean
  reason?: 'IP_BLOCKED' | 'EMAIL_EXISTS'
  totalCount: number // Total de contas do IP (sem limite de tempo)
  recentCount: number // Contas dos últimos 30 dias
  shouldFlagAsSuspicious: boolean
  oldestRegistrationDate?: Date
  message?: string // Mensagem clara para o usuário
}

/**
 * Verifica se pode criar conta deste IP
 */
export async function canRegisterFromIP(
  ip: string,
  email?: string
): Promise<IPRegistrationCheck> {
  try {
    // Hash do IP para comparação (LGPD compliance)
    const ipHash = hashIP(ip)
    
    if (!ipHash) {
      // Se não conseguiu fazer hash (IP inválido), permitir registro
      // Mas não marcar como suspeito
      return {
        allowed: true,
        totalCount: 0,
        recentCount: 0,
        shouldFlagAsSuspicious: false
      }
    }

    // Verificar se email já existe (se fornecido)
    if (email) {
      const existingUser = await safeQueryWithParams(
        'check-email-exists',
        () => prisma.user.findUnique({
          where: { email },
          select: { id: true }
        }),
        { email }
      )

      if (existingUser) {
        return {
          allowed: false,
          reason: 'EMAIL_EXISTS',
          totalCount: 0,
          recentCount: 0,
          shouldFlagAsSuspicious: false,
          message: 'Este email já está cadastrado. Tente fazer login ou recuperar sua senha.'
        }
      }
    }

    // Buscar todas as contas criadas deste IP (usando hash)
    const allAccountsFromIP = await safeQueryWithParams(
      'count-all-accounts-by-ip',
      () => prisma.userSecurity.findMany({
        where: {
          registrationIp: ipHash
        },
        include: {
          user: {
            select: {
              id: true,
              createdAt: true
            }
          }
        }
      }),
      { ipHash }
    )

    // Ordenar por data de criação do usuário (mais antigo primeiro)
    allAccountsFromIP.sort((a, b) => 
      a.user.createdAt.getTime() - b.user.createdAt.getTime()
    )

    const totalCount = allAccountsFromIP.length

    // Buscar contas dos últimos 30 dias (para bloqueio)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - BLOCK_WINDOW_DAYS)

    const recentAccounts = allAccountsFromIP.filter(
      account => account.user.createdAt >= thirtyDaysAgo
    )

    const recentCount = recentAccounts.length

    // Determinar ação baseado nos limites
    const shouldFlagAsSuspicious = totalCount >= SUSPICIOUS_THRESHOLD && totalCount < BLOCK_THRESHOLD
    const shouldBlock = recentCount >= BLOCK_THRESHOLD

    if (shouldBlock) {
      return {
        allowed: false,
        reason: 'IP_BLOCKED',
        totalCount,
        recentCount,
        shouldFlagAsSuspicious: false,
        oldestRegistrationDate: allAccountsFromIP[0]?.user.createdAt,
        message: 'Não foi possível criar a conta. Este endereço IP já possui 6 ou mais contas cadastradas nos últimos 30 dias. Se você compartilha este IP com outras pessoas ou acredita que isso é um erro, entre em contato com o suporte.'
      }
    }

    return {
      allowed: true,
      totalCount,
      recentCount,
      shouldFlagAsSuspicious,
      oldestRegistrationDate: allAccountsFromIP[0]?.user.createdAt
    }
  } catch (error) {
    console.error('Erro ao verificar limite de IP:', error)
    // Em caso de erro, permitir registro (fail-open para não bloquear usuários legítimos)
    return {
      allowed: true,
      totalCount: 0,
      recentCount: 0,
      shouldFlagAsSuspicious: false
    }
  }
}

/**
 * Registra criação de conta para um IP (armazena como hash)
 */
export async function recordIPRegistration(
  ip: string,
  userId: string
): Promise<void> {
  try {
    const ipHash = hashIP(ip)
    
    if (!ipHash) {
      // Se não conseguiu fazer hash, não registrar
      return
    }

    await safeWrite(
      'record-ip-registration',
      () => prisma.userSecurity.upsert({
        where: { userId },
        create: {
          userId,
          registrationIp: ipHash // Armazenar hash, não IP direto
        },
        update: {
          registrationIp: ipHash
        }
      }),
      ['user_security']
    )
  } catch (error) {
    console.error('Erro ao registrar IP de registro:', error)
    // Não falhar o registro se houver erro ao registrar IP
  }
}

/**
 * Marca conta como suspeita
 */
export async function flagAccountAsSuspicious(
  userId: string,
  reason: string,
  ip: string
): Promise<void> {
  try {
    const ipHash = hashIP(ip)
    
    await safeWrite(
      'flag-account-suspicious',
      () => prisma.userSecurity.upsert({
        where: { userId },
        create: {
          userId,
          registrationIp: ipHash || null,
          isSuspicious: true,
          suspiciousReason: reason,
          suspiciousFlaggedAt: new Date()
        },
        update: {
          isSuspicious: true,
          suspiciousReason: reason,
          suspiciousFlaggedAt: new Date()
        }
      }),
      ['user_security']
    )
  } catch (error) {
    console.error('Erro ao marcar conta como suspeita:', error)
    // Não falhar se houver erro ao marcar como suspeita
  }
}

/**
 * Atualiza último IP de login (armazena como hash)
 */
export async function updateLastLoginIP(
  userId: string,
  ip: string
): Promise<void> {
  try {
    const ipHash = hashIP(ip)
    
    if (!ipHash) {
      // Se não conseguiu fazer hash, não atualizar
      return
    }

    await safeWrite(
      'update-last-login-ip',
      () => prisma.userSecurity.upsert({
        where: { userId },
        create: {
          userId,
          lastLoginIp: ipHash // Armazenar hash, não IP direto
        },
        update: {
          lastLoginIp: ipHash
        }
      }),
      ['user_security']
    )
  } catch (error) {
    console.error('Erro ao atualizar último IP de login:', error)
    // Não falhar login se houver erro ao atualizar IP
  }
}

/**
 * Verifica quantas contas foram criadas deste IP (para debug/admin)
 * Retorna dados usando hash do IP
 */
export async function checkIPRegistrationLimit(ip: string): Promise<{
  total: number
  recent: number
  accounts: Array<{
    userId: string
    email: string
    createdAt: Date
    isSuspicious: boolean
  }>
}> {
  const ipHash = hashIP(ip)
  
  if (!ipHash) {
    return {
      total: 0,
      recent: 0,
      accounts: []
    }
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - BLOCK_WINDOW_DAYS)

  const accounts = await safeQueryWithParams(
    'check-ip-registration-limit',
    () => prisma.userSecurity.findMany({
      where: {
        registrationIp: ipHash
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true
          }
        }
      }
    }),
    { ipHash }
  )

  // Ordenar por data de criação do usuário (mais recente primeiro)
  accounts.sort((a, b) => 
    b.user.createdAt.getTime() - a.user.createdAt.getTime()
  )

  const total = accounts.length
  const recent = accounts.filter(
    account => account.user.createdAt >= thirtyDaysAgo
  ).length

  return {
    total,
    recent,
    accounts: accounts.map(account => ({
      userId: account.user.id,
      email: account.user.email,
      createdAt: account.user.createdAt,
      isSuspicious: account.isSuspicious
    }))
  }
}

