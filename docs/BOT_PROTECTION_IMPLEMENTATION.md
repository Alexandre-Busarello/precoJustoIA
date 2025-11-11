# Implementação de Proteção contra Bots

## 📋 Resumo

Sistema completo de proteção contra bots implementado após incidente de 50k registros automáticos que estouraram a quota de CPU.

## 🛡️ Componentes Implementados

### 1. Rate Limiting Avançado (`src/lib/rate-limit-middleware.ts`)

**Características:**
- ✅ Múltiplas janelas de tempo (1min, 15min, 1h, 24h)
- ✅ Bloqueio automático de IP após violações
- ✅ Tempo mínimo entre requisições
- ✅ Tracking de violações com decay automático
- ✅ Headers informativos (Retry-After, X-RateLimit-*)

**Configurações Disponíveis:**
- `REGISTER` - Muito restritivo (2/min, bloqueio após 3 violações)
- `LOGIN` - Moderado (5/min)
- `API_GENERAL` - Permissivo (60/min)
- `API_PREMIUM` - Restritivo (30/min)
- `ADMIN_OPERATION` - Permissivo para admins (100/min)

### 2. Detecção de Padrões Suspeitos

**Detecta:**
- User-Agent ausente ou muito curto
- User-Agents conhecidos de bots (curl, wget, python, etc)
- Requisições POST sem referer
- Headers Accept ausentes

### 3. Honeypot

Campos ocultos que bots preenchem acidentalmente:
- `website`, `url`, `homepage`, `phone`, `company`, `comment`, `message`, `subject`

Se qualquer desses campos for preenchido, o IP é bloqueado imediatamente.

### 4. Validações de Segurança

**Na rota de registro:**
- Email deve ter formato válido
- Nome não pode ser apenas números
- Senha deve conter letras E números
- Validação de campos obrigatórios

### 5. Middleware Reutilizável (`src/lib/api-protection.ts`)

Helpers para proteger qualquer rota:
- `protectGetRoute()` - Para rotas GET
- `protectPostRoute()` - Para rotas POST (com honeypot)
- `protectPutRoute()` - Para rotas PUT/PATCH
- `protectDeleteRoute()` - Para rotas DELETE
- `withApiProtection()` - Wrapper genérico

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
1. `src/lib/rate-limit-middleware.ts` - Sistema de rate limiting
2. `src/lib/api-protection.ts` - Helpers reutilizáveis
3. `src/app/api/admin/ip-blocks/route.ts` - Endpoint admin para gerenciar bloqueios
4. `docs/API_PROTECTION_GUIDE.md` - Guia de uso
5. `docs/BOT_PROTECTION_IMPLEMENTATION.md` - Este arquivo

### Arquivos Modificados:
1. `src/app/api/auth/register/route.ts` - Proteções anti-bot adicionadas

## 🚀 Como Usar

### Exemplo Básico - Rota de Registro

```typescript
import { withRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-middleware'

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    RATE_LIMIT_CONFIGS.REGISTER,
    async () => {
      // Sua lógica aqui
    }
  )
}
```

### Exemplo com Helper

```typescript
import { protectPostRoute } from '@/lib/api-protection'

export const POST = protectPostRoute(
  async (request: NextRequest) => {
    // Sua lógica aqui
  },
  { rateLimit: 'REGISTER' }
)
```

## 🔧 Gerenciamento de Bloqueios

### Verificar Status de um IP

```bash
GET /api/admin/ip-blocks?ip=1.2.3.4&endpoint=register
```

### Desbloquear um IP

```bash
POST /api/admin/ip-blocks
Content-Type: application/json

{
  "ip": "1.2.3.4",
  "endpoint": "register"
}
```

## 📊 Limites Configurados

### Registro (REGISTER)
- **2 requisições por minuto**
- **5 requisições por 15 minutos**
- **10 requisições por hora**
- **20 requisições por 24 horas**
- **Bloqueio após 3 violações** (24 horas)
- **Mínimo 5 segundos entre requisições**

Isso significa que um bot precisaria de **pelo menos 10 minutos** para fazer 2 registros, e seria bloqueado após apenas 3 tentativas de violação.

## 🎯 Próximos Passos Recomendados

1. **Monitoramento**: Integrar logs com Sentry/DataDog/CloudWatch
2. **Dashboard**: Criar interface admin para visualizar bloqueios
3. **CAPTCHA**: Considerar adicionar reCAPTCHA para casos extremos
4. **Whitelist**: Adicionar IPs confiáveis que não devem ser bloqueados
5. **Alertas**: Configurar alertas para bloqueios em massa

## ⚠️ Importante

- O sistema usa Redis para armazenar bloqueios (com fallback para memória)
- Bloqueios são temporários (TTL configurável)
- Logs de atividades suspeitas são gerados automaticamente
- Não exponha detalhes de erro para evitar ajudar bots

## 🔗 Documentação Adicional

Veja `docs/API_PROTECTION_GUIDE.md` para exemplos detalhados e casos de uso avançados.

