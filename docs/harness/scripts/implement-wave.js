// Workflow genérico: implementa UMA onda de lotes com o ciclo
//   programador -> QA independente -> fixer (até maxCycles) -> committer
// e, ao final (a menos que skipIntegration), um agente de integração da onda.
//
// Derivado de docs/melhorias-2026-09/workflows/implement-wave.js (ondas 0–6 do Preço Justo AI).
// Rode pela ferramenta Workflow do Claude Code (ver docs/harness/scripts/harness.md).
// Copie este arquivo para o scratchpad da sessão antes de chamar o Workflow.
//
// ARGS (objeto JSON passado ao Workflow):
//   repo            (obrigatório) caminho absoluto do repositório.
//   scratch         (obrigatório) scratchpad da sessão: locks, screenshots, logs. Fica FORA do repo.
//   wave            (obrigatório) número da onda (só para rótulos e mensagens de commit).
//   batches         (obrigatório) [{ id, title }]; cada id tem uma spec em <docsDir>/batches/<id>.md.
//   docsDir         pasta do programa de melhorias (padrão: <repo>/docs/melhorias).
//   concurrency     quantos lotes ao mesmo tempo (padrão 1). 3 é o máximo que coube em 15 GB de RAM;
//                   com token apertado, use 1.
//   maxCycles       ciclos QA->fixer por lote (padrão 3). Depois disso o lote é commitado como "wip:".
//   skipIntegration true = não roda o agente de integração (rodar lotes um a um e integrar no fim).
//   branch          nome da branch (só informativo no contexto). Padrão: "a branch atual".
//   devUrl          URL do dev server local (padrão http://localhost:3100).
//   projectContext  1–3 linhas sobre stack e idioma da UI (ex.: "Next.js 15, React 19, Tailwind v4. UI em pt-BR.").
//   coAuthor        linha de co-autoria dos commits (padrão "Co-Authored-By: Claude <noreply@anthropic.com>").
//   screenshotCmd   comando de screenshots (padrão "npx tsx scripts/local/screenshots.ts").
//
// ARMADILHA: não use crases (backticks) dentro dos prompts abaixo — eles são template literals e uma crase
// solta encerra a string e quebra o script inteiro. Escreva comandos entre aspas simples.

export const meta = {
  name: 'implement-wave',
  description: 'Implementa uma onda: programador por lote -> QA independente -> correções -> commit local; depois integração da onda',
  phases: [
    { title: 'Implementar', detail: 'programador executa o lote' },
    { title: 'Testar', detail: 'QA independente procura bugs e regressões' },
    { title: 'Corrigir', detail: 'fixer corrige o que o QA reprovou' },
    { title: 'Commit', detail: 'commit local por lote' },
    { title: 'Integração', detail: 'teste cruzado da onda inteira' },
  ],
}

const S = args.scratch
const R = args.repo
if (!S || !R) throw new Error('args.repo e args.scratch são obrigatórios')
const DOCS = args.docsDir || `${R}/docs/melhorias`
const MAX_CYCLES = args.maxCycles || 3
const CONC = args.concurrency || 1
const DEV = args.devUrl || 'http://localhost:3100'
const BRANCH = args.branch || 'a branch atual'
const COAUTHOR = args.coAuthor || 'Co-Authored-By: Claude <noreply@anthropic.com>'
const SHOTS = args.screenshotCmd || 'npx tsx scripts/local/screenshots.ts'

