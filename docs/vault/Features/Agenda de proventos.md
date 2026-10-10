---
tags: [feature, proventos]
updated: 2026-10-09
fontes: [src/app/agenda-proventos/, src/app/api/agenda-proventos/, src/components/dashboard-agenda-widget.tsx, src/lib/finance/dividends.ts, src/lib/dividend-radar-service.ts, src/lib/dividend-service.ts]
---
# Agenda de proventos
> `/agenda-proventos` lista data-com, pagamento e valor dos proventos dos ativos da carteira e do radar, com projeção de renda mensal de 12 meses e exportação para calendário.

## Como funciona
- Página: `src/app/agenda-proventos/page.tsx` (servidor; sem sessão → `/login?callbackUrl=/agenda-proventos`; `robots: { index: false }`), com `agenda-client.tsx`, `agenda-data.ts`, `agenda-model.ts` e `income-chart.tsx`.
- Eventos: `DividendHistory` + projeções para os ativos do [[Radar]] (RadarConfig) e da [[Carteira]]. Filtros Carteira / Radar / Todos e janelas de 30/90 dias à frente ou 90 dias para trás. Tabela com ticker fixo.
- Valor por posição = quantidade na data-ex (transações confirmadas); JCP mostrado bruto e líquido (`jcpNet` em `src/lib/finance/dividends.ts`).
- Renda mensal dos próximos 12 meses: barra cheia = confirmado, vazada = projetado.
- APIs: `/api/agenda-proventos` (JSON), `/api/agenda-proventos/ics` (`text/calendar`, RFC 5545, UID estável) e `/api/agenda-proventos/ttm`; todas exigem sessão. Botões "Baixar .ics" e "Adicionar ao Google Agenda".
- Projeções determinísticas: `projectSeasonal` (mês que pagou em pelo menos 2 dos últimos 3 anos, valor mediano), rotuladas "estimativa estatística" (`src/lib/dividend-radar-service.ts`). Sem LLM.
- Widget "Próximos proventos" no dashboard (`src/components/dashboard-agenda-widget.tsx`).

## Regras / limites
- Exige login; não achei gate Premium na página (não verifiquei a API linha a linha).
- Datas só-dia formatadas em UTC (`formatDate` com `dateOnly`), para não mostrar um dia antes (correção da [[Onda 5]]).
- Proventos duplicados entre fontes são deduplicados na leitura (mesmo ticker, data-ex a até 5 dias, valor a até 2%).

## Histórico nas ondas
- [[Onda 2]]: `f77fd79` (agenda, ICS, projeções sazonais, renda mensal) e `9680fb4` (projeções puras fora do serviço).
- [[Onda 5]]: `44aa012` (datas), `4782de7` (dedupe de FII) e `f15d22f` (gravação não apaga linhas do Yahoo).
- [[Onda 6]]: contexto "agenda" (próximos 5 eventos) para o [[Ben]].

## Pendências
- Dono: confirmar o rótulo "Data ex" (o InfoHint explica data-com).
- AAPL34 local soma ~R$ 0,54 em 12 meses (esperado ~R$ 0,26): conferir duplicatas na produção.
- E-mail de resumo semanal de proventos foi adiado.

## Relacionadas
[[Carteira]] · [[Radar]] · [[Fontes de dados]] · [[Bazin]] · [[Barsi]]
