'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Server, Database, HardDrive, Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CacheStatus {
  timestamp: string
  environment: {
    platform: string
    isServerless: boolean
    nodeVersion: string
    region: string
  }
  redis: {
    status: 'connected' | 'disconnected' | 'disabled' | 'error'
    connected: boolean
    disabled: boolean
    clientExists: boolean
    reconnectAttempts: number
    lastCriticalError: string | null
    keysInRedis?: number
    url: string
  }
  connection: {
    lazyMode: boolean
    idleTimeSeconds: number
    maxIdleTimeout: number
    disconnectAfterOperation: boolean
  }
  memory: {
    keysInMemory: number
    approximateSize: string
    cleanupInterval: number
  }
  performance: {
    connectionTimeout: number
    commandTimeout: number
    failFastEnabled: boolean
  }
  health: {
    overall: 'healthy' | 'degraded'
    usingFallback: boolean
    canServRequests: boolean
  }
  recommendations: string[]
}

export default function CacheMonitorPage() {
  const [status, setStatus] = useState<CacheStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const router = useRouter()

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/cache-status')
      
      if (response.status === 403) {
        router.push('/login')
        return
      }
      
      if (!response.ok) {
        throw new Error('Erro ao carregar status')
      }
      
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const executeAction = async (action: string, prefix?: string) => {
    if (!confirm(`Confirma a ação: ${action}?`)) return
    
    try {
      setActionLoading(true)
      const response = await fetch('/api/admin/cache-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prefix })
      })
      
      if (!response.ok) {
        throw new Error('Erro ao executar ação')
      }
      
      const result = await response.json()
      alert(result.message || 'Ação executada com sucesso')
      fetchStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao executar ação')
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000) // Atualiza a cada 5s
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'disconnected': return 'bg-yellow-500'
      case 'disabled': return 'bg-red-500'
      case 'error': return 'bg-red-600'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle2 className="h-5 w-5" />
      case 'disconnected': return <Activity className="h-5 w-5" />
      case 'disabled': return <XCircle className="h-5 w-5" />
      case 'error': return <AlertTriangle className="h-5 w-5" />
      default: return null
    }
  }

  if (loading && !status) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Erro ao Carregar Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchStatus} className="mt-4">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitor de Cache Redis</h1>
          <p className="text-muted-foreground mt-1">
            Atualizado em {new Date(status.timestamp).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Status Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Redis</p>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(status.redis.status)}
                <Badge className={getStatusColor(status.redis.status)}>
                  {status.redis.status.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saúde Geral</p>
              <div className="flex items-center gap-2 mt-1">
                {status.health.overall === 'healthy' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <Badge variant={status.health.overall === 'healthy' ? 'default' : 'secondary'}>
                  {status.health.overall}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ambiente</p>
              <p className="font-semibold mt-1">{status.environment.platform}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pode Servir</p>
              <p className="font-semibold mt-1 text-green-600">
                {status.health.canServRequests ? 'SIM ✓' : 'NÃO ✗'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redis Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Redis
            </CardTitle>
            <CardDescription>Estado da conexão Redis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Conectado</span>
              <span className="font-semibold">{status.redis.connected ? 'Sim' : 'Não'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cliente Existe</span>
              <span className="font-semibold">{status.redis.clientExists ? 'Sim' : 'Não'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Chaves</span>
              <span className="font-semibold">{status.redis.keysInRedis ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tempo Ocioso</span>
              <span className="font-semibold">{status.connection.idleTimeSeconds}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tentativas Reconexão</span>
              <span className="font-semibold">{status.redis.reconnectAttempts}</span>
            </div>
            {status.redis.lastCriticalError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-600 font-semibold">Último Erro Crítico:</p>
                <p className="text-xs text-red-500 mt-1">{status.redis.lastCriticalError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Cache em Memória
            </CardTitle>
            <CardDescription>Fallback local</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Chaves</span>
              <span className="font-semibold">{status.memory.keysInMemory}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tamanho Aproximado</span>
              <span className="font-semibold">{status.memory.approximateSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Limpeza Automática</span>
              <span className="font-semibold">{status.memory.cleanupInterval}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Usando Fallback</span>
              <span className="font-semibold">{status.health.usingFallback ? 'Sim' : 'Não'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Timeout Conexão</p>
              <p className="text-sm font-semibold">{status.performance.connectionTimeout}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timeout Comando</p>
              <p className="text-sm font-semibold">{status.performance.commandTimeout}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Idle</p>
              <p className="text-sm font-semibold">{status.connection.maxIdleTimeout}s</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lazy Mode</p>
              <p className="text-sm font-semibold">{status.connection.lazyMode ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fail-Fast</p>
              <p className="text-sm font-semibold">{status.performance.failFastEnabled ? 'Ativo' : 'Inativo'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disconnect After Op</p>
              <p className="text-sm font-semibold">{status.connection.disconnectAfterOperation ? 'Ativo' : 'Inativo'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recomendações */}
      {status.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recomendações</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {status.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="mt-0.5">{rec.startsWith('✅') ? '✅' : rec.startsWith('⚠️') ? '⚠️' : rec.startsWith('🔧') ? '🔧' : rec.startsWith('💡') ? '💡' : '📊'}</span>
                  <span>{rec.replace(/^[✅⚠️🔧💡📊🔥⚡]/, '').trim()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <Card>
        <CardHeader>
          <CardTitle>Ações de Manutenção</CardTitle>
          <CardDescription>Execute ações administrativas no cache</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => executeAction('clear')}
              disabled={actionLoading}
            >
              Limpar Todo Cache
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const prefix = prompt('Digite o prefixo (ex: companies):')
                if (prefix) executeAction('clear', prefix)
              }}
              disabled={actionLoading}
            >
              Limpar por Prefixo
            </Button>
            <Button
              variant="outline"
              onClick={() => executeAction('reconnect')}
              disabled={actionLoading}
            >
              Reinicializar Redis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

