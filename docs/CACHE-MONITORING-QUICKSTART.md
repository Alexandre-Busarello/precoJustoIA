# 🚀 Quick Start - Monitoramento de Cache

Guia rápido para começar a usar o monitoramento de cache Redis.

## ⚡ Acesso Rápido

### **Dashboard Web (Recomendado)**

1. Faça login como administrador
2. Acesse: `https://seu-dominio.com/admin/cache-monitor`
3. Pronto! Interface visual em tempo real

![Cache Monitor Dashboard](https://via.placeholder.com/800x400?text=Cache+Monitor+Dashboard)

---

## 📱 Usando o Dashboard

### **Visão Geral**
O dashboard mostra em tempo real:
- ✅ Status do Redis (conectado/desconectado/desabilitado)
- 📊 Métricas de conexão e cache
- 💡 Recomendações automáticas
- 🔧 Ações administrativas

### **Auto-Refresh**
Clique no botão **"Auto-refresh ON"** para monitorar continuamente (atualiza a cada 5s).

### **Ações Disponíveis**
- **Limpar Todo Cache**: Remove tudo
- **Limpar por Prefixo**: Ex: `companies`, `users`
- **Reinicializar Redis**: Força reconexão

---

## 💻 Usando via Terminal

### **1. Verificar Status**
```bash
./scripts/monitor-cache.sh status
```

Saída:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATUS DO CACHE REDIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status Redis:    CONECTADO
Saúde Geral:     SAUDÁVEL
Pode Servir:     Sim

🔌 CONEXÃO
Conectado:       Sim
Desabilitado:    Não
Tempo Ocioso:    2s
Chaves Redis:    1247
```

### **2. Monitorar em Tempo Real**
```bash
./scripts/monitor-cache.sh watch
```

Atualiza automaticamente a cada 5s. Pressione `Ctrl+C` para sair.

### **3. Limpar Cache**
```bash
# Limpar tudo
./scripts/monitor-cache.sh clear

# Limpar por prefixo
./scripts/monitor-cache.sh clear companies
```

### **4. Reinicializar Redis**
```bash
./scripts/monitor-cache.sh reconnect
```

### **5. Ver JSON Bruto**
```bash
./scripts/monitor-cache.sh json | jq '.'
```

---

## 🔧 Configuração do Script

### **Variável de Ambiente**
```bash
# Para produção
export CACHE_MONITOR_URL="https://meu-app.com"
./scripts/monitor-cache.sh status

# Ou inline
CACHE_MONITOR_URL="https://meu-app.com" ./scripts/monitor-cache.sh status
```

### **Cookie de Sessão**
O script precisa de um cookie de autenticação. Duas opções:

#### **Opção 1: Login via Browser**
1. Faça login no browser
2. Abra DevTools (F12)
3. Console: `document.cookie`
4. Copie o cookie `next-auth.session-token`
5. Crie arquivo `~/.analisador-acoes-session`:
```bash
echo "next-auth.session-token=SEU_TOKEN_AQUI" > ~/.analisador-acoes-session
```

#### **Opção 2: Login via curl**
```bash
curl -c ~/.analisador-acoes-session \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"senha"}' \
  https://seu-dominio.com/api/auth/callback/credentials
```

---

## 🔍 Interpretação dos Status

### ✅ **Tudo Funcionando**
```
Status Redis:    CONECTADO
Saúde Geral:     SAUDÁVEL
Pode Servir:     Sim
```
✅ Redis operacional

---

### 🟡 **Ocioso (Normal em Serverless)**
```
Status Redis:    DESCONECTADO
Tempo Ocioso:    15s
Pode Servir:     Sim
```
✅ Normal! Economizando conexões  
✅ Próxima operação reconectará automaticamente

---

### 🔴 **Max Clients (Crítico mas Funcional)**
```
Status Redis:    DESABILITADO
Saúde Geral:     DEGRADADO
Pode Servir:     Sim
Usando Fallback: Sim

⚠ Último erro crítico: ERR max number of clients reached
```
⚠️ Redis desabilitado mas aplicação funciona!  
✅ Usando cache em memória como fallback  
🔧 **Ação**: Ver recomendações no dashboard

---

## 🎯 Casos de Uso Comuns

### **1. Debug de Lentidão**
```bash
# Ver se Redis está conectado
./scripts/monitor-cache.sh status | grep "Status Redis"

# Se desconectado, pode ser causa de latência extra
```

### **2. Verificar Economia de Conexões**
```bash
# Ver modo e tempo ocioso
./scripts/monitor-cache.sh json | jq '.connection'
```

Resposta:
```json
{
  "lazyMode": true,
  "idleTimeSeconds": 8,
  "maxIdleTimeout": 10,
  "disconnectAfterOperation": false
}
```

✅ `idleTimeSeconds`: 8s → Vai desconectar em 2s  
✅ `lazyMode`: true → Conecta apenas quando necessário  
✅ `disconnectAfterOperation`: false → Modo normal (não ultra-agressivo)

### **3. Limpar Cache após Deploy**
```bash
# Limpar tudo para forçar recarga
./scripts/monitor-cache.sh clear

# Ou apenas dados de empresas
./scripts/monitor-cache.sh clear companies
```

### **4. Monitorar Durante Load Test**
```bash
# Terminal 1: Monitoramento
./scripts/monitor-cache.sh watch

# Terminal 2: Load test
ab -n 1000 -c 10 https://seu-dominio.com/api/companies
```

Observe:
- Tempo ocioso voltando a 0
- Status mudando para "conectado"
- Número de chaves aumentando

---

## 📊 Métricas Importantes

### **Para Otimização de Custos**
```bash
# Ver se modo ultra-agressivo está ativo
./scripts/monitor-cache.sh json | jq '.connection.disconnectAfterOperation'
# true = máxima economia, false = economia moderada
```

### **Para Performance**
```bash
# Ver timeouts configurados
./scripts/monitor-cache.sh json | jq '.performance'
```

Resposta:
```json
{
  "connectionTimeout": 3000,  // 3s para conectar
  "commandTimeout": 2000,     // 2s para comandos
  "failFastEnabled": true     // Fail-fast ativo
}
```

### **Para Debugging**
```bash
# Ver se há erros críticos
./scripts/monitor-cache.sh json | jq '.redis.lastCriticalError'
# null = OK, "string" = erro ocorreu
```

---

## 🚨 Troubleshooting

### **Script não funciona**
```bash
# Verificar permissões
chmod +x ./scripts/monitor-cache.sh

# Verificar dependências
which curl jq
# Se não tiver jq: sudo apt install jq
```

### **Erro de autenticação**
```
✗ Cookie de sessão não encontrado
```
**Solução**: Criar cookie conforme seção "Cookie de Sessão"

### **Erro de conexão**
```
✗ Erro ao obter status: Connection refused
```
**Solução**: Verificar se aplicação está rodando e `CACHE_MONITOR_URL` está correto

---

## 📚 Documentação Completa

- [Documentação Detalhada](./CACHE-MONITORING.md)
- [Cache Service](../src/lib/cache-service.ts)
- [API Endpoint](../src/app/api/admin/cache-status/route.ts)
- [Dashboard](../src/app/admin/cache-monitor/page.tsx)

---

## 🎓 Próximos Passos

1. ✅ Acesse o dashboard: `/admin/cache-monitor`
2. 📊 Ative auto-refresh para monitorar
3. 📈 Observe as recomendações
4. 🔧 Ajuste configurações se necessário
5. 🚀 Monitore durante deploys/load tests

**Dica**: Mantenha o dashboard aberto durante deploys para verificar se Redis continua estável!

