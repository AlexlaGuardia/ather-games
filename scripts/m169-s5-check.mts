// BETA M169 s5 on prod: foundations (Low / High + their stone steps), deck, porch, balcony, columns, on a TEST keeper's plot (a fresh
// profile: 40 planks + 40 bricks in the bag, nothing on the plot; every POST is answered in the page: nothing written). PHONE 390x844
// + DESKTOP 1280x760.  1 plan catalog: Columns + Foundations + decks, each card with its icon  2 twelve pieces planned (a wall panel
// ON a Low foundation, a balcony turned on a wall's top); Build pays 30 planks + 27 bricks  3 reload: all stand  4 up the steps onto
// each foundation, onto the deck; no step = the porch stops her  5 up a ladder onto the balcony, its rail holds her, she stands there
// 6 a column blocks  7 0 page errors.   npx tsx scripts/m169-s5-check.mts [--url ...] [--out dir] [--only phone|desktop]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { buildCatalog } from '../src/app/shimmer/open/ather/build-catalog'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m169s5')
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
    if (sessionStorage.getItem('m169s5')) return; sessionStorage.setItem('m169s5', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 20 }; slots[9] = { id: 'goldwood_plank', n: 20 }; slots[10] = { id: 'stone_brick', n: 20 }; slots[11] = { id: 'stone_brick', n: 20 }
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
  const CX = spot!.x, CZ = spot!.z, LX = CX - 3, LZ = CZ
  // 1
  ok(await fly(), `   ${N}: plan mode`); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), LX, LZ); await sleep(400)
  await tapEl('[data-act="wall-catalog"]'); await sleep(800)
  const subs = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-cat-group="pieces"] [data-build-sub]')].map(e => [e.dataset.buildSub!, [...e.querySelectorAll<HTMLElement>('[data-cat]')].map(c => [c.dataset.cat!, c.querySelectorAll('[data-build-icon] path').length])])) as [string, [string, number][]][]
  for (const sub of ['Columns', 'Foundations + decks']) {
    const want = buildCatalog().find(g => g.sub === sub)!, got = subs.find(s => s[0] === sub)?.[1] ?? []
    ok(JSON.stringify(got.map(c => c[0])) === JSON.stringify(want.ids.map(id => `piece:${id}`)), `1. ${N}: ${sub} = ${got.map(c => c[0].slice(6)).join(', ')} in the plan catalog`)
    ok(got.length > 0 && got.every(c => c[1] > 0), `1. ${N}: every ${sub} card shows its icon`)
  }
  await p.evaluate(() => document.querySelector('[data-build-sub="Foundations + decks"]')?.scrollIntoView({ block: 'center' })); await shot(`m169s5-${N}-1-catalog`)
  // 2: a Low foundation + its step + a wall on it; a High + its steps; a deck, a porch + its step; two columns; a wall, a ladder
  //    against it, a balcony turned to face away on its top
  const bag0 = await bagOf('goldwood_plank'), brick0 = await bagOf('stone_brick')
  const put = async (id: string, x: number, z: number, turns = 0) => { await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), x, z); await sleep(500); await pickCard(id)
    for (let k = 0; k < turns; k++) { await tapEl('[data-act="turn"]'); await sleep(400) }
    const r = await setAt(x, z); await stop(); ok(r, `2. ${N}: ${id} planned`) }
  const FX = LX - 2, FZ = LZ + 3   // the foundations' row, in front
  await put('foundation_low', FX, FZ); await put('found_step', FX, FZ + 1.225); await put('goldwood_panel_wide', FX, FZ - 0.85)
  await put('foundation_high', FX + 3, FZ); await put('found_steps', FX + 3, FZ + 1.45)
  await put('deck', FX + 7, FZ); await put('porch', FX + 7, FZ - 3.5); await put('column', FX + 10, FZ); await put('stone_column', FX + 10, FZ - 2)
  await put('goldwood_panel_wide', LX, LZ - 0.25); await put('ladder', LX, LZ); await put('balcony', LX, LZ - 0.6, 2)
  const pl = await planned()
  console.log('  planned', JSON.stringify(pl.map((q: any) => [q.item, +(q.x - LX).toFixed(2), +(q.z - LZ).toFixed(2), q.q])))
  const bal = pl.find((q: any) => q.item === 'balcony')
  ok(pl.length === 12 && !!bal && bal.q === 2 && Math.abs(bal.z - (LZ - 0.6)) < 0.3, `2. ${N}: all twelve planned; the balcony on the wall's top, turned to face away (q ${bal?.q})`)
  const wallOn = pl.find((q: any) => q.item === 'goldwood_panel_wide' && Math.abs(q.z - (FZ - 0.85)) < 0.3)
  ok(!!wallOn, `2. ${N}: a wall panel set ON the Low foundation`)
  await tapEl('[data-act="build-plan"] button'); await sleep(1500)
  const paidP = bag0 - await bagOf('goldwood_plank'), paidB = brick0 - await bagOf('stone_brick')
  ok((await stood()).length === 12 && (await planned()).length === 0 && paidP === 30 && paidB === 27, `2. ${N}: Build pays 30 planks + 27 bricks, all stand (paid ${paidP} + ${paidB})`)
  await settled(); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), FX + 4, FZ + 4); await sleep(1500); await shot(`m169s5-${N}-2-built`)
  await tapEl('[data-act="land"]'); await sleep(1500); await load()
  const all = await stood(), one = (id: string) => all.find((q: any) => q.item === id)
  ok(all.length === 12, `3. ${N}: after a reload all twelve stand`)
  const me = () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: (s.px ?? s.x) as number, y: s.py as number, z: (s.pz ?? s.z) as number, lad: !!s.onLadder } })
  const tpTo = async (x: number, z: number, yaw = 0) => { await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), x, z, yaw); await sleep(1800) }
  const hold = async (key: string, done: (m: { x: number; y: number; z: number; lad: boolean }) => boolean, ms = 9000) => { let top = -1e9; await p.keyboard.down(key); const t = Date.now(); while (Date.now() - t < ms) { const m = await me(); top = Math.max(top, m.y); if (done(m)) break } await p.keyboard.up(key); await sleep(600); return { ...(await me()), top } }
  // 4: up the step(s) onto each foundation, onto the deck, up the porch's... (the porch has no step here: it stops her, a plinth)
  for (const [id, H] of [['foundation_low', 0.6], ['foundation_high', 1.2], ['deck', 0.12]] as const) {
    const f = one(id); await tpTo(f.x, f.z + 3.5); const g0 = (await me()).y
    const m = await hold('w', m => m.z < f.z + 0.2, 6000)
    ok(Math.abs(m.y - g0 - H) < 0.05 && m.z < f.z + 0.5, `4. ${N}: she walks up onto the ${id} (feet +${(m.y - g0).toFixed(2)}, z ${(m.z - f.z).toFixed(2)})`)
    if (id === 'foundation_low') await shot(`m169s5-${N}-4-on-foundation`)
  }
  { const f = one('porch'); await tpTo(f.x, f.z - 3.5); const g0 = (await me()).y; const m = await hold('s', m => m.z > f.z - 0.2, 4000)   // from behind (the deck is in front)
    ok(Math.abs(m.y - g0) < 0.05 && m.z < f.z - 0.9, `4. ${N}: with no step a porch's 0.6 m stops her (feet +${(m.y - g0).toFixed(2)}, z ${(m.z - f.z).toFixed(2)})`) }
  // 5: up the ladder, off onto the balcony, to its far rail; she stands there
  { const L = one('ladder'), B = one('balcony'); await tpTo(L.x, L.z + 2); const g0 = (await me()).y
    let m = await hold('w', m => m.lad && m.y - g0 > 4.1, 40000)
    ok(m.lad && m.y - g0 > 4.1, `5. ${N}: she climbs the ladder (feet +${(m.y - g0).toFixed(2)})`)
    m = await hold('w', m => !m.lad && m.z < B.z - 0.2, 6000); await p.keyboard.down('w'); await sleep(2000); await p.keyboard.up('w'); await sleep(600); m = await me()
    ok(!m.lad && Math.abs(m.y - g0 - 5.0) < 0.05 && m.z < L.z - 0.4 && m.z > B.z - 0.55, `5. ${N}: she steps off onto the balcony and its rail holds her (feet +${(m.y - g0).toFixed(2)}, z ${(m.z - B.z).toFixed(2)})`)
    await sleep(3000); const st = await me(); ok(Math.abs(st.y - g0 - 5.0) < 0.05, `5. ${N}: she stands on the balcony (feet +${(st.y - g0).toFixed(2)} after 3 s)`); await shot(`m169s5-${N}-5-balcony`) }
  // 6: a column is in her way
  { const c = one('column'); await tpTo(c.x, c.z + 3); const m = await hold('w', m => m.z < c.z - 1, 4000); ok(m.z > c.z + 0.2, `6. ${N}: a column stops her (z ${(m.z - c.z).toFixed(2)})`) }
  await tpTo(FX + 4, FZ + 9, 0); await sleep(1200); await shot(`m169s5-${N}-6-yard`)
  ok(errs.length === 0, `7. ${N}: 0 page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await p.close()
}
try { const only = flag('--only', ''); if (only !== 'desktop') await run(true); if (only !== 'phone') await run(false) } catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
