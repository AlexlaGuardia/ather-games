// ── BETA M214: THE DEV DASH IS A USABLE PLACE (world-M214, 2026-11-26) ──
// Alex: 'a graveyard of old tools... make this a usable place with a pill to use the world creation mode'.
// Owner-only (/shimmer/dev is owner-gated), so this runs on the box with OWNER_KEY. Desktop first (1280x800), the landing
// also at 390x844. Asserts:
//   1. /shimmer/dev leads with the Creative mode pill, inside the first viewport, then the live tools (13 pages + the M213
//      spirit gallery + the birth rune route); no archived route is linked anywhere on the page.
//   2. the pill opens ?mode=terrain (the World Builder) in place.
//   3. every route in DEV_ARCHIVE.md answers 404 (or lands back on /shimmer/dev); a removed tab (?mode=map) falls back to the index.
//   4. every kept tool (each registered live page + each kept editor tab) loads with 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m214-devdash-check.mts [--url https://ather.games] [--out docs/looks/m214-2026-11-26]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { DEV_PAGES } from '../src/app/shimmer/dev/templates/dev-pages'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m214-2026-11-26')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const ARCHIVED = [...readFileSync('DEV_ARCHIVE.md', 'utf8').matchAll(/^\| `(\/[^`]+)` \| `([0-9a-f]{7,40})` \|/gm)].map(m => m[1])
const LIVE = DEV_PAGES.filter(p => p.era === 'live').map(p => p.path)
const KEPT_MODES = ['terrain', 'spirits', 'moves', 'evolution', 'tools', 'alchemy', 'farming', 'resources', 'items', 'skills', 'mana', 'daycycle', 'doctor', 'meshbench']
ok(ARCHIVED.length >= 30, `DEV_ARCHIVE.md lists ${ARCHIVED.length} removed routes`)

const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage()
const errs: string[] = []
let where = ''
p.on('pageerror', e => errs.push(`${where}: ${String(e).slice(0, 200)}`))
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const go = async (path: string, vp = { width: 1280, height: 800 }) => {
  where = path; await p.setViewport(vp)
  const r = await p.goto(`${url}${path}`, { waitUntil: 'networkidle2', timeout: 180000 }).catch(() => null)
  return r
}

try {
  // ── 1. the landing ──
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const r = await go('/shimmer/dev', vp)
    ok(r?.status() === 200, `${vp.width}: /shimmer/dev answers 200 (got ${r?.status()})`)
    await p.waitForSelector('[data-creative-pill]', { timeout: 60000 }).catch(() => null)
    const s = await p.evaluate(() => {
      const pill = document.querySelector<HTMLAnchorElement>('[data-creative-pill]')
      const live = document.querySelector('[data-live-tools]')
      const r = pill?.getBoundingClientRect()
      return {
        pill: !!pill, href: pill?.getAttribute('href') ?? '', text: pill?.textContent ?? '', top: r?.top ?? 1e9, bottom: r?.bottom ?? 1e9, w: r?.width ?? 0,
        pillFirst: !!(pill && live && (pill.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING)),
        liveLinks: [...(live?.querySelectorAll('a') ?? [])].map(a => a.getAttribute('href') ?? ''),
        allLinks: [...document.querySelectorAll('a')].map(a => a.getAttribute('href') ?? ''),
        oldFold: /Old versions/i.test(document.body.innerText),
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    })
    ok(s.pill && /Creative mode/.test(s.text) && s.href.endsWith('?mode=terrain'), `${vp.width}: the Creative mode pill is there and points at ?mode=terrain`)
    ok(s.bottom <= vp.height, `${vp.width}: the pill sits inside the first viewport (bottom ${Math.round(s.bottom)} <= ${vp.height})`)
    ok(s.pillFirst, `${vp.width}: the pill comes before the live tools`)
    ok(s.liveLinks.some(h => h.endsWith('?mode=spirits')), `${vp.width}: the M213 spirit gallery is among the live tools`)
    for (const l of LIVE) ok(s.liveLinks.includes(l), `${vp.width}: live tool ${l} is linked`)
    ok(s.liveLinks.length === LIVE.length + 1, `${vp.width}: live tools = ${LIVE.length} pages + gallery (got ${s.liveLinks.length})`)
    const dead = s.allLinks.filter(h => ARCHIVED.includes(h))
    ok(dead.length === 0, `${vp.width}: no archived route linked on the page${dead.length ? ' (' + dead.join(', ') + ')' : ''}`)
    ok(!s.oldFold, `${vp.width}: no 'Old versions' fold`)
    ok(!s.hscroll, `${vp.width}: no horizontal page scroll`)
    await p.screenshot({ path: `${out}/a-landing-${vp.width}.png` })
  }

  // ── 2. the pill opens the World Builder in place ──
  await go('/shimmer/dev')
  await p.waitForSelector('[data-creative-pill]', { timeout: 60000 })
  await p.click('[data-creative-pill]')
  await sleep(4000)
  const m = await p.evaluate(() => ({ q: location.search, pill: !!document.querySelector('[data-creative-pill]'), tab: [...document.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Creative mode') }))
  ok(m.q.includes('mode=terrain') && !m.pill && m.tab, `the pill opens ?mode=terrain with the Creative mode tab (${m.q})`)
  await sleep(4000)
  await p.screenshot({ path: `${out}/b-creative-mode.png` })

  // ── 3. removed routes and a removed tab ──
  for (const path of ARCHIVED) {
    where = path
    const r = await p.goto(`${url}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => null)
    const landed = new URL(p.url()).pathname
    ok(r?.status() === 404 || landed === '/shimmer/dev', `removed ${path} -> ${r?.status()} ${landed !== path ? '(landed ' + landed + ')' : ''}`)
  }
  await go('/shimmer/dev?mode=map')
  await sleep(1500)
  ok(await p.evaluate(() => !!document.querySelector('[data-creative-pill]')), 'a removed tab (?mode=map) falls back to the index')
  errs.length = 0   // 404 pages are not the sweep's subject

  // ── 4. sweep every kept tool for page errors ──
  const before = () => errs.length
  for (const path of LIVE) {
    const n = before(); const r = await go(path); await sleep(5000)
    ok(r?.status() === 200 && errs.length === n, `kept ${path}: ${r?.status() ?? "no response"}, 0 page errors${errs.length > n ? ' — ' + errs.slice(n).join(' | ') : ''}`)
  }
  for (const mode of KEPT_MODES) {
    const n = before(); const r = await go(`/shimmer/dev?mode=${mode}`); await sleep(5000)
    const active = await p.evaluate(() => !document.querySelector('[data-creative-pill]'))
    ok(r?.status() === 200 && active && errs.length === n, `kept tab ?mode=${mode}: opens, 0 page errors${errs.length > n ? ' — ' + errs.slice(n).join(' | ') : ''}`)
    if (mode === 'spirits' || mode === 'items' || mode === 'evolution') await p.screenshot({ path: `${out}/c-tab-${mode}.png` })
  }
} finally {
  await br.close()
}
console.log(fails ? `FAILED ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
