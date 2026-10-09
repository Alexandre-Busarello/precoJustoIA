---
tags: [feature, radar]
updated: 2026-10-09
fontes: [src/app/radar/page.tsx, src/components/radar-page-content.tsx, src/components/radar-grid.tsx, src/lib/radar-service.ts, src/app/api/radar/, src/app/radar-dividendos/, src/components/dividend-radar-page-content.tsx, src/components/dividend-radar-grid.tsx, src/lib/dividend-radar-service.ts]
---
# Radar
> Dois radares. **Radar de oportunidades** (`/radar`): a lista de acompanhamento do usuário com critérios por estratégia e status técnico. **Radar de dividendos** (`/radar-dividendos`): calendário de proventos por mês.

## Como funciona
**Radar de oportunidades**
- `src/app/radar/page.tsx` → `radar-page-content.tsx` e `radar-grid.tsx` (DataTable com ticker fixo).
- Cada linha mostra "6/8" + 8 pontos (cheio = passou, vazado = falhou), com nome acessível e InfoHint das estratégias (`radar-strategy-badges.tsx`).
- Status técnico em `src/lib/radar-service.ts` (`TECHNICAL_LABELS`): "Abaixo/Acima do valor estimado", "Abaixo/Acima da faixa estimada", "Até a entrada técnica". Nunca é recomendação.
- APIs: `/api/radar` (lista do usuário), `/api/radar/data` e `/api/radar/explore` (até 50 sugestões, cache por dia e plano).
- O mesmo radar aparece no dashboard (`dashboard-radar-section.tsx`) e alimenta a [[Agenda de proventos]].

**Radar de dividendos**
- `/radar-dividendos` (`dividend-radar-page-content.tsx`, `dividend-radar-grid.tsx`, `src/app/radar-dividendos/dividend-months.ts`) e `/radar-dividendos/[ticker]`.
- Ponto cheio = confirmado, vazado = projetado; mês atual destacado com `bg-surface`. Detalhes (data-com, pagamento, valor, tipo) abrem por toque (Popover no desktop, folha no mobile).
- Projeções determinísticas (`projectSeasonal`, `src/lib/dividend-radar-service.ts`); APIs em `/api/dividend-radar/{grid,projections,reprocess}`; cron `dividend-radar-projections`.

## Regras / limites
- **Radar de oportunidades — free:** até 3 tickers (`FREE_TICKER_LIMIT = 3` em `src/app/api/radar/route.ts`). **Premium:** ilimitado. O explore usa dados de demonstrativos só para Premium (`includeStatements: isPremium`).
- Radar de dividendos: não verifiquei gate de plano.
- Sem "Compra"/"Região segura" ([[Compliance CVM]]).

## Histórico nas ondas
- [[Onda 1]]: `0f00d7c` (pontos no lugar de pílulas, rótulos neutros, Barsi rotulado certo, radar de dividendos por toque e compacto no mobile, login detectado com `useSession`).
- [[Onda 2]]: projeções de dividendos sem Gemini (`f77fd79`).
- [[Onda 5]]: datas-ex sem o erro de um dia (`44aa012`).

## Pendências
- Nada específico no RESUME.

## Relacionadas
[[Alertas]] · [[Agenda de proventos]] · [[Sinais financeiros]] · [[Barsi]] · [[Bazin]]
