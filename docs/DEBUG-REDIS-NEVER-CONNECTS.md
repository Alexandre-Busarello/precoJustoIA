# 🔍 DEBUG: Redis Nunca Conecta

## 🔴 Problema Identificado

Através dos logs:
```
connected: false,
clientExists: false,  // ← Cliente nunca é criado!
disabled: false,
lastError: null
```

O Redis **NUNCA está sendo instanciado**. O cliente nem está sendo criado.

## 🎯 Logs de Debug Adicionados

Adicionei logs detalhados em TODA a cadeia de inicialização do Redis:

### **1. Carregamento do Módulo**
```
🌟 Módulo cache-service carregado no servidor - iniciando auto-init
```

### **2. Inicialização**
```
🚀 Inicializando CacheService...
🔍 Configuração: { LAZY_CONNECT, REDIS_IDLE_TIMEOUT, ... }
⏳ LAZY_CONNECT = true: Redis conectará quando necessário
✅ CacheService inicializado com sucesso (lazy mode)
```

### **3. Primeira Operação (Lazy Load)**
```
🔍 ensureRedisConnection: { 
  LAZY_CONNECT: true, 
  redisConnected: false, 
  willInitialize: true 
}
🔄 Iniciando Redis via lazy loading...
```

### **4. initializeRedis()**
```
🚀 initializeRedis CHAMADO
✅ Ambiente: Servidor + Redis module disponível
✅ REDIS_URL configurada: redis://default:***...
🔗 Criando nova conexão Redis...
📡 Chamando redisClient.connect()...
✅ redisClient.connect() completou (aguardando evento "ready")
🏁 initializeRedis finalizado
```

### **5. Eventos do Redis**
```
🔗 Redis: Conectando...
✅ Redis: Pronto para uso
🔓 Redis foi reabilitado após conexão bem-sucedida
```

### **6. Operações**
```
🔍 shouldUseRedis = false/true: { ... }
📦 Cache SET (Redis): ...
📦 Cache HIT (Redis): ...
```

---

## 🧪 TESTE AGORA

### **Passo 1: Reiniciar Aplicação**

```bash
# IMPORTANTE: Parar o servidor completamente (Ctrl+C)
# Depois iniciar novamente
npm run dev
```

### **Passo 2: Observar Logs de Inicialização**

Quando o servidor iniciar, você DEVE ver:

```
🌟 Módulo cache-service carregado no servidor - iniciando auto-init
🚀 Inicializando CacheService...
🔍 Configuração: {
  LAZY_CONNECT: true,
  REDIS_IDLE_TIMEOUT: 10000,
  DISCONNECT_AFTER_OPERATION: false,
  isServerless: true
}
⏳ LAZY_CONNECT = true: Redis conectará quando necessário
🧹 Limpeza automática do cache em memória configurada (300s)
⏰ Monitoramento agressivo de inatividade configurado (10s)
✅ CacheService inicializado com sucesso (lazy mode)
```

### **Passo 3: Fazer uma Requisição**

```bash
# Em outro terminal
curl http://localhost:3000/api/companies?limit=1
```

### **Passo 4: Verificar Logs de Conexão**

No terminal do servidor, você DEVE ver:

```
🔍 Cache.get("analisador-acoes:..."): { shouldUse: false, ... }
🔍 shouldUseRedis = false: { disabled: false, connected: false, ... }
🔍 ensureRedisConnection: { 
  LAZY_CONNECT: true,
  redisConnected: false,
  willInitialize: true  ← Deve ser true!
}
🔄 Iniciando Redis via lazy loading...
🚀 initializeRedis CHAMADO
✅ Ambiente: Servidor + Redis module disponível
✅ REDIS_URL configurada: redis://default:***...
🔗 Criando nova conexão Redis...
📡 Chamando redisClient.connect()...

... (aguardando conexão) ...

🔗 Redis: Conectando...
✅ Redis: Pronto para uso
🔓 Redis foi reabilitado após conexão bem-sucedida
✅ redisClient.connect() completou
🏁 initializeRedis finalizado. Estado: { clientExists: true, connected: true }

📦 Cache SET (Redis): ...  ← Deve usar Redis agora!
```

---

## ❓ Possíveis Cenários

### **Cenário A: Logs Aparecem Corretamente**

