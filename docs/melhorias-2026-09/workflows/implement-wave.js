export const meta = {
  name: 'pja-implement-wave',
  description: 'Implementa uma onda do backlog: programador por lote -> testador independente -> correções (até 3 ciclos) -> commit local; depois teste de integração da onda',
  phases: [
    { title: 'Implementar', detail: 'programador executa o lote' },
    { title: 'Testar', detail: 'testador independente procura bugs e regressões' },
    { title: 'Corrigir', detail: 'programador corrige o que o testador reprovou' },
    { title: 'Commit', detail: 'commit local por lote aprovado' },
    { title: 'Integração', detail: 'teste cruzado da onda inteira' },
  ],
}

const S = args.scratch
const R = args.repo
const DOCS = `${R}/docs/melhorias-2026-09`
const MAX_CYCLES = args.maxCycles || 3
const CONC = args.concurrency || 3

const CTX = `
PROJECT: Preço Justo AI at ${R} (Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui, Prisma). Branch melhorias/ux-ui-mobile. UI language pt-BR.
MANDATORY: read ${DOCS}/backlog-rules.md first (where it says <SCRATCH>, use ${S}) and follow it strictly (production-DB safety, ownership, design system, compliance copy, SEO titles, mobile, dark mode, validation, final report).
Reference specs: ${DOCS}/reports/ux-ui.md, ${DOCS}/reports/mobile.md, ${DOCS}/reports/mercado-financeiro.md, ${DOCS}/reports/simplificacao.md, ${DOCS}/strategy.md. Owner decisions at the top of ux-ui.md override everything (full dark mode required; trial stays 1 day; do NOT change plan prices).

MACHINE LIMITS (the owner's PC has 15 GB RAM and freezes when full — this is critical):
- Wrap EVERY heavy command in the shared lock so only one agent runs it at a time:
  flock -w 3600 ${S}/heavy.lock npx tsc --noEmit
  flock -w 3600 ${S}/heavy.lock npx eslint <files>
  flock -w 3600 ${S}/heavy.lock timeout 300 npx tsx --test <files>   (always with timeout; unit tests must not import Prisma/DB/network modules)
  flock -w 3600 ${S}/heavy.lock npx tsx scripts/local/screenshots.ts ...
- Waiting for a background command: never use 'until ! pgrep -f "<pattern>"' (the loop matches its own command line and never exits). Wait on the PID ('while kill -0 $PID 2>/dev/null; do sleep 5; done') or use a bracket pattern like 'pgrep -f "[s]creenshots.ts"'; always bound waits with a timeout.
- Never start another dev server, never run next build, never open extra browsers outside the screenshot script. The dev server on http://localhost:3100 (local Docker DB) is managed by a watchdog that may restart it for memory — if a request fails with connection refused, wait 30 s and retry.
- Screenshots: pass only the routes you need (--routes) and only the viewports/auth you need; write to ${S}/shots/<your-batch-id>/... Keep outputs out of the repo.
- DISK: the repo is on a large external disk, but ${S} lives on / (~13 GB free). Screenshots: deviceScaleFactor 1, only the routes/viewports you need, prefer viewport-height captures; after reviewing, DELETE raw captures you no longer need and keep at most a few evidence images per batch. If \`df -h /\` shows less than 2 GB free, delete old dirs under ${S}/shots first (never delete anything outside ${S}). Never write large files inside the repo.
- Test users: premium@local.test / Local123!  and free@local.test / Local123! (local DB only).
`

const PROG_SCHEMA = {
  type: 'object',
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' }, description: 'repo-relative paths created/modified/deleted by you' },
    summary: { type: 'string' },
    acceptance: { type: 'string', description: 'each acceptance criterion: met/not met + evidence' },
    followups: { type: 'array', items: { type: 'string' }, description: 'out-of-scope items for other batches/owner' },
  },
  required: ['filesChanged', 'summary', 'acceptance', 'followups'],
}
const TEST_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    blocking: { type: 'array', items: { type: 'string' }, description: 'bugs/regressions/unmet P0-P1 criteria that MUST be fixed; each with file:line or route+viewport+theme, repro and expected' },
    minor: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'string', description: 'commands run with results, screenshot dirs reviewed' },
  },
  required: ['verdict', 'blocking', 'minor', 'evidence'],
}
const COMMIT_SCHEMA = {
  type: 'object',
  properties: { committed: { type: 'boolean' }, sha: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } },
  required: ['committed', 'sha', 'files', 'note'],
}

