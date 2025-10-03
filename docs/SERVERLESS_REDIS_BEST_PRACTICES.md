# 🚀 Redis em Ambientes Serverless: Guia de Boas Práticas

## 📚 Contexto

Este documento explica como otimizar o uso do Redis em ambientes serverless (Vercel/AWS Lambda), abordando os desafios únicos dessa arquitetura.

## 🏗️ Arquitetura Serverless vs. Tradicional

### Tradicional (Servidor único)
```
┌─────────────┐
│   Node.js   │ → UMA instância, UMA conexão Redis
│   App       │
└─────────────┘
```

### Serverless (Vercel)
```
┌─────────────┐
│  Lambda A   │ → Conexão Redis A
└─────────────┘
┌─────────────┐
│  Lambda B   │ → Conexão Redis B
└─────────────┘
┌─────────────┐
│  Lambda C   │ → Conexão Redis C
└─────────────┘

Múltiplas Lambdas = Múltiplas Conexões
```

## ⚠️ Desafios Serverless

### 1. **Cold Starts**
Cada nova Lambda inicializa do zero, criando nova conexão.

**Impacto:**
- Latência adicional (50-200ms para conectar)
- Picos de conexões durante scaling

**Solução:**
- Lazy loading (conecta apenas quando necessário)
- Reutilização entre invocações warm

### 2. **Pool de Conexões Limitado**
Redis tem limite de conexões (ex: 25-100 dependendo do plano).

**Problema:**
- 50 Lambdas simultâneas > limite de 25 conexões = ERRO

**Solução:**
- Idle disconnect (libera conexões ociosas)
- Limitar concorrência de funções
- Upgrade do plano Redis

### 3. **Lambdas Zumbi**
Lambdas podem ficar "warm" por minutos sem tráfego.

**Problema:**
- Conexão aberta mas não usada
- Desperdício de pool

**Solução:**
- Monitorar idle time
- Desconectar após 30s de inatividade

## ✅ Boas Práticas Implementadas

### 1. **Singleton por Lambda**
```typescript
// UMA instância global do serviço
export const cacheService = CacheService.getInstance()

// Variáveis globais (fora da classe) persistem entre invocações warm
let redisClient: any | null = null
```

**Benefício:** Lambda warm reutiliza conexão, evitando overhead.

### 2. **Lazy Loading**
```typescript
const LAZY_CONNECT = true

async get(key) {
  await this.ensureRedisConnection() // Conecta só se necessário
  // ...
}
```

**Benefício:** Cold starts mais rápidos, conexão sob demanda.

### 3. **Idle Disconnect**
```typescript
setInterval(() => {
  const idleTime = Date.now() - lastActivity
  if (idleTime > 30000 && connected) {
    disconnectRedis() // Libera pool
  }
}, 15000)
```

**Benefício:** Lambdas ociosas liberam conexões automaticamente.

### 4. **Mutex de Inicialização**
```typescript
let isInitializing = false
let initializationPromise: Promise<void> | null = null

async initialize() {
  if (isInitializing) {
    return initializationPromise // Aguarda inicialização em progresso
  }
  // ...
}
```

**Benefício:** Evita race conditions em invocações simultâneas.

### 5. **Fallback para Memória**
```typescript
try {
  // Tenta Redis
  return await redisClient.get(key)
} catch (error) {
  // Fallback para memória
  return memoryCache.get(key)
}
```

**Benefício:** Serviço continua funcionando mesmo sem Redis.

## 📊 Monitoramento

### Métricas Importantes

1. **Número de Conexões Ativas**
   - Alerta se > 70% do limite
   - Esperado: 10-40% em tráfego normal

2. **Taxa de Reutilização**
   - Logs: `♻️ Redis já conectado`
   - Ideal: > 80% das requisições reutilizam

3. **Idle Disconnects**
   - Logs: `⏰ Redis ocioso por Xs`
   - Esperado: vários por minuto em baixo tráfego

4. **Cold Starts**
   - Logs: `🔗 Criando nova conexão`
   - Esperado: proporcional ao scaling

### Dashboard de Exemplo

```typescript
// GET /api/cache/stats
{
  "connection": {
    "connected": true,
    "idleTime": 5,        // ✅ Ativo recentemente
    "lazyMode": true,     // ✅ Lazy loading ativo
    "isServerless": true  // ✅ Detectou Vercel
  },
  "redis": {
    "keys": 150,
    "connected": true
  }
}
```

## 🎯 Metas de Performance

### Uso de Conexões

| Cenário | Conexões Ativas | % do Pool (limite 50) | Status |
|---------|-----------------|------------------------|---------|
| Noite (baixo tráfego) | 5-8 | 10-15% | ✅ Ótimo |
| Normal | 10-20 | 20-40% | ✅ Bom |
| Pico | 30-40 | 60-80% | ⚠️ Atenção |
| Sobrecarga | 45+ | 90%+ | ❌ Crítico |

### Latência Redis

| Operação | Target | Máximo Aceitável |
|----------|--------|------------------|
| GET (warm) | < 10ms | < 50ms |
| GET (cold start) | < 100ms | < 200ms |
| SET | < 20ms | < 100ms |
| Reconnect | < 200ms | < 500ms |

## 🔧 Configurações Recomendadas

### `vercel.json`
```json
{
  "functions": {
    "src/app/api/**": {
      "memory": 1024,        // Memória suficiente
      "maxDuration": 10      // Timeout razoável
    }
  }
}
```

### Variáveis de Ambiente
```bash
# Redis
REDIS_URL=redis://...

# Otimizações
LAZY_CONNECT=true
REDIS_IDLE_TIMEOUT=30000

# Vercel (detecta automaticamente)
VERCEL=1
```

### Redis (redis.conf ou painel)
```conf
maxclients 100              # Aumentar se necessário
timeout 300                 # Fechar clientes inativos (5min)
tcp-keepalive 60           # Keepalive
```

## 🚨 Troubleshooting

### Problema: "Too many clients"

**Causa:** Pool esgotado, mais Lambdas que limite Redis.

**Soluções:**
1. Verificar idle disconnect funcionando
2. Upgrade plano Redis (mais conexões)
3. Limitar concorrência Vercel (`maxConcurrency`)
4. Migrar para Redis serverless (Upstash)

### Problema: Latência alta

**Causa:** Cold starts, distância geográfica.

**Soluções:**
1. Lazy loading para evitar conexão em todas as funções
2. Redis na mesma região da Vercel
3. Cache em memória como fallback

### Problema: Conexões não liberadas

**Causa:** Idle disconnect não funcionando.

**Debug:**
```typescript
const info = cache.getConnectionInfo()
console.log(info.idleTime) // Deve resetar a cada operação
console.log(info.isServerless) // Deve ser true na Vercel
```

## 📚 Referências

- [Vercel Functions Limits](https://vercel.com/docs/functions/serverless-functions/limits)
- [Redis Clients](https://redis.io/docs/reference/clients/)
- [Upstash Redis for Serverless](https://upstash.com/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

## 📝 Changelog

- **2025-10-03:** Implementação inicial de otimizações serverless
  - Lazy loading
  - Idle disconnect
  - Mutex de inicialização
  - Monitoramento aprimorado

---

**Autor:** Equipe Analisador de Ações  
**Última atualização:** 2025-10-03

