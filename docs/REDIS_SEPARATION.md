# Separação do Redis para Rate Limiting

## 📋 Visão Geral

O sistema agora usa **duas instâncias separadas de Redis**:

1. **REDIS_URL** - Cache geral da aplicação (dados, queries, etc)
2. **REDIS_RATE_LIMIT_URL** - Dedicado exclusivamente para rate limiting e bloqueio de IPs

## 🎯 Por que separar?

### Benefícios

1. **Isolamento de Performance**
   - Rate limiting não impacta o cache geral
   - Cache geral não afeta o rate limiting
   - Melhor performance em ambos os sistemas

2. **Escalabilidade**
   - Pode escalar cada Redis independentemente
   - Rate limiting pode usar Redis mais simples/barato
   - Cache geral pode usar Redis com mais memória

3. **Segurança**
   - Se um Redis falhar, o outro continua funcionando
   - Rate limiting crítico não depende do cache geral

4. **Monitoramento**
   - Métricas separadas para cada uso
   - Mais fácil identificar problemas

## 🔧 Configuração

### Variáveis de Ambiente

Adicione no seu `.env`:

```bash
# Redis para cache geral da aplicação
REDIS_URL="redis://seu-redis-cache:6379"

# Redis dedicado para rate limiting
REDIS_RATE_LIMIT_URL="redis://seu-redis-rate-limit:6379"
```

### Usando a Mesma Instância

Se você não tiver duas instâncias separadas, pode usar a mesma URL:

```bash
REDIS_URL="redis://localhost:6379"
REDIS_RATE_LIMIT_URL="redis://localhost:6379"
```

**Nota**: Funciona, mas não terá os benefícios de isolamento. Recomendado usar instâncias separadas em produção.

## 📊 O que usa cada Redis?

### REDIS_URL (Cache Geral)
- ✅ Cache de queries do Prisma
- ✅ Cache de dados de empresas
- ✅ Cache de análises
- ✅ Cache de rankings
- ✅ Qualquer outro cache da aplicação

### REDIS_RATE_LIMIT_URL (Rate Limiting)
- ✅ Dados de rate limiting por IP
- ✅ Bloqueios de IP
- ✅ Histórico de violações
- ✅ Timestamps de requisições
- ✅ Nada mais!

## 🏗️ Arquitetura

```
┌─────────────────────────────────────┐
│      Aplicação Next.js              │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Cache Service              │  │
│  │   (cache-service.ts)         │  │
│  │   Usa: REDIS_URL             │  │
│  └───────────┬──────────────────┘  │
│              │                      │
│  ┌───────────▼──────────────────┐  │
│  │   Rate Limit Cache Service   │  │
│  │   (rate-limit-cache-service) │  │
│  │   Usa: REDIS_RATE_LIMIT_URL  │  │
│  └───────────┬──────────────────┘  │
│              │                      │
│  ┌───────────▼──────────────────┐  │
│  │   Rate Limit Middleware      │  │
│  │   (rate-limit-middleware.ts) │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         │                    │
         │                    │
    ┌────▼────┐         ┌─────▼─────┐
    │ REDIS   │         │ REDIS     │
    │ Cache   │         │ Rate Limit│
    │ Geral   │         │           │
    └─────────┘         └───────────┘
```

## 🔍 Verificação

### Verificar se está funcionando

1. **Logs de inicialização**:
   ```
   ✅ RateLimitCacheService inicializado (lazy mode)
   ✅ REDIS_RATE_LIMIT_URL configurada para rate limiting
   ✅ Rate Limit Redis: Pronto para uso
   ```

2. **Se REDIS_RATE_LIMIT_URL não estiver configurado**:
   ```
   ⚠️ REDIS_RATE_LIMIT_URL não configurada, usando apenas cache em memória para rate limiting
   ```

### Testar Rate Limiting

Faça várias requisições rápidas para uma rota protegida. Você deve ver:
- Rate limiting funcionando
- Dados sendo salvos no Redis dedicado
- Bloqueios de IP funcionando

## 🚨 Troubleshooting

### Rate Limiting não funciona

1. Verifique se `REDIS_RATE_LIMIT_URL` está configurado
2. Verifique se o Redis está acessível
3. Verifique os logs para erros de conexão

### Cache geral não funciona

1. Verifique se `REDIS_URL` está configurado
2. O cache geral não foi alterado, continua usando `REDIS_URL`

### Usar mesma instância temporariamente

Se precisar usar a mesma instância temporariamente:

```bash
REDIS_URL="redis://localhost:6379"
REDIS_RATE_LIMIT_URL="redis://localhost:6379"
```

Funciona, mas não é recomendado para produção.

## 📝 Notas Importantes

- ✅ O cache geral (`cache-service.ts`) **não foi alterado**
- ✅ Apenas o rate limiting usa o novo Redis
- ✅ Fallback para memória funciona em ambos
- ✅ Cada serviço tem sua própria conexão Redis
- ✅ Não há compartilhamento de estado entre os dois

## 🔗 Arquivos Relacionados

- `src/lib/rate-limit-cache-service.ts` - Serviço de cache para rate limiting
- `src/lib/rate-limit-middleware.ts` - Middleware de rate limiting
- `src/lib/cache-service.ts` - Serviço de cache geral (não alterado)
- `src/lib/api-global-protection.ts` - Proteção global (usa rate limiting)