// Contexto comum a TODOS os agentes. As regras do projeto ficam em <docsDir>/backlog-rules.md.
const CTX = `
PROJECT at ${R} (${args.projectContext || 'see the repo README for the stack'}). Branch ${BRANCH}.
MANDATORY: read ${DOCS}/backlog-rules.md first (where it says <SCRATCH>, use ${S}) and follow it strictly (production-DB safety, ownership, design system, compliance copy, mobile, dark mode, validation, final report).
Also read the project's second brain before deciding anything: ${R}/docs/vault/00 - Início.md and the notes it links that relate to your batch.

MACHINE LIMITS (low RAM, the PC freezes when full):
- Wrap EVERY heavy command in the shared lock so only one agent runs it at a time:
  flock -w 3600 ${S}/heavy.lock npx tsc --noEmit
  flock -w 3600 ${S}/heavy.lock npx eslint <files>
  flock -w 3600 ${S}/heavy.lock timeout 300 npx tsx --test <files>   (always with timeout; unit tests must not import Prisma/DB/network modules)
  flock -w 3600 ${S}/heavy.lock ${SHOTS} ...
- Waiting for a background command: never use 'until ! pgrep -f "<pattern>"' (the loop matches its own command line and never exits). Wait on the PID ('while kill -0 $PID 2>/dev/null; do sleep 5; done') or use a bracket pattern like 'pgrep -f "[s]creenshots.ts"'; always bound waits with a timeout.
- Never start another dev server, never run a production build, never open extra browsers outside the screenshot script. The dev server on ${DEV} (local DB) is managed by a watchdog that may restart it — if a request fails with connection refused, wait 30 s and retry.
- Screenshots: only the routes/viewports you need, written under ${S}/shots/<batch-id>/; delete raw captures after review. If 'df -h /' shows less than 2 GB free, delete old dirs under ${S}/shots first (never anything outside ${S}). Never write large files inside the repo.
`

// Saídas estruturadas: o workflow decide o próximo passo pelo JSON, não por texto livre.
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
Your full batch spec (OWNED PATHS, CONTEXT, TASKS, ACCEPTANCE, TEST PLAN) is in ${DOCS}/batches/${b.id}.md (where it says <SCRATCH>, use ${S}) — READ IT FULLY before doing anything. You may edit only the files listed under OWNED PATHS there.`

// 1. Programador: implementa o lote inteiro e se autovalida.
const programmer = (b) => agent(`${CTX}
ROLE: Senior engineer (programador executor). Implement this batch COMPLETELY — nothing half-done, no TODO placeholders, no commented-out leftovers. Prefer simple, readable code that matches the repo's idioms. Do not git commit (a separate step commits after QA).
${batchBlock(b)}

Before finishing, run the validation steps from backlog-rules.md (with the flock lock) and look at your own screenshots (mobile + desktop, light + dark where applicable). Return the structured report.`, { label: `dev:${b.id}`, phase: 'Implementar', schema: PROG_SCHEMA })

// 2. QA: independente e adversarial; não edita código da aplicação.
const tester = (b, dev, cycle) => agent(`${CTX}
ROLE: QA engineer (independent, adversarial). A programmer just implemented the batch below (cycle ${cycle}). Your job is to FIND FAILURES: bugs, regressions, runtime errors, broken layouts, unmet acceptance criteria, dark-mode leaks, mobile problems, wrong numbers/formatting, compliance copy violations. Do NOT edit application code (you may only write screenshots/notes under ${S}). Do not trust the programmer's report — verify.
${batchBlock(b)}

PROGRAMMER REPORT:
${JSON.stringify(dev)}

