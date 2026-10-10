# BATCH w6-ben-context (wave 6, runs BEFORE w6-ben-ui): Ben knows what the user is looking at

Owner request (2026-10-08): the Ben UI/UX should be easier and contextualized with the app. Read docs/melhorias-2026-09/backlog-rules.md first. CVM compliance: Ben explains and computes, he never recommends ("compra", "venda", "melhor ação" are forbidden; keep the w2 guardrail in ben-service). No Prisma schema change.

## OWNED PATHS
- src/lib/ben-context/** (new: page-context types, builders, serializer)
- src/lib/ben-service.ts, src/lib/ben-tools.ts (context injection + tool selection only), src/lib/ben-interaction-service.ts
- src/app/api/ben/chat/route.ts, src/app/api/ben/interactions/route.ts
- src/hooks/use-ben-chat.ts (context plumbing only; UI is w6-ben-ui)
- src/components/ben/ask-ben-button.tsx (new: the "Perguntar ao Ben" entry point) + MECHANICAL-ONLY insertion of `<AskBenButton …/>` in: src/components/asset/valuation-table.tsx (row menu), src/components/portfolio-holdings-table.tsx (row menu), the onde-aportar result component (wave 3), src/components/quick-ranker.tsx (results header), the screening results header, src/components/custom-monitors-list.tsx (alert row)
- src/lib/__tests__/ben-context/** (new)

## TASKS
1. **Typed page context (P0).** Replace the ad-hoc `{ pageType, ticker, companyName }` with a typed union that covers every main surface, built on the client from the route plus data the page already has. No new fetches just for the context. Variants:
   - asset (ticker, type, price, the selected valuation model and its fair value/margin, score);
   - portfolio (id, name, top holdings with weights, return);
   - ranking (model, universe, params summary, top 10 tickers);
   - screening (active filters, result count, top tickers);
   - comparador (tickers);
   - onde-aportar (amount, universe, result allocations);
   - backtest (config summary, total return, CDI/IBOV comparison);
   - agenda (next 5 events);
   - alerts;
   - dashboard;
   - the generic fallback.
   Keep it small: a serializer caps it at ~1,5k chars and never sends PII beyond what the user already sees.
2. **Server use (P0).** The chat API receives the context and injects it as a short "O usuário está vendo: …" system section, so Ben's first answer is about what's on screen. Ben keeps using his tools for fresh data: the context is a hint, not a source of truth for numbers older than the page. Pick tools by context, e.g. on an asset page prefer the asset tools, and on a portfolio prefer the portfolio tools.
3. **"Perguntar ao Ben" entry points (P0).** A small, consistent button/menu item that opens the chat with a contextual, prefilled question, plus the structured context:
   - valuation row: "Por que o preço justo pelo FCD é R$ X?";
   - portfolio holding: "Como PETR4 pesa na minha carteira?";
   - onde-aportar result: "Explique por que esta alocação";
   - ranking results: "O que estes resultados têm em comum?";
   - alert: "Por que este alerta disparou?".
   It must respect the plan limits (free: 2 messages/day). When the limit is reached, show the limit state instead of opening an empty chat.
4. **Answers link back (P1).** Ben's answers that mention tickers or platform sections render links: tickers → asset page; "metodologia do FCD" → /metodologia#fcd. Do it with a safe post-processor on the client, or structured markers from the server; never raw HTML from the LLM.
5. **Tests (P1).** Context builders and serializer (caps, every variant); the server's prompt section includes the context and the compliance guardrail stays.

## ACCEPTANCE
- On /acao/petr4, "Perguntar ao Ben" in the FCD row opens the chat with the question prefilled and an answer that references PETR4's FCD numbers shown on the page.
- On /carteira/<id> and /ranking, the default quick actions and the first answer reflect what's on screen.
- The free limit is respected.
- tsc, eslint and check-ui are clean; tests pass (`timeout 300`).
