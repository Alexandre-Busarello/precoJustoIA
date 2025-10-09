import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/user-service'
import { cacheService } from '@/lib/cache-service'

/**
 * GET /api/admin/cache-status
 * 
 * Endpoint de monitoramento para acompanhar o status do cache e conexões Redis em tempo real
 * Requer autenticação de administrador
 */
export async function GET() {
  try {
    // Verificar se é admin
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer privilégios de administrador.' },
        { status: 403 }
      )
    }

    // Coletar informações detalhadas
    const connectionInfo = cacheService.getConnectionInfo()
    const stats = await cacheService.getStats()
    
    // Calcular métricas adicionais
    const now = Date.now()
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
    const environment = process.env.VERCEL ? 'Vercel' : process.env.AWS_LAMBDA_FUNCTION_NAME ? 'AWS Lambda' : 'Unknown'
    
    // Status geral do Redis
    let redisStatus: 'connected' | 'disconnected' | 'disabled' | 'error' = 'disconnected'
    if (connectionInfo.redisDisabled) {
      redisStatus = 'disabled'
    } else if (connectionInfo.lastCriticalError) {
      redisStatus = 'error'
    } else if (connectionInfo.connected) {
      redisStatus = 'connected'
    }
    
    // Montar resposta detalhada
    const response = {
      timestamp: new Date().toISOString(),
      environment: {
        platform: environment,
        isServerless,
        nodeVersion: process.version,
        region: process.env.VERCEL_REGION || 'N/A'
      },
      redis: {
        status: redisStatus,
        connected: connectionInfo.connected,
        disabled: connectionInfo.redisDisabled,
        clientExists: connectionInfo.clientExists,
        reconnectAttempts: connectionInfo.reconnectAttempts,
        lastCriticalError: connectionInfo.lastCriticalError,
        keysInRedis: stats.redis.keys,
        url: process.env.REDIS_URL ? '***configured***' : 'not configured'
      },
      connection: {
        lazyMode: connectionInfo.lazyMode,
        idleTimeSeconds: connectionInfo.idleTime,
        maxIdleTimeout: 10, // REDIS_IDLE_TIMEOUT em segundos
        disconnectAfterOperation: process.env.REDIS_DISCONNECT_AFTER_OP === 'true'
      },
      memory: {
        keysInMemory: stats.memory.keys,
        approximateSize: stats.memory.size,
        cleanupInterval: 300 // MEMORY_CLEANUP_INTERVAL em segundos
      },
      performance: {
        connectionTimeout: 3000, // ms
        commandTimeout: 2000, // ms
        failFastEnabled: true
      },
      health: {
        overall: redisStatus === 'connected' || redisStatus === 'disconnected' ? 'healthy' : 'degraded',
        usingFallback: !connectionInfo.connected || connectionInfo.redisDisabled,
        canServRequests: true // Sempre pode servir requisições (com fallback)
      },
      recommendations: getRecommendations(connectionInfo, stats)
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Erro ao obter status do cache:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao obter status do cache',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

/**
 * Gerar recomendações baseadas no estado atual
 */
function getRecommendations(
  connectionInfo: ReturnType<typeof cacheService.getConnectionInfo>,
  stats: Awaited<ReturnType<typeof cacheService.getStats>>
): string[] {
  const recommendations: string[] = []

  // Redis desabilitado
  if (connectionInfo.redisDisabled) {
    recommendations.push('⚠️ Redis está DESABILITADO devido a erro crítico. Aplicação usa apenas cache em memória.')
    recommendations.push(`💡 Erro: "${connectionInfo.lastCriticalError}". Verifique configuração ou limites do Redis.`)
    
    if (connectionInfo.lastCriticalError?.includes('max number of clients')) {
      recommendations.push('🔧 Aumente o limite de conexões do Redis ou ative REDIS_DISCONNECT_AFTER_OP=true')
    }
  }

  // Redis desconectado mas não desabilitado
  if (!connectionInfo.connected && !connectionInfo.redisDisabled) {
    if (connectionInfo.idleTime > 10) {
      recommendations.push('✅ Redis desconectado por inatividade (comportamento esperado em serverless)')
    } else {
      recommendations.push('⚠️ Redis desconectado recentemente. Próxima operação tentará reconectar.')
    }
  }

  // Redis conectado há muito tempo (possível vazamento)
  if (connectionInfo.connected && connectionInfo.idleTime === 0 && connectionInfo.isServerless) {
    recommendations.push('⚡ Redis conectado. Será desconectado após 10s de inatividade.')
  }

  // Muitas chaves em memória
  if (stats.memory.keys > 1000) {
    recommendations.push(`📊 Cache em memória com ${stats.memory.keys} chaves. Considere aumentar TTL do Redis se estiver disponível.`)
  }

  // Modo ultra-agressivo ativo
  if (process.env.REDIS_DISCONNECT_AFTER_OP === 'true') {
    recommendations.push('🔥 Modo ULTRA-AGRESSIVO ativo: desconectando após cada operação. Alta economia de conexões, mas maior latência.')
  }

  // Tudo OK
  if (recommendations.length === 0) {
    recommendations.push('✅ Sistema operando normalmente com configurações otimizadas para serverless.')
  }

  return recommendations
}

/**
 * POST /api/admin/cache-status/clear
 * 
 * Limpar cache (útil para testes/debugging)
 */
export async function POST(request: Request) {
  try {
    // Verificar se é admin
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer privilégios de administrador.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, prefix } = body

    let result: any = {}

    switch (action) {
      case 'clear':
        await cacheService.clear(prefix)
        result = { 
          success: true, 
          message: prefix 
            ? `Cache limpo com prefixo "${prefix}"` 
            : 'Todo o cache foi limpo'
        }
        break

      case 'reconnect':
        // Forçar desconexão e reconexão
        await cacheService.disconnect()
        await cacheService.initialize()
        result = { 
          success: true, 
          message: 'Redis reinicializado (desconectado e pronto para reconectar)'
        }
        break

      default:
        return NextResponse.json(
          { error: 'Ação inválida. Use: clear, reconnect' },
          { status: 400 }
        )
    }

    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('Erro ao executar ação no cache:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao executar ação',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