Do at minimum:
1. git diff / git status for the batch files; read the changed code looking for logic bugs, null/undefined crashes, broken imports, SSR/client mismatches, removed functionality, ownership violations (files changed outside OWNED PATHS — blocking).
2. flock -w 3600 ${S}/heavy.lock npx tsc --noEmit (errors in batch files are blocking; errors only in other batches' files are minor), eslint on changed files, the project's UI/compliance guard scripts on changed files, unit tests if any.
3. Screenshots of every route in the test plan: mobile (390) + desktop (1440), the relevant auth modes, light AND dark. LOOK at every image. Check 320 px for horizontal overflow on key routes.
4. Check the dev-server log in ${S} and the screenshot report for server/console/page errors on those routes.
5. Exercise the main interactions of the batch (tabs, filters, menus, forms) with a short Playwright script when the test plan asks for it.
Verdict 'pass' only if there are no blocking issues. P2 polish goes to 'minor'.`, { label: `qa:${b.id}#${cycle}`, phase: 'Testar', schema: TEST_SCHEMA })

// 3. Fixer: recebe o laudo do QA e corrige dentro dos OWNED PATHS.
const fixer = (b, qa, cycle) => agent(`${CTX}
ROLE: Senior engineer (fixer) — fix round ${cycle}. QA REJECTED the batch. Fix ALL blocking issues and as many minor issues as are cheap and in scope. Stay inside OWNED PATHS. Do not git commit.
${batchBlock(b)}

QA FINDINGS:
${JSON.stringify(qa)}

Re-run the relevant validation (with the flock lock) and screenshots to confirm each fix. Return the structured report (filesChanged = everything you changed in this round).`, { label: `fix:${b.id}#${cycle}`, phase: 'Corrigir', schema: PROG_SCHEMA })

// 4. Committer: um commit local por lote, sob o git.lock (lotes paralelos commitam na mesma working tree).
const committer = (b, files, qa, passed) => agent(`${CTX}
ROLE: Release helper. Create ONE local git commit (never push) containing exactly this batch's changes.
Batch: ${b.id} — ${b.title}
Owned paths: see the OWNED PATHS section of ${DOCS}/batches/${b.id}.md (read it).
Files reported changed: ${JSON.stringify(files)}
QA passed: ${passed}. ${passed ? '' : 'QA did not fully pass after the max cycles: still commit (so work is not lost) but prefix the subject with "wip: " and list the open blocking issues in the body: ' + JSON.stringify(qa?.blocking || [])}

Steps:
1. git status --porcelain. Files to commit = changed/untracked files inside the owned paths AND/OR in the reported list. Never include files of other batches, .env, node_modules, build output, screenshots or anything under the scratchpad.
2. With the git lock: flock -w 600 ${S}/git.lock sh -c 'git add -A -- <files...> && git commit -m "<subject>" -m "<body>" -- <files...>'
   Subject (imperative, <= 72 chars, conventional prefix like feat/fix/refactor). Body: 3-8 bullet lines. End the message with a blank line and exactly:
   ${COAUTHOR}
3. Verify with git show --stat HEAD (only this batch's files).
4. Free disk: rm -rf ${S}/shots/${b.id}* ${S}/shots/qa-${b.id}*. Return sha + files.`, { label: `commit:${b.id}`, phase: 'Commit', schema: COMMIT_SCHEMA, effort: 'low' })

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
    if (cycle === MAX_CYCLES) break // último ciclo: sem fixer, vai para o commit como wip
    const fix = await fixer(b, qa, cycle)
    if (fix) { fix.filesChanged.forEach(f => files.add(f)); dev = { ...fix, previous: dev.summary } }
  }
  const passed = qa?.verdict === 'pass'
  log(`${b.id}: QA ${passed ? 'aprovado' : 'NÃO aprovado'} após ${Math.min(cycle, MAX_CYCLES)} ciclo(s)`)
  const commit = await committer(b, [...files], qa, passed)
  return { id: b.id, passed, cycles: Math.min(cycle, MAX_CYCLES), qa, commit, followups: dev.followups, summary: dev.summary }
}

// Pool simples: no máximo CONC lotes ao mesmo tempo (limite de RAM e de tokens).
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

// skipIntegration: rodar um lote por vez (uma chamada de Workflow por lote) e integrar no fim da onda.
if (args.skipIntegration) return { wave: args.wave, results }

// 5. Integrador: um agente por onda procura quebras ENTRE lotes.
phase('Integração')
const integ = await agent(`${CTX}
ROLE: Integration tester + fixer for wave ${args.wave}. Several batches were implemented in the same working tree and committed separately. Results:
${JSON.stringify(results.map(r => ({ id: r?.id, passed: r?.passed, open: r?.qa?.blocking, minor: r?.qa?.minor, followups: r?.followups, commit: r?.commit?.sha })))}

Do:
1. flock -w 3600 ${S}/heavy.lock npx tsc --noEmit — the whole project must be clean. flock ... npx eslint src --quiet — no new errors. Run the full unit test suite with timeout 300 under the lock.
2. Screenshots of the default route list at mobile in light AND dark, anon + logged in, into ${S}/shots/wave${args.wave}-integration. LOOK at them for cross-batch breakage: shared components, inconsistent headers/spacing, runtime errors, horizontal overflow, dark-mode leaks.
3. Fix only cross-batch integration breakages and the open blocking items above if they are small (you may edit any file for this, keep changes minimal). Do NOT start new features.
4. Commit your fixes (if any) with the git lock: subject "fix: integração da onda ${args.wave}", body bullets, ending with a blank line and "${COAUTHOR}". Never push.
Return a concise report: status of tsc/eslint/tests, what you fixed, remaining open issues (with file/route) that need another round.`, { label: `integration:wave${args.wave}`, phase: 'Integração' })

return { wave: args.wave, results, integration: integ }
