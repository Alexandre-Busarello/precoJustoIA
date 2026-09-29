# BATCH w1-account-ben-onboarding (wave 1): Account area (perfil, suporte, conversas Ben, share), Ben chat sidebar, onboarding/notification/quiz modals

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/perfil/**
- src/app/conversas-ben/**
- src/components/ben-chat-sidebar.tsx
- src/app/share/**
- src/app/suporte/**
- src/components/support-center.tsx
- src/components/create-ticket-dialog.tsx
- src/components/ticket-details-dialog.tsx
- src/components/onboarding-provider.tsx
- src/components/onboarding-modal.tsx
- src/components/onboarding-banner.tsx
- src/components/notification-modals-wrapper.tsx
- src/components/notification-modal.tsx
- src/components/quiz-modal.tsx
- src/components/quiz-page-client.tsx
- src/app/quiz/**
- src/app/unsubscribe/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md sections 4 and 6; mobile.md 3.4 (chat) and 3.11 (textarea); simplificacao.md section 6 (interruptions). NEVER send Ben messages that call Gemini while testing (the screenshot script blocks /api/ben/*; only render states).

1) Ben chat (P0). In ben-chat-sidebar.tsx:
- remove the text-sm override on the textarea (line ~973) so it is 16 px below md;
- replace the native <select> (line ~744) with ui/select;
- the Sheet close X must not overlap the '+' button;
- mobile h-dvh with safe-area padding;
- neutral bubbles (user bg-muted, assistant plain) rendered through markdown-renderer;
- no emoji, tokens, dark legible.

2) Account pages (P1).
- /perfil: sections Conta, Assinatura (plan + renewal date from existing data; 'Minha Conta' info formerly on the dashboard lives here; id='assinatura'), Preferências (notification preferences; render <ThemeToggle variant='list'/>, which stays null until wave 3).
- /conversas-ben: PageHeader + list/table of conversations.
- /share/ben/[token]: prose.
- /suporte: PageHeader, tickets as a DataTable, dialogs on ui/dialog.
- /unsubscribe/[token]: tokens.
- /quiz/[campaignId]: tokens.

3) Modals (P0). Rebuild onboarding-modal, notification-modal and quiz-modal on ui/dialog (focus trap, Esc, aria-labelled, 'Fechar' X). Each must call claimModalSlot() from @/lib/interruptions before auto-opening and releaseModalSlot() on close, so a new user sees at most ONE modal. Onboarding has priority; notification-modals-wrapper must not open while onboarding is open.
- Trial onboarding copy: the trial is 1 day, so the steps lead straight to premium value: (1) open a full valuation of an asset, (2) create a price alert, (3) run a Gordon or Barsi ranking.
- onboarding-banner: neutral inline notice.
- No emoji or exclamation marks.

4) Strip title suffixes.

ACCEPTANCE:
- All modals are Radix dialogs (Esc closes, focus is trapped, the close button has an accessible name).
- The Ben textarea computes a 16 px font below 768 px.
- A brand-new local user (register a throwaway user locally, e.g. qa+<n>@local.test; do NOT trigger verification emails — if registration sends mail, instead set flags on a local seed user via the LOCAL DB with inline env) sees at most one modal on /dashboard.
- Dark legible.

## TEST PLAN
Routes: /perfil, /conversas-ben, /suporte, /quiz/<seeded campaign id if any>, plus the Ben chat opened from the FAB on /acao/petr4 (premium), and /dashboard for the onboarding flow. Viewports small/mobile/desktop; light/dark.
Check:
(1) Ben textarea getComputedStyle fontSize == 16px at 390.
(2) Opening the sheet at 360: the close X and the '+' buttons do not overlap (disjoint boxes).
(3) To reproduce onboarding locally, reset onboarding flags for free@local.test in the LOCAL DB (inline env) and reload /dashboard: exactly one dialog; Esc closes it; no second modal follows in the same page view.
(4) Suporte ticket dialog: keyboard navigation.
(5) /perfil#assinatura anchor scrolls to the section.
(6) Dark screenshots.
