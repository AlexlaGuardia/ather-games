// BETA M138 + M142 on prod: cancel / edit a plan, and the plan-mode grid. PHONE 390x844 (touch) and DESKTOP 1280x760 (mouse). Fresh
// profile, injected works (a BUILT 6 x 6 room, a drafted run beside it, a drafted run on floor 2), planks in the bag and the Keepstone.
//  1 out of plan mode: no grid; in it: 1 m lines round the house, one mesh, not rebuilt while nothing changes
//  2 Cancel plan asks; Keep it keeps; yes = only the drafts gone (both floors), bag + Keepstone + built room to the byte; reload the same
//  3 a drawn wall lands on the grid's lines  4 Edit: a drag takes 1 m off the plan, nothing spent, a built wall stays up  5 reload: the
//  edited plan is there; Build builds and charges exactly that  6 out of plan mode: the grid is gone, 0 page errors
//   npx tsx scripts/m138-plan-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m138')
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
const RZ = Z1 + 3   // the run beside the house
async function run(PHONE: boolean) {
  W = PHONE ? 390 : 1280; H = PHONE ? 844 : 760; const N = PHONE ? 'phone' : 'desktop'
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: W, height: H, isMobile: true, hasTouch: true } : { width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const walls: Record<string, any> = {}
  for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
  for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
  const rk = findRooms(walls as any)[0].key, builtWalls = JSON.parse(JSON.stringify(walls))
  for (let x = X0; x < X0 + 3; x++) walls[`h,${x},${RZ}`] = { mat: 'goldwood', draft: true }
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid: { [rk]: 36 }, roof: 'gable', cols: { [`${X0 + 5},${RZ}`]: { mat: 'goldwood', draft: true } }, upper: [{ walls: { [`h,${X0},${Z0}`]: { mat: 'goldwood', draft: true }, [`h,${X0 + 1},${Z0}`]: { mat: 'goldwood', draft: true } } }] }
  await p.evaluateOnNewDocument((works: string) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m138')) return; sessionStorage.setItem('m138', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }
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
  await load(); await sleep(1500)
  ok((await grid()) === null, `1. ${N}: no grid while walking`)
  const before = await stores()
  ok(await fly(), `   ${N}: plan mode`); ok(await poll(async () => !!(await grid())), `1. ${N}: the grid is drawn`)
  const g0 = await grid(); await sleep(2500); const g1 = await grid()
  ok(!!g0 && g0.id === g1?.id && g0.lv === 0, `1. ${N}: one mesh, ${g0?.seg} lines, not rebuilt over 2.5 s`)
  ok(await has(X0, RZ) && await has(X0 + 0, Z0 + 1) && await has(X0 + 1, RZ + 1) && !(await has(X0 + 0.5, RZ + 0.5)), `1. ${N}: lines on every metre`)
  await settled(); await shot(`m138-${N}-1-card`)
  // 2. cancel
  ok(!!(await p.$('[data-act="cancel-plan"]')) && !!(await p.$('[data-act="edit-plan"]')), `2. ${N}: the card has Edit and Cancel plan`)
  const fits = await p.evaluate(() => [...document.querySelectorAll('[data-plan-bom] button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight })); ok(fits, `2. ${N}: the buttons fit the screen`)
  await tapEl('[data-act="cancel-plan"] button'); await sleep(500); await shot(`m138-${N}-2-ask`)
  ok(!!(await p.$('[data-act="cancel-plan-yes"]')) && drafts(await read()).length === 6, `2. ${N}: it asks first, nothing gone yet`)
  await tapEl('[data-act="keep-plan"] button'); await sleep(500); ok(drafts(await read()).length === 6 && !(await p.$('[data-act="cancel-plan-yes"]')), `2. ${N}: Keep it keeps the plan`)
  await tapEl('[data-act="cancel-plan"] button'); await sleep(500); await tapEl('[data-act="cancel-plan-yes"] button'); await sleep(1200)
  const w2 = await read()
  ok(drafts(w2).length === 0 && JSON.stringify(Object.keys(w2.walls).sort()) === JSON.stringify(Object.keys(builtWalls).sort()) && w2.paid[rk] === 36 && !(w2.upper ?? []).length, `2. ${N}: only the drafts are gone (${Object.keys(w2.walls).length} built walls, room paid ${w2.paid[rk]})`)
  ok(await stores() === before, `2. ${N}: bag and Keepstone unchanged`); ok(!(await p.$('[data-plan-bom]')), `2. ${N}: the card is gone`)
  await load(); ok(drafts(await read()).length === 0 && Object.keys((await read()).walls).length === Object.keys(builtWalls).length, `2. ${N}: the same after a reload`)
  // 3. draw
  ok(await fly(), `   ${N}: plan mode again`); await tapEl('[data-tool="walls"]'); await sleep(500)
  for (let t = 0; t < 3 && drafts(await read()).length < 4; t++) await line(X0, RZ, X0 + 4, RZ)
  const d3 = drafts(await read()); ok(d3.length === 4 && (await Promise.all([0, 1, 2, 3, 4].map(n => has(X0 + n, RZ)))).every(Boolean), `3. ${N}: a drawn wall lands on the grid (${d3.join(' ')})`)
  // 4. edit
  await tapEl('[data-act="edit-plan"] button'); await sleep(1500)
  ok(await p.evaluate(() => (window as any).__build.tool()) === 'erase' && !!(await p.$('[data-act="edit-plan"][data-on="true"]')), `4. ${N}: Edit opens the tools on the plan`); await shot(`m138-${N}-3-edit`)
  for (let t = 0; t < 3 && drafts(await read()).length > 3; t++) await line(X0 + 3, RZ, X0 + 4, RZ)
  ok(drafts(await read()).length === 3, `4. ${N}: one metre taken off the plan (${drafts(await read()).join(' ')})`); ok(await stores() === before, `4. ${N}: nothing spent, nothing given back`)
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 2, Z1); await sleep(400); await line(X0 + 1, Z1, X0 + 3, Z1)
  ok(Object.values((await read()).walls).filter((x: any) => !x.draft).length === Object.keys(builtWalls).length && await stores() === before, `4. ${N}: a built wall stays up under Edit's Erase`)
  await tapEl('[data-act="edit-plan"] button'); await sleep(500)
  // 5. reload, build
  await load(); ok(drafts(await read()).length === 3, `5. ${N}: the edited plan is there after a reload`); ok(await fly(), `   ${N}: plan mode`); await sleep(800)
  const n0 = await planks(); await tapEl('[data-act="build-plan"] button'); await sleep(1200); const w5 = await read()
  ok(drafts(w5).length === 0 && Object.keys(w5.walls).length === Object.keys(builtWalls).length + 3 && n0 - (await planks()) === 5, `5. ${N}: Build builds the edited plan (3 m, ${n0 - (await planks())} planks)`)
  await tapEl('[data-act="land"]'); ok(await poll(async () => (await grid()) === null), `6. ${N}: out of plan mode the grid is gone`)
  ok(errs.length === 0, `6. ${N}: 0 page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await p.close()
}
try { const only = flag('--only', ''); if (only !== 'desktop') await run(true); if (only !== 'phone') await run(false) } catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
