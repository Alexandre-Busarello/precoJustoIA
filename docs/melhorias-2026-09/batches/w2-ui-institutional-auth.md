# BATCH w2-ui-institutional-auth (wave 2): Institutional + content + auth: blog list-first, metodologia as documentation with live assumptions, sobre, como-funciona, contato, legal pages, auth pages, landing SEO pages, parceiros

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/blog/**
- src/app/metodologia/**
- src/app/sobre/**
- src/app/como-funciona/**
- src/app/contato/**
- src/app/termos-de-uso/**
- src/app/lgpd/**
- src/app/login/**
- src/app/register/**
- src/app/esqueci-senha/**
- src/app/redefinir-senha/**
- src/app/verificar-email/**
- src/app/acompanhar-acoes-bolsa-de-valores/**
- src/components/monitor-assets-form.tsx
- src/app/analisar-acoes/**
- src/app/parceiros/**
- src/components/parceiros/**
- src/app/oferta/layout.tsx
- public/images/how-it-works/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.14 and 5.15; simplificacao.md C3; mercado-financeiro.md section 4 (disclaimers/terminology) and F14. The landing kit is rendered, not edited; LandingHero usages become PageHeader or plain layouts.

1) Metodologia (P0, trust page).
- Documentation layout with a sticky side TOC (desktop) or a collapsible TOC (mobile).
- One section per model: fórmula in a mono block, critérios, limitações, when it does not apply (FCD/Magic Formula for financials; Lynch for cyclicals).
- Include Bazin, Peter Lynch and P/VP justo (bancos), added in wave 2 (read src/lib/strategies/* to describe them accurately).
- A 'Premissas atuais' table from getMacroAssumptions() (Selic, CDI, IPCA esperado, NTN-B real longa, ERP, Ke) with 'Atualizado em' and the source (BCB SGS or fallback).
- Liquidity thresholds (LIQUIDITY_DEFAULTS).
- Definitions: margem de segurança = 1 - P/VJ, potencial = VJ/P - 1, DY 12m bruto, JCP IRRF 17,5% desde 2026.
- The standard disclaimer.
- alternates.canonical '/metodologia'.

2) Blog (P1). The article list comes first (title, excerpt, date, reading time) with a category filter; no hero and no 'Por que ler nosso blog'. Post page: prose 68ch, text-base, reduced headings (markdown-renderer already handles the scale).

3) Sobre / Como funciona / Contato / legal (P1).
- Sobre: short text (quem, por quê, fontes de dados, contato); no Missão/Visão/Valores; keep founder personal data removed (commit 5777118).
- Como funciona: 3 numbered steps, each with a real screenshot captured locally with Playwright into public/images/how-it-works/*.webp (<= 150 KB).
- Contato: textarea 16 px, ui/select instead of the native select.
- Termos/LGPD: prose tokens.
- Canonicals for como-funciona, sobre, contato, termos-de-uso, lgpd and oferta (src/app/oferta/layout.tsx).

4) Auth (P1). /login, /register, /esqueci-senha, /redefinir-senha, /verificar-email:
- the purple trial card becomes one muted line 'Inclui 1 dia de Premium grátis. Sem cartão.';
- the button says 'Criar conta';
- Google first;
- inputs have autocomplete (email, current-password, new-password) and 16 px;
- no emoji;
- <= 1.2 screens on mobile.
Do NOT submit forms that send e-mails (password reset, verification).

5) SEO landings (P2).
- /acompanhar-acoes-bolsa-de-valores + monitor-assets-form: tokens, compliance copy.
- /analisar-acoes: minimal restyle only (its future is an owner decision; company-preview is owned by w2-score-compliance-fii).
- Parceiros (src/app/parceiros, src/components/parceiros/**): tokens. clube-dos-dividendos/sections/features-ai.tsx ~271 'sinal de compra' -> 'Indicadores técnicos em zona de sobrevenda'. Fix the 6 ESLint errors in features-portfolio.tsx line 47 (escape the quotes).

6) Strip title suffixes in all owned pages.

ACCEPTANCE:
- curl shows the correct canonical for every owned public route.
- No bg-clip-text or icon tiles on these routes.
- /metodologia shows the live assumptions table with a date.
- npx eslint src/components/parceiros has 0 errors.
- The auth pages fit about 1 screen on mobile.
- Dark legible.

## TEST PLAN
Routes: /metodologia, /blog, /blog/como-calcular-preco-justo-metodo-graham, /sobre, /como-funciona, /contato, /termos-de-uso, /lgpd, /login, /register, /esqueci-senha, /acompanhar-acoes-bolsa-de-valores, /analisar-acoes, /parceiros/<slug from src/app/parceiros>, /oferta. Modes: anonymous (+ logged in for auth redirects); small/mobile/desktop; light/dark.
Check:
(1) Canonical curl table.
(2) /metodologia TOC anchors work; the assumptions table shows values + date.
(3) Auth: page height / viewport height <= 1.2 at 390; input font-size 16px; autocomplete attributes present.
(4) npx eslint src/components/parceiros -> 0 errors.
(5) grep -n 'bg-clip-text' in owned files -> 0.
