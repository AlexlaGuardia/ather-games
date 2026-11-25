// BETA M143 on prod: floor slabs + wall panels are PLANNED from the catalog, paid at Build. PHONE 390x844 and DESKTOP 1280x760, fresh
// profile, an OLD save seeded (a placed slab at 45 deg, two crafted in the bag, a carpentry, 6 planks, 1 brick).
//  1 the Carpentry's furniture list has none of the 8; the old save is as it was  2 the catalog group: 8 cards, have / need
//  3 two slabs and a panel set = DRAFTS: works.planned, bag untouched, nothing solid, on the card  4 short: Build is off
//  5 Erase taps one off; Build takes exactly the list; they stand  6 plan again, Cancel = nothing taken  7 the crafted slab from the
//  hand still sets free  8 a built floor under a drafted divider: unit only
//   npx tsx scripts/m143-plan-pieces-check.mts [--url ...] [--out dir] [--only phone|desktop]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR, benchOf } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m143')
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
  const PLACED = { id: 'old1', item: 'goldwood_slab', x: X0 - 2, z: Z0, q: 0.5, placedAt: 5 }
  const works = { v: 1, rooms: [{ id: 'carp', kind: 'carpentry', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2 }], chests: [], pieces: [PLACED] }
  await p.evaluateOnNewDocument((works: string) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m143')) return; sessionStorage.setItem('m143', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[2] = { id: 'goldwood_slab', n: 2 }; slots[8] = { id: 'goldwood_plank', n: 6 }; slots[9] = { id: 'stone_brick', n: 1 }
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
  // 1
  const old = JSON.stringify(await stood()); ok(JSON.stringify(JSON.parse(old)) === JSON.stringify([PLACED]) && await bagOf('goldwood_slab') === 2, `1. ${N}: the old save is as it was (1 placed, 2 in the bag)`)

  let tiles: string[] = []
  for (let t = 0; t < 4 && !tiles.length; t++) {
    const b = benchOf(works.rooms[0] as any); await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), b.x, b.z + (t % 2 ? -1.2 : 1.2)); await sleep(1800); await p.keyboard.press('e'); await sleep(1500)
    await p.evaluate(() => { [...document.querySelectorAll<HTMLElement>('button')].find(b => /^furniture$/i.test((b.textContent ?? '').trim()))?.click() }); await sleep(900)
    tiles = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-job]')].map(e => e.dataset.job!))
  }
  ok(tiles.includes('goldwood_bench') && !tiles.some(t => /_slab|_panel/.test(t)), `1. ${N}: the bench lists ${tiles.length} pieces, no slab or panel`)
  await shot(`m143-${N}-1-bench`); await p.keyboard.press('Escape'); await sleep(900)
  // 2
  ok(await fly(), `   ${N}: plan mode`); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 2.5, RZ); await sleep(400)
  await tapEl('[data-act="wall-catalog"]'); await sleep(800)
  const cards = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-cat-group="pieces"] [data-cat]')].map(e => [e.dataset.cat!, e.innerText.replace(/\n/g, ' | ')]))
  ok(cards.length === 8 && cards.every(c => /\d+ \/ \d+ /.test(c[1])), `2. ${N}: 8 cards, have / need (${cards[0]?.[1]})`)
  await p.evaluate(() => document.querySelector('[data-cat-group="pieces"]')?.scrollIntoView({ block: 'center' })); await shot(`m143-${N}-2-catalog`)
  ok(await p.evaluate(() => { const c = document.querySelector('[data-catalog]')!.getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth }), `2. ${N}: the catalog fits`)
  // 3
  const bag0 = await stores()
  await pickCard('goldwood_slab_wide'); ok(!!(await p.$('[data-placing="piece"]')) && !!(await p.$('[data-act="snap"]')) && !!(await p.$('[data-act="turn"]')), `3. ${N}: the ghost is held, Snap and Turn as ever`)
  ok(await setAt(X0 + 1, RZ - 1), `3. ${N}: a wide slab planned`); ok(await setAt(X0 + 4, RZ - 1), `3. ${N}: still held, a second one planned`); await stop()
  await pickCard('goldwood_panel_wide'); ok(await setAt(X0 + 2.5, RZ + 1), `3. ${N}: a wall panel planned`); await stop()
  ok((await planned()).length === 3 && JSON.stringify(await stood()) === old && await stores() === bag0, `3. ${N}: three drafts, nothing standing, bag and Keepstone unchanged`)
  const lines = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-bom-line]')].map(e => `${e.dataset.bomLine}:${e.dataset.need}:${e.dataset.have}`))
  ok(JSON.stringify(await lines()) === JSON.stringify(['goldwood_plank:11:6']), `3. ${N}: on the plan card (${await lines()})`); await settled(); await shot(`m143-${N}-3-card`)
  // 4
  ok(await p.evaluate(() => document.querySelector<HTMLButtonElement>('[data-act="build-plan"] button')?.disabled === true), `4. ${N}: short = cannot Build`)
  await load(); ok((await planned()).length === 3 && await stores() === bag0, `4. ${N}: the plan is there after a reload`)
  
  const pn = (await planned())[2]; await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), pn.x, pn.z + 1.2); await sleep(1500); await p.keyboard.down('w'); await sleep(1800); await p.keyboard.up('w'); await sleep(300)
  const walked = await p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px ?? s.x, z: s.pz ?? s.z } }); ok(walked.z < pn.z - 0.3, `4. ${N}: the planned panel is walked through (z ${walked.z?.toFixed?.(2)} past ${pn.z})`)
  // 5
  ok(await fly(), `   ${N}: plan mode`); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 2.5, RZ); await sleep(400)
  await tapEl('[data-act="edit-plan"] button'); await sleep(1500)
  for (let t = 0; t < 3 && (await planned()).length > 2; t++) await at(X0 + 4, RZ - 1)
  ok((await planned()).length === 2 && await stores() === bag0, `5. ${N}: Edit, a tap takes the second slab off the plan, nothing given or taken`)
  await tapEl('[data-act="edit-plan"] button'); await sleep(500)
  ok(JSON.stringify(await lines()) === JSON.stringify(['goldwood_plank:7:6']), `5. ${N}: the card says ${await lines()}`)
  await tapEl('[data-act="edit-plan"] button'); await sleep(1200); for (let t = 0; t < 3 && (await planned()).length > 1; t++) await at(X0 + 2.5, RZ + 1); await tapEl('[data-act="edit-plan"] button'); await sleep(500)
  ok((await planned()).length === 1 && (await planned())[0].item === 'goldwood_slab_wide', `5. ${N}: the panel off too`)
  const n0 = await planks(); await tapEl('[data-act="build-plan"] button'); await sleep(1200)
  ok((await planned()).length === 0 && (await stood()).length === 2 && (await stood())[1].item === 'goldwood_slab_wide' && n0 - (await planks()) === 4 && await bagOf('goldwood_slab') === 2 && !(await p.$('[data-plan-bom]')), `5. ${N}: Build takes exactly 4 planks and it stands`)
  // 6
  const bag6 = await stores(); await pickCard('stone_slab'); ok(await setAt(X0 + 4, RZ + 1), `6. ${N}: a stone slab planned`); await stop()
  await tapEl('[data-act="cancel-plan"] button'); await sleep(500); await tapEl('[data-act="cancel-plan-yes"] button'); await sleep(1000)
  ok((await planned()).length === 0 && (await stood()).length === 2 && await stores() === bag6, `6. ${N}: Cancel plan: the draft gone, nothing taken, what stands stands`)
  await tapEl('[data-act="land"]'); await sleep(1500); await load()
  ok((await stood()).length === 2 && JSON.stringify((await stood())[0]) === JSON.stringify(PLACED), `6. ${N}: after a reload both stand, the old slab to the byte`)
  // 7
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), X0 + 5, RZ + 4); await sleep(1500); await p.keyboard.press('Digit3'); await sleep(1500)
  for (let t = 0; t < 3 && (await stood()).length < 3; t++) { if (await p.$('[data-act="place"]')) await tapEl('[data-act="place"]'); else await p.keyboard.press('e'); await sleep(1200) }
  ok((await stood()).length === 3 && await bagOf('goldwood_slab') === 1 && n0 - (await planks()) === 4 && (await planned()).length === 0, `7. ${N}: a crafted slab from the hand is set at once, free`)
  ok(errs.length === 0, `8. ${N}: 0 page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await p.close()
}
try { const only = flag('--only', ''); if (only !== 'desktop') await run(true); if (only !== 'phone') await run(false) } catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
