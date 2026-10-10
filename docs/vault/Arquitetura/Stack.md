---
tags: [arquitetura, stack]
updated: 2026-10-09
fontes: [package.json, vercel.json, prisma/schema.prisma, scripts/build-with-migrations.js]
---
# Stack
> Next.js 15 (App Router) + React 19 + Prisma/PostgreSQL na Vercel, com Tailwind 4, Redis para cache e Gemini para as partes de IA.

## Como funciona
- **Framework:** `next` 15.5.9, `react`/`react-dom` 19.1.2; `yarn dev` = `next dev --turbopack` (`package.json`).
- **Banco:** Prisma 6.19.3, `provider = "postgresql"`, `url = env("DATABASE_URL")` (`prisma/schema.prisma`). Em produção é Neon (ver [[Banco de produção no .env]]).
- **Build:** `yarn build` chama `scripts/build-with-migrations.js`, que executa `npx prisma db push` antes do `next build`. Por isso o build nunca roda localmente com o `.env` (ver [[Ambiente local e CI]]).
- **Auth:** `next-auth` 4 + `@auth/prisma-adapter`, `bcryptjs` (`src/lib/auth.ts`).
- **UI:** Tailwind 4 (`@tailwindcss/postcss`, `tw-animate-css`), Radix UI, `class-variance-authority`, `lucide-react`, `sonner`, `next-themes`, `recharts` (ver [[Design system]] e [[Tema e dark mode]]).
- **Dados no cliente:** `@tanstack/react-query` 5 (persistência em `src/lib/react-query-persister.ts`).
- **IA:** `@google/genai` (Gemini; o Ben usa `gemini-flash-lite-latest` em `src/lib/ben-service.ts`).
- **Dados de mercado:** `yahoo-finance2`, `axios`, `cheerio` para scraping (ver [[Fontes de dados]]).
- **Cache:** `redis` 5 (ver [[Caches]]).
- **Pagamentos:** `stripe`, `@stripe/react-stripe-js`, `mercadopago`; serviços `src/lib/kiwify-user-service.ts` e `src/lib/cakto-user-service.ts`.
- **E-mail:** `nodemailer` e `resend` (`src/lib/email-service.ts`).
- **Validação:** `zod` 4. **Markdown:** `react-markdown`, `remark-gfm`, `marked`.
- **Hospedagem:** Vercel; `vercel.json` define 4 crons e `maxDuration` (60 s padrão em `src/app/api/**`, 300 s nas rotas pesadas). Ver [[Crons]].
- **Testes:** `yarn test` = `tsx --test "src/**/*.test.ts"` (node:test); Playwright só para screenshots locais.

## Regras / limites
- `engines.node` diz `>=20`, mas `yarn test` precisa de Node ≥ 21 (glob do test runner); o CI usa Node 22 (`.github/workflows/quality.yml`).
- Nenhuma onda mudou o schema do Prisma (o build de produção faz `db push`).

## Histórico nas ondas
- [[Onda 0]]: entrada de `next-themes` e `@radix-ui/react-popover`.
- [[Onda 4]]: `ad4cc22` removeu código morto e dependências sem uso (framer-motion, react-hook-form etc.) e criou o CI.

## Pendências
- Subir `engines.node` para `>=22` depois de checar o runtime da Vercel (RESUME, onda 4).

## Relacionadas
[[Fontes de dados]] · [[Caches]] · [[Crons]] · [[Middleware e rate limit]] · [[Ambiente local e CI]] · [[00 - Início]]
