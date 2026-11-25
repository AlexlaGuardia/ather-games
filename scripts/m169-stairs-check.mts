// BETA M169 s3 on prod: STAIRS (railings optional), RAILINGS, a FENCE + GATE in the same rail style, a RAMP, on a TEST keeper's plot.
// PHONE 390x844 + DESKTOP 1280x760, fresh profile (a new keeper: 40 planks in the bag; nothing on the plot). Every POST is answered in
// the page: nothing written.
//  1 plan mode's catalog: Stairs / Railings + fences / Ramps + ladders, every card with its icon  2 a wide wall panel, a railed stair
//  with its back to it, a ramp, fence | gate | fence planned; Build pays 3 + 18 + 10 + 2 + 2 + 2 planks  3 reload: all stand, the gate
//  shut  4 the keeper walks up the stair to the wall top (4.8 m)  5 half way up, pushing sideways, the railing holds her on the stair
//  6 up the ramp (1.2 m)  7 the shut gate stops her; E opens it; she walks through; reload: open stays open; E from the far side
//  shuts it, reload: shut stays shut  8 0 page errors
//   npx tsx scripts/m169-stairs-check.mts [--url ...] [--out dir] [--only phone|desktop]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { buildCatalog } from '../src/app/shimmer/open/ather/build-catalog'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m169s')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
let W = 390, H = 844; const PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

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
const X0 = spot.x - 3, X1 = spot.x + 3, Z0 = spot.z - 3, Z1 = spot.z + 3   // 6 x 6
console.log(`room ${X0}..${X1} x ${Z0}..${Z1}`)
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number, wy = 0) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, GROUND_Y + wy, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const RZ = (Z0 + Z1) / 2   // the run beside the house
async function run(PHONE: boolean) {
  W = PHONE ? 390 : 1280; H = PHONE ? 844 : 760; const N = PHONE ? 'phone' : 'desktop'
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: W, height: H, isMobile: true, hasTouch: true } : { width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  // SETUP: an OLD save: one placed slab (45 deg), two crafted slabs in the bag, a carpentry, planks + bricks; a built 6 x 6 room
  const works = { v: 1, rooms: [], chests: [], pieces: [] }
  await p.evaluateOnNewDocument((works: string) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m169s')) return; sessionStorage.setItem('m169s', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 20 }; slots[9] = { id: 'goldwood_plank', n: 20 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const read = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'))
  const planks = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(s => s?.id === 'goldwood_plank').reduce((a, s) => a + s.n, 0))
  const stores = () => p.evaluate(() => JSON.stringify([(JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots), Object.keys(localStorage).filter(k => /bank/.test(k)).sort().map(k => localStorage.getItem(k))]))
  const drafts = (w: any) => [w.walls, w.cols, ...(w.upper ?? []).map((u: any) => u.walls)].flatMap(m => Object.entries(m ?? {})).filter(([, v]: any) => v.draft).map(([k]) => k)
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tapEl = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await (PHONE ? p.touchscreen : { tap: (x: number, y: number) => p.mouse.click(x, y) }).tap(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const unblock = (x: number, y: number) => p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y)
  const reblock = () => p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
    await unblock(a.x, a.y); await unblock(b.x, b.y)
    if (PHONE) { await p.touchscreen.touchStart(a.x, a.y); for (let n = 1; n <= 10; n++) { await p.touchscreen.touchMove(a.x + (b.x - a.x) * n / 10, a.y + (b.y - a.y) * n / 10); await sleep(40) } await p.touchscreen.touchEnd() }
    else { await p.mouse.move(a.x, a.y); await p.mouse.down(); for (let n = 1; n <= 10; n++) { await p.mouse.move(a.x + (b.x - a.x) * n / 10, a.y + (b.y - a.y) * n / 10); await sleep(40) } await p.mouse.up() }
    await reblock(); await sleep(900)
  }
  const line = async (x0: number, z0: number, x1: number, z1: number) => { await settled(); const v = await view(); await drag(screenOf(v, x0, z0), screenOf(v, x1, z1)) }
  const grid = () => p.evaluate(() => { const g = (window as any).__planGrid; return g ? { seg: g.segments, lv: g.lv, id: g.id, y: g.y() } : null })
  const has = (x: number, z: number) => p.evaluate((x, z) => !!(window as any).__planGrid?.has(x, z), x, z)
  const load = async () => {
    await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(3500); await hideCard()
    if (PHONE) await p.touchscreen.tap(W / 2, H - 200); else await p.mouse.click(W / 2, H / 2); await sleep(800)
    await p.evaluate(() => document.exitPointerLock?.())
  }
  const fly = async () => {
    for (let t = 0; t < 3; t++) {
      await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1800)
      await p.keyboard.press('e'); await sleep(1200)
      if (await tapEl('[data-act="plan"]') && await poll(() => p.evaluate(() => (window as any).__build?.on() === true))) break
    }
    await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 2, RZ); await sleep(500)
    return await p.evaluate(() => (window as any).__build?.on() === true)
  }
  const planned = async () => ((await read()).planned ?? []) as any[]
  const stood = async () => ((await read()).pieces ?? []) as any[]
  const bagOf = (id: string) => p.evaluate((id: string) => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(s => s?.id === id).reduce((a, s) => a + s.n, 0), id)
  const at = async (x: number, z: number) => { await settled(); const v = await view(), q = screenOf(v, x, z); await unblock(q.x, q.y); if (PHONE) await p.touchscreen.tap(q.x, q.y); else { await p.mouse.move(q.x, q.y); await sleep(500); await p.mouse.click(q.x, q.y) } await sleep(700); await reblock() }
  const pickCard = async (id: string) => { if (!(await p.$('[data-catalog]'))) { await tapEl('[data-act="wall-catalog"]'); await sleep(700) } const r = await tapEl(`[data-cat="piece:${id}"]`); await sleep(900); return r }
  const setAt = async (x: number, z: number) => { const n = (await planned()).length; for (let t = 0; t < 3 && (await planned()).length === n; t++) { await at(x, z); if (PHONE) { await tapEl('[data-act="place"]'); await sleep(800) } } return (await planned()).length === n + 1 }
  const stop = async () => { if (PHONE) await p.evaluate(() => { [...document.querySelectorAll<HTMLElement>('[data-placing] button')].find(b => /Cancel/.test(b.textContent ?? ''))?.click() }); else await p.keyboard.press('Escape'); await sleep(500) }
  await load(); await sleep(1500)
  const CX = spot!.x, CZ = spot!.z, SX = CX - 3, SZ = CZ, RX = CX + 3, RZ2 = CZ + 1, GZ = CZ + 6
  // 1
  ok(await fly(), `   ${N}: plan mode`); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), SX, SZ); await sleep(400)
  await tapEl('[data-act="wall-catalog"]'); await sleep(800)
  const subs = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-cat-group="pieces"] [data-build-sub]')].map(e => [e.dataset.buildSub!, [...e.querySelectorAll<HTMLElement>('[data-cat]')].map(c => [c.dataset.cat!, c.querySelectorAll('[data-build-icon] path').length])])) as [string, [string, number][]][]
  const want = buildCatalog().filter(g => ['Stairs', 'Railings + fences', 'Ramps + ladders'].includes(g.sub))
  ok(want.length === 3 && want.every(g => JSON.stringify(subs.find(s => s[0] === g.sub)?.[1].map(c => c[0])) === JSON.stringify(g.ids.map(id => `piece:${id}`))), `1. ${N}: ${want.map(g => `${g.sub} ${g.ids.length}`).join(', ')} in the plan catalog`)
  ok(subs.filter(s => want.some(g => g.sub === s[0])).every(s => s[1].every(c => c[1] > 0)), `1. ${N}: every stair / railing / fence / ramp card shows its icon`)
  await p.evaluate(() => document.querySelector('[data-build-sub="Stairs"]')?.scrollIntoView({ block: 'center' })); await shot(`m169s-${N}-1-catalog`)
  // 2
  const bag0 = await bagOf('goldwood_plank')
  const put = async (id: string, x: number, z: number) => { await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), x, z); await sleep(500); await pickCard(id); const r = await setAt(x, z); await stop(); ok(r, `2. ${N}: ${id} planned`) }
  await put('goldwood_panel_wide', SX, SZ - 3.2); await put('stair_railed', SX, SZ); await put('ramp', RX, RZ2)
  await put('fence', CX - 1.5, GZ); await put('fence_gate', CX, GZ); await put('fence', CX + 1.5, GZ)
  const pl = await planned(); console.log('  planned', JSON.stringify(pl.map((q: any) => [q.item, +(q.x - CX).toFixed(2), +(q.z - CZ).toFixed(2), q.q])))
  ok(pl.every((q: any) => q.q === 0), `2. ${N}: all planned square (q 0), the stair climbing north to the panel`)
  await tapEl('[data-act="build-plan"] button'); await sleep(1500)
  const st = await stood()
  ok(st.length === 6 && (await planned()).length === 0 && bag0 - await bagOf('goldwood_plank') === 37, `2. ${N}: Build pays 37 planks, all six stand (paid ${bag0 - await bagOf('goldwood_plank')})`)
  await settled(); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), CX, CZ + 2); await sleep(1200); await shot(`m169s-${N}-2-built`)
  await tapEl('[data-act="land"]'); await sleep(1500); await load()
  const gate = () => stood().then(s => s.find((q: any) => q.item === 'fence_gate'))
  const S = (await stood()).find((q: any) => q.item === 'stair_railed'), R = (await stood()).find((q: any) => q.item === 'ramp'), G0 = await gate()
  ok((await stood()).length === 6 && !!S && !!R && !!G0 && !G0.open, `3. ${N}: after a reload all six stand, the gate shut`)
  const me = () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: (s.px ?? s.x) as number, y: s.py as number, z: (s.pz ?? s.z) as number } })
  const tpTo = async (x: number, z: number, yaw = 0) => { await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), x, z, yaw); await sleep(1800) }
  /** hold a key until `done` (or ms); the highest the feet got */
  const hold = async (key: string, done: (m: { x: number; y: number; z: number }) => boolean, ms = 9000) => { let top = -1e9; await p.keyboard.down(key); await poll(async () => { const m = await me(); top = Math.max(top, m.y); return done(m) }, ms); await p.keyboard.up(key); await sleep(500); return { ...(await me()), top } }
  // 4: up the stair to the wall top
  await tpTo(S.x, S.z + 4.5); const g0 = (await me()).y
  let m = await hold('w', m => m.z < S.z - 2.9 || m.y - g0 > 4.7, 40000); ok(m.top - g0 > 4.6, `4. ${N}: the keeper walks up the stair to the wall top (feet +${(m.top - g0).toFixed(2)} m)`); await shot(`m169s-${N}-4-top`)
  // 5: half way up, the railing holds her on
  await tpTo(S.x, S.z + 4.5); m = await hold('w', m => m.z < S.z + 0.4, 40000); const y5 = m.y
  m = await hold('a', m => m.x < S.x - 1.2, 12000); const l5 = m   // a slow desktop frame walks slowly: hold until off the side, or 12 s pressed on the rail
  m = await hold('d', m => m.x > S.x + 1.2, 15000)
  ok(y5 - g0 > 1.6 && l5.x > S.x - 1 && l5.x < S.x - 0.4 && l5.y > y5 - 0.45 && m.x < S.x + 1 && m.x > S.x + 0.4 && m.y > y5 - 0.45, `5. ${N}: half way up (+${(y5 - g0).toFixed(2)} m) the railings hold her on (left x ${(l5.x - S.x).toFixed(2)}, right x ${(m.x - S.x).toFixed(2)}, feet +${(m.y - g0).toFixed(2)})`); await shot(`m169s-${N}-5-rail`)
  // 6: up the ramp
  await tpTo(R.x, R.z + 3.2); const g6 = (await me()).y; m = await hold('w', m => m.z < R.z - 1.6, 30000); ok(m.top - g6 > 1.0, `6. ${N}: up the ramp (feet +${(m.top - g6).toFixed(2)} m)`)
  // 7: the gate
  await tpTo(G0.x, G0.z + 1.6); m = await hold('w', m => m.z < G0.z - 0.4, 3000); ok(m.z > G0.z + 0.05, `7. ${N}: the shut gate stops the keeper (z ${(m.z - G0.z).toFixed(2)})`)
  await p.keyboard.press('e'); await sleep(1200); ok((await gate()).open === true, `7. ${N}: E opens the gate (saved)`); await shot(`m169s-${N}-7-open`)
  m = await hold('w', m => m.z < G0.z - 1.0, 4000); ok(m.z < G0.z - 0.4, `7. ${N}: open, she walks through (z ${(m.z - G0.z).toFixed(2)})`)
  await load(); ok((await gate()).open === true, `7. ${N}: reload: open stays open`)
  await tpTo(G0.x, G0.z - 1.4, Math.PI); await p.keyboard.press('e'); await sleep(1200); ok(!(await gate()).open, `7. ${N}: E from the far side shuts it`)
  m = await hold('w', m => m.z > G0.z + 0.4, 3000); ok(m.z < G0.z - 0.05, `7. ${N}: shut, it stops her going back (z ${(m.z - G0.z).toFixed(2)})`)
  await load(); ok(!(await gate()).open, `7. ${N}: reload: shut stays shut`)
  await tpTo(CX + 1, CZ + 11, 0); await sleep(1500); await shot(`m169s-${N}-7-yard`)
  ok(errs.length === 0, `8. ${N}: 0 page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await p.close()
}
try { const only = flag('--only', ''); if (only !== 'desktop') await run(true); if (only !== 'phone') await run(false) } catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
