# Proteção Global de APIs

## 🎯 Visão Geral

Implementamos uma solução **híbrida** para proteger todas as rotas da API:

1. **Middleware Global** - Aplica rate limiting básico automaticamente em todas as rotas `/api/*`
2. **Proteção Específica** - Use `protectGetRoute`/`protectPostRoute` para proteções extras em rotas críticas

## 🛡️ Como Funciona

### Proteção Automática (Middleware)

O middleware do Next.js (`src/middleware.ts`) agora aplica rate limiting básico em **todas** as rotas `/api/*` automaticamente:

- ✅ **100 requisições por minuto** por IP (padrão)
- ✅ **Bloqueio automático** após 10 violações
- ✅ **Detecção de padrões suspeitos** (User-Agent, headers)
- ✅ **Sem necessidade de alterar cada rota**

### Rotas com Proteção Mais Restritiva

Algumas rotas críticas têm limites mais baixos automaticamente:

- `/api/auth/register` - 2/min (muito restritivo)
- `/api/auth/login` - 5/min
- `/api/auth/reset-password` - 5/min
- `/api/auth/forgot-password` - 5/min

### Rotas Excluídas

Estas rotas não têm rate limiting global (mas podem ter proteção específica):

- `/api/health` - Health checks
- `/api/webhooks/*` - Webhooks (geralmente têm autenticação própria)

## 📝 Quando Usar Proteção Específica

Mesmo com proteção global, você deve usar `protectGetRoute`/`protectPostRoute` em:

1. **Rotas críticas** que precisam de limites mais baixos
2. **Rotas que precisam de honeypot** (registro, formulários públicos)
3. **Rotas que precisam de validações extras** (headers obrigatórios, métodos específicos)

### Exemplo: Rota de Registro

```typescript
import { protectPostRoute } from '@/lib/api-protection'
import { RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-middleware'

export const POST = protectPostRoute(
  async (request: NextRequest) => {
    // Sua lógica aqui
  },
  {
    rateLimit: 'REGISTER', // Limite mais restritivo (2/min)
    enableHoneypot: true  // Honeypot habilitado
  }
)
```

**Por que usar proteção específica aqui?**
- Limite mais baixo (2/min vs 100/min global)
- Honeypot para detectar bots
- Validações extras de dados

## 🔧 Configuração

### Ajustar Limites Globais

Edite `src/lib/api-global-protection.ts`:

```typescript
const GLOBAL_API_RATE_LIMIT = {
  window1Min: 100,        // Ajuste conforme necessário
  window15Min: 500,
  window1Hour: 2000,
  window24Hour: 10000,
  blockAfterViolations: 10,
  blockDuration: 3600,
  endpoint: 'api-global'
}
```

### Adicionar Rotas Restritivas

Adicione rotas que precisam de limites mais baixos:

```typescript
const STRICT_ROUTES: Record<string, typeof RATE_LIMIT_CONFIGS.REGISTER> = {
  '/api/auth/register': RATE_LIMIT_CONFIGS.REGISTER,
  '/api/sua-rota-critica': RATE_LIMIT_CONFIGS.API_PREMIUM,
}
```

### Excluir Rotas do Rate Limiting

Adicione rotas que não devem ter rate limiting:

```typescript
const EXCLUDED_ROUTES = [
  '/api/health',
  '/api/webhooks',
  '/api/sua-rota-excluida',
]
```

## 🔍 Verificar Rotas Sem Proteção

Use o script helper para identificar rotas que ainda não têm proteção específica:

```bash
# Verificar rotas sem proteção
tsx scripts/apply-api-protection.ts --check

# Listar todas as rotas
tsx scripts/apply-api-protection.ts --list
```

## 📊 Comparação: Global vs Específica

| Característica | Proteção Global | Proteção Específica |
|---------------|-----------------|---------------------|
| **Aplicação** | Automática em todas as rotas | Manual por rota |
| **Rate Limit** | 100/min (padrão) | Configurável (2-100/min) |
| **Honeypot** | ❌ Não | ✅ Sim (em POST) |
| **Validações** | Básicas (User-Agent) | Completas (headers, métodos) |
| **Uso** | Proteção básica | Rotas críticas |

## ✅ Checklist de Proteção

- [x] ✅ Middleware global aplicado em `/api/*`
- [x] ✅ Rate limiting básico funcionando
- [x] ✅ Bloqueio automático de IPs
- [x] ✅ Detecção de padrões suspeitos
- [ ] ⚠️ Rotas críticas com proteção específica (use o script para verificar)
- [ ] ⚠️ Honeypot em formulários públicos (aplicar manualmente)

## 🎯 Próximos Passos

1. **Execute o script** para ver quais rotas ainda precisam de proteção específica:
   ```bash
   tsx scripts/apply-api-protection.ts --check
   ```

2. **Proteja rotas críticas** manualmente usando `protectGetRoute`/`protectPostRoute`

3. **Monitore logs** para ajustar limites conforme necessário

4. **Ajuste configurações** baseado no comportamento real dos usuários

## 💡 Dicas

- **Não remova a proteção global** - Ela é sua primeira linha de defesa
- **Use proteção específica** apenas em rotas que realmente precisam
- **Monitore logs** para identificar padrões de ataque
- **Ajuste limites** baseado em dados reais, não em suposições

## 🔗 Referências

- [Guia de Proteção de APIs](./API_PROTECTION_GUIDE.md) - Detalhes sobre proteção específica
- [Implementação de Proteção contra Bots](./BOT_PROTECTION_IMPLEMENTATION.md) - Visão geral completa

