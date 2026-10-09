# BATCH w6-ben-ui (wave 6, after w6-ben-context and w5-mobile-ben-a11y): simpler, clearer Ben chat

Owner request (2026-10-08): the Ben UI/UX should be easier and contextualized. Read docs/melhorias-2026-09/backlog-rules.md first. Use the design system tokens and full dark mode. This is a professional tool, not a toy: no gradients, no emoji confetti. Compliance framing as in w6-ben-context.

## OWNED PATHS
- src/components/ben-chat-sidebar.tsx (split into src/components/ben/** as needed), src/components/ben-chat-fab.tsx, src/components/ben-intro-card.tsx
- src/app/conversas-ben/**
- src/hooks/use-ben-chat.ts (UI state only; the context plumbing belongs to w6-ben-context)

## TASKS
1. **One entry model (P0).**
   - Desktop: a right-side panel that keeps the page visible and doesn't cover the main content column on ≥ xl. It is resizable or has a fixed width.
   - Mobile: a bottom sheet with snap points (half/full), keeping the w5 floating-button rules.
   - The panel header shows the current context as a chip ("Vendo: PETR4 · Valuation"), and the user can remove the chip to ask something generic.
2. **Start screen per context (P0).** Instead of a generic greeting:
   - a one-line hint of what Ben can do here;
   - at most 3 contextual suggestions from w6-ben-context, as plain text buttons, no icon soup;
   - a short "Ben consulta os dados da plataforma; não é recomendação" note.
3. **Conversation UX (P0):**
   - streaming with a clear "consultando dados…" state that shows which tool is running ("buscando fundamentos de PETR4");
   - stop button;
   - retry on error with a human message;
   - copy answer;
   - follow-up suggestions after each answer (max 2);
   - links from w6-ben-context rendered as inline links;
   - long answers collapsed to a summary with "ver mais";
   - Markdown tables rendered with the DataTable style.
4. **Limits and plan (P0).** Free users see "2 mensagens por dia · restam N" before typing. At 0, the composer is replaced by a clear upgrade/come-back-tomorrow state; don't pretend to send.
5. **History (P1).** /conversas-ben: list with title (auto from the first question), context chip, date, search, delete/rename. "Continuar no painel" opens the conversation in the side panel on any page.
6. **A11y and quality (P0):**
   - focus is trapped in the mobile sheet, but not in the desktop panel;
   - Esc closes;
   - aria-live for streaming;
   - targets ≥ 44 px;
   - legible at 320 px;
   - dark mode;
   - no layout shift when the panel opens: desktop content reflows smoothly, or the panel overlays only the right gutter.

## ACCEPTANCE
- Screenshots of /acao/petr4, /carteira/<id>, /ranking and /dashboard with the panel open (desktop) and the sheet half/full (mobile), light + dark. Each shows the right context chip and suggestions.
- Free user at the limit sees the limit state.
- Keyboard-only flow works (open, type, send, stop, close).
- tsc, eslint and check-ui are clean.

## Added after wave 3
- /dashboard: the IBOV notice (PageNotice) and BenIntroCard stack as two notices, and on mobile they push the "Onde aportar este mês" block below the fold. Fold the Ben intro into the PageNotice slot (one notice at a time) or turn it into the panel's start screen.
