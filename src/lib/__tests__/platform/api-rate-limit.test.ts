import test from 'node:test'
import assert from 'node:assert/strict'

import {
  API_RATE_LIMIT,
  apiRateLimitWindow,
  clientIpFromHeaders,
  isApiRateLimitExempt,
  isLoopbackIp,
  parseApiRateLimitMode,
} from '../../../middleware'

test('modo do rate limit: enforce por padrão, log e off pelo env', () => {
  assert.equal(parseApiRateLimitMode(undefined), 'enforce')
  assert.equal(parseApiRateLimitMode(''), 'enforce')
  assert.equal(parseApiRateLimitMode('qualquer'), 'enforce')
  assert.equal(parseApiRateLimitMode('log'), 'log')
  assert.equal(parseApiRateLimitMode('off'), 'off')
})

test('isenções: auth, webhooks, health e crons com o segredo', () => {
  assert.equal(isApiRateLimitExempt('/api/auth/session', null, 's3cr3t'), true)
  assert.equal(isApiRateLimitExempt('/api/webhooks/stripe', null, 's3cr3t'), true)
  assert.equal(isApiRateLimitExempt('/api/health', null, 's3cr3t'), true)
  assert.equal(isApiRateLimitExempt('/api/cron/fetch-etf', 'Bearer s3cr3t', 's3cr3t'), true)
  // Sem o segredo certo, cron e demais rotas contam no limite
  assert.equal(isApiRateLimitExempt('/api/cron/fetch-etf', null, 's3cr3t'), false)
  assert.equal(isApiRateLimitExempt('/api/cron/fetch-etf', 'Bearer errado', 's3cr3t'), false)
  assert.equal(isApiRateLimitExempt('/api/rank-builder', null, 's3cr3t'), false)
  // CRON_SECRET ausente não isenta ninguém (nem `Bearer undefined`)
  assert.equal(isApiRateLimitExempt('/api/rank-builder', 'Bearer undefined', undefined), false)
  assert.equal(isApiRateLimitExempt('/api/rank-builder', 'Bearer ', ''), false)
})

test('IP do cliente pelos headers do proxy', () => {
  assert.equal(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7')
  assert.equal(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' })), '198.51.100.2')
  assert.equal(clientIpFromHeaders(new Headers({ 'cf-connecting-ip': '192.0.2.9' })), '192.0.2.9')
  assert.equal(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '::1' })), '127.0.0.1')
  assert.equal(clientIpFromHeaders(new Headers()), 'unknown')
  assert.equal(isLoopbackIp('127.0.0.1'), true)
  assert.equal(isLoopbackIp('unknown'), true)
  assert.equal(isLoopbackIp('203.0.113.7'), false)
})

test('janela fixa de 1 minuto: chave por IP e segundos até a próxima janela', () => {
  const start = Date.UTC(2026, 9, 9, 12, 0, 0)
  const a = apiRateLimitWindow('203.0.113.7', start)
  const b = apiRateLimitWindow('203.0.113.7', start + 59_000)
  const c = apiRateLimitWindow('203.0.113.7', start + 60_000)
  assert.equal(a.key, b.key)
  assert.notEqual(a.key, c.key)
  assert.notEqual(a.key, apiRateLimitWindow('203.0.113.8', start).key)
  assert.equal(a.retryAfter, 60)
  assert.equal(b.retryAfter, 1)
  assert.equal(apiRateLimitWindow('x', start + 59_900).retryAfter, 1)
  assert.equal(API_RATE_LIMIT.windowSeconds, 60)
  assert.ok(API_RATE_LIMIT.limit >= 100, 'limite generoso')
})
