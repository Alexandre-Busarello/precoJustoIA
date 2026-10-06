/**
 * Harness de screenshots (Playwright/Chromium) para o ambiente LOCAL.
 *
 * Uso:
 *   npx tsx scripts/local/screenshots.ts --base http://localhost:3100 --out ./shots/baseline \
 *     [--routes /,/planos,/acao/petr4] [--auth both|anon|premium|free|all] [--viewports small,mobile,desktop] \
 *     [--theme light|dark|both] [--concurrency 2] [--anon-ip per-route|shared] [--popup-wait 7500] [--no-exit-intent] \
 *     [--allow-stale-seed]
 *
 * Saída:
 *   <out>/<mode>/<viewport>/<slug>.png            screenshot full-page (após fechar modais bloqueantes)
 *   <out>/<mode>/<viewport>-dark/<slug>.png       idem com --theme dark|both (tema escuro forçado)
 *   <out>/<mode>/<viewport>/<slug>__modal-N.png   screenshot da viewport com o modal aberto (quando houver)
 *   <out>/report.json                             status HTTP, erros de console/página, modais, requisições bloqueadas etc.
 *
 * Segurança (defesa em profundidade, além do seed):
 *   - Bloqueia no navegador chamadas a endpoints de IA (Gemini), pagamento/checkout, e-mail, cron e admin.
 *   - Bloqueia analytics de terceiros (Clarity, GA/GTM, Meta...) para não poluir métricas de produção.
 *   - Recusa rodar contra hosts que não sejam localhost/127.0.0.1 (a menos que --allow-remote).
 *   - Avisa/aborta se o seed local não foi rodado hoje (caches de IA diários vencidos => risco de chamada ao Gemini).
 */
import { chromium, devices, type Browser, type BrowserContext, type Page, type Request, type Route } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
type Mode = 'anon' | 'premium' | 'free'
type ViewportName = 'small' | 'mobile' | 'desktop'
type Theme = 'light' | 'dark'

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) args[key] = true
    else {
      args[key] = next
      i++
    }
  }
  return args
}

export const DEFAULT_ROUTES = [
  // Marketing / institucional
  '/', '/planos', '/como-funciona', '/metodologia', '/sobre', '/contato',
  // Ferramentas principais
  '/ranking', '/screening-acoes', '/screening-fiis', '/analise-setorial', '/radar-dividendos', '/radar-dividendos/petr4',
  '/radar', '/backtest', '/calculadoras/dividend-yield', '/calculadoras/recuperacao', '/pl-bolsa', '/projecoes-ibov',
  '/indices', '/indices/ipj-value', '/comparador', '/comparador-etfs',
  // Páginas de ativo
  '/acao/petr4', '/acao/itub4', '/acao/petr4/analise-tecnica', '/acao/petr4/relatorios', '/fii/hglg11', '/etf/bova11', '/bdr/aapl34',
  '/compara-acoes/petr4/vale3', '/compara-etfs/bova11/divo11',
  // Área logada
  '/dashboard', '/carteira', '/perfil', '/notificacoes',
  // Conteúdo
  '/blog', '/blog/como-calcular-preco-justo-metodo-graham',
  // Auth
  '/login', '/register', '/esqueci-senha',
]

