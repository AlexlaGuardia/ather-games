// M37 slice 4 check (plot-bom-check): a drawn plan is a DRAFT with a bill of materials; Build needs it all.
//   1. draw a 5x4 room with a SHORT bag: 18 draft pieces, list = 38 goldwood planks + 20 stone bricks, have < need, Build disabled,
//      nothing spent, room not built (no floor / roof)
//   2. SETUP (stated): the test guest's own localStorage bag is topped up to the list, then reload: the draft survives, Build lights
//   3. Build: bag spent exactly, walls built (no draft), room built, list gone; reload keeps it
//   4. Erase one built piece: its plank comes back; erase the whole top wall: the room's floor planks + roof bricks come back too
//   5. grandfather: an old-format save (built walls, no draft, no paid) reloads built, no list; 0 page errors.
// The bag is the test guest's own (fresh browser context, localStorage); Alex's real items are never touched.
//   npx tsx scripts/plot-bom-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plot-bom')
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
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('house')) return; sessionStorage.setItem('house', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 5 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.removeItem('open.works.v1')
  })
  const count = (id: string) => p.evaluate((i: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === i ? s.n : 0), 0), id)
  const planks = () => count('goldwood_plank')
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

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  ok(await enterPlan(), 'E at the table, Plan: flying')
  await tap('[data-tool="walls"]'); await sleep(400)
  const p0 = await planks()
  await dragW(X0, Z0, X1, Z0); await dragW(X0, Z1, X1, Z1); await dragW(X0, Z0, X0, Z1); await dragW(X1, Z0, X1, Z1)
  const w1 = await walls(), d1 = await draftCount(), b1 = await bom()
  ok(!!w1 && w1.rooms.length === 1 && w1.rooms[0].cells === 20, `1. four sides close one 5x4 room (${JSON.stringify(w1?.rooms)})`)
  ok(d1.total === 18 && d1.draft === 18 && d1.paid === 0, `   18 pieces, all draft, none paid (${JSON.stringify(d1)})`)
  ok(p0 === await planks(), `   drawing spent nothing (${p0} planks before and after)`)
  ok(!!b1 && b1.lines.goldwood_plank?.need === 38 && b1.lines.stone_brick?.need === 20 && Object.keys(b1.lines).length === 2, `   the list: 38 goldwood planks + 20 stone bricks (${JSON.stringify(b1?.lines)})`)
  ok(!!b1 && b1.lines.goldwood_plank.have === 5 && b1.lines.stone_brick.have === 0 && b1.lines.goldwood_plank.short && b1.lines.stone_brick.short, '   have / need: 5 of 38 planks, 0 of 20 bricks, both short (red)')
  ok(!!b1 && b1.disabled && !b1.ready, '   Build is disabled while short')
  ok(w1?.rooms[0].built === false, '   the room is not built (no floor, no roof yet)')
  await shot('bom-1-short')
  // 2. SETUP: top the test guest's own bag up to the list, reload
  await p.evaluate(() => {
    const inv = JSON.parse(localStorage.getItem('open.inv.v1')!); inv.slots[8] = { id: 'goldwood_plank', n: 40 }; inv.slots[9] = { id: 'stone_brick', n: 20 }
    localStorage.setItem('open.inv.v1', JSON.stringify(inv))
  })
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  const d2 = await draftCount(); ok(d2.draft === 18, `2. the plan survives a reload as a draft (${d2.draft} of ${d2.total})`)
  ok(await enterPlan(), '   Plan again')
  ok(await poll(async () => (await bom())?.ready === true, 15000), '   with the parts in the bag the list is met and Build lights')
  const b2 = await bom(); ok(!!b2 && !b2.disabled && b2.lines.goldwood_plank.have === 40 && b2.lines.stone_brick.have === 20, `   have / need now 40/38 planks and 20/20 bricks (${JSON.stringify(b2?.lines)})`)
  await shot('bom-2-ready')
  // 3. Build
  ok(await tap('[data-act="build-plan"] button'), '3. tap Build')
  ok(await poll(async () => (await draftCount()).draft === 0), '   every piece is built (no draft)')
  const d3 = await draftCount(); ok(d3.total === 18 && d3.paid === 1, `   18 pieces stand and the room is paid (${JSON.stringify(d3)})`)
  ok((await planks()) === 2 && (await count('stone_brick')) === 0, `   the list was spent exactly: 40-38 = 2 planks, 0 bricks (${await planks()}, ${await count('stone_brick')})`)
  ok(await poll(async () => (await walls())?.rooms[0]?.built === true), '   the room is built (floor + roof stand)')
  ok(await poll(async () => (await bom()) === null), '   the list is gone once built')
  await shot('bom-3-built')
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  ok(await poll(async () => { const w = await walls(); return !!w && w.rooms.length === 1 && w.rooms[0].built }, 30000) && (await draftCount()).draft === 0, '   a reload keeps the built house')
  // 4. erase: one piece, then the whole top wall (the room stops closing)
  await enterPlan(); await tap('[data-tool="erase"]'); await sleep(400)
  const e0 = await planks()
  await dragW(X0 + 1, Z0, X0 + 3, Z0)
  ok(await poll(async () => (await planks()) - e0 === 2), `4. erasing 2 built metres refunds 2 planks (${(await planks()) - e0})`)
  const e1 = await planks()
  await dragW(X0, Z0, X1, Z0)   // the rest of the top wall: 3 more pieces, and the room no longer closes
  ok(await poll(async () => (await count('stone_brick')) === 20), `   the broken room gives its roof back: 20 bricks (${await count('stone_brick')})`)
  ok((await planks()) - e1 === 3 + 20, `   and its floor: 3 pieces + 20 floor planks = 23 (${(await planks()) - e1})`)
  ok((await draftCount()).paid === 0, '   the room is no longer recorded as built')
  await shot('bom-4-erased')
  // 5. grandfather: strip draft + paid from what is saved, as a pre-slice-4 save would be; re-draw nothing
  await p.evaluate((x0: number, x1: number, z0: number, z1: number) => {
    const w = JSON.parse(localStorage.getItem('open.works.v1')!); delete w.paid
    const sq: Record<string, unknown> = {}; for (const [k, v] of Object.entries(w.walls ?? {})) sq[k] = { mat: (v as any).mat, ...(((v as any).kind) ? { kind: (v as any).kind } : {}) }
    // put the whole 5x4 box back as plain built walls (the old shape), then reload
    for (let i = x0; i < x1; i++) { sq[`h,${i},${z0}`] = { mat: 'goldwood' }; sq[`h,${i},${z1}`] = { mat: 'goldwood' } }
    for (let j = z0; j < z1; j++) { sq[`v,${x0},${j}`] = { mat: 'goldwood' }; sq[`v,${x1},${j}`] = { mat: 'goldwood' } }
    w.walls = sq; localStorage.setItem('open.works.v1', JSON.stringify(w))
  }, X0, X1, Z0, Z1)
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await enterPlan()
  ok(await poll(async () => { const w = await walls(); return !!w && w.rooms.length === 1 && w.rooms[0].built === true }, 30000), '5. an old-format house (built walls, no draft, no paid) reloads as BUILT: floor and roof stand')
  ok((await bom()) === null, '   and puts nothing on the list (grandfathered, never un-built)')
  ok(errs.length === 0, `   0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
