# 🔧 Troubleshooting: Redis Sempre Desconectado

## 🔴 Problema

Redis aparece sempre como **DESCONECTADO** no dashboard, e as chaves aumentam apenas no **cache em memória**, nunca no Redis.

## ✅ O Que Já Verificamos

1. ✅ **Redis está funcionando**: Teste direto conectou com sucesso
2. ✅ **Rede está OK**: Porta 16574 acessível
3. ✅ **REDIS_URL configurada**: Credenciais corretas
4. ✅ **Redis tem 736 chaves**: Outras instâncias estão usando

## 🎯 Solução Rápida

### **1. Forçar Conexão via Dashboard**

1. Acesse: `http://localhost:3000/admin/cache-monitor`
2. Role até "Ações de Manutenção"
3. Clique em: **🔌 Forçar Conexão (Debug)**
4. Aguarde a mensagem de sucesso
5. Clique em **Atualizar**
6. Verifique se status mudou para "CONECTADO"

### **2. Reiniciar Aplicação**

```bash
# Parar o servidor (Ctrl+C)
# Depois iniciar novamente:
npm run dev
```

### **3. Verificar Logs**

Quando iniciar a aplicação, procure por estas mensagens:

✅ **Funcionando:**
```
✅ CacheService inicializado com sucesso (lazy mode)
```

❌ **Com problema:**
```
❌ Redis: ERRO CRÍTICO (ERR max number of clients reached)
🚨 Redis: ERRO CRÍTICO (...) - Redis DESABILITADO nesta instância
```

## 🔍 Diagnósticos Detalhados

### **A. Verificar Estado Interno do Redis no Next.js**

Adicione temporariamente logs no arquivo `src/lib/cache-service.ts`:

```typescript
// Linha ~405 (método get)
console.log('🔍 DEBUG get:', {
  shouldUse: shouldUseRedis(),
  redisConnected,
  redisDisabled,
  clientExists: redisClient !== null
})
```

### **B. Testar Conexão Direta**

```bash
node -r dotenv/config scripts/diagnose-redis.js
```

Resultado esperado:
```
✅ PING: PONG
✅ SET: ok
✅ GET: ok
```

### **C. Verificar Variáveis de Ambiente**

```bash
# Ver se está carregando corretamente
grep REDIS_URL .env

# Testar no Node
node -r dotenv/config -e "console.log(process.env.REDIS_URL ? '✅ OK' : '❌ MISSING')"
```

## 🐛 Causas Mais Comuns

### **1. Redis Ficou "Disabled" (mais provável)**

**Sintoma**: Redis nunca conecta, mesmo após reiniciar

**Causa**: Em algum momento, houve um erro crítico (ex: max clients) e o Redis foi marcado como `disabled`. O código para de tentar conectar.

**Solução**:
```bash
# Opção 1: Use o botão "Forçar Conexão" no dashboard

# Opção 2: Reinicie a aplicação
npm run dev
```

**Como evitar**: Já está resolvido com as otimizações implementadas (fail-fast, idle disconnect, etc)

---

### **2. Modo LAZY_CONNECT muito agressivo**

**Sintoma**: Redis só conecta quando realmente necessário, pode parecer sempre desconectado

**Causa**: `LAZY_CONNECT = true` + idle timeout de 10s

**Solução temporária** (para debug):
```typescript
// src/lib/cache-service.ts
const LAZY_CONNECT = false // Força conectar no início
const REDIS_IDLE_TIMEOUT = 60000 // 1 minuto
```

⚠️ **Não recomendado para produção** (aumenta uso de conexões)

---

### **3. Try-Catch silenciando erros**

**Sintoma**: Sem logs de erro, mas Redis não conecta

**Causa**: Erros sendo capturados mas não reportados adequadamente

**Solução**: Verificar logs do console quando servidor inicia

---

### **4. Problema com Redis Cloud**

**Sintoma**: Funcionava antes, parou de funcionar

**Causas possíveis**:
- Redis Cloud atingiu limite do plano gratuito
- IP foi bloqueado por excesso de conexões
- Credenciais foram regeneradas

**Verificar**:
1. Acesse painel do Redis Cloud
2. Veja status do database
3. Verifique se senha mudou
4. Veja métricas de uso

---

## 🧪 Teste Definitivo

Execute este teste para ter certeza que está tudo funcionando:

```bash
# 1. Diagnóstico
node -r dotenv/config scripts/diagnose-redis.js

# 2. Reiniciar app
npm run dev

# 3. Fazer requisição
curl http://localhost:3000/api/companies?limit=1

# 4. Verificar status
curl http://localhost:3000/api/admin/cache-status | jq '.redis.status'
```

**Resultado esperado**:
```json
"connected"  // ou "disconnected" (se passou 10s)
```

**Resultado COM problema**:
```json
"disabled"  // Problema confirmado
```

## 📝 Checklist de Depuração

- [ ] Redis funciona via `diagnose-redis.js`?
- [ ] Variável `REDIS_URL` está no `.env`?
- [ ] Aplicação foi reiniciada após mudanças?
- [ ] Logs mostram "Redis DESABILITADO"?
- [ ] Dashboard mostra "lastCriticalError"?
- [ ] Botão "Forçar Conexão" foi testado?
- [ ] Cache em memória está funcionando?
- [ ] Aplicação consegue servir requisições?

## 🎯 Próximos Passos

Se após tudo isso o Redis continuar sempre desconectado:

1. **Desabilite temporariamente as otimizações**:
```typescript
// src/lib/cache-service.ts
const REDIS_IDLE_TIMEOUT = 999999 // Muito tempo
const LAZY_CONNECT = false
const DISCONNECT_AFTER_OPERATION = false
```

2. **Adicione logs agressivos**:
```typescript
console.log('🔍 shouldUseRedis:', shouldUseRedis())
console.log('🔍 redisConnected:', redisConnected)
console.log('🔍 redisDisabled:', redisDisabled)
```

3. **Verifique o código do cache-service**:
   - A função `handleRedisError` pode estar marcando como disabled
   - A função `shouldUseRedis` pode estar retornando false

4. **Abra issue** com:
   - Logs da aplicação
   - Resultado do `diagnose-redis.js`
   - Screenshot do dashboard
   - Configurações do cache-service

## 💡 Lembre-se

✅ **É NORMAL** o Redis estar desconectado quando ocioso (economiza conexões)  
❌ **NÃO É NORMAL** o Redis NUNCA conectar mesmo com requisições ativas  
✅ Aplicação funciona SEMPRE, com ou sem Redis (cache em memória é fallback)

