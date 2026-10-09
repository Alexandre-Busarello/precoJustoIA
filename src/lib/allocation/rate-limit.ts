import type { RateLimitConfig } from '@/lib/rate-limit-middleware'

/** Limite de simulações por IP: cada uma consulta o banco para vários ativos. */
export const ALLOCATION_RATE_LIMIT: RateLimitConfig = {
  window1Min: 12,
  window15Min: 60,
  window1Hour: 150,
  window24Hour: 600,
  blockAfterViolations: 10,
  blockDuration: 3600,
  endpoint: 'api-allocation',
}

/** Registro de compras na carteira: grava transações, então é mais restrito. */
export const ALLOCATION_REGISTER_RATE_LIMIT: RateLimitConfig = {
  window1Min: 5,
  window15Min: 20,
  window1Hour: 60,
  window24Hour: 200,
  blockAfterViolations: 10,
  blockDuration: 3600,
  minTimeBetweenRequests: 1500,
  endpoint: 'api-allocation-register',
}
