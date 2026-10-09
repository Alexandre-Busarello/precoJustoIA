---
tags: [feature, alertas]
updated: 2026-10-09
fontes: [src/lib/custom-trigger-service.ts, src/components/custom-monitor-form.tsx, src/components/custom-monitors-list.tsx, src/components/alerts-tabs.tsx, src/components/monitor-limit-banner.tsx, src/app/api/user-asset-monitor/, src/lib/asset-monitoring-service.ts, src/app/dashboard/]
---
# Alertas
> Monitoramentos por ativo com gatilhos de preço, indicadores e valuation (preço-teto Bazin, desconto ao preço justo, DY 12m). Avisam por notificação no app e e-mail.

## Como funciona
- Telas (com `alerts-tabs.tsx`: Meu radar, Alertas de preço, Monitoramentos, Notificações): `/dashboard/subscriptions`, `/dashboard/monitoramentos-customizados` (+ `criar`, `editar/[id]`) e `/notificacoes`.
- `custom-monitor-form.tsx` lê `?ticker=` e `?type=` para preencher o formulário (links vêm da página do ativo).
- Avaliador puro em `src/lib/custom-trigger-service.ts` (`evaluateTriggerConfig`), usado pelo fluxo de `src/lib/asset-monitoring-service.ts`.
- Gatilhos novos da [[Onda 2]]:
  - `bazinCeiling`: teto = média de 5 anos completos de proventos ÷ DY-alvo, padrão 6% (`DEFAULT_BAZIN_TARGET_YIELD`, `BAZIN_FULL_YEARS`);
  - `fairValueDiscount`: desconto ao preço justo, com modelo `graham`, `fcd`, `gordon`, `bazin` ou `bankPvp` (`FAIR_VALUE_MODELS`), lido do último `AssetSnapshot`;
  - `dyTtmAbove`: DY TTM acima de X.
- API: `src/app/api/user-asset-monitor/` (validação com zod).
- Crons: `monitor-custom-triggers`, `monitor-assets`, `monitor-price-variations` (ver [[Crons]]).

## Regras / limites
- **Free:** até 3 monitoramentos ativos (`FREE_MONITOR_LIMIT = 3`; antes era 1). Só bloqueia a criação, ninguém perde alertas. **Premium:** ilimitado. Banner em `monitor-limit-banner.tsx`.
- Sem dados → não dispara e mostra o motivo.
- Texto descreve o critério, sem "compra" ([[Compliance CVM]]).

## Histórico nas ondas
- [[Onda 1]]: `c08d34e` (telas de alertas no design system, abas e formulário com preenchimento).
- [[Onda 2]]: `a16f330` (gatilhos Bazin, desconto ao preço justo e DY TTM; limite free 3).
- [[Onda 6]]: "Perguntar ao Ben" na linha do alerta ("Por que este alerta disparou?").

## Pendências
- Dono: confirmar o limite de 3 alertas grátis.

## Relacionadas
[[Radar]] · [[Bazin]] · [[Crons]] · [[Ben]] · [[Planos e preços]]
