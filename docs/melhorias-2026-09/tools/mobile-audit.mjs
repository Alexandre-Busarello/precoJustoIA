// Mobile UX audit (local only: http://localhost:3100, wired to local DB). Read-only navigation.
import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(process.cwd() + '/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:3100'
const OUT = process.env.OUT || 'tmp/mobile-audit/'
fs.mkdirSync(OUT, { recursive: true })
const args = process.argv.slice(2)
const ONLY = args.find((a) => a.startsWith('--routes='))?.slice(9).split(',')
const MODES = (args.find((a) => a.startsWith('--modes='))?.slice(8) || 'anon,premium').split(',')
const W = Number(args.find((a) => a.startsWith('--w='))?.slice(4) || 360)
const H = Number(args.find((a) => a.startsWith('--h='))?.slice(4) || 740)

const BLOCK_ANY = [
  /^\/api\/ai-reports\/[^/]+\/generate/, /^\/api\/(generate-analysis|review-analysis|screening-ai)(\/|$)/,
  /^\/api\/portfolio\/(ai-assistant|transaction-ai)(\/|$)/, /^\/api\/simulation\/ai-analysis/, /^\/api\/blog\/generate-post/,
  /^\/api\/dividend-radar\/reprocess/, /^\/api\/ben\/(chat|project-ibov)(\/|$)/, /^\/api\/(checkout|payment|webhooks)(\/|$)/,
  /^\/api\/subscription\/portal/, /^\/api\/cron(\/|$)/, /^\/api\/admin\/(?!check(\/|$))/,
  /^\/api\/auth\/(register|forgot-password|resend-verification|reset-password)(\/|$)/, /^\/checkout(\/|$)/,
]
const BLOCK_WRITE = [/^\/api\/(asset-subscriptions|monitor-assets|user-asset-monitor|tickets|trial)(\/|$)/, /^\/api\/ben\/memory(\/|$)/, /^\/api\/admin\//]
const BLOCK_HOSTS = [/(^|\.)clarity\.ms$/, /(^|\.)(googletagmanager|google-analytics|googleadservices|googlesyndication|doubleclick)\.(com|net)$/, /^analytics\.google\.com$/, /(^|\.)(facebook\.net|facebook\.com|hotjar\.com|tiktok\.com)$/, /(^|\.)vercel-(insights|scripts)\.com$/, /(^|\.)(stripe\.com|mercadopago\.com|cakto\.com\.br|kiwify\.com\.br)$/]
const ALLOWED_RANK_MODELS = new Set(['graham', 'screening', 'fii_screening', 'fiiScreening', 'dividendYield', 'lowPE', 'magicFormula', 'barsi'])

export async function route(context) {
  await context.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((f) => f);' })
  await context.route('**/*', async (r, req) => {
    let u
    try { u = new URL(req.url()) } catch { return r.continue() }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return r.continue()
    if (u.host === new URL(BASE).host) {
      const p = u.pathname, m = req.method()
      if (BLOCK_ANY.some((re) => re.test(p)) || (m !== 'GET' && m !== 'HEAD' && BLOCK_WRITE.some((re) => re.test(p)))) {
        return r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"blocked"}' })
      }
      if (p === '/api/rank-builder' && m === 'POST') {
        let model = null
        try { model = JSON.parse(req.postData() || '{}').model } catch {}
        if (!ALLOWED_RANK_MODELS.has(model)) { console.log('   blocked rank-builder model', model); return r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"blocked"}' }) }
      }
      return r.continue()
    }
    if (BLOCK_HOSTS.some((re) => re.test(u.hostname))) return r.abort('blockedbyclient')
    return r.continue()
  })
}

export async function newCtx(browser, state, w = W, h = H) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', storageState: state,
  })
  await route(ctx)
  return ctx
}

export async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await route(ctx)
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('#email').fill('premium@local.test')
  await page.locator('#password').fill('Local123!')
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 }), page.locator('button[type="submit"]').first().click()])
  const st = await ctx.storageState()
  await ctx.close()
  return st
}

export async function go(page, path) {
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(2500)
      return true
    } catch (e) {
      console.log('   retry', path, e.message.slice(0, 80))
      await new Promise((r) => setTimeout(r, 20000))
    }
  }
  return false
}

