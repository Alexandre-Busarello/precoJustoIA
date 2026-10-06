# BATCH w1-home-pricing-checkout (wave 1): Home (product-led, short), Planos, checkout/PIX mobile, landing kit restyle, remove fabricated trust signals

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/page.tsx
- src/app/planos/**
- src/components/landing-pricing-section.tsx
- src/components/landing/**
- src/components/structured-data.tsx
- src/components/inner-link-button.tsx
- src/app/checkout/**
- src/components/optimized-checkout.tsx
- src/components/optimized-pix-payment.tsx
- src/components/optimized-card-payment.tsx
- src/components/special-offer-checkout.tsx
- src/components/payment-success-handler.tsx
- src/components/stripe-error-display.tsx
- src/app/oferta/page.tsx
- src/components/oferta-checkout-buttons.tsx
- src/components/kiwify-checkout-link.tsx
- src/components/dynamic-cta-section.tsx
- public/images/product/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.1, 5.13 and section 4 (FloatingCTA); mobile.md 3.6 and 3.12; mercado-financeiro.md 2 (pricing page inconsistencies) and 4. NEVER click pay, generate PIX or subscribe; the checkout UI is verified with Playwright route mocks (route.fulfill with fake JSON for /api/checkout*, /api/payment*, /api/subscription*) inside the test browser only.

1) Landing kit src/components/landing/* (P0; also consumed by blog, metodologia, backtest, screening, comparador, radar-dividendos, analise-setorial and indices, so keep props compatible).
- landing-hero: left-aligned, solid H1 text-4xl sm:text-5xl semibold, no pill, no micro-proof icons, no bg-clip-text.
- cta-section: bg-surface; fix the INVISIBLE secondary button (lines ~110-118: outline variant with white text on bg-background). Both buttons must be legible (AA) in light and dark.
- faq-section: native <details>/<summary> accordion (or ui/collapsible), no icons, closed by default.
- floating-cta: mobile only, appears after the hero leaves the viewport and hides when the final CTA enters it.
- feature-card: no icon tiles.
- social-proof: remove fabricated content.
- breadcrumbs: tokens.

2) Home (P0), per ux-ui.md 5.1.
- Hero: H1 'O preço justo de cada ação da B3, calculado por 8 modelos de valuation.'; one-sentence subtitle; the PRIMARY action is a ticker search (reuse @/components/company-search) that navigates to the asset page; secondary link 'Criar conta grátis'; on the right a real product screenshot. Capture it with Playwright from local /acao/petr4 (1440 wide, light) into public/images/product/*.webp, <= 150 KB each, using next/image.
- Trust strip (text only): data sources · updated 3x/day · public methodology (links).
- 3 product blocks with screenshots: asset page, rankings, backtest.
- Models as a compact table (Modelo · O que mede · Plano) + 'Ver metodologia'.
- Pricing summary (LandingPricingSection).
- ONE FAQ (remove the duplicate near line ~1100).
- Final CTA on bg-surface.
Remove:
- QuickRanker from the home;
- the '4,8 · 1.250 avaliações' seal (line ~141) and aggregateRating (lines ~1206-1209);
- '87%', '100x mais rápido', '-R$ 5.000/-R$ 10.000', '100% Dados Confiáveis', 'Único no mercado brasileiro';
- testimonials with rating: 5 that cannot be verified;
- stats with icons, 'Explore ferramentas', sectors, backtest mockup, 'Ranking inteligente' pill, Gratuito/Premium badges per card.
Company count comes from COVERED_COMPANIES_LABEL. Logged-in users: server-side redirect('/dashboard') via getServerSession at the top of the page. structured-data.tsx: remove aggregateRating (line ~120) and anything else unverifiable. Strip the title if needed.

3) Planos (P0), per ux-ui.md 5.13.
- H1 'Planos' + one line; the 3 plan cards ABOVE the fold (remove the 'Ver planos' hero and 'Apoie o projeto'); neutral cards.
- Annual card: 2 px brand border + 'Recomendado'.
- Big tabular price + ONE auxiliary line ('equivale a R$ X/mês · 15% off no PIX'), computed from the offer prices.
- <= 8 features per card; comparison table with lucide Check/Minus. On mobile, a segmented Grátis/Mensal/Anual control showing one column.
- Remove the fear block ('-R$ 5.000'), all emoji and the exit-intent-dependent copy.
- Fix inconsistencies: the metadata '12%' and FAQ '20%' become the real discount computed as 1 - anual/(12 x mensal) (about 20,5% with 19,90/189,90); remove '+R$ 497'; use '8 modelos' consistently; remove 'Análise Preditiva' and 'Somos os únicos'; remove aggregateRating (line ~469).
- Logged-in premium users see 'Seu plano atual' instead of CTAs.
- Trial copy stays '1 dia'.
- landing-pricing-section: scale-105 only at lg; on mobile the annual card comes first.

4) Checkout (P1).
- Tokens, no emoji.
- optimized-pix-payment below 640 px: primary full-width h-12 'Copiar código PIX' with 'Copiado' feedback and the hint 'Cole no app do seu banco' at the top; the QR code collapsed under 'Pagar com outro aparelho'.
- Card form tokens, inputs 16 px.
- success/cancel/pending pages with PageHeader.
- special-offer-checkout and oferta (forced light theme) with tokens and compliance copy.

ACCEPTANCE:
- Home <= 6,000 px at 1440 and <= 9,000 px at 390, <= 18 screens at 360x740.
- FAQ appears once; the CTA secondary button has AA contrast.
- grep in owned files for '1.250|87%|100x|R\$ 5.000|100% Dados|Único no mercado|aggregateRating|Preditiva|únicos' returns 0.
- /planos shows 3 prices at 1440x900 without scroll and has no emoji.
- The mocked PIX shows 'Copiar código PIX' above the fold at 360x740.
- Logged-in users are redirected from / to /dashboard.
- Dark legible.

## TEST PLAN
Routes: /, /planos, /checkout (mock network), /checkout/success, /checkout/cancel, /checkout/pending, /oferta, /checkout/oferta-especial, plus regression of landing-kit consumers: /blog, /metodologia, /screening-acoes, /comparador, /analise-setorial, /radar-dividendos, /indices. Modes: anonymous/free/premium; small/mobile/desktop; light/dark.
Measure:
(1) document.documentElement.scrollHeight on / at 1440 and 390, and screens at 360.
(2) Count FAQ sections on / (== 1).
(3) The CTA secondary button text color vs background contrast >= 4.5.
(4) grep command from the acceptance criteria.
(5) /planos at 1440x900: the 3 price elements are inside the viewport.
(6) PIX with Playwright mocks: the copy button is the first interactive element at 360 px.
(7) Logged in -> GET / redirects to /dashboard.
(8) Home JSON-LD has no aggregateRating (view source).
(9) No request to real payment endpoints in the network log (all mocked/blocked).