const VIEWPORTS: Record<ViewportName, Parameters<Browser['newContext']>[0]> = {
  // Android intermediário típico (360×740, DPR 2, toque)
  small: {
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: devices['Pixel 5'].userAgent,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: devices['iPhone 13'].userAgent,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
}

const CREDENTIALS: Record<Exclude<Mode, 'anon'>, { email: string; password: string }> = {
  premium: { email: 'premium@local.test', password: 'Local123!' },
  free: { email: 'free@local.test', password: 'Local123!' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloqueios
// ─────────────────────────────────────────────────────────────────────────────
/** Endpoints same-origin bloqueados para QUALQUER método (IA, pagamentos, e-mail, cron, admin). */
const BLOCK_ANY_METHOD: Array<[RegExp, string]> = [
  [/^\/api\/ai-reports\/[^/]+\/generate/, 'ai'],
  [/^\/api\/(generate-analysis|review-analysis|screening-ai)(\/|$)/, 'ai'],
  [/^\/api\/portfolio\/(ai-assistant|transaction-ai)(\/|$)/, 'ai'],
  [/^\/api\/simulation\/ai-analysis/, 'ai'],
  [/^\/api\/blog\/generate-post/, 'ai'],
  [/^\/api\/dividend-radar\/reprocess/, 'ai'],
  [/^\/api\/ben\/(chat|project-ibov)(\/|$)/, 'ai'],
  [/^\/api\/(checkout|payment|webhooks)(\/|$)/, 'payment'],
  [/^\/api\/subscription\/portal/, 'payment'],
  [/^\/api\/cron(\/|$)/, 'cron-admin'],
  [/^\/api\/admin\/(?!check(\/|$))/, 'cron-admin'],
  [/^\/api\/auth\/(register|forgot-password|resend-verification|reset-password)(\/|$)/, 'email'],
  [/^\/checkout(\/|$)/, 'payment'],
]
/** Endpoints same-origin bloqueados apenas para métodos de escrita (podem disparar e-mail). */
const BLOCK_WRITE_METHODS: Array<[RegExp, string]> = [
  [/^\/api\/(asset-subscriptions|monitor-assets|user-asset-monitor|tickets|trial)(\/|$)/, 'email'],
  [/^\/api\/ben\/memory(\/|$)/, 'ai'],
  [/^\/api\/admin\//, 'cron-admin'],
]
/** Hosts de terceiros bloqueados. */
const BLOCK_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)clarity\.ms$/, 'analytics'],
  [/(^|\.)(googletagmanager|google-analytics|googleadservices|googlesyndication|doubleclick)\.(com|net)$/, 'analytics'],
  [/^analytics\.google\.com$/, 'analytics'],
  [/(^|\.)(facebook\.net|facebook\.com|hotjar\.com|hotjar\.io|tiktok\.com|licdn\.com)$/, 'analytics'],
  [/(^|\.)vercel-(insights|scripts)\.com$/, 'analytics'],
  [/(^|\.)(stripe\.com|stripe\.network|mercadopago\.com|mercadopago\.com\.br|mercadolibre\.com|cakto\.com\.br|kiwify\.com\.br|kiwify\.app)$/, 'payment'],
]

// ─────────────────────────────────────────────────────────────────────────────
// Tipos do relatório
// ─────────────────────────────────────────────────────────────────────────────
interface ModalInfo {
  phase: 'load' | 'scroll' | 'exit-intent'
  kind: 'dialog' | 'overlay' | 'banner'
  blocking: boolean
  label: string
  selector: string
  dismissed?: boolean
  dismissMethod?: string
  screenshot?: string
}
interface RouteResult {
  route: string
  mode: Mode
  viewport: ViewportName
  theme: Theme
  url: string
  finalUrl: string | null
  status: number | null
  redirectChain: string[]
  timings: { gotoMs: number; networkIdle: boolean; totalMs: number }
  consoleErrors: string[]
  consoleWarningsCount: number
  pageErrors: string[]
  failedRequests: Array<{ method: string; url: string; status?: number; failure?: string }>
  blockedRequests: Array<{ method: string; url: string; reason: string }>
  apiWrites: Array<{ method: string; path: string; status?: number }>
  modals: ModalInfo[]
  nextDevIssues: number | null
  pageHeight: number | null
  horizontalOverflowPx: number | null
  screenshot: string | null
  error: string | null
  /** true quando a 1ª tentativa pegou o dev server reiniciando (ECONNREFUSED/RESET) e a rota foi capturada de novo */
  retriedAfterServerRestart?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function slugify(route: string): string {
  const s = route.replace(/^\/+|\/+$/g, '').replace(/[/?&=#]+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')
  return s || 'home'
}
function truncate(s: string, n = 400) {
  return s.length > n ? s.slice(0, n) + '…' : s
}
let ipCounter = 0
function fakeIp(): string {
  ipCounter++
  // TEST-NET-2/3 (RFC 5737) — nunca roteáveis
  return ipCounter % 2 ? `198.51.100.${(ipCounter % 250) + 1}` : `203.0.113.${(ipCounter % 250) + 1}`
}

async function installRouting(context: BrowserContext, base: URL, result: () => RouteResult | null, opts: { forwardedFor?: () => string | undefined }) {
  // tsx/esbuild (keepNames) injeta __name() nas funções serializadas para page.evaluate; define um shim no browser.
  await context.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((f) => f);' })
  await context.route('**/*', async (route: Route, request: Request) => {
    const res = result()
    let u: URL
    try {
      u = new URL(request.url())
    } catch {
      return route.continue()
    }
    const method = request.method()
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue()
    const sameOrigin = u.host === base.host
    if (sameOrigin) {
      const p = u.pathname
      const hitAny = BLOCK_ANY_METHOD.find(([re]) => re.test(p))
      const hitWrite = method !== 'GET' && method !== 'HEAD' ? BLOCK_WRITE_METHODS.find(([re]) => re.test(p)) : undefined
      const hit = hitAny ?? hitWrite
      if (hit) {
        res?.blockedRequests.push({ method, url: p + u.search, reason: hit[1] })
        // Navegação bloqueada devolve página simples em vez de erro de rede
        if (request.isNavigationRequest()) return route.fulfill({ status: 451, contentType: 'text/html', body: '<h1>Bloqueado pelo harness local</h1>' })
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'blocked-by-local-harness', reason: hit[1] }) })
      }
      const xff = opts.forwardedFor?.()
      if (xff) return route.continue({ headers: { ...request.headers(), 'x-forwarded-for': xff } })
      return route.continue()
    }
    const hostHit = BLOCK_HOSTS.find(([re]) => re.test(u.hostname))
    if (hostHit) {
      res?.blockedRequests.push({ method, url: `${u.hostname}${u.pathname}`.slice(0, 200), reason: hostHit[1] })
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
}

/** Detecta modais/overlays/banners visíveis. Roda no browser. */
async function detectModals(page: Page): Promise<Array<Omit<ModalInfo, 'phase'>>> {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const isVisible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0.05
    }
    const labelOf = (el: Element) => {
      const aria = el.getAttribute('aria-label')
      const labelled = el.getAttribute('aria-labelledby')
      const lbl = labelled ? document.getElementById(labelled)?.textContent : null
      const h = el.querySelector('h1,h2,h3,h4,[data-slot="dialog-title"],[data-slot="alert-dialog-title"]')?.textContent
      const txt = (el as HTMLElement).innerText || el.textContent || ''
      return (aria || lbl || h || txt).replace(/\s+/g, ' ').trim().slice(0, 160)
    }
    const selectorOf = (el: Element) => {
      const parts: string[] = [el.tagName.toLowerCase()]
      if (el.id) parts.push('#' + el.id)
      const role = el.getAttribute('role')
      if (role) parts.push(`[role="${role}"]`)
      const slot = el.getAttribute('data-slot')
      if (slot) parts.push(`[data-slot="${slot}"]`)
      const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3)
      if (!role && !slot && cls.length) parts.push('.' + cls.join('.'))
      return parts.join('')
    }
    const out: Array<{ kind: 'dialog' | 'overlay' | 'banner'; blocking: boolean; label: string; selector: string }> = []
    const seen = new Set<Element>()
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-slot="dialog-content"],[data-slot="alert-dialog-content"],[data-slot="sheet-content"],[data-slot="drawer-content"],[data-vaul-drawer]'))
    for (const el of dialogs) {
      if (!isVisible(el)) continue
      if (Array.from(seen).some((s) => s.contains(el) || el.contains(s))) continue
      seen.add(el)
      const r = el.getBoundingClientRect()
      const area = (Math.min(r.right, vw) - Math.max(r.left, 0)) * (Math.min(r.bottom, vh) - Math.max(r.top, 0))
      const modal = el.getAttribute('aria-modal') === 'true' || !!document.querySelector('[data-slot="dialog-overlay"],[data-slot="alert-dialog-overlay"],[data-slot="sheet-overlay"]')
      out.push({ kind: 'dialog', blocking: modal || area / (vw * vh) > 0.35, label: labelOf(el), selector: selectorOf(el) })
    }
    // Overlays/banners fixos que não são dialogs (popups caseiros, banners de cookie, CTAs flutuantes)
    for (const el of Array.from(document.body.querySelectorAll('body *'))) {
      const s = getComputedStyle(el)
      if (s.position !== 'fixed' && s.position !== 'sticky') continue
      if (s.position === 'sticky') continue
      if (!isVisible(el)) continue
      if (Array.from(seen).some((x) => x.contains(el) || el.contains(x))) continue
      const tag = el.tagName.toLowerCase()
      if (tag === 'header' || tag === 'nav' || el.closest('header,nav') || el.getAttribute('role') === 'navigation') continue
      if (tag === 'nextjs-portal' || el.closest('nextjs-portal')) continue
      // overlay (fundo escuro) de um dialog já reportado
      if (/overlay/.test(el.getAttribute('data-slot') || '') && out.some((o) => o.kind === 'dialog')) continue
      const r = el.getBoundingClientRect()
      const w = Math.min(r.right, vw) - Math.max(r.left, 0)
      const h = Math.min(r.bottom, vh) - Math.max(r.top, 0)
      if (w <= 0 || h <= 0) continue
      const frac = (w * h) / (vw * vh)
      const text = ((el as HTMLElement).innerText || '').trim()
      const z = parseInt(s.zIndex || '0', 10) || 0
      if (frac > 0.5 && z >= 10) {
        seen.add(el)
        out.push({ kind: 'overlay', blocking: true, label: labelOf(el) || '(overlay sem texto)', selector: selectorOf(el) })
      } else if (frac > 0.04 && frac <= 0.5 && text.length > 15 && r.top > vh * 0.4) {
        // banner/CTA flutuante na metade inferior (ex.: cookies, "assine", chat)
        seen.add(el)
        out.push({ kind: 'banner', blocking: false, label: labelOf(el), selector: selectorOf(el) })
      }
    }
    return out
  })
}

