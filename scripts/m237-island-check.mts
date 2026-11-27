// ── BETA M237 s5: THE ISLAND WARNING (owner desktop 1280x900) ── (built on m237-builder-paths-check)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock (the
// draft is never sent), and the REAL store is hashed before/after: unchanged. Nothing is saved or published.
//   owner: Builder on the Wilds, tool 'Settlements': Bryonydell (s1-10) -> its tile; a REAL drag puts it on the shore islet at
//   (220, 920) (settlement-routes.test: no way over the ground). Its marker, its list line and the panel then warn 'no path
//   reaches here'; Publish ASKS (a confirm, answered No here) and nothing is published. A second REAL drag to (-20, 1215) (the s4
//   spot, reached by a spur): every warning goes and Publish asks nothing (its POST answered by the mock); 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m237-island-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import type { Network } from '../src/app/shimmer/open/ather/network.ts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m237-s5-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const MOVE = 's1-10'
const errs: string[] = [], posts: string[] = [], dialogs: string[] = []
const ISLET = { x: 220, z: 920 }, REACHED = { x: -20, z: 1215 }
const bake = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' } as any)).json() as Network
const m0 = bake.settlements.find(s => s.id === MOVE)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const ctx = await br.createBrowserContext(), o: Page = await ctx.newPage()
  o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const store = () => o.evaluate(async () => (await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store', headers: { 'x-m237-real': '1' } })).json()) as Promise<any>
  const hashes = (s: any) => ({ draft: hash(s.draft), live: hash(s.live), v: s.index.live, n: s.index.versions.length })
  const real = await store(); const h0 = hashes(real)
  console.log(`  real store before ${JSON.stringify(h0)}`)
  await o.setRequestInterception(true)
  o.on('request', (r: HTTPRequest) => {
    if (r.url().includes('/shimmer/save-builder') && r.method() === 'POST') {   // never reaches the real store
      posts.push(JSON.parse(r.postData() ?? '{}').action)
      r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, ok: true, draftAt: Date.now() }) }); return
    }
    r.continue()
  })
  await o.goto(`${url}/shimmer/dev?mode=terrain&map=wilds`, { waitUntil: 'load', timeout: 240000 })
  await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "wilds" && !!window.__terrain?.origin() && window.__terrain?.settlements?.().length > 0', { timeout: 240000, polling: 500 })
  await sleep(1500)
  o.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}) })   // Publish's ask: answered No
  await o.click('[data-testid="brush-settle"]'); await sleep(500)
  await o.click(`[data-testid="settle-go-${MOVE}"]`)
  await o.waitForFunction(`window.__terrain?.ready === true && (() => { const g = window.__terrain.origin(); const s = window.__terrain.settlements().find(q => q.id === '${MOVE}'); return g && s && Math.abs(s.x - g.x) <= 500 && Math.abs(s.z - g.z) <= 500 })()`, { timeout: 120000, polling: 500 })
  await sleep(2000)
  if (!(await o.evaluate(() => (window as W).__terrain.overlay.on))) { await o.click('[data-testid="overlay-toggle"]'); await sleep(800) }
  const org = await o.evaluate(() => (window as W).__terrain.origin()) as { x: number; z: number }
  const cv = (await (await o.$('[data-testid="terrain-canvas"]'))!.boundingBox())!
  const px = (x: number, z: number) => ({ x: cv.x + ((x - org.x + 500) / 1000) * cv.width, y: cv.y + ((z - org.z + 500) / 1000) * cv.height })
  const drag = async (from: { x: number; z: number }, to: { x: number; z: number }) => {
    const a = px(from.x, from.z), b = px(to.x, to.z)
    await o.mouse.move(a.x, a.y); await o.mouse.down()
    for (let k = 1; k <= 20; k++) { await o.mouse.move(a.x + (b.x - a.x) * k / 20, a.y + (b.y - a.y) * k / 20); await sleep(30) }
    await o.mouse.up(); await sleep(700)
    return (await o.evaluate(() => (window as W).__terrain.settlements()) as any[]).find(s => s.id === MOVE)
  }
  const warns = () => o.evaluate((id: string) => ({
    marker: !!document.querySelector(`[data-testid="settle-island-${id}"]`), list: !!document.querySelector(`[data-testid="settle-list-island-${id}"]`),
    panel: document.querySelector('[data-testid="settle-island"]')?.textContent ?? null, sel: document.querySelector('[data-testid="settle-sel"]')?.getAttribute('data-id') ?? null,
  }), MOVE)
  // ── the islet ──
  const mv = await drag(m0, ISLET)
  ok(!!mv && Math.hypot(mv.x - ISLET.x, mv.z - ISLET.z) < 6, `1. the drag put ${MOVE} on the islet (${mv?.x}, ${mv?.z})`)
  await o.waitForSelector(`[data-testid="settle-island-${MOVE}"]`, { timeout: 90000 }).catch(() => {})
  const w1 = await warns()
  ok(w1.marker, '2. its MARKER warns (no path reaches here)')
  ok(w1.list, '2. its LIST line warns')
  ok(w1.sel === MOVE && !!w1.panel && /no path reaches here/i.test(w1.panel), `2. the PANEL warns (${(w1.panel ?? 'none').slice(0, 60)})`)
  ok(!(await o.$(`[data-testid="ov-tile"] polyline[data-path^="${MOVE}>"]`)), '2. no spur is drawn to it')
  await o.screenshot({ path: `${out}/desk-island-warning.png` })
  const p0 = posts.filter(a => a === 'publish').length
  const pub1 = await o.evaluate(() => (window as W).__terrain.publish()) as boolean
  ok(dialogs.length === 1 && /no path reaches/i.test(dialogs[0]) && dialogs[0].includes(mv?.name ?? 'Bryonydell'), `3. Publish ASKS first (${dialogs[0] ?? 'no dialog'})`)
  ok(pub1 === false && posts.filter(a => a === 'publish').length === p0, `3. answered No: nothing published (publish() = ${pub1}, publish POSTs ${posts.filter(a => a === 'publish').length - p0})`)
  // ── a reachable spot ──
  const mv2 = await drag(ISLET, REACHED)
  ok(!!mv2 && Math.hypot(mv2.x - REACHED.x, mv2.z - REACHED.z) < 6, `4. the second drag moved it to (${mv2?.x}, ${mv2?.z})`)
  await o.waitForSelector(`[data-testid="ov-tile"] polyline[data-path^="${MOVE}>"]`, { timeout: 90000 }).catch(() => {})
  await o.waitForFunction((id: string) => !document.querySelector(`[data-testid="settle-island-${id}"]`), { timeout: 30000, polling: 300 }, MOVE).catch(() => {})
  const w2 = await warns()
  ok(!w2.marker && !w2.list && !w2.panel, `5. reached: no warning on the marker, the list or the panel (${JSON.stringify({ m: w2.marker, l: w2.list, p: !!w2.panel })})`)
  const pub2 = await o.evaluate(() => (window as W).__terrain.publish()) as boolean
  ok(dialogs.length === 1 && pub2 === true && posts.filter(a => a === 'publish').length === p0 + 1, `6. reached: Publish asks nothing (dialogs ${dialogs.length}, publish() = ${pub2}, POST answered by the mock)`)
  await o.screenshot({ path: `${out}/desk-reached-no-warning.png` })
  const after = await store(); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `7. the REAL store is untouched (${JSON.stringify(h1)}; ${posts.length} POSTs mocked)`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `8. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
