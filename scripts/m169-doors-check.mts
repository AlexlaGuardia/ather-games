// BETA M169 s2 on prod: a DOOR that opens and shuts, and a WINDOW, in a wall on a TEST keeper's plot. PHONE 390x844 + DESKTOP 1280x760,
// fresh profile (a new keeper: 20 planks, 3 panes in the bag; nothing on the plot). Every POST is answered in the page: nothing written.
//  1 plan mode's catalog: Doors / Windows / Openings + trim, every card with its icon  2 a panel, a window and a door planned flush in one
//  line; Build pays 2 + 2 + 5 planks and 1 pane  3 after a reload they stand; the shut door blocks the walker  4 E opens it: the keeper
//  walks through  5 E (from the far side) shuts it: blocks again  6 reload: shut stays shut; E open, reload: open stays open  7 the window
//  blocks like a wall  8 0 page errors
//   npx tsx scripts/m169-doors-check.mts [--url ...] [--out dir] [--only phone|desktop]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { buildCatalog } from '../src/app/shimmer/open/ather/build-catalog'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m169')
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
    if (sessionStorage.getItem('m169')) return; sessionStorage.setItem('m169', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 20 }; slots[9] = { id: 'crystal_pane', n: 3 }
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
  const PX = X0 + 0.5, WX = X0 + 1.5, DX = X0 + 3   // the line: panel X0..X0+1 | window ..X0+2 | door ..X0+4, along x at RZ
  // 1
  ok(await fly(), `   ${N}: plan mode`); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 2, RZ); await sleep(400)
  await tapEl('[data-act="wall-catalog"]'); await sleep(800)
  const subs = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-cat-group="pieces"] [data-build-sub]')].map(e => [e.dataset.buildSub!, [...e.querySelectorAll<HTMLElement>('[data-cat]')].map(c => [c.dataset.cat!, c.querySelectorAll('[data-build-icon] path').length])])) as [string, [string, number][]][]
  const want = buildCatalog().filter(g => ['Doors', 'Windows', 'Openings + trim'].includes(g.sub))
  ok(want.length === 3 && want.every(g => JSON.stringify(subs.find(s => s[0] === g.sub)?.[1].map(c => c[0])) === JSON.stringify(g.ids.map(id => `piece:${id}`))), `1. ${N}: ${want.map(g => `${g.sub} ${g.ids.length}`).join(', ')} in the plan catalog`)
  ok(subs.filter(s => want.some(g => g.sub === s[0])).every(s => s[1].every(c => c[1] > 0)), `1. ${N}: every door / window / opening card shows its icon`)
  await p.evaluate(() => document.querySelector('[data-build-sub="Doors"]')?.scrollIntoView({ block: 'center' })); await shot(`m169-${N}-1-catalog`)
  // 2
  const bag0 = [await bagOf('goldwood_plank'), await bagOf('crystal_pane')]
  await pickCard('goldwood_panel'); ok(await setAt(PX, RZ), `2. ${N}: a wall panel planned`); await stop()
  await pickCard('window'); ok(await setAt(WX, RZ), `2. ${N}: a window planned flush beside it`); await stop()
  await pickCard('door'); ok(await setAt(DX, RZ), `2. ${N}: a door planned flush beside that`); await stop()
  const pl = await planned(); console.log('  planned', JSON.stringify(pl.map((q: any) => [q.item, q.x - X0, q.z - RZ, q.q])))
  await tapEl('[data-act="build-plan"] button'); await sleep(1500)
  const st = await stood(), d0 = st.find((q: any) => q.item === 'door'), w0 = st.find((q: any) => q.item === 'window')
  ok(st.length === 3 && (await planned()).length === 0 && bag0[0] - await bagOf('goldwood_plank') === 9 && bag0[1] - await bagOf('crystal_pane') === 1, `2. ${N}: Build pays 9 planks + 1 pane, all three stand`)
  await settled(); await shot(`m169-${N}-2-built`)
  await tapEl('[data-act="land"]'); await sleep(1500); await load()
  const door = () => stood().then(s => s.find((q: any) => q.item === 'door'))
  ok(!!d0 && !!w0 && !!(await door()) && !(await door()).open, `3. ${N}: after a reload they stand, the door shut`)
  const kz = () => p.evaluate(() => { const s = (window as any).__ather.state(); return (s.pz ?? s.z) as number })
  const walk = async (key: string, past: (z: number) => boolean, ms = 9000) => { await p.keyboard.down(key); await poll(async () => past(await kz()), ms); await p.keyboard.up(key); await sleep(400); return kz() }
  const tpTo = async (x: number, z: number, yaw = 0) => { await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), x, z, yaw); await sleep(1800) }
  // 3: shut = blocks
  await tpTo(d0.x + 0.3, d0.z + 1.6); let z = await walk('w', z => z < d0.z - 0.4)
  ok(z > d0.z + 0.1, `3. ${N}: the shut door stops the keeper (z ${z.toFixed(2)}, door ${d0.z})`); await shot(`m169-${N}-3-shut`)
  // 4: E opens, walk through
  await p.keyboard.press('e'); await sleep(1200)
  ok((await door()).open === true, `4. ${N}: E opens it (saved)`); await shot(`m169-${N}-4-open`)
  z = await walk('w', z => z < d0.z - 1.0); ok(z < d0.z - 0.4, `4. ${N}: open, the keeper walks through (z ${z.toFixed(2)})`)
  // 5: E from the far side shuts; walking back is stopped
  await tpTo(d0.x + 0.3, Math.min(z, d0.z - 1.0), Math.PI); await p.keyboard.press('e'); await sleep(1200)   // turned round: E acts on what the keeper faces (M60 aim)
  ok(!(await door()).open, `5. ${N}: E from the far side shuts it`)
  z = await walk('w', z => z > d0.z + 0.4); ok(z < d0.z - 0.1, `5. ${N}: shut again, it stops the keeper going back (z ${z.toFixed(2)})`)
  // 6: reload keeps the state
  await load(); ok(!(await door()).open, `6. ${N}: reload: shut stays shut`)
  await tpTo(d0.x + 0.3, d0.z + 1.4); await p.keyboard.press('e'); await sleep(1200); const o1 = (await door()).open === true
  await load(); ok(o1 && (await door()).open === true, `6. ${N}: E open, reload: open stays open`)
  await tpTo(d0.x + 0.3, d0.z + 1.6); z = await walk('w', z => z < d0.z - 0.6); ok(z < d0.z - 0.4, `6. ${N}: and walks through after the reload (z ${z.toFixed(2)})`)
  // 7: the window is a wall
  await tpTo(w0.x, w0.z + 1.6); z = await walk('w', z => z < w0.z - 0.4); ok(z > w0.z + 0.1, `7. ${N}: the window stops the keeper like a wall (z ${z.toFixed(2)})`)
  await tpTo(w0.x + 1.5, w0.z + 4.5, 0); await sleep(1200); await shot(`m169-${N}-7-line`)
  ok(errs.length === 0, `8. ${N}: 0 page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await p.close()
}
try { const only = flag('--only', ''); if (only !== 'desktop') await run(true); if (only !== 'phone') await run(false) } catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
