// ── BETA AUDIT, pass 1: the stranger's first minutes (2026-11-16, play lane) ─────────────────────────────────────
// A brand-new visitor on a PHONE (fresh profile, touch, 390x844) lands on ather.games, taps Play, and waits.
// Records what a stranger would meet: load times, what's on screen, every page error / console error / failed
// request, and a screenshot per beat. Observes only: no __ather hooks are CALLED (their keys are listed).
//   npx tsx scripts/beta-audit.mts [--url https://ather.games] [--out /tmp/beta]
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/beta')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.createBrowserContext()   // fresh profile: no storage, no cookies
const p = await ctx.newPage()
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const log: { t: number; kind: string; msg: string }[] = []
const t0 = Date.now(); const T = () => Math.round((Date.now() - t0) / 100) / 10
p.on('pageerror', e => log.push({ t: T(), kind: 'pageerror', msg: String(e).slice(0, 300) }))
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') log.push({ t: T(), kind: `console.${m.type()}`, msg: m.text().slice(0, 300) }) })
p.on('response', r => { if (r.status() >= 400) log.push({ t: T(), kind: `http${r.status()}`, msg: r.url().slice(0, 200) }) })
p.on('requestfailed', r => log.push({ t: T(), kind: 'reqfail', msg: `${r.failure()?.errorText} ${r.url().slice(0, 200)}` }))
const beats: Record<string, unknown>[] = []
const visible = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s+\n/g, '\n').trim().slice(0, 1500))
const beat = async (name: string, extra: Record<string, unknown> = {}) => {
  await p.screenshot({ path: `${out}/${String(beats.length).padStart(2, '0')}-${name}.png` }).catch(() => {})
  const panels = await p.evaluate(() => [...document.querySelectorAll('[data-panel]')].map(e => e.getAttribute('data-panel'))).catch(() => [])
  beats.push({ t: T(), name, url: p.url(), panels, text: await visible().catch(() => '?'), ...extra })
  console.log(`[${T()}s] ${name}  ${p.url()}  panels=${JSON.stringify(panels)}`)
}

// 1. the home page
let s = Date.now()
await p.goto(url, { waitUntil: 'load', timeout: 180000 })
await beat('home', { loadMs: Date.now() - s })
// 2. tap the Play link a stranger would tap
let play = null
for (const a of await p.$$('a[href="/shimmer/open/ather"]')) if (await a.isVisible()) { play = a; break }
const playText = play ? await play.evaluate(e => (e as HTMLElement).innerText.trim()) : null
s = Date.now()
if (play) { await play.tap(); } else { await p.goto(`${url}/shimmer/open/ather`) }
await beat('tapped-play', { found: !!play, playText })
// 3. watch the world come up; note when the hooks appear (= the scene is live)
let liveAt: number | null = null
for (let i = 0; i < 12; i++) {
  await sleep(10000)
  if (liveAt == null && await p.evaluate(() => !!(window as any).__ather?.open).catch(() => false)) liveAt = Date.now() - s
  await beat(`wait-${(i + 1) * 10}s`, { liveMs: liveAt })
}
const hooks = await p.evaluate(() => Object.keys((window as any).__ather ?? {})).catch(() => [])
const storage = await p.evaluate(() => Object.keys(localStorage)).catch(() => [])
const mem = await p.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null).catch(() => null)
writeFileSync(`${out}/audit.json`, JSON.stringify({ url, liveMs: liveAt, hooks, storage, heapMB: mem && Math.round(mem / 1e6), beats, log }, null, 1))
console.log(JSON.stringify({ liveMs: liveAt, hooks, storage, heapMB: mem && Math.round(mem / 1e6), errors: log.length }, null, 1))
await b.close()