const batchBlock = (b) => `BATCH ${b.id}: ${b.title}
Your full batch spec (OWNED PATHS, TASKS, TEST PLAN) is in ${DOCS}/batches/${b.id}.md (where it says <SCRATCH>, use ${S}) — READ IT FULLY before doing anything. You may edit only the files listed under OWNED PATHS there.`

const programmer = (b) => agent(`${CTX}
ROLE: Senior front-end/full-stack engineer (programador executor). Implement this batch COMPLETELY — nothing half-done, no TODO placeholders, no commented-out leftovers. Prefer simple, readable code that matches the repo's idioms. Do not git commit (a separate step commits after QA).
${batchBlock(b)}

Before finishing, run the validation steps from backlog-rules.md (with the flock lock) and look at your own screenshots (mobile + desktop, light + dark where applicable). Return the structured report.`, { label: `dev:${b.id}`, phase: 'Implementar', schema: PROG_SCHEMA })

const tester = (b, dev, cycle) => agent(`${CTX}
ROLE: QA engineer / tester (independent, adversarial). A programmer just implemented the batch below (cycle ${cycle}). Your job is to FIND FAILURES: bugs, regressions, runtime errors, broken layouts, unmet acceptance criteria, dark-mode leaks, mobile problems, wrong numbers/formatting, compliance copy violations. Do NOT edit application code (you may only write screenshots/notes under ${S}). Be concrete and skeptical; do not trust the programmer's report — verify.
${batchBlock(b)}

PROGRAMMER REPORT:
${JSON.stringify(dev)}

Do at minimum:
1. git diff / git status for the batch files; read the changed code looking for logic bugs, null/undefined crashes, broken imports, SSR/client mismatches (hydration), removed functionality that users relied on, ownership violations (files changed outside OWNED PATHS — report as blocking).
2. flock -w 3600 ${S}/heavy.lock npx tsc --noEmit (report errors in batch files as blocking; errors only in other batches' files: mention as minor), eslint on changed files, bash scripts/check-ui.sh <changed files>, unit tests if any.
3. Screenshots of every route in the test plan: mobile (390) + desktop (1440), anon and/or premium as relevant, light AND --theme dark if the screenshot script supports it (check scripts/local/screenshots.ts --help / source). LOOK at every image. Compare with the previous wave's screenshots in ${S}/shots when available (the original baseline from before wave 0 was not kept; use git stash/checkout of an older commit only if really needed). Also check a 320 px width for horizontal overflow on key routes (the script may support --viewports; otherwise use a tiny Playwright snippet).
4. Check ${S}/dev.log tail and the screenshot report.json for server errors / console errors / page errors on those routes.
5. Exercise the main interactions of the batch (tabs, filters, menus, forms) with a short Playwright script when the test plan asks for it.
Verdict 'pass' only if there are no blocking issues. P2 polish goes to 'minor'.`, { label: `qa:${b.id}#${cycle}`, phase: 'Testar', schema: TEST_SCHEMA })

const fixer = (b, qa, cycle) => agent(`${CTX}
ROLE: Senior engineer (programador executor) — fix round ${cycle}. The tester REJECTED your batch. Fix ALL blocking issues and as many minor issues as are cheap and in scope. Stay inside OWNED PATHS. Do not git commit.
${batchBlock(b)}

TESTER FINDINGS:
${JSON.stringify(qa)}

Re-run the relevant validation (with the flock lock) and screenshots to confirm each fix. Return the structured report (filesChanged = everything you changed in this round).`, { label: `fix:${b.id}#${cycle}`, phase: 'Corrigir', schema: PROG_SCHEMA })