async function tryDismiss(page: Page): Promise<{ ok: boolean; method: string }> {
  const stillBlocking = async () => (await detectModals(page)).some((m) => m.blocking)
  await page.keyboard.press('Escape').catch(() => {})
  await sleep(400)
  if (!(await stillBlocking())) return { ok: true, method: 'Escape' }
  const candidates = [
    '[role="dialog"] [data-slot="dialog-close"]',
    '[role="dialog"] button[aria-label*="echar" i]',
    '[role="dialog"] button[aria-label*="lose" i]',
    '[role="dialog"] button:has-text("Fechar")',
    '[role="dialog"] button:has-text("Agora não")',
    '[role="dialog"] button:has-text("Não, obrigado")',
    '[role="dialog"] button:has-text("Talvez depois")',
    '[role="dialog"] button:has-text("Pular")',
    '[role="dialog"] button:has-text("Continuar")',
    '[role="alertdialog"] button:has-text("Cancelar")',
    'button[aria-label*="echar" i]',
    'button[aria-label*="lose" i]',
    // modais "caseiros" (sem role=dialog): botões de recusa por texto ou o X (lucide) dentro de um overlay fixo
    'div.fixed button:has-text("Talvez depois")',
    'div.fixed button:has-text("Agora não")',
    'div.fixed button:has-text("Não, obrigado")',
    'div.fixed button:has-text("Fechar")',
    'div.fixed.inset-0 button:has(svg.lucide-x)',
  ]
  for (const sel of candidates) {
    const loc = page.locator(sel).first()
    if (await loc.isVisible().catch(() => false)) {
      await loc.click({ timeout: 3000 }).catch(() => {})
      await sleep(500)
      if (!(await stillBlocking())) return { ok: true, method: `click ${sel}` }
    }
  }
  // último recurso: clicar no overlay (canto superior esquerdo)
  await page.mouse.click(5, 5).catch(() => {})
  await sleep(400)
  if (!(await stillBlocking())) return { ok: true, method: 'click-outside' }
  return { ok: false, method: 'none' }
}

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const step = Math.max(300, Math.floor(window.innerHeight * 0.85))
    for (let i = 0; i < 60; i++) {
      const max = (document.scrollingElement || document.documentElement).scrollHeight
      const y = Math.min(max, (i + 1) * step)
      window.scrollTo(0, y)
      await delay(120)
      if (y >= max) break
    }
    await delay(300)
    window.scrollTo(0, 0)
  })
}

