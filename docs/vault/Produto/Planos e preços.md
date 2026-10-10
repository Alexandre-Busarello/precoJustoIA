---
tags: [produto, planos, pricing]
updated: 2026-10-09
fontes: [src/lib/usage-based-pricing-service.ts, src/lib/trial-service.ts, src/lib/offer-utils.ts, docs/melhorias-2026-09/strategy.md]
---
# Planos e preços

> Três níveis de uso: anônimo, gratuito e Premium. O trial Premium dura **1 dia**. Os preços vivem na tabela `offers` de produção, e **não se altera preço sem o dono**.

## Limites por feature (`src/lib/usage-based-pricing-service.ts:29`)
| Feature | Anônimo | Gratuito (por mês) |
|---|---|---|
| `anon_full_view` | 2 | — (usa sessão) |
| `company_full_view` | 1 | 3 |
| `ranking_create` | 1 | 3 |
| `comparator_use` | 1 | 3 |
| `backtest_run` | 1 | 1 |
| `screening_run` | 1 | 3 |
| `recovery_calculator` | 2 | 3 (também por IP) |

- `-1` = ilimitado. O Premium é ilimitado.
- `FREE_LIMIT_BY_IP_FEATURES` conta o uso gratuito também por IP, para evitar múltiplas contas.
- Bônus: `effectiveLimit = freeLimit + bonusCredits`.
- Alertas: o limite grátis subiu de 1 para 3 na [[Onda 2]]. Ele só bloqueia a criação; ninguém perde alertas. Ver [[Alertas]].
- Modelos: só o [[Graham]] é grátis (`PREMIUM_STOCK_MODELS_COUNT = 11 − 1`).

## Trial (`src/lib/trial-service.ts:16`)
- `TRIAL_DURATION_DAYS = 1`, ativado por `ENABLE_TRIAL === 'true'`.
- **Decisão do dono:** continua de 1 dia. Trials longos geraram múltiplas contas sem conversão. Ver [[Decisões do dono]].
- Para o valor aparecer em 24 h, o onboarding do trial leva direto ao valuation completo, a um alerta de preço-teto e ao ranking Bazin/Gordon.

## Preço atual e proposta (strategy.md §6, só proposta)
- Hoje: R$ 189,90/ano (R$ 19,90/mês; −15% no PIX).
- Proposta para o dono, **fora deste ciclo**: Premium a R$ 199/ano, Pro a R$ 399/ano (IR/DARF, Ben ilimitado) e plano grátis mais aberto.
- Sequência sugerida: entregar os hábitos primeiro e só depois reajustar.

## Relacionadas
[[Visão do produto]] · [[Compliance CVM]] · [[Middleware e rate limit]] · [[00 - Início]]