const committer = (b, files, qa, passed) => agent(`${CTX}
ROLE: Release helper. Create ONE local git commit (never push) containing exactly this batch's changes.
Batch: ${b.id} — ${b.title}
Owned paths: see the OWNED PATHS section of ${DOCS}/batches/${b.id}.md (read it).
Files reported changed by the programmer(s): ${JSON.stringify(files)}
QA passed: ${passed}. ${passed ? '' : 'QA did not fully pass after the max cycles: still commit (so work is not lost) but prefix the subject with "wip: " and list the open blocking issues in the body: ' + JSON.stringify(qa?.blocking || [])}

Steps:
1. git status --porcelain. The files to commit = changed/untracked files that are inside the owned paths (including the MECHANICAL-ONLY files listed there) AND/OR in the reported list. Never include files owned by other batches that you cannot attribute to this batch, never include .env, node_modules, .next, screenshots, or anything under the scratchpad.
2. Use the git lock (other batches commit concurrently): flock -w 600 ${S}/git.lock sh -c 'git add -A -- <files...> && git commit -m "<subject>" -m "<body>" -- <files...>'
   Subject (pt-BR, imperative, <= 72 chars) describing the batch, e.g. "refactor(ui): página de ação com AssetHeader e tabela de valuation". Body: 3-8 bullet lines of what changed. End the message with a blank line and exactly:
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
3. Verify with git show --stat HEAD (make sure the commit contains only this batch's files).
4. Free disk: rm -rf ${S}/shots/${b.id}* ${S}/shots/qa-${b.id}* (screenshot dirs of this batch only). Return sha + files.`, { label: `commit:${b.id}`, phase: 'Commit', schema: COMMIT_SCHEMA, effort: 'low' })

async function runBatch(b) {
  let dev = await programmer(b)
  if (!dev) return { id: b.id, status: 'programmer-failed' }
  const files = new Set(dev.filesChanged)
  let qa = null
  let cycle = 1
  for (; cycle <= MAX_CYCLES; cycle++) {
    qa = await tester(b, dev, cycle)
    if (!qa) break
    if (qa.verdict === 'pass') break
    if (cycle === MAX_CYCLES) break
    const fix = await fixer(b, qa, cycle)
    if (fix) { fix.filesChanged.forEach(f => files.add(f)); dev = { ...fix, previous: dev.summary } }
  }
  const passed = qa?.verdict === 'pass'
  log(`${b.id}: QA ${passed ? 'aprovado' : 'NÃO aprovado'} após ${Math.min(cycle, MAX_CYCLES)} ciclo(s)`)
  const commit = await committer(b, [...files], qa, passed)
  return { id: b.id, passed, cycles: Math.min(cycle, MAX_CYCLES), qa, commit, followups: dev.followups, summary: dev.summary }
}

// Simple worker pool so at most CONC batches run at once (RAM limit).
const batches = args.batches
if (!Array.isArray(batches) || !batches.length || !batches.every(b => b && b.id)) throw new Error('args.batches must be a non-empty array of {id,title}')
const results = new Array(batches.length)
let next = 0
await Promise.all(Array.from({ length: Math.min(CONC, batches.length) }, async () => {
  while (next < batches.length) {
    const k = next++
    try { results[k] = await runBatch(batches[k]) } catch (e) { results[k] = { id: batches[k].id, status: 'error', error: String(e) } }
  }
}))

// skipIntegration: rodar um lote por vez e deixar a integração para o fim da onda.
if (args.skipIntegration) return { wave: args.wave, results }

phase('Integração')
const integ = await agent(`${CTX}
ROLE: Integration tester + fixer for wave ${args.wave}. Several batches were implemented in parallel in the same working tree and committed separately. Results:
${JSON.stringify(results.map(r => ({ id: r?.id, passed: r?.passed, open: r?.qa?.blocking, minor: r?.qa?.minor, followups: r?.followups, commit: r?.commit?.sha })))}

Do:
1. flock -w 3600 ${S}/heavy.lock npx tsc --noEmit — the whole project must be clean. flock ... npx eslint src --quiet (errors only) — no new errors.
2. Screenshots of the default route list (scripts/local/screenshots.ts default routes) at mobile in light AND dark (if supported), anon + premium, into ${S}/shots/wave${args.wave}-integration. LOOK at them for cross-batch breakage: broken shared components, inconsistent headers/spacing between pages, runtime errors, horizontal overflow, dark-mode leaks in pages touched by this wave.
3. Fix only cross-batch integration breakages and trivial leftovers (you may edit any file for this, keep changes minimal). Do NOT start new features.
4. Commit your fixes (if any) with the git lock: subject "fix: integração da onda ${args.wave}", body bullets, ending with a blank line and "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Never push.
Return a concise pt-BR report: status of tsc/eslint, what you fixed, remaining open issues (with file/route) that need another round.`, { label: `integration:wave${args.wave}`, phase: 'Integração' })

return { wave: args.wave, results, integration: integ }
