# Backlog global rules (read before starting any batch)

<!--
Versão genérica de docs/melhorias-2026-09/backlog-rules.md. Copie para docs/<programa>/backlog-rules.md e
preencha os <...>. Este arquivo é lido por TODO agente (programador, QA, fixer, committer, integrador),
então mantenha-o curto, imperativo e sem ambiguidade. <SCRATCH> é substituído pelo workflow.
-->

GLOBAL RULES (every batch):

- PRODUCTION SAFETY: <descreva o risco real, ex.: "the repo .env points DATABASE_URL/DIRECT_URL at the PRODUCTION database">. Never run <build que roda migração/db push>, <comandos de migração/reset>, <clientes SQL> against .env, or scripts outside <pastas liberadas>. Any command that touches a DB must inline the LOCAL URL: DATABASE_URL=<url local> DIRECT_URL=<url local>. The dev server already runs at <http://localhost:PORT> on the local DB: do not start another and do not kill it (a watchdog restarts it; wait and retry). Never call payment, e-mail-sending or AI-generation endpoints. Do not git commit (a separate step commits).

- OWNERSHIP: edit/create/delete only inside your ownedPaths. Importing from anywhere is fine. If something outside your scope must change, do not edit it; list it in your final report as a follow-up.

- DESIGN SYSTEM: follow <docs/<programa>/reports/ux-ui.md §...>. Tokens only (<lista de classes permitidas>). Remove <padrões proibidos: gradientes, blur, sombras grandes, pesos extremos, cores cruas, emoji na UI, '!' e CAPS na copy>. Numbers only via <módulo de formatação> with tabular-nums; check the unit of every field (fraction vs percent) before formatting. Use the shared components <lista>. Icons: <biblioteca, tamanhos>.

- COMPLIANCE COPY: never <termos proibidos>; use <termos aprovados>. <Idioma e caixa: ex. sentence case pt-BR.> <Decisões do dono que afetam copy: ex. trial de 1 dia, nunca escrever prazo maior.>

- TITLES/SEO: <template de título>; strip <sufixos duplicados>. Remove fabricated review/rating markup.

- MOBILE: no horizontal scroll at 320/360/390 px; tap targets >= 44 px; inputs >= 16 px below md; wide tables use <componente de tabela com coluna fixa>; nothing fixed may cover content.

- DARK MODE: every surface you touch must be legible in dark. Force dark in tests with <flag do script de screenshots>.

- MACHINE LIMITS: every heavy command (typecheck, lint, tests, screenshots) runs under 'flock -w 3600 <SCRATCH>/heavy.lock'. Tests always with 'timeout 300'; unit tests never import the ORM/DB/network. Never run a production build or a second dev server. Wait on PIDs, never with 'until ! pgrep -f'.

- VALIDATION before finishing:
  1. typecheck: zero errors in your files (errors only in other batches' files: mention them);
  2. lint on your changed files: no errors;
  3. <guard scripts: check-ui / check-compliance> on your changed files: pass;
  4. unit tests for any logic you add;
  5. screenshots: <comando> --routes <your routes> --auth <modos> --viewports small,mobile,desktop --theme both --out <SCRATCH>/shots/<batch-id>. If the seed is stale, re-seed once with the LOCAL URL. Test users: <usuários de teste locais>.

- FINAL REPORT: changed files; each acceptance criterion met/not met with evidence (screenshot paths, numbers, command output); out-of-scope follow-ups.
