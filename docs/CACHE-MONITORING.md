# 📊 Monitoramento de Cache Redis

Sistema de monitoramento em tempo real para acompanhar o uso de conexões Redis e status do cache em ambientes serverless.

## 🎯 Acesso

### **Dashboard Visual**
```
https://seu-dominio.com/admin/cache-monitor
```

### **API Endpoint**
```
GET https://seu-dominio.com/api/admin/cache-status
```

⚠️ **Requer autenticação de administrador**

## 📈 Métricas Monitoradas

### **Status do Redis**
- ✅ **Connected**: Redis conectado e funcionando
- 🟡 **Disconnected**: Redis desconectado por inatividade (normal em serverless)
- 🔴 **Disabled**: Redis desabilitado devido a erro crítico
- ⚠️ **Error**: Redis com problemas

### **Conexão**
- **Conectado**: Se há conexão ativa no momento
- **Cliente Existe**: Se o cliente Redis foi instanciado
- **Tempo Ocioso**: Segundos desde última operação
- **Tentativas de Reconexão**: Quantas vezes tentou reconectar

### **Cache em Memória**
- **Chaves**: Quantidade de chaves no fallback local
- **Tamanho**: Tamanho aproximado em KB/MB
- **Usando Fallback**: Se está operando sem Redis

### **Performance**
- **Connection Timeout**: 3000ms (fail-fast)
- **Command Timeout**: 2000ms (fail-fast)
- **Max Idle Timeout**: 10s antes de desconectar
- **Lazy Mode**: Conecta apenas quando necessário
- **Disconnect After Operation**: Desconecta após cada operação (modo ultra-agressivo)

## 🔍 Como Interpretar os Status

### ✅ **Tudo OK**
```json
{
  "redis": { "status": "connected", "disabled": false },
  "health": { "overall": "healthy", "canServRequests": true }
}
```
✅ Redis funcionando normalmente

---

### 🟡 **Ocioso (Normal)**
```json
{
  "redis": { "status": "disconnected", "disabled": false },
  "connection": { "idleTimeSeconds": 15 }
}
```
✅ Comportamento esperado em serverless (economizando conexões)

---

### 🔴 **Max Clients (Crítico)**
```json
{
  "redis": { 
    "status": "disabled", 
    "lastCriticalError": "ERR max number of clients reached"
  },
  "health": { "overall": "degraded", "usingFallback": true }
}
```
⚠️ Redis atingiu limite de conexões e foi desabilitado
✅ Aplicação continua funcionando com cache em memória

**Soluções:**
1. Aumentar `maxclients` no Redis
2. Ativar modo ultra-agressivo: `REDIS_DISCONNECT_AFTER_OP=true`
3. Reduzir número de instâncias Lambda/Vercel

---

## 🎛️ Ações Disponíveis

### **1. Limpar Todo Cache**
Remove todas as chaves do Redis e memória
```bash
POST /api/admin/cache-status
{ "action": "clear" }
```

### **2. Limpar por Prefixo**
Remove apenas chaves com prefixo específico
```bash
POST /api/admin/cache-status
{ "action": "clear", "prefix": "companies" }
```

### **3. Reinicializar Redis**
Desconecta e prepara para reconexão
```bash
POST /api/admin/cache-status
{ "action": "reconnect" }
```

## 🚨 Alertas e Recomendações

O sistema gera recomendações automáticas baseadas no estado atual:

### **⚠️ Redis Desabilitado**
```
⚠️ Redis está DESABILITADO devido a erro crítico. 
   Aplicação usa apenas cache em memória.
💡 Erro: "ERR max number of clients reached". 
   Verifique configuração ou limites do Redis.
🔧 Aumente o limite de conexões do Redis ou ative 
   REDIS_DISCONNECT_AFTER_OP=true
```

### **✅ Tudo OK**
```
✅ Sistema operando normalmente com configurações 
   otimizadas para serverless.
```

### **🔥 Modo Ultra-Agressivo**
```
🔥 Modo ULTRA-AGRESSIVO ativo: desconectando após 
   cada operação. Alta economia de conexões, mas maior latência.
```

## 📊 Exemplo de Resposta Completa

