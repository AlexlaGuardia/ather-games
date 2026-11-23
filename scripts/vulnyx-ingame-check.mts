// ── M102 THE VULNYX IN GAME, OWNER-ONLY (2026-11-23, sprites-vulnyx-ingame) ─────────────────────────────────────────
// SETUP (stated): a Spirit Planter at (-130, 102.5) whose pot already BLOOMED (seeded in open.works.v1 + the book's pots).
//  A. owner cookie + ?spirits=3d: window.__spiritModel.mounted >= 1 (the group named 'spirit-model-vulnyx' is in the scene),
//     the glb answers 200, 0 page errors, frame time at 390x844 noted (SwiftShader, not a phone).
//  B. owner, NO flag: nothing mounted (the orb, as today).   C. NOT owner + ?spirits=3d: nothing mounted.
//  --shots <dir>: phone far / phone near / desktop / night (hour 21) from the owner + flag run.
//   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/vulnyx-ingame-check.mts [--url http://localhost:3202] [--shots dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', '')
if (shots) mkdirSync(shots, { recursive: true })
const OWNER_KEY = process.env.OWNER_KEY
if (!OWNER_KEY) { console.error('OWNER_KEY not set: set -a; . /root/ather-games/.env; set +a'); process.exit(2) }
const P = { x: -130, z: 102.5 }
const PLANTER = { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})

async function run(owner: boolean, withFlag: boolean, w = 390, h = 844, hour = 14) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  let glb = 0; p.on('response', r => { if (r.url().includes('/open/spirits/vulnyx.glb')) glb = r.status() })
  if (owner) {
    // /owner redirects to siteOrigin (prod) even on a devwin, so hit it without following, then read /api/owner ON this origin
    await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(OWNER_KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    const o = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
    if (!o) { ok(false, 'owner cookie took'); await p.close(); return null }
  }
  await p.evaluateOnNewDocument((piece: unknown, bloomAt: number) => {
    if (sessionStorage.getItem('vxc')) return; sessionStorage.setItem('vxc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [piece] }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: bloomAt }], pots: { 'vx-check': { seed: 'mana_seed_fox', at: bloomAt, bloomed: true } }, met: [] }))
  }, PLANTER, Date.now() - BLOOM_MS - 60000)
  await p.goto(`${url}/shimmer/open/ather?hour=${hour}${withFlag ? '&spirits=3d' : ''}`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), P.x, P.z)
  await sleep(owner && withFlag ? 9000 : 6000)
  const mounted = await p.evaluate(() => (window as any).__spiritModel?.mounted ?? 0) as number
  return { p, errs, glb: () => glb, mounted }
}
const shot = async (p: Page, name: string) => { await hideCard(p); await sleep(400); try { await p.screenshot({ path: `${shots}/${name}.png` }) } catch { /* slow frame */ } }
const look = async (p: Page, dz: number, dx = 0) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), P.x + dx, P.z + dz); await sleep(2000); await aimAt(p, P.x, P.z, 0.85); await sleep(1500) }

// A. owner + flag (phone)
const a = await run(true, true)
if (a) {
  ok(a.mounted >= 1, `A owner + ?spirits=3d: Vulnyx mounted on the bloomed planter (mounted=${a.mounted})`)
  ok(a.glb() === 200, `A glb /open/spirits/vulnyx.glb answered ${a.glb()}`)
  await look(a.p, 4.5)
  const fps = await a.p.evaluate(`new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / 5) } requestAnimationFrame(f) })`) as number
  console.log(`   frame: ${fps.toFixed(2)} fps = ${(1000 / fps).toFixed(0)} ms/frame at 390x844 near the planter (SwiftShader, not a phone)`)
  if (shots) { await shot(a.p, 'phone-far'); await look(a.p, 1.9, 0.5); await shot(a.p, 'phone-near') }
  ok(a.errs.length === 0, `A 0 page errors ${a.errs.join(' | ')}`)
  await a.p.close()
}
// B. owner, no flag
const b = await run(true, false)
if (b) { ok(b.mounted === 0, `B owner, no flag: nothing mounted (mounted=${b.mounted})`); ok(b.errs.length === 0, `B 0 page errors ${b.errs.join(' | ')}`); await b.p.close() }
// C. not owner + flag
const c = await run(false, true)
if (c) { ok(c.mounted === 0, `C not owner + ?spirits=3d: nothing mounted (mounted=${c.mounted})`); ok(c.errs.length === 0, `C 0 page errors ${c.errs.join(' | ')}`); await c.p.close() }
if (shots) {
  const d = await run(true, true, 1280, 800)
  if (d) { await look(d.p, 3.2, 0.8); await shot(d.p, 'desk'); await d.p.close() }
  const n = await run(true, true, 390, 844, 21)
  if (n) { await look(n.p, 2.6, 0.5); await shot(n.p, 'night'); await n.p.close() }
}
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
