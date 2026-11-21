// ── PLAN-BAR LAYOUT check (sprites 11-21): nothing in plan mode overlaps, and the drawing stays in view, at a given size.
// SETUP (stated): a BUILT 6 x 6 room (injected), planks in the bag. Taps / one-finger drag on a phone size, mouse on desktop.
//   Plan -> Walls -> drag a 6 m run on the room's north line (the materials panel appears). Then, for the Walls state AND (phone)
//   the 'house' state: every button in the build bar, the materials panel and the floor switcher is the TOPMOST element at its own
//   centre (nothing covers it), the panels do not overlap each other or the bottom HUD, and the drawn run's middle is bare canvas.
//   npx tsx scripts/plan-layout-check.mts --size 390x844 [--url ...] [--out dir] [--tag before]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plan-layout')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const [W, H] = flag('--size', '390x844').split('x').map(Number), PHONE = W < 600, TAG = flag('--tag', 'now'), PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

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
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: W, height: H, isMobile: true, hasTouch: true } : { width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const walls: Record<string, { mat: string }> = {}
  for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
  for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
  const rk = findRooms(walls as any)[0].key
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid: { [rk]: 36 }, roof: 'gable' }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('plc')) return; sessionStorage.setItem('plc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${TAG}-${W}x${H}-${n}.png` }) } catch { /* slow frame */ } }
  const press = async (x: number, y: number) => { if (PHONE) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y) }
  const tapEl = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await press(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const unblock = (x: number, y: number) => p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y)
  const reblock = () => p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
    await unblock(a.x, a.y); await unblock(b.x, b.y)
    if (PHONE) { await p.touchscreen.touchStart(a.x, a.y); for (let n = 1; n <= 10; n++) { await p.touchscreen.touchMove(a.x + (b.x - a.x) * n / 10, a.y + (b.y - a.y) * n / 10); await sleep(40) } await p.touchscreen.touchEnd() }
    else { await p.mouse.move(a.x, a.y); await p.mouse.down(); for (let n = 1; n <= 10; n++) { await p.mouse.move(a.x + (b.x - a.x) * n / 10, a.y + (b.y - a.y) * n / 10); await sleep(40) } await p.mouse.up() }
    await reblock()
  }
  const drafts = () => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}).filter((x: any) => x.draft).length)
  // the audit: every button in the plan UI is topmost at its own centre; panels pairwise disjoint (and clear of the bottom HUD)
  const audit = (label: string, runMid: { x: number; y: number }) => p.evaluate((label: string, rm: { x: number; y: number }) => {
    const bad: string[] = []
    const panels = ['[data-build-bar]', '[data-plan-bom]', '[data-floor-switch]'].map(s => [s, document.querySelector(s)] as const).filter(([, e]) => !!e)
    const sel = '[data-build-bar] button, [data-plan-bom] button, [data-floor-switch] button'
    let n = 0
    for (const b of document.querySelectorAll<HTMLElement>(sel)) {
      const r = b.getBoundingClientRect(); if (!r.width || !r.height) continue
      // scrolled out of its own row (a phone's tab row scrolls): judged where it is visible, skip when wholly scrolled away
      const cx = Math.max(r.left + 2, Math.min(r.right - 2, r.left + r.width / 2)), cy = r.top + r.height / 2
      let host: Element | null = b.parentElement; let clipped = false
      while (host && host !== document.body) { const hr = host.getBoundingClientRect(), cs = getComputedStyle(host); if ((cs.overflowX === 'auto' || cs.overflowX === 'hidden' || cs.overflowX === 'scroll') && (r.right < hr.left + 4 || r.left > hr.right - 4)) { clipped = true; break } host = host.parentElement }
      if (clipped || cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) continue
      n++
      const top = document.elementFromPoint(Math.max(r.left + 3, Math.min(cx, innerWidth - 3)), cy)
      if (!top || !(top === b || b.contains(top))) bad.push(`${label}: ${b.dataset.act ?? b.dataset.tool ?? b.dataset.floor ?? b.dataset.found ?? b.dataset.roof ?? b.textContent?.slice(0, 12)} covered by ${(top as HTMLElement)?.dataset ? Object.keys((top as HTMLElement).dataset).join('/') || top?.tagName : top?.tagName}`)
    }
    const rects = panels.map(([s, e]) => [s, e!.getBoundingClientRect()] as const)
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i][1], c = rects[j][1]; if (a.left < c.right - 1 && a.right > c.left + 1 && a.top < c.bottom - 1 && a.bottom > c.top + 1) bad.push(`${label}: ${rects[i][0]} overlaps ${rects[j][0]}`) }
    const bom = document.querySelector('[data-plan-bom]')?.getBoundingClientRect()
    const hud = [...document.querySelectorAll<HTMLElement>('div')].filter(d => { const cs = getComputedStyle(d); const r = d.getBoundingClientRect(); return cs.position === 'fixed' && r.bottom > innerHeight - 4 && r.height > 40 && r.height < innerHeight / 3 && !d.closest('[data-plan-bom],[data-build-bar],[data-floor-switch]') && r.width > innerWidth / 2 })
    if (bom) for (const h of hud) { const r = h.getBoundingClientRect(); if (bom.bottom > r.top + 1 && bom.top < r.bottom) bad.push(`${label}: the materials panel overlaps the bottom HUD`) }
    const top = document.elementFromPoint(rm.x, rm.y)
    const runFree = top?.tagName === 'CANVAS'
    if (!runFree) bad.push(`${label}: the drawn run is covered (${top?.tagName} ${top ? Object.keys((top as HTMLElement).dataset ?? {}).join('/') : ''})`)
    return { bad, n }
  }, label, runMid)

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await press(W / 2, H - 200); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000)
  ok(await tapEl('[data-act="plan"]') && await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), `${W}x${H}: Plan: flying`)
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)
  ok(await tapEl('[data-tool="walls"]'), '   Walls'); await sleep(500)
  // a run 3 m north of the room (free ground, not on top of the room's own wall)
  const RZ = Z0 - 3
  for (let t = 0; t < 3 && (await drafts()) < 6; t++) { await settled(); const v = await view(); await drag(screenOf(v, X0, RZ), screenOf(v, X1, RZ)); await sleep(1000) }
  ok((await drafts()) === 6, `   a drag planned the 6 m run (${await drafts()}); the materials panel shows: ${await p.evaluate(() => !!document.querySelector('[data-plan-bom]'))}`)
  await sleep(600)
  const v = await view(), mid = screenOf(v, (X0 + X1) / 2, RZ)
  const a1 = await audit('walls', mid); await shot('walls')
  ok(a1.bad.length === 0, `1. Walls state: ${a1.n} buttons all clear, panels apart, the run in view${a1.bad.length ? ': ' + a1.bad.slice(0, 4).join(' | ') : ''}`)
  if (PHONE) {
    const hb = await tapEl('[data-act="house-settings"]'); await sleep(500)
    if (hb) {
      const a2 = await audit('house', mid); await shot('house')
      ok(a2.bad.length === 0 && await p.evaluate(() => !!document.querySelector('[data-found="0.6"]') && !!document.querySelector('[data-roof="hip"]') && !!document.querySelector('[data-act="walls-down"]')), `2. house state: roof, foundation and walls-down all there and clear (${a2.n} buttons)${a2.bad.length ? ': ' + a2.bad.slice(0, 4).join(' | ') : ''}`)
    } else ok(false, '2. house state: no house tab (the old layout)')
  }
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
  console.log(`shots in ${out}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
