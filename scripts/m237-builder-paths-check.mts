// ── BETA M237 s4: THE WORLD BUILDER DRAWS THE RE-ROUTED PATHS (owner desktop 1280x900) ── (built on m237-settlements-check)
// READ ONLY against prod (ather.games is Alex's live save): every POST to save-builder is answered IN THE PAGE from a mock (the
// draft is never sent), and the REAL store is hashed before/after: unchanged. Nothing is saved or published.
//   owner: Builder on the Wilds, overlay on (POIs + roads), tool 'Settlements': Bryonydell (s1-10) -> its tile; a REAL drag moves it
//   ~90 m. The top-down tile view then draws a path (`data-path` = `s1-10>~...`, the game's own withRoutes spur via network.ts
//   routeSettlementEdits) that REACHES the moved marker (an end within 30 m) and whose other end meets another path; the same
//   road is in the overlay data Fly and the overview draw (__terrain.overlay.data()); 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m237-builder-paths-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import type { Network } from '../src/app/shimmer/open/ather/network.ts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m237-s4-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const MOVE = 's1-10'
const errs: string[] = [], posts: string[] = []
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
  await o.click('[data-testid="brush-settle"]'); await sleep(500)
  await o.click(`[data-testid="settle-go-${MOVE}"]`)
  await o.waitForFunction(`window.__terrain?.ready === true && (() => { const g = window.__terrain.origin(); const s = window.__terrain.settlements().find(q => q.id === '${MOVE}'); return g && s && Math.abs(s.x - g.x) <= 500 && Math.abs(s.z - g.z) <= 500 })()`, { timeout: 120000, polling: 500 })
  await sleep(2000)
  if (!(await o.evaluate(() => (window as W).__terrain.overlay.on))) { await o.click('[data-testid="overlay-toggle"]'); await sleep(800) }
  ok(!!(await o.$('[data-testid="ov-tile"]')), '0. the overlay (POIs + roads) is drawn on the top-down tile view')
  const bakedHere = await o.$$eval('[data-testid="ov-tile"] polyline[data-road="path"]', p => p.length)
  ok(bakedHere > 0, `0. the baked paths are drawn on this tile (${bakedHere})`)
  // a REAL drag of the marker, ~90 m toward the tile centre
  const org = await o.evaluate(() => (window as W).__terrain.origin()) as { x: number; z: number }
  const cv = (await (await o.$('[data-testid="terrain-canvas"]'))!.boundingBox())!
  const px = (x: number, z: number) => ({ x: cv.x + ((x - org.x + 500) / 1000) * cv.width, y: cv.y + ((z - org.z + 500) / 1000) * cv.height })
  const dx = Math.sign(org.x - m0.x) * 70 || 70, dz = Math.sign(org.z - m0.z) * 55 || 55
  const to = { x: m0.x + dx, z: m0.z + dz }, a = px(m0.x, m0.z), b = px(to.x, to.z)
  await o.mouse.move(a.x, a.y); await o.mouse.down()
  for (let k = 1; k <= 20; k++) { await o.mouse.move(a.x + (b.x - a.x) * k / 20, a.y + (b.y - a.y) * k / 20); await sleep(30) }
  await o.mouse.up(); await sleep(700)
  const mv = (await o.evaluate(() => (window as W).__terrain.settlements()) as any[]).find(s => s.id === MOVE)
  ok(!!mv && Math.hypot(mv.x - to.x, mv.z - to.z) < 6, `1. the drag moved ${MOVE} to (${mv?.x}, ${mv?.z})`)
  // the spur: drawn in the top-down view as a path polyline, from the moved marker to another path
  const sel = `[data-testid="ov-tile"] polyline[data-path^="${MOVE}>"]`
  await o.waitForSelector(sel, { timeout: 90000 }).catch(() => {})
  const drawn = await o.$$eval(sel, ps => ps.map(p => ({ id: p.getAttribute('data-path'), road: p.getAttribute('data-road'), stroke: p.getAttribute('stroke'), pts: (p.getAttribute('points') ?? '').trim().split(/\s+/).map(s => s.split(',').map(Number)) })))
  const spur = drawn[0]
  ok(!!spur, `2. the top-down view draws a path from ${MOVE} (${drawn.map(d => d.id).join(', ') || 'none'})`)
  if (spur && mv) {
    const ends = [spur.pts[0], spur.pts[spur.pts.length - 1]], dS = Math.min(...ends.map(q => Math.hypot(q[0] - mv.x, q[1] - mv.z)))
    ok(dS < 30, `2. it REACHES the moved marker (an end ${dS.toFixed(1)} m from it)`)
    const bakedStroke = await o.$eval('[data-testid="ov-tile"] polyline[data-road="path"]:not([data-path^="s1-10>"])', p => p.getAttribute('stroke')).catch(() => null)
    ok(spur.road === 'path' && spur.stroke === bakedStroke, `2. drawn exactly like a baked path (road=${spur.road}, stroke ${spur.stroke} = ${bakedStroke})`)
    const data = await o.evaluate(() => (window as W).__terrain.overlay.data().roads.filter((r: any) => r.kind === 'path').map((r: any) => ({ id: r.id, pts: r.pts }))) as { id: string; pts: number[][] }[]
    const full = data.find(r => r.id === spur.id)
    const far = full ? full.pts[0][0] === ends[0][0] ? full.pts[full.pts.length - 1] : full.pts[0] : null
    const meets = !!far && data.some(r => r.id !== spur.id && r.pts.some(q => Math.hypot(q[0] - far[0], q[1] - far[1]) < 5))
    ok(!!full, `3. the same road is in the overlay data Fly + the overview draw (${data.length} paths)`)
    ok(meets, '3. its far end meets another path (joined to the network)')
  }
  await o.screenshot({ path: `${out}/desk-builder-spur.png` })
  const after = await store(); const h1 = hashes(after)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `4. the REAL store is untouched (${JSON.stringify(h1)}; ${posts.length} POSTs mocked)`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
