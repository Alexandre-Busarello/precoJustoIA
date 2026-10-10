# BATCH w5-mobile-ben-a11y (wave 5): Ben on mobile, touch targets, accessibility leftovers

Read docs/melhorias-2026-09/backlog-rules.md first. Design system tokens; full dark mode; check-ui must pass.

## OWNED PATHS
- src/components/ben-chat-fab.tsx, src/components/ben-chat-sidebar.tsx, src/components/ben-intro-card.tsx (UI only; don't change src/lib/ben-service.ts / ben-tools.ts)
- src/components/ui/button.tsx (size variants), src/components/ui/info-hint.tsx, src/components/ui/data-table.tsx (sortable header hit area)
- src/components/rentability-selector.tsx (tabs size only)
- the onboarding quiz slider component (add an accessible name)
- src/lib/__tests__/a11y/** (optional)

## TASKS
1. **Ben floating button covers content on mobile (P0).** At 390 px it covers:
   - the price on asset pages;
   - the tab row on /indices/<ticker>;
   - the stats on /dashboard.
   Place it above the bottom nav with safe-area insets, shrink it to a 48 px circle on mobile, hide it while scrolling down and show it on scroll up. Don't render it on pages with a fixed bottom CTA (checkout, onde-aportar result) or when the chat sidebar is open. It must stay keyboard accessible, and its focus ring must be visible.
2. **Touch targets ≥ 44 px on mobile (P0):**
   - `Button size="sm"` (40 px): add `min-h-11` on coarse pointers, using `pointer-coarse:` or a media query;
   - the InfoHint trigger;
   - the Ben chips;
   - DataTable sortable headers;
   - rentability-selector tabs (38 px).
   Measure them with docs/melhorias-2026-09/tools/mobile-audit.mjs before and after.
3. **Quiz slider (P1).** The onboarding quiz slider has no accessible name: add an aria-label or a linked label.
4. **Copy and visual check of the Ben UI** in light and dark at 320, 390 and 1440. Nothing should overlap.

## ACCEPTANCE
- The mobile-audit tap-target report shows no interactive element < 44 px on /dashboard, /acao/petr4, /ranking, /carteira/<id>.
- The Ben button never overlaps the main price, the tabs or the bottom nav at 320/390 (screenshots).
- axe or Playwright accessibility snapshot: the slider has a name.
- tsc, eslint and check-ui are clean.