async function nextDevIssues(page: Page): Promise<number | null> {
  return page
    .evaluate(() => {
      const portal = document.querySelector('nextjs-portal') as (Element & { shadowRoot: ShadowRoot | null }) | null
      const txt = portal?.shadowRoot?.textContent || ''
      const m = txt.match(/(\d+)\s*Issues?/i)
      return m ? parseInt(m[1], 10) : txt ? 0 : null
    })
    .catch(() => null)
}

/** O dev server local pode reiniciar no meio (watchdog de memória, mudança de config): detecta e espera voltar. */
function hitServerRestart(r: RouteResult, base: URL): boolean {
  const re = /ERR_CONNECTION_(REFUSED|RESET)|ERR_EMPTY_RESPONSE|ECONNREFUSED|ECONNRESET|socket hang up/i
  if (r.error && re.test(r.error)) return true
  return r.failedRequests.some((f) => !!f.failure && re.test(f.failure) && f.url.includes(base.host))
}
async function waitForServer(base: URL, maxMs = 180000): Promise<boolean> {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 10000)
      const res = await fetch(new URL('/api/auth/csrf', base), { signal: ctl.signal })
      clearTimeout(timer)
      if (res.ok) return true
    } catch {
      /* ainda fora do ar */
    }
    await sleep(2000)
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
async function login(browser: Browser, base: URL, mode: Exclude<Mode, 'anon'>, timeoutMs: number): Promise<{ state: Awaited<ReturnType<BrowserContext['storageState']>>; method: string }> {
  const { email, password } = CREDENTIALS[mode]
  const context = await browser.newContext(VIEWPORTS.desktop)
  await installRouting(context, base, () => null, {})
  const page = await context.newPage()
  try {
    await page.goto(new URL('/login', base).toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.locator('#email').fill(email, { timeout: timeoutMs })
    await page.locator('#password').fill(password)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: timeoutMs }),
      page.locator('button[type="submit"]').first().click(),
    ])
    const session = await page.evaluate(async () => (await fetch('/api/auth/session')).json())
    if (!session?.user?.email) throw new Error('sessão vazia após login pela UI')
    return { state: await context.storageState(), method: 'ui' }
  } catch (uiErr) {
    // Fallback: fluxo de credenciais do next-auth via HTTP (mesmo backend, sem UI)
    console.warn(`   ⚠️  login via UI falhou (${(uiErr as Error).message}); tentando fluxo de credenciais do next-auth`)
    const req = context.request
    const csrf = await (await req.get(new URL('/api/auth/csrf', base).toString())).json()
    const resp = await req.post(new URL('/api/auth/callback/credentials', base).toString(), {
      form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: new URL('/dashboard', base).toString(), json: 'true' },
    })
    const session = await (await req.get(new URL('/api/auth/session', base).toString())).json()
    if (!session?.user?.email) throw new Error(`login falhou para ${email} (status ${resp.status()})`)
    return { state: await context.storageState(), method: 'credentials-api' }
  } finally {
    await context.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Captura de uma rota
// ─────────────────────────────────────────────────────────────────────────────
async function captureRoute(
  browser: Browser,
  base: URL,
  outDir: string,
  mode: Mode,
  vp: ViewportName,
  theme: Theme,
  route: string,
  opts: { storageState?: Awaited<ReturnType<BrowserContext['storageState']>>; timeoutMs: number; popupWaitMs: number; anonIp: 'per-route' | 'shared'; exitIntent: boolean }
): Promise<RouteResult> {
  const url = new URL(route, base).toString()
  const dir = path.join(outDir, mode, theme === 'dark' ? `${vp}-dark` : vp)
  fs.mkdirSync(dir, { recursive: true })
  const slug = slugify(route)
  const result: RouteResult = {
    route, mode, viewport: vp, theme, url, finalUrl: null, status: null, redirectChain: [],
    timings: { gotoMs: 0, networkIdle: false, totalMs: 0 },
    consoleErrors: [], consoleWarningsCount: 0, pageErrors: [], failedRequests: [], blockedRequests: [], apiWrites: [], modals: [],
    nextDevIssues: null, pageHeight: null, horizontalOverflowPx: null, screenshot: null, error: null,
  }
  const t0 = Date.now()
  const context = await browser.newContext({
    ...VIEWPORTS[vp],
    storageState: opts.storageState,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: theme,
  })
  // Força o tema do next-themes (chave 'theme') antes de qualquer script da página
  await context.addInitScript({ content: `try { localStorage.setItem('theme', '${theme}') } catch (e) {}` })
  const ip = mode === 'anon' && opts.anonIp === 'per-route' ? fakeIp() : undefined
  await installRouting(context, base, () => result, { forwardedFor: () => ip })
  const page = await context.newPage()
  page.setDefaultTimeout(opts.timeoutMs)

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // erros causados pelos próprios bloqueios do harness não são achados do app
      if (/ERR_BLOCKED_BY_CLIENT/.test(msg.text())) return
      if (/status of 403/.test(msg.text()) && result.blockedRequests.some((b) => msg.location().url.includes(b.url.split('?')[0]))) return
      const t = truncate(msg.text())
      if (!result.consoleErrors.includes(t) && result.consoleErrors.length < 50) result.consoleErrors.push(t)
    } else if (msg.type() === 'warning') result.consoleWarningsCount++
  })
  page.on('pageerror', (err) => {
    const t = truncate(`${err.name}: ${err.message}`)
    if (!result.pageErrors.includes(t)) result.pageErrors.push(t)
  })
  page.on('requestfailed', (req) => {
    const f = req.failure()?.errorText || ''
    if (/ERR_BLOCKED_BY_CLIENT|blockedbyclient|ERR_ABORTED/i.test(f)) return
    if (result.failedRequests.length < 50) result.failedRequests.push({ method: req.method(), url: truncate(req.url(), 200), failure: f })
  })
  page.on('response', (resp) => {
    const req = resp.request()
    let u: URL
    try {
      u = new URL(resp.url())
    } catch {
      return
    }
    if (u.host !== base.host) return
    const st = resp.status()
    if (u.pathname.startsWith('/api/') && req.method() !== 'GET' && req.method() !== 'HEAD') {
      result.apiWrites.push({ method: req.method(), path: u.pathname, status: st })
    }
    if (st >= 400 && st !== 451 && !(st === 403 && resp.headers()['content-type']?.includes('json') && result.blockedRequests.some((b) => b.url.startsWith(u.pathname)))) {
      if (!req.isNavigationRequest() && result.failedRequests.length < 50) result.failedRequests.push({ method: req.method(), url: truncate(u.pathname + u.search, 200), status: st })
    }
  })

  try {
    const g0 = Date.now()
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs })
    result.timings.gotoMs = Date.now() - g0
    result.status = resp?.status() ?? null
    // cadeia de redirects
    let rq = resp?.request().redirectedFrom()
    const chain: string[] = []
    while (rq) {
      chain.unshift(rq.url())
      rq = rq.redirectedFrom()
    }
    result.redirectChain = chain
    result.timings.networkIdle = await page.waitForLoadState('networkidle', { timeout: 30000 }).then(() => true).catch(() => false)
    const loadedAt = Date.now()
    // esconde o indicador de dev do Next (badge "N") dos screenshots; a contagem de issues continua legível no shadowRoot
    // e desliga o scroll suave: com ele o scrollTo(0,0) antes do full-page ainda está animando e o header sticky sai do lugar
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important} html{scroll-behavior:auto!important}' }).catch(() => {})

    const recordModals = async (phase: ModalInfo['phase']) => {
      const found = await detectModals(page)
      for (const m of found) {
        const known = result.modals.find((x) => x.label === m.label && x.kind === m.kind)
        if (known) continue
        const info: ModalInfo = { ...m, phase }
        result.modals.push(info)
        if (m.blocking) {
          const shot = path.join(dir, `${slug}__modal-${result.modals.length}.png`)
          await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
          info.screenshot = path.relative(outDir, shot)
          const d = await tryDismiss(page)
          info.dismissed = d.ok
          info.dismissMethod = d.method
        }
      }
    }

    await recordModals('load')
    await autoScroll(page)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    // espera popups temporizados (ex.: captura de e-mail aparece após 6s)
    const remaining = opts.popupWaitMs - (Date.now() - loadedAt)
    if (remaining > 0) await sleep(remaining)
    await recordModals('scroll')

    if (opts.exitIntent && vp === 'desktop' && mode !== 'premium' && ['/planos', '/checkout'].includes(new URL(page.url()).pathname)) {
      // useExitIntent exige >=10s na página e >=5s sem interação; depois dispara em document.mouseleave com clientY<=0
      const waitMore = Math.max(0, 11000 - (Date.now() - loadedAt))
      await sleep(Math.max(waitMore, 5500))
      await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave', { clientY: -5, clientX: 400, relatedTarget: null, bubbles: true })))
      await sleep(1200)
      await recordModals('exit-intent')
    }

    result.nextDevIssues = await nextDevIssues(page)
    const metrics = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement
      return { h: el.scrollHeight, overflow: Math.max(0, el.scrollWidth - window.innerWidth) }
    })
    result.pageHeight = metrics.h
    result.horizontalOverflowPx = metrics.overflow
    await page.evaluate(() => window.scrollTo(0, 0))
    await sleep(300)
    const shot = path.join(dir, `${slug}.png`)
    try {
      await page.screenshot({ path: shot, fullPage: true, timeout: 60000 })
    } catch (e) {
      await page.screenshot({ path: shot, fullPage: false })
      result.error = `full-page falhou, capturada só a viewport: ${(e as Error).message}`
    }
    result.screenshot = path.relative(outDir, shot)
    result.finalUrl = page.url()
  } catch (e) {
    result.error = truncate((e as Error).message, 800)
    try {
      const shot = path.join(dir, `${slug}.png`)
      await page.screenshot({ path: shot, fullPage: false })
      result.screenshot = path.relative(outDir, shot)
      result.finalUrl = page.url()
    } catch {
      /* ignore */
    }
  } finally {
    result.timings.totalMs = Date.now() - t0
    await context.close()
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const base = new URL(String(args.base || 'http://localhost:3100'))
  if (!['localhost', '127.0.0.1'].includes(base.hostname) && !args['allow-remote']) {
    console.error(`❌ --base ${base.origin} não é local. Use --allow-remote se souber o que está fazendo (NUNCA produção).`)
    process.exit(1)
  }
  const outDir = path.resolve(String(args.out || path.join(process.cwd(), 'shots', new Date().toISOString().replace(/[:.]/g, '-'))))
  const routes = (typeof args.routes === 'string' ? args.routes.split(',') : DEFAULT_ROUTES).map((r) => r.trim()).filter(Boolean).map((r) => (r.startsWith('/') ? r : '/' + r))
  const auth = String(args.auth || 'both')
  const modes: Mode[] = auth === 'both' ? ['anon', 'premium'] : auth === 'all' ? ['anon', 'premium', 'free'] : (auth.split(',') as Mode[])
  const viewports = (typeof args.viewports === 'string' ? args.viewports.split(',') : ['mobile', 'desktop']) as ViewportName[]
  const unknownVp = viewports.filter((v) => !(v in VIEWPORTS))
  if (unknownVp.length) {
    console.error(`❌ viewport(s) desconhecido(s): ${unknownVp.join(',')} (use small, mobile, desktop)`)
    process.exit(1)
  }
  const themeArg = String(args.theme || 'light')
  if (!['light', 'dark', 'both'].includes(themeArg)) {
    console.error(`❌ --theme ${themeArg} inválido (use light, dark ou both)`)
    process.exit(1)
  }
  const themes: Theme[] = themeArg === 'both' ? ['light', 'dark'] : [themeArg as Theme]
  const concurrency = Math.max(1, parseInt(String(args.concurrency || '2'), 10))
  const timeoutMs = parseInt(String(args.timeout || '90000'), 10)
  const popupWaitMs = parseInt(String(args['popup-wait'] || '7500'), 10)
  const anonIp = (String(args['anon-ip'] || 'per-route') as 'per-route' | 'shared')
  const exitIntent = !args['no-exit-intent']

  // Frescor do seed (caches de IA diários)
  const stampFile = path.join(__dirname, '.last-seed.json')
  let seedStamp: { seededAt: string; localDate: string } | null = null
  try {
    seedStamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'))
  } catch {
    /* sem stamp */
  }
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (!seedStamp || seedStamp.localDate !== today) {
    const msg = `seed local ${seedStamp ? `é de ${seedStamp.localDate}` : 'não encontrado'} (hoje: ${today}). Rode scripts/local/seed-local.ts antes: caches de IA vencidos podem fazer o app chamar o Gemini.`
    if (!args['allow-stale-seed']) {
      console.error('❌ ' + msg + ' (use --allow-stale-seed para ignorar)')
      process.exit(1)
    }
    console.warn('⚠️  ' + msg)
  }

  fs.mkdirSync(outDir, { recursive: true })
  console.log(`📸 base=${base.origin} out=${outDir}\n   modos=${modes.join(',')} viewports=${viewports.join(',')} temas=${themes.join(',')} rotas=${routes.length} concorrência=${concurrency}`)

  const browser = await chromium.launch({ headless: true })
  const startedAt = new Date().toISOString()
  const results: RouteResult[] = []
  const loginInfo: Record<string, string> = {}
  try {
    const states: Partial<Record<Mode, Awaited<ReturnType<BrowserContext['storageState']>>>> = {}
    for (const m of modes) {
      if (m === 'anon') continue
      process.stdout.write(`🔐 login ${m}... `)
      const { state, method } = await login(browser, base, m, timeoutMs)
      states[m] = state
      loginInfo[m] = method
      console.log(`ok (${method})`)
    }

    // Fila: rota-major para que a 1ª compilação de cada rota aconteça uma vez só
    const tasks: Array<{ mode: Mode; vp: ViewportName; theme: Theme; route: string }> = []
    for (const route of routes) for (const mode of modes) for (const vp of viewports) for (const theme of themes) tasks.push({ mode, vp, theme, route })
    let next = 0
    let done = 0
    const worker = async () => {
      while (next < tasks.length) {
        const t = tasks[next++]
        // se o dev server estiver fora do ar (reinício), espera voltar antes de capturar
        if (!(await waitForServer(base, 1500).catch(() => false))) await waitForServer(base)
        const capOpts = { storageState: states[t.mode], timeoutMs, popupWaitMs, anonIp, exitIntent }
        let res = await captureRoute(browser, base, outDir, t.mode, t.vp, t.theme, t.route, capOpts)
        if (hitServerRestart(res, base)) {
          console.warn(`   ↻ dev server reiniciou durante ${t.mode}/${t.vp} ${t.route}; aguardando e repetindo...`)
          await waitForServer(base)
          res = await captureRoute(browser, base, outDir, t.mode, t.vp, t.theme, t.route, capOpts)
          res.retriedAfterServerRestart = true
        }
        results.push(res)
        done++
        const flags = [
          res.error ? `ERRO: ${res.error.slice(0, 80)}` : '',
          res.pageErrors.length ? `${res.pageErrors.length} pageerror` : '',
          res.consoleErrors.length ? `${res.consoleErrors.length} console.error` : '',
          res.modals.filter((m) => m.kind !== 'banner').length ? `modais: ${res.modals.filter((m) => m.kind !== 'banner').map((m) => m.label.slice(0, 40)).join(' | ')}` : '',
          res.blockedRequests.filter((b) => b.reason !== 'analytics').length ? `bloqueadas: ${res.blockedRequests.filter((b) => b.reason !== 'analytics').map((b) => b.url).join(',')}` : '',
        ].filter(Boolean).join(' · ')
        console.log(`[${done}/${tasks.length}] ${t.mode}/${t.vp}${t.theme === 'dark' ? '-dark' : ''} ${t.route} → ${res.status ?? '---'} ${(res.timings.totalMs / 1000).toFixed(1)}s ${flags}`)
        fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ base: base.origin, startedAt, inProgress: true, results }, null, 2))
      }
    }
    // workers escalonados (o dev server compila cada rota na 1ª visita)
    await Promise.all(Array.from({ length: concurrency }, (_, i) => sleep(i * 1500).then(worker)))
  } finally {
    await browser.close()
  }

  results.sort((a, b) => a.route.localeCompare(b.route) || a.mode.localeCompare(b.mode) || a.viewport.localeCompare(b.viewport) || a.theme.localeCompare(b.theme))
  const modalSummary: Record<string, { kind: string; blocking: boolean; occurrences: string[] }> = {}
  for (const r of results) {
    for (const m of r.modals) {
      const key = `${m.kind}:${m.label.slice(0, 80)}`
      modalSummary[key] ??= { kind: m.kind, blocking: m.blocking, occurrences: [] }
      modalSummary[key].occurrences.push(`${r.mode}/${r.viewport}${r.theme === 'dark' ? '-dark' : ''}${r.route}`)
    }
  }
  const report = {
    base: base.origin,
    startedAt,
    finishedAt: new Date().toISOString(),
    seed: seedStamp,
    login: loginInfo,
    options: { routes, modes, viewports, themes, concurrency, timeoutMs, popupWaitMs, anonIp, exitIntent },
    summary: {
      total: results.length,
      byStatus: results.reduce<Record<string, number>>((acc, r) => {
        const k = r.error && r.status === null ? 'error' : String(r.status)
        acc[k] = (acc[k] || 0) + 1
        return acc
      }, {}),
      withPageErrors: results.filter((r) => r.pageErrors.length).map((r) => `${r.mode}/${r.viewport}${r.theme === 'dark' ? '-dark' : ''}${r.route}`),
      withConsoleErrors: results.filter((r) => r.consoleErrors.length).length,
      withHorizontalOverflow: results.filter((r) => (r.horizontalOverflowPx ?? 0) > 1).map((r) => `${r.mode}/${r.viewport}${r.theme === 'dark' ? '-dark' : ''}${r.route} (+${r.horizontalOverflowPx}px)`),
      modals: modalSummary,
    },
    results,
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\n✅ ${results.length} capturas. Relatório: ${path.join(outDir, 'report.json')}`)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
