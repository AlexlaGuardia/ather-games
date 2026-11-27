// BETA M144 on prod (PHONE 390x844, touch, a FRESH profile = a fresh test keeper, never Alex's save): a built column + a built wall
// metre, a FULL bag. 1 both come down (no 'Your bag is full'), into the store, nothing to the bag  2 the catalog shows '1 stored'
// 3 a reload keeps it  4 the same plan again: the card says 2 from the store, no materials; Build charges nothing  5 down again;
// Break down into a full bag keeps them; with room = exactly the old refund (3 planks + 1, 0.5 carried)  6 0 page errors
//   npx tsx scripts/m144-store-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { itemDef } from '../src/app/shimmer/open/shared/inventory'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m144-2026-11-27')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
let W = 390, H = 844; const PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [8, 6]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const CX = spot.x + 2, CZ = spot.z, WX = spot.x - 2, WZ = spot.z, WK = `h,${WX},${WZ}`, CK = `${CX},${CZ}`   // a column corner + one wall metre
console.log(`column ${CK}, wall ${WK}`)
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number, wy = 0) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, GROUND_Y + wy, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const BAIT = itemDef('bait').stack
async function run() {
  const N = 'phone'
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  // a FRESH test keeper (new browser context): a BUILT column + a BUILT wall metre, and a FULL bag (no room for any refund)
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls: { [WK]: { mat: 'goldwood' } }, roof: 'gable', cols: { [CK]: { mat: 'goldwood' } } }
  await p.evaluateOnNewDocument((works: string, bait: number) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m144')) return; sessionStorage.setItem('m144', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null).map(() => ({ id: 'bait', n: bait })); slots[0] = { id: 'repeater', n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works), BAIT)
  const read = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'))
  const bag = () => p.evaluate(() => localStorage.getItem('open.inv.v1'))
  const planks = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(s => s?.id === 'goldwood_plank').reduce((a, s) => a + s.n, 0))
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play|Tap to start/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tapEl = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.touchscreen.tap(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const unblock = (x: number, y: number) => p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y)
  const reblock = () => p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  const tapAt = async (wx: number, wz: number) => { await settled(); const s = screenOf(await view(), wx, wz); await unblock(s.x, s.y); await p.touchscreen.tap(s.x, s.y); await sleep(900); await reblock() }
  const line = async (x0: number, z0: number, x1: number, z1: number) => {
    await settled(); const v = await view(), a = screenOf(v, x0, z0), b = screenOf(v, x1, z1)
    await unblock(a.x, a.y); await unblock(b.x, b.y)
    await p.touchscreen.touchStart(a.x, a.y); for (let n = 1; n <= 10; n++) { await p.touchscreen.touchMove(a.x + (b.x - a.x) * n / 10, a.y + (b.y - a.y) * n / 10); await sleep(40) } await p.touchscreen.touchEnd()
    await reblock(); await sleep(900)
  }
  const load = async () => {
    await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(3500); await hideCard()
    await p.touchscreen.tap(W / 2, H - 200); await sleep(800)
  }
  const fly = async () => {
    for (let t = 0; t < 3; t++) {
      await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1800)
      await p.keyboard.press('e'); await sleep(1200)
      if (await tapEl('[data-act="plan"]') && await poll(() => p.evaluate(() => (window as any).__build?.on() === true))) break
    }
    await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot!.x, spot!.z); await sleep(500)
    return await p.evaluate(() => (window as any).__build?.on() === true)
  }
  const tool = async (t: string) => { const cur = await p.evaluate(() => (window as any).__build.tool()); if (cur !== t) await tapEl(`[data-tool="${t === 'look' ? cur : t}"]`); await sleep(400) }   // 'look' = tap the active tool off
  const catalog = async (open: boolean) => { const on = await p.evaluate(() => document.querySelector('[data-act="wall-catalog"]')?.getAttribute('aria-pressed') === 'true'); if (on !== open) await tapEl('[data-act="wall-catalog"]'); await sleep(600) }
  const stored = (w: any, k: string) => w.stored?.[k]?.n ?? 0

  await load(); const bag0 = await bag()
  ok(await fly(), `   ${N}: plan mode`)
  // 1. take both down with a FULL bag: no refusal, both go into the store, the bag is untouched
  await tool('column'); for (let t = 0; t < 3 && (await read()).cols?.[CK]; t++) await tapAt(CX, CZ)
  await tool('erase'); for (let t = 0; t < 3 && (await read()).walls?.[WK]; t++) await line(WX, WZ, WX + 1, WZ)
  const w1 = await read()
  ok(!w1.cols?.[CK] && !w1.walls?.[WK], `1. column + wall metre came down with a FULL bag (cols ${JSON.stringify(w1.cols ?? {})}, wall ${!!w1.walls?.[WK]})`)
  ok(stored(w1, 'col:goldwood') === 1 && stored(w1, 'wall:goldwood') === 1, `1. the store holds them: ${JSON.stringify(w1.stored)}`)
  ok(await bag() === bag0, '1. nothing went to the bag')
  // 2. the catalog shows 'N stored'
  await tool('look'); await catalog(true)
  const cat = await p.evaluate(() => ({ rows: [...document.querySelectorAll('[data-stored]')].map(e => `${e.getAttribute('data-stored')}=${e.getAttribute('data-n')}|${e.textContent}`), wood: document.querySelector('[data-cat="walls:goldwood"]')?.textContent ?? '' }))
  ok(cat.rows.some(r => r.startsWith('col:goldwood=1|') && r.includes('1 stored')) && cat.rows.some(r => r.startsWith('wall:goldwood=1|')), `2. the catalog's Stored rows: ${cat.rows.join(' ; ')}`)
  ok(cat.wood.includes('1 stored'), `2. the Goldwood wall card says '1 stored' (${cat.wood})`)
  await shot('m144-1-stored')
  // 3. reload keeps the store
  await load(); const w3 = await read(); ok(stored(w3, 'col:goldwood') === 1 && stored(w3, 'wall:goldwood') === 1, `3. a reload keeps the store (${JSON.stringify(w3.stored)})`)
  // 4. plan the same column + metre: the plan card says 2 from the store, nothing to pay; Build charges nothing
  ok(await fly(), `   ${N}: plan mode again`)
  await tool('column'); for (let t = 0; t < 3 && !(await read()).cols?.[CK]; t++) await tapAt(CX, CZ)
  await tool('walls'); for (let t = 0; t < 3 && !(await read()).walls?.[WK]; t++) await line(WX, WZ, WX + 1, WZ)
  const w4 = await read(); ok(w4.cols?.[CK]?.draft === true && w4.walls?.[WK]?.draft === true, '4. both planned again')
  await tool('look'); await sleep(800)
  const card = await p.evaluate(() => { const c = document.querySelector('[data-plan-bom]'); return c ? { ready: c.getAttribute('data-ready'), st: c.querySelector('[data-bom-stored]')?.getAttribute('data-bom-stored'), lines: c.querySelectorAll('[data-bom-line]').length, text: c.textContent } : null })
  ok(!!card && card.ready === 'true' && card.st === '2' && card.lines === 0, `4. plan card: ready, 2 from the store, no materials (${JSON.stringify(card)})`)
  await shot('m144-2-plan-card')
  await tapEl('[data-act="build-plan"] button'); await sleep(1500)
  const w5 = await read()
  ok(!!w5.cols?.[CK] && !w5.cols[CK].draft && !!w5.walls?.[WK] && !w5.walls[WK].draft, '4. Build stands both')
  ok(stored(w5, 'col:goldwood') === 0 && stored(w5, 'wall:goldwood') === 0 && await bag() === bag0, `4. Build charged nothing and took them from the store (${JSON.stringify(w5.stored)})`)
  // 5. down again, then Break down into a bag with room: exactly the pre-M144 refund (column 3 planks; a 1.5-plank metre = 1 plank + 0.5 carried)
  await tool('column'); for (let t = 0; t < 3 && (await read()).cols?.[CK]; t++) await tapAt(CX, CZ)
  await tool('erase'); for (let t = 0; t < 3 && (await read()).walls?.[WK]; t++) await line(WX, WZ, WX + 1, WZ)
  ok(stored(await read(), 'col:goldwood') === 1 && stored(await read(), 'wall:goldwood') === 1, '5. both stored again')
  await tool('look'); await catalog(true)
  await tapEl('[data-act="break-down"][data-key="col:goldwood"] button'); await sleep(800)
  ok(stored(await read(), 'col:goldwood') === 1, '5. Break down into a FULL bag keeps the column stored')
  await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('open.inv.v1')!); v.slots = v.slots.map((s: any, i: number) => (i < 8 ? s : null)); localStorage.setItem('open.inv.v1', JSON.stringify(v)) })
  await load(); ok(await fly(), `   ${N}: plan mode (bag with room)`); await tool('look'); await catalog(true)
  const pk0 = await planks()
  await tapEl('[data-act="break-down"][data-key="col:goldwood"] button'); await sleep(800)
  await tapEl('[data-act="break-down"][data-key="wall:goldwood"] button'); await sleep(800)
  const w6 = await read(), got = (await planks()) - pk0
  ok(got === 4 && Math.abs((w6.wallCarry?.goldwood_plank ?? 0) - 0.5) < 1e-9, `5. Break down = the old refund: ${got} planks (3 column + 1), 0.5 carried (${JSON.stringify(w6.wallCarry)})`)
  ok(!w6.stored || Object.keys(w6.stored).length === 0, `5. the store is empty (${JSON.stringify(w6.stored)})`)
  await shot('m144-3-broken-down')
  ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`)
  await p.close()
}
try { await run() } catch (e) { ok(false, String(e).slice(0, 300)) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