```json
{
  "timestamp": "2025-10-09T15:30:00.000Z",
  "environment": {
    "platform": "Vercel",
    "isServerless": true,
    "nodeVersion": "v20.11.0",
    "region": "iad1"
  },
  "redis": {
    "status": "connected",
    "connected": true,
    "disabled": false,
    "clientExists": true,
    "reconnectAttempts": 0,
    "lastCriticalError": null,
    "keysInRedis": 1247,
    "url": "***configured***"
  },
  "connection": {
    "lazyMode": true,
    "idleTimeSeconds": 0,
    "maxIdleTimeout": 10,
    "disconnectAfterOperation": false
  },
  "memory": {
    "keysInMemory": 45,
    "approximateSize": "2.3 MB",
    "cleanupInterval": 300
  },
  "performance": {
    "connectionTimeout": 3000,
    "commandTimeout": 2000,
    "failFastEnabled": true
  },
  "health": {
    "overall": "healthy",
    "usingFallback": false,
    "canServRequests": true
  },
  "recommendations": [
    "✅ Sistema operando normalmente com configurações otimizadas para serverless."
  ]
}
```

## 🔄 Auto-Refresh

O dashboard visual suporta atualização automática a cada 5 segundos:

1. Acesse `/admin/cache-monitor`
2. Clique em **"Auto-refresh ON"**
3. Monitore em tempo real

## 🛠️ Casos de Uso

### **1. Debug de Problemas de Conexão**
```bash
# Verificar se Redis está conectado
curl -H "Cookie: ..." https://seu-dominio.com/api/admin/cache-status | jq '.redis.status'
```

### **2. Monitorar Economia de Conexões**
```bash
# Ver tempo ocioso
curl -H "Cookie: ..." https://seu-dominio.com/api/admin/cache-status | jq '.connection.idleTimeSeconds'
```

### **3. Verificar se Modo Ultra-Agressivo Está Ativo**
```bash
curl -H "Cookie: ..." https://seu-dominio.com/api/admin/cache-status | jq '.connection.disconnectAfterOperation'
```

### **4. Limpar Cache após Deploy**
```bash
curl -X POST -H "Cookie: ..." -H "Content-Type: application/json" \
  -d '{"action":"clear"}' \
  https://seu-dominio.com/api/admin/cache-status
```

## 📈 Métricas Esperadas

### **Ambiente Saudável (Serverless)**
- ✅ `redis.status`: "disconnected" ou "connected"
- ✅ `connection.idleTimeSeconds`: 0-15s
- ✅ `redis.disabled`: false
- ✅ `health.canServRequests`: true

### **Ambiente com Problemas**
- ⚠️ `redis.status`: "disabled" ou "error"
- ⚠️ `redis.lastCriticalError`: presente
- ⚠️ `health.overall`: "degraded"
- ✅ `health.canServRequests`: true (ainda funciona com fallback!)

## 🎓 Interpretação Avançada

### **Cenário 1: Alta Latência**
```json
{
  "connection": { "disconnectAfterOperation": true },
  "redis": { "status": "disconnected", "disabled": false }
}
```
**Diagnóstico**: Modo ultra-agressivo está reconectando a cada operação  
**Ação**: Se latência é problema, desative `REDIS_DISCONNECT_AFTER_OP`

### **Cenário 2: Max Clients Recorrente**
```json
{
  "redis": { 
    "status": "disabled",
    "lastCriticalError": "max number of clients"
  }
}
```
**Diagnóstico**: Muitas instâncias Lambda ativas simultaneamente  
**Ação**: 
1. Aumentar `maxclients` no Redis
2. Ativar modo ultra-agressivo
3. Usar Redis com mais capacidade

### **Cenário 3: Cache em Memória Grande**
```json
{
  "memory": { "keysInMemory": 5000, "approximateSize": "50 MB" }
}
```
**Diagnóstico**: Muito fallback para memória (Redis indisponível)  
**Ação**: Verificar por que Redis está desconectado frequentemente

## 🔗 Links Relacionados

- [Cache Service](../src/lib/cache-service.ts)
- [Documentação Smart Cache](./SMART-CACHE-MODEL-MAPPING.md)
- [Variáveis de Ambiente](../env.example)

## 📝 Notas

- O monitoramento é **somente leitura** por padrão
- Ações administrativas requerem confirmação
- Auto-refresh consome recursos do browser
- Ideal para debugging e otimização