✅ **Sucesso!** O Redis está conectando e funcionando.

**Próximo passo**: Verificar no dashboard:
```
http://localhost:3000/admin/cache-monitor
```

Deve mostrar:
- Status: CONECTADO
- Chaves Redis: [número]
- Cliente Existe: Sim

---

### **Cenário B: Logs Param em "willInitialize: false"**

```
🔍 ensureRedisConnection: { 
  willInitialize: false  ← PROBLEMA!
}
```

**Problema**: A condição `!redisConnected && !isInitializing` está falhando.

**Solução**: Veja qual flag está impedindo:
- Se `redisConnected = true`: Já está conectado (mas não deveria)
- Se `isInitializing = true`: Está travado em inicialização

---

### **Cenário C: Erro em initializeRedis()**

```
❌ Erro ao conectar ao Redis: [mensagem]
❌ Stack: [stacktrace]
```

**Problema**: A conexão está falhando.

**Causas possíveis**:
1. **REDIS_URL incorreta**: Verificar `.env`
2. **Redis Cloud offline**: Verificar painel
3. **Timeout**: Aumentar `CONNECTION_TIMEOUT`
4. **Max clients**: Erro crítico conhecido

---

### **Cenário D: Logs Não Aparecem**

Se você NÃO ver `🌟 Módulo cache-service carregado`:

**Problema**: O módulo não está sendo carregado.

**Solução**:
1. Verificar se o arquivo existe: `src/lib/cache-service.ts`
2. Verificar se está sendo importado em algum lugar
3. Limpar cache: `rm -rf .next && npm run dev`

---

## 🐛 Checklist de Debug

Copie e cole no terminal após reiniciar:

```bash
echo "=== CHECKLIST DE DEBUG ==="
echo ""
echo "1. Módulo carregado?"
grep "🌟 Módulo cache-service" .next/server/chunks/*.js 2>/dev/null && echo "✅ Sim" || echo "❌ Não"
echo ""
echo "2. REDIS_URL configurada?"
grep REDIS_URL .env && echo "✅ Sim" || echo "❌ Não"
echo ""
echo "3. Node modules Redis instalado?"
ls node_modules/redis/package.json && echo "✅ Sim" || echo "❌ Não"
echo ""
echo "4. Logs no console?"
echo "   Verifique manualmente no terminal do 'npm run dev'"
```

---

## 📝 Me Envie Esses Logs

Para eu ajudar melhor, me envie:

### **1. Logs de Inicialização**
```
(copie TUDO que aparece quando faz npm run dev)
```

### **2. Logs da Primeira Requisição**
```
(copie TUDO que aparece quando faz curl http://localhost:3000/api/companies?limit=1)
```

### **3. Estado do Dashboard**
```
(tire screenshot de http://localhost:3000/admin/cache-monitor)
```

---

## 🎯 O Que Esperar

### ✅ **Funcionando:**
```
🌟 Módulo carregado
🚀 Inicializando
⏳ Lazy mode ativo
✅ Inicializado
🔍 ensureRedisConnection: willInitialize = true
🚀 initializeRedis CHAMADO
✅ REDIS_URL configurada
🔗 Criando conexão
📡 Chamando connect()
✅ Redis: Pronto
📦 Cache SET (Redis)
```

### ❌ **Com Problema:**

**Opção 1**: Logs param antes de `🚀 initializeRedis CHAMADO`
**Opção 2**: Erro em `❌ Erro ao conectar`
**Opção 3**: Nenhum log aparece

Em qualquer caso, os logs vão me dizer EXATAMENTE onde está travando!

---

## 🔧 Workaround Temporário

Se quiser testar forçando conexão imediata (sem lazy loading):

```typescript
// src/lib/cache-service.ts (linha ~100)
const LAZY_CONNECT = false  // Mude de true para false
```

Isso força o Redis a conectar no início, facilitando debug.

⚠️ **Não recomendado para produção** (usa mais conexões)

---

## 📞 Próximos Passos

1. ✅ Reinicie: `npm run dev`
2. 👀 Observe os logs
3. 📸 Tire screenshot/copie logs
4. 📤 Me envie os resultados

Com os novos logs, vou identificar EXATAMENTE por que o Redis não está conectando! 🚀