const METRICS = () => {
  const vw = innerWidth, vh = innerHeight
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05 }
  const desc = (el) => { const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40); return `${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''} "${t}"` }
  const targets = [...document.querySelectorAll('a[href],button,[role=button],[role=tab],input:not([type=hidden]),select,textarea,summary,[role=checkbox],[role=switch],[role=combobox]')].filter(vis)
  let total = 0; const lt44 = []; const lt24 = []
  for (const el of targets) {
    const inText = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p,li,span')
    if (inText) continue
    if (el.closest('footer')) continue
    if (el.closest('[class*="top-[81px]"]')) continue
    total++
    const r = el.getBoundingClientRect(); const s = Math.min(r.width, r.height)
    if (s < 24) lt24.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    else if (s < 44) lt44.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  const inputsSmallFont = [...document.querySelectorAll('input,select,textarea')].filter(vis)
    .filter((el) => !['checkbox', 'radio', 'range', 'submit', 'button', 'file', 'color'].includes(el.type))
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${desc(el)} ${getComputedStyle(el).fontSize}`)
  const tiny = {}
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length) continue
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own || !vis(el)) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 12) tiny[fs] = (tiny[fs] || 0) + 1
  }
  const hscroll = [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4 && vis(el) })
    .map((el) => ({ tag: el.tagName.toLowerCase(), cls: (el.className?.toString?.() || '').slice(0, 70), sw: el.scrollWidth, cw: el.clientWidth, hasTable: !!el.querySelector('table'), stickyCol: !!el.querySelector('th[class*=sticky],td[class*=sticky],[class*="sticky left"]') }))
  const tooltipTriggers = document.querySelectorAll('[data-slot=tooltip-trigger],[data-radix-tooltip-trigger]').length
  const titleOnly = [...document.querySelectorAll('[title]')].filter(vis).length
  const imgs = [...document.images].filter(vis).map((i) => { const r = i.getBoundingClientRect(); return { src: i.currentSrc.replace(location.origin, '').slice(0, 90), nat: i.naturalWidth + 'x' + i.naturalHeight, shown: Math.round(r.width) + 'x' + Math.round(r.height), ratio: +(i.naturalWidth / (r.width * devicePixelRatio)).toFixed(1), loading: i.loading } }).filter((x) => x.ratio > 1.6)
  const res = performance.getEntriesByType('resource')
  const js = res.filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js'))
  const fixedBottom = [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' || !vis(el)) return false; const r = el.getBoundingClientRect(); return r.bottom > vh - 160 && r.top < vh && r.height < vh * 0.8 }).map((el) => { const r = el.getBoundingClientRect(); return `${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}` })
  const safeArea = [...document.querySelectorAll('body *')].some((el) => /safe-area-inset/.test(getComputedStyle(el).paddingBottom + getComputedStyle(el).bottom))
  return {
    url: location.pathname, docW: document.documentElement.scrollWidth, vw, pageH: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / vh).toFixed(1),
    tapTotal: total, tapLt44: lt44.length, tapLt24: lt24.length, lt24Samples: [...new Set(lt24)].slice(0, 14), lt44Samples: [...new Set(lt44)].slice(0, 18),
    inputsSmallFont, tinyText: tiny, hscroll: hscroll.slice(0, 10), tooltipTriggers, titleAttr: titleOnly, oversizedImgs: imgs.slice(0, 8),
    jsCount: js.length, jsDecodedKB: Math.round(js.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024), fixedBottom, safeArea,
  }
}

const STICKY = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const iv = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    if (r.top < 300 && r.bottom > 0 && r.height < innerHeight * 0.6 && r.width > innerWidth * 0.6) iv.push([Math.max(0, r.top), r.bottom, el.tagName.toLowerCase() + '.' + (el.className?.toString?.() || '').split(' ').slice(0, 3).join('.')])
  }
  iv.sort((a, b) => a[0] - b[0])
  let cover = 0; const parts = []
  for (const [t, b, n] of iv) { if (t <= cover + 2) { if (b > cover) { parts.push(`${n} ${Math.round(t)}-${Math.round(b)}`); cover = b } } }
  return { stickyTopPx: Math.round(cover), pct: Math.round((cover / innerHeight) * 100), parts }
}

async function main() {
  const browser = await chromium.launch()
  const state = MODES.includes('premium') ? await login(browser) : undefined
  fs.writeFileSync(OUT + '/state.json', JSON.stringify(state || {}))
  const ROUTES = ONLY || ['/', '/planos', '/acao/petr4', '/fii/hglg11', '/etf/bova11', '/ranking', '/screening-acoes', '/comparador', '/compara-acoes/petr4/vale3', '/dashboard', '/carteira', '/backtest', '/radar-dividendos', '/radar', '/analise-setorial', '/indices/ipj-value', '/pl-bolsa', '/calculadoras/dividend-yield', '/contato', '/login', '/register', '/perfil', '/blog/como-calcular-preco-justo-metodo-graham']
  const results = []
  for (const mode of MODES) {
    const ctx = await newCtx(browser, mode === 'premium' ? state : undefined)
    for (const r of ROUTES) {
      if (mode === 'anon' && ['/dashboard', '/carteira', '/perfil', '/radar'].includes(r)) continue
      const page = await ctx.newPage()
      console.log(mode, r)
      const ok = await go(page, r)
      if (!ok) { await page.close(); continue }
      await page.keyboard.press('Escape').catch(() => {})
      const m = await page.evaluate(METRICS)
      await page.evaluate(() => window.scrollTo(0, Math.min(1400, document.documentElement.scrollHeight / 2)))
      await page.waitForTimeout(700)
      const st = await page.evaluate(STICKY)
      const slug = (r.replace(/^\//, '').replace(/\//g, '_') || 'home')
      await page.screenshot({ path: `${OUT}/${mode}__${slug}__scrolled.png` })
      results.push({ mode, route: r, ...m, sticky: st })
      await page.close()
    }
    await ctx.close()
  }
  fs.writeFileSync(`${OUT}/metrics-${W}x${H}${ONLY ? '-partial' : ''}.json`, JSON.stringify(results, null, 2))
  await browser.close()
}
if (process.argv[1].endsWith('audit.mjs')) main().catch((e) => { console.error(e); process.exit(1) })
