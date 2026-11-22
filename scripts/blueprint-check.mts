// ── M39 slice 1: BLUEPRINTS, OWNER SAVE -> GLADE (world d5a9e927, 11-19). As the owner (OWNER_KEY cookie), on the plot in plan
// mode: draw a 5 x 4 building with real drags, the Blueprint tool + a tap on one of its walls picks it (bar: 5 x 4 m, fits a
// lot), pick a lot with NO saved blueprint (never overwrites Alex's), Save; it reads back from the public route; at the Glade
// that lot stands the blueprint instead of its blockout. The test save is always set aside in a finally (DELETE).
// (M67 s1b-3: the Glade is the closed Glade, zone 'glade', in Greg's garden; the lots stand there as backdrop and the keeper goes
// by the real __ather.travel({ kind: 'glade' }), not the Wilds waymark. The lot is looked at from the green, in Glade coords.)
//   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/blueprint-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { lotAt } from '../src/app/shimmer/open/ather/moonwell-glade'
import { GLADE_GREEN } from '../src/app/shimmer/open/ather/moonwell'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/blueprint-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const W = 1100, H = 680, PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [14, 12, 10, 8]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const X0 = spot.x - 2, X1 = spot.x + 3, Z0 = spot.z - 2, Z1 = spot.z + 2   // 5 x 4
console.log(`room ${X0}..${X1} x ${Z0}..${Z1}`)
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, GROUND_Y, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}


const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let saved: string | null = null
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set: set -a; . /root/ather-games/.env; set +a'); process.exit(2) }
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
try {
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('bp')) return; sessionStorage.setItem('bp', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 30 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })); localStorage.removeItem('open.works.v1')
  })
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 60000 })
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - spot!.x, a.z - spot!.z) < 0.2 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const dragW = async (ax: number, az: number, bx: number, bz: number) => { await settled(); const v = await view(), a = screenOf(v, ax, az), b = screenOf(v, bx, bz); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); await sleep(900) }
  const tapW = async (x: number, z: number) => { await settled(); const v = await view(), a = screenOf(v, x, z); await p.mouse.click(a.x, a.y); await sleep(900) }
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow */ } }
  await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)), 'the harness is the owner')
  // a lot with no blueprint of Alex's (never overwrite his drawing)
  let lot: string | null = null
  for (const l of ['hazel', 'sax', 'yarrow', 'mallow', 'fennel']) { const st = await p.evaluate((id: string) => fetch(`/shimmer/open/house-blueprints?id=${id}`, { cache: 'no-store' }).then(r => r.status), `glade-${l}`); if (st === 404) { lot = l; break } }
  if (!lot) { ok(false, 'a lot without a saved blueprint to test on (all five have Alex\'s: nothing to do)'); throw new Error('no free lot') }
  console.log(`testing on ${lot}'s lot`)
  await p.mouse.click(550, 340); await sleep(500)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)
  await tap('[data-tool="walls"]'); await sleep(300)
  await dragW(X0, Z0, X1, Z0); await dragW(X0, Z1, X1, Z1); await dragW(X0, Z0, X0, Z1); await dragW(X1, Z0, X1, Z1)
  ok(await tap('[data-tool="blueprint"]'), '1. the owner sees the Blueprint tool'); await sleep(300)
  await tapW(X0 + 2.5, Z1)   // the NEAR wall: the far one sits under the build bar on screen (the click hit the bar)
  console.log('  diag:', JSON.stringify(await p.evaluate(() => ({ walls: Object.keys(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}).length, tool: (window as any).__build.tool(), drawer: (window as any).__build.drawer(), bar: document.querySelector('[data-bp-bar]')?.textContent ?? null }))))
  await shot('bp-0-after-tap')
  const size = await p.evaluate(() => document.querySelector('[data-bp-size]')?.textContent ?? '')
  const fits = await p.evaluate(() => document.querySelector('[data-bp-fits]')?.getAttribute('data-bp-fits'))
  ok(/^5 x 4 m · 18 pieces/.test(size) && fits === 'true', `   a tap on a wall picks the building: ${size}, fits a lot: ${fits}`)
  await p.select('#bp-lot', lot); await sleep(300)
  await shot('bp-1-bar')
  const resp = p.waitForResponse(r => r.url().includes('/shimmer/save-house-blueprint') && r.request().method() === 'POST', { timeout: 30000 })
  await tap('[data-act="bp-save"]')
  const r = await resp; saved = `glade-${lot}`
  ok(r.ok(), `2. Save blueprint: the owner route took it (${r.status()})`)
  const got = await p.evaluate((id: string) => fetch(`/shimmer/open/house-blueprints?id=${id}`, { cache: 'no-store' }).then(r => r.json()), saved)
  ok(got?.w === 5 && got?.d === 4 && Object.keys(got.walls ?? {}).length === 18, `   it reads back from the public route (${got?.w}x${got?.d})`)
  // 3. the Glade stands it on that lot
  await tap('[data-act="land"]'); await sleep(800)
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await p.evaluate(() => (window as any).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }   // M67: the Glade is its own zone, not the Wilds' waymark
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'glade'), 240000), 'off to the Glade (zone glade)')
  ok(await poll(async () => ((await p.evaluate(() => (window as any).__glade?.blueprints?.() ?? [])) as string[]).includes(lot!), 30000), `3. ${lot}'s lot stands the blueprint instead of the blockout`)
  const l = lotAt(lot)!
  const face = Math.atan2(-(l.x - GLADE_GREEN.x), -(l.z - GLADE_GREEN.z))
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), GLADE_GREEN.x + (l.x - GLADE_GREEN.x) * 0.45, GLADE_GREEN.z + (l.z - GLADE_GREEN.z) * 0.45, face); await sleep(2500)
  await shot('bp-2-glade')
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally {
  if (saved) { const st = await p.evaluate((id: string) => fetch(`/shimmer/save-house-blueprint?id=${id}`, { method: 'DELETE' }).then(r => r.status), saved).catch(() => 0); console.log(`cleanup: test blueprint ${saved} set aside (${st})`) }
  await br.close()
}
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
