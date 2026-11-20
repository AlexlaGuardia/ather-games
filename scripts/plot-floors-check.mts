// M47 slice 1 check (plot-floors-check): the house in stacked LEVELS.
//   1. draw a floor-1 room (4x3, goldwood), switch to floor 2 (the plan-bar 1/2/3), draw a room on the slab over it
//   2. a wall on floor 2 that floats over open ground is refused (nothing saved)
//   3. the cutaway: editing floor 1 hides floor 2, editing floor 2 shows both (floor 1 as a low guide)
//   4. Build spends BOTH levels' drafts (one list); the bag drops by exactly the list
//   5. test teleport (__ather.tp with a height) onto floor 2: feet stand ~ one storey (3.4 m) up on the slab
//   6. reload keeps both levels, still built, floor 2 still stands
//   7. an OLD save (no `upper`) loads as one level. 0 page errors.
//   npx tsx scripts/plot-floors-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plot-floors')
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
const X0 = spot.x - 2, X1 = spot.x + 2, Z0 = spot.z - 1, Z1 = spot.z + 2   // 4 x 3
console.log(`room ${X0}..${X1} x ${Z0}..${Z1}`)
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number, wy = GROUND_Y) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, wy, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('house')) return; sessionStorage.setItem('house', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 120 }; slots[9] = { id: 'stone_brick', n: 60 }; slots[10] = { id: 'stucco', n: 30 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.removeItem('open.works.v1')
  })
  const count = (id: string) => p.evaluate((i: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === i ? s.n : 0), 0), id)
  const bom = () => p.evaluate(() => { const e = document.querySelector('[data-plan-bom]'); if (!e) return null; const b = e.querySelector<HTMLButtonElement>('[data-act="build-plan"] button'); return { ready: e.getAttribute('data-ready') === 'true', disabled: !!b?.disabled, lines: Object.fromEntries([...e.querySelectorAll('[data-bom-line]')].map(l => [l.getAttribute('data-bom-line'), { need: +l.getAttribute('data-need')!, have: +l.getAttribute('data-have')!, short: l.getAttribute('data-short') === 'true' }])) } })
  const draftCount = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { total: Object.keys(w.walls ?? {}).length, draft: Object.values(w.walls ?? {}).filter((x: any) => x.draft).length, paid: Object.keys(w.paid ?? {}).length } })
  const enterPlan = async () => { await p.mouse.click(550, 340); await sleep(600); await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500); await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]'); const r = await poll(() => p.evaluate(() => (window as any).__build?.on() === true)); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot!.x, spot!.z); return r }
  const saved = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: Object.keys(w.walls ?? {}).length, roof: w.roof } })
  const savedFull = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: (w.walls ?? {}) as Record<string, { mat: string; kind?: string }>, floors: (w.floors ?? {}) as Record<string, string> } })
  const walls = () => p.evaluate(() => { const w = (window as any).__walls; return w ? { rooms: w.rooms(), down: w.down(), roof: w.roof() } : null })
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - spot!.x, a.z - spot!.z) < 0.2 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const dragW = async (ax: number, az: number, bx: number, bz: number) => {
    await settled(); const v = await view(), a = screenOf(v, ax, az), b = screenOf(v, bx, bz)
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); await sleep(900)
  }

  const count2 = (id: string) => count(id)

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  ok(await enterPlan(), 'E at the table, Plan: flying')
  await tap('[data-tool="walls"]'); await sleep(300)
  const works = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'))
  const floors = () => p.evaluate(() => { const f = (window as any).__floors; return f ? { shown: f.shown() as number[], editing: f.editing() as number, count: f.count() as number } : null })
  const dc = (sel: string) => p.evaluate((x: string) => { document.querySelector<HTMLElement>(x)?.click() }, sel)
  const STOREY = 3.4
  // a drag on floor `lv`: the pointer's plane is that floor's, so project the points at its height
  const dragL = async (lv: number, ax: number, az: number, bx: number, bz: number) => {
    await settled(); const v = await view(), y = GROUND_Y + lv * STOREY, a = screenOf(v, ax, az, y), b = screenOf(v, bx, bz, y)
    // the plan bars can sit over the house at this zoom: let the pointer through them for the drag (the buttons are DOM-clicked)
    const bars = '[data-build-bar],[data-plan-bom],[data-floor-switch]'
    await p.evaluate((q: string) => document.querySelectorAll<HTMLElement>(q).forEach(e => { e.style.pointerEvents = 'none' }), bars)
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); await sleep(900)
    await p.evaluate((q: string) => document.querySelectorAll<HTMLElement>(q).forEach(e => { e.style.pointerEvents = 'auto' }), bars)
  }
  const room = async (lv: number) => { await dragL(lv, X0, Z0, X1, Z0); await dragL(lv, X0, Z1, X1, Z1); await dragL(lv, X0, Z0, X0, Z1); await dragL(lv, X1, Z0, X1, Z1) }
  const cnt = (w: any) => ({ g: Object.keys(w.walls ?? {}).length, u: Object.keys(w.upper?.[0]?.walls ?? {}).length })
  // 1. floor 1 room, then floor 2 over it
  ok((await p.evaluate(() => document.querySelectorAll('[data-floor]').length)) === 3, '1. the plan bar has a 1/2/3 floor switcher')
  await room(0)
  let w1 = await works(); ok(cnt(w1).g === 14 && cnt(w1).u === 0, `   floor 1: a 4x3 room drafted (14 pieces) (${JSON.stringify(cnt(w1))})`)
  await dc('[data-floor="1"]'); await sleep(500)
  ok((await floors())?.editing === 1, '   switched to floor 2')
  // 2. a floating wall (open ground well off the house) is refused: drag a 2 m run 6 m past the room
  await dragL(1, X0, Z1 + 5, X0 + 2, Z1 + 5)
  w1 = await works(); ok(cnt(w1).u === 0, `2. a wall on floor 2 over open ground floats: refused, nothing saved (${cnt(w1).u})`)
  await room(1)
  w1 = await works(); ok(cnt(w1).g === 14 && cnt(w1).u === 14, `   floor 2: a room drawn on the slab over floor 1 (${JSON.stringify(cnt(w1))})`)
  await shot('floors-1-both-planned')
  // 3. the cutaway
  const both = await floors()
  ok(!!both && both.editing === 1 && both.shown.join() === '0,1', `3. editing floor 2 shows floors 1 and 2 (${JSON.stringify(both)})`)
  await dc('[data-floor="0"]'); await sleep(600)
  const only = await floors()
  ok(!!only && only.editing === 0 && only.shown.join() === '0', `   editing floor 1 hides floor 2 (${JSON.stringify(only)})`)
  await shot('floors-2-cutaway')
  // 4. Build spends both
  const before = { p: await count2('goldwood_plank'), b: await count2('stone_brick') }
  const bomv = await p.evaluate(() => { const e = document.querySelector('[data-plan-bom]'); return e ? { ready: e.getAttribute('data-ready') === 'true', lines: Object.fromEntries([...e.querySelectorAll('[data-bom-line]')].map(l => [l.getAttribute('data-bom-line'), +(l.getAttribute('data-need') ?? 0)])) } : null })
  ok(!!bomv && bomv.ready && bomv.lines.goldwood_plank === 52 && bomv.lines.stone_brick === 12, `4. one list for both floors: 52 planks (2 x 14 wall + 2 x 12 floor), 12 bricks (ground roof only) (${JSON.stringify(bomv)})`)
  ok(await tap('[data-act="build-plan"] button'), '   tap Build')
  ok(await poll(async () => { const w = await works(); return Object.values(w.walls ?? {}).every((x: any) => !x.draft) && Object.values(w.upper?.[0]?.walls ?? {}).length === 14 && Object.values(w.upper[0].walls).every((x: any) => !x.draft) && Object.keys(w.upper[0].paid ?? {}).length === 1 && Object.keys(w.paid ?? {}).length === 1 }, 15000), '   both floors stand built, both rooms paid')
  const after = { p: await count2('goldwood_plank'), b: await count2('stone_brick') }
  ok(before.p - after.p === 52 && before.b - after.b === 12, `   spent exactly the list: planks -${before.p - after.p}, bricks -${before.b - after.b}`)
  await shot('floors-3-built')
  // 5. leave plan mode, teleport up (dev hook: __ather.tp takes a height) and stand on floor 2
  await dc('[data-act="land"]'); await sleep(1200)
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2
  const stand = async () => { await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, 0, y), cx, cz, GROUND_Y + STOREY + 0.8); await sleep(1500)
    // swiftshader frames are slow: wait until the feet stop moving (landed), then read them
    let last = 1e9, st: any = null
    for (let n = 0; n < 40; n++) { st = await p.evaluate(() => (window as any).__ather.state()); if (Math.abs(st.py - last) < 0.005) break; last = st.py; await sleep(1000) }
    return st }
  let st = await stand()
  ok(Math.abs(st.py - (GROUND_Y + STOREY)) < 0.25, `5. standing on floor 2: feet y ${st.py?.toFixed?.(2)} vs ${(GROUND_Y + STOREY).toFixed(2)} (one storey up on the slab)`)
  await shot('floors-4-upstairs')
  // 6. reload keeps it
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  const w6 = await works()
  ok(cnt(w6).g === 14 && cnt(w6).u === 14 && Object.values(w6.upper[0].walls).every((x: any) => !x.draft), '6. a reload keeps both floors, built')
  st = await stand()
  ok(Math.abs(st.py - (GROUND_Y + STOREY)) < 0.25, `   and floor 2 still holds the keeper after the reload (feet y ${st.py?.toFixed?.(2)})`)
  const fl = await floors(); ok(!!fl && fl.count === 2, `   the scene stands ${fl?.count} levels`)
  // 7. an old save (no upper) loads as one level, unchanged
  await p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); delete w.upper; localStorage.setItem('open.works.v1', JSON.stringify(w)) })
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
  const w7 = await works(), f7 = await poll(async () => (await floors())?.count === 1, 20000)
  ok(f7 && cnt(w7).g === 14 && !w7.upper, '7. a save with no `upper` loads as ONE level, the ground floor unchanged')
  ok(errs.length === 0, `   0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
