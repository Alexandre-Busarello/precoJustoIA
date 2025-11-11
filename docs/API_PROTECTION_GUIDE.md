# Guia de Proteção de APIs contra Bots

Este guia explica como usar o sistema de proteção contra bots implementado na aplicação.

## 📋 Visão Geral

O sistema implementa múltiplas camadas de proteção:

1. **Rate Limiting** - Limita requisições por IP com múltiplas janelas de tempo
2. **Bloqueio Automático de IP** - Bloqueia IPs após múltiplas violações
3. **Detecção de Padrões Suspeitos** - Identifica User-Agents e headers suspeitos
4. **Honeypot** - Campos ocultos que bots preenchem acidentalmente
5. **Validações de Segurança** - Validações adicionais de dados

## 🚀 Uso Básico

### Proteger uma Rota de Registro

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-middleware'

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    RATE_LIMIT_CONFIGS.REGISTER,
    async () => {
      // Sua lógica aqui
      const body = await request.json()
      // ...
      return NextResponse.json({ success: true })
    }
  )
}
```

### Usar Helpers de Proteção

```typescript
import { protectPostRoute, protectGetRoute } from '@/lib/api-protection'

// Para rotas POST (com honeypot habilitado)
export const POST = protectPostRoute(
  async (request: NextRequest) => {
    const body = await request.json()
    // Sua lógica aqui
    return NextResponse.json({ success: true })
  },
  {
    rateLimit: 'REGISTER' // ou configuração customizada
  }
)

// Para rotas GET
export const GET = protectGetRoute(
  async (request: NextRequest) => {
    // Sua lógica aqui
    return NextResponse.json({ data: [] })
  }
)
```

## ⚙️ Configurações de Rate Limit

### Configurações Disponíveis

- **REGISTER** - Muito restritivo (2/min, 5/15min, 10/hora, 20/dia)
- **LOGIN** - Moderado (5/min, 20/15min, 50/hora, 200/dia)
- **API_GENERAL** - Permissivo (60/min, 300/15min, 1000/hora, 5000/dia)
- **API_PREMIUM** - Restritivo (30/min, 150/15min, 500/hora, 2000/dia)

### Configuração Customizada

```typescript
import { RateLimitConfig } from '@/lib/rate-limit-middleware'

const customConfig: RateLimitConfig = {
  window1Min: 10,
  window15Min: 50,
  window1Hour: 200,
  window24Hour: 1000,
  blockAfterViolations: 5,
  blockDuration: 3600, // 1 hora em segundos
  minTimeBetweenRequests: 1000, // 1 segundo mínimo entre requisições
  endpoint: 'custom-endpoint'
}

export const POST = protectPostRoute(
  async (request: NextRequest) => {
    // ...
  },
  { rateLimit: customConfig }
)
```

## 🍯 Honeypot

O honeypot detecta bots que preenchem campos ocultos. Para usar no frontend:

```tsx
// No formulário de registro
<form>
  <input name="name" />
  <input name="email" />
  <input name="password" type="password" />
  
  {/* Campo honeypot - deve estar oculto via CSS */}
  <input 
    name="website" 
    style={{ display: 'none' }}
    tabIndex={-1}
    autoComplete="off"
  />
  
  <button type="submit">Registrar</button>
</form>
```

Se o campo `website` (ou outros campos honeypot) for preenchido, o IP será bloqueado imediatamente.

## 🔍 Detecção de Padrões Suspeitos

O sistema detecta automaticamente:

- User-Agent ausente ou muito curto
- User-Agents conhecidos de bots (curl, wget, python, etc)
- Requisições POST sem referer
- Headers Accept ausentes ou inválidos

Essas detecções são logadas mas não bloqueiam imediatamente (exceto em casos extremos).

## 🛡️ Proteções Adicionais

### Validações de Dados

A rota de registro inclui validações extras:

- Email deve ter formato válido
- Nome não pode ser apenas números
- Senha deve conter letras e números (não apenas um tipo)

### Headers de Resposta

O sistema retorna headers úteis:

```
X-RateLimit-Limit-1Min: 2
X-RateLimit-Remaining-1Min: 1
Retry-After: 60
```

## 🔧 Gerenciamento de Bloqueios (Admin)

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

## 📊 Monitoramento

Todas as atividades suspeitas são logadas no console. Em produção, você pode:

1. Integrar com Sentry, DataDog ou CloudWatch
2. Criar um dashboard de monitoramento
3. Configurar alertas para bloqueios em massa

## 🎯 Exemplos Práticos

### Exemplo 1: Rota de Login

```typescript
import { protectPostRoute } from '@/lib/api-protection'
import { RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-middleware'

export const POST = protectPostRoute(
  async (request: NextRequest) => {
    const { email, password } = await request.json()
    // Lógica de login
    return NextResponse.json({ token: '...' })
  },
  {
    rateLimit: 'LOGIN'
  }
)
```

### Exemplo 2: API Premium

```typescript
import { protectGetRoute } from '@/lib/api-protection'

export const GET = protectGetRoute(
  async (request: NextRequest) => {
    // Verificar se usuário é premium
    // Retornar dados premium
    return NextResponse.json({ data: [] })
  },
  {
    rateLimit: 'API_PREMIUM'
  }
)
```

### Exemplo 3: Rota Customizada

```typescript
import { withApiProtection } from '@/lib/api-protection'
import { RateLimitConfig } from '@/lib/rate-limit-middleware'

const myConfig: RateLimitConfig = {
  window1Min: 30,
  window15Min: 150,
  window1Hour: 500,
  window24Hour: 2000,
  blockAfterViolations: 3,
  blockDuration: 7200,
  endpoint: 'my-endpoint'
}

export const POST = withApiProtection(
  async (request: NextRequest) => {
    // Sua lógica
    return NextResponse.json({ success: true })
  },
  {
    rateLimit: myConfig,
    enableHoneypot: true,
    enableSuspiciousPatterns: true,
    allowedMethods: ['POST'],
    requiredHeaders: ['Content-Type']
  }
)
```

## ⚠️ Importante

1. **Não exponha detalhes de erro** - Bots podem usar isso para encontrar vulnerabilidades
2. **Monitore logs regularmente** - Identifique padrões de ataque
3. **Ajuste limites conforme necessário** - Baseado no comportamento real dos usuários
4. **Use HTTPS sempre** - Protege contra interceptação de dados
5. **Considere CAPTCHA** - Para casos extremos, adicione reCAPTCHA ou hCaptcha

## 🔗 Referências

- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [OWASP Bot Detection](https://owasp.org/www-community/vulnerabilities/Bot_detection)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)

