// Check: BETA M100, THE M MAP PANS + ZOOMS (Alex 11-23). Both worlds' maps, desk + phone 390:
//   the Ather's fold map (open/ather, DOM pins) and the Athernyx continent map (open/continent, a canvas).
//   wheel / pinch zooms TOWARD the pointer (the content under it stays under it), drag / one finger pans by the drag,
//   the view clamps at the picture's edges, Reset view brings the whole map back, stops keep their on-screen size and
//   still take a tap at zoom (the continent's Rune Hold door really steps you through).
// Reads the box's data-view (`k,x,y`, ui/pan-zoom-view.tsx) and the continent canvas's data-stops.
// npx tsx scripts/m100-map-zoom-check.mts   (URL= to point elsewhere; default prod)
import puppeteer, { type Page } from 'puppeteer-core'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const near = (a: number, b: number, e = 2) => Math.abs(a - b) <= e
type V = { k: number; x: number; y: number }
/** left/top: the box's content corner on screen; w/h: its CSS px (what the view is in); s: screen px per CSS px */
type Box = { left: number; top: number; w: number; h: number; s: number }

async function run(phone: boolean, which: 'ather' | 'continent') {
  const tag = `${phone ? 'phone' : 'desk'}/${which}`
  const p = await br.newPage()
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
  // a keeper who has been born (the birth screen covers everything for a fresh browser)
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* sandboxed */ } })
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1280, height: 900 })
  await p.goto(`${URL}/shimmer/open/${which}`, { waitUntil: 'load', timeout: 240000 })
  const panel = which === 'ather' ? '[data-panel="fold-map"]' : '[data-panel="continent-map"]'
  const BOX = `${panel} [data-panzoom]`
  if (which === 'ather') await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 })
  else await wait(25000)
  await wait(3000)
  if (phone) { await p.touchscreen.tap(195, 420); await wait(800) }
  for (let i = 0; i < 6 && !(await p.$(BOX)); i++) { await p.keyboard.press('KeyM'); await wait(2500) }
  if (!(await p.$(BOX))) { ok(false, `${tag}: M opens the map with a pan box`); await p.close(); return }
  if (which === 'ather') {   // the Athernyx face has the pins that are always there (the doors); flip to it, then test both faces
    // the Ather face first: it pans + zooms too
    await faceTest(p, BOX, `${tag} · Ather face`, phone, false)
    await p.keyboard.press('Tab'); await wait(1200)
    await faceTest(p, BOX, `${tag} · Athernyx face`, phone, true)
  } else await faceTest(p, BOX, tag, phone, true)
  ok(errs.length === 0, `${tag}: no page errors (${errs.slice(0, 2).join(' | ')})`)
  await p.close()
}

async function faceTest(p: Page, BOX: string, tag: string, phone: boolean, stops: boolean) {
  const view = async (): Promise<V> => { const a = await p.$eval(BOX, el => el.getAttribute('data-view') ?? ''); const [k, x, y] = a.split(',').map(Number); return { k, x, y } }
  const box = async (): Promise<Box> => p.$eval(BOX, el => { const r = el.getBoundingClientRect(), s = r.width / ((el as HTMLElement).offsetWidth || 1); return { left: r.left + el.clientLeft * s, top: r.top + el.clientTop * s, w: el.clientWidth, h: el.clientHeight, s } })
  // ★ FINISH THE FRAME'S OPEN ANIMATION (hearthOpen, scale .96 -> 1): a headless tab can stall it mid-way, and every px
  // measured before it lands is off by the scale. The pan box itself handles a scaled ancestor; this is the CHECK's ruler.
  await p.evaluate(() => { for (const a of document.getAnimations()) try { a.finish() } catch { /* infinite */ } })
  // let the frame's open animation settle: two equal reads
  for (let i = 0, last = ''; i < 20; i++) { const cur = JSON.stringify(await box()); if (cur === last) break; last = cur; await wait(300) }
  /** a stop's centre (page px) and size: a DOM pin (button in the layer) or a canvas stop from data-stops */
  const stop = async (): Promise<{ x: number; y: number; size: number; id: string } | null> => p.$eval(BOX, el => {
    const b = el.querySelector('[data-panzoom-layer] button') as HTMLElement | null
    if (b) { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width, id: b.title } }
    const c = el.querySelector('canvas[data-map="base"]') as HTMLCanvasElement | null, s = c?.dataset.stops ? JSON.parse(c.dataset.stops) : []
    if (!c || !s.length) return null
    const r = c.getBoundingClientRect()
    return { x: r.left + s[0].x, y: r.top + s[0].y, size: -1, id: s[0].id }
  })
  const b = await box()
  ok((await view()).k === 1, `${tag}: opens on the whole map (k=1)`)
  const top = await p.evaluate((BOX) => { const el = document.querySelector(BOX)!, r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el.contains(t) ? '' : (t?.outerHTML.slice(0, 120) ?? 'nothing') }, BOX)
  ok(top === '', `${tag}: nothing covers the map (${top})`)
  const s0 = await stop()
  if (stops) ok(!!s0, `${tag}: a stop is on the map (${s0?.id})`)
  // ── zoom toward a point off-centre ───────────────────────────────────────────────────────────────────────────
  const px = b.w * 0.3, py = b.h * 0.4   // CSS px of the box
  if (phone) await pinch(p, b.left + px * b.s, b.top + py * b.s, 40, 160)
  else { await p.mouse.move(b.left + px * b.s, b.top + py * b.s); for (let i = 0; i < 5; i++) { await p.mouse.wheel({ deltaY: -120 }); await wait(80) } }
  await wait(400)
  const v1 = await view()
  ok(v1.k > 1.8, `${tag}: ${phone ? 'pinch' : 'wheel'} magnifies (k=${v1.k})`)
  // the content point under the pointer stays under it: (p - x) / k is the same before (k=1, x=0) and after
  ok(v1.k > 1.8 && near((px - v1.x) / v1.k, px, phone ? 6 : 1.5) && near((py - v1.y) / v1.k, py, phone ? 6 : 1.5), `${tag}: zooms TOWARD the pointer (content under it ${((px - v1.x) / v1.k).toFixed(1)},${((py - v1.y) / v1.k).toFixed(1)} vs ${px.toFixed(1)},${py.toFixed(1)})`)
  if (s0) {
    const s1 = (await stop())!
    const ex = b.left + ((s0.x - b.left) / b.s * v1.k + v1.x) * b.s, ey = b.top + ((s0.y - b.top) / b.s * v1.k + v1.y) * b.s
    ok(v1.k > 1.8 && near(s1.x, ex, 3) && near(s1.y, ey, 3), `${tag}: the stop rides the picture (${s1.x.toFixed(0)},${s1.y.toFixed(0)} vs ${ex.toFixed(0)},${ey.toFixed(0)})`)
    if (s0.size > 0) ok(v1.k > 1.8 && near(s1.size, s0.size, 1), `${tag}: the stop keeps its size on screen (${s0.size.toFixed(1)} -> ${s1.size.toFixed(1)} px)`)
  }
  // ── drag pans by the drag ────────────────────────────────────────────────────────────────────────────────────
  const cx = b.left + b.w * b.s / 2, cy = b.top + b.h * b.s / 2
  const drag = async (dx: number, dy: number) => {
    if (phone) {
      await p.touchscreen.touchStart(cx, cy)
      for (let i = 1; i <= 8; i++) { await p.touchscreen.touchMove(cx + (dx * b.s * i) / 8, cy + (dy * b.s * i) / 8); await wait(16) }
      await p.touchscreen.touchEnd()
    } else {
      await p.mouse.move(cx, cy); await p.mouse.down()
      for (let i = 1; i <= 8; i++) { await p.mouse.move(cx + (dx * b.s * i) / 8, cy + (dy * b.s * i) / 8); await wait(16) }
      await p.mouse.up()
    }
    await wait(300)
  }
  await p.screenshot({ path: `/tmp/m100-${tag.replace(/\W+/g, "_")}.png` }).catch(() => {})
  const before = await view()
  const dx = Math.min(-before.x - 1, 40) > 10 ? 30 : -30, dy = Math.min(-before.y - 1, 40) > 10 ? 20 : -20   // a direction with room
  await drag(dx, dy)
  const v2 = await view()
  ok(near(v2.x - before.x, dx, 1.5) && near(v2.y - before.y, dy, 1.5), `${tag}: ${phone ? 'one finger' : 'a drag'} pans by the drag (${(v2.x - before.x).toFixed(1)},${(v2.y - before.y).toFixed(1)} vs ${dx},${dy})`)
  // ── clamps at the edges ──────────────────────────────────────────────────────────────────────────────────────
  for (let i = 0, last = ''; i < 24; i++) { await drag(b.w * 0.45, b.h * 0.45); const v = JSON.stringify(await view()); if (v === last) break; last = v }
  const v3 = await view()
  ok(v3.x === 0 && v3.y === 0, `${tag}: clamps at the top-left edge (x,y = ${v3.x},${v3.y})`)
  for (let i = 0, last = ''; i < 24; i++) { await drag(-b.w * 0.45, -b.h * 0.45); const v = JSON.stringify(await view()); if (v === last) break; last = v }
  const v4 = await view()
  ok(v4.k > 1.8 && near(v4.x, b.w - b.w * v4.k, 1) && near(v4.y, b.h - b.h * v4.k, 1), `${tag}: clamps at the bottom-right edge (${v4.x.toFixed(1)},${v4.y.toFixed(1)} vs ${(b.w - b.w * v4.k).toFixed(1)},${(b.h - b.h * v4.k).toFixed(1)})`)
  // ── a stop still takes a tap at zoom: bring one into view (zoom about it) and hit-test / tap it ─────────────
  if (stops) {
    const r1 = await p.$(`${BOX} [data-map-reset]`)
    ok(!!r1, `${tag}: a Reset view button is up once the view moved`)
    if (r1) { if (phone) await r1.tap(); else await r1.click() }
    await wait(400)
    ok(JSON.stringify(await view()) === JSON.stringify({ k: 1, x: 0, y: 0 }), `${tag}: Reset view brings the whole map back (${JSON.stringify(await view())})`)
    ok(!(await p.$(`${BOX} [data-map-reset]`)), `${tag}: and the button goes once it is home`)
    const s = (await stop())!
    if (phone) await pinch(p, s.x, s.y, 40, 160)
    else { await p.mouse.move(s.x, s.y); for (let i = 0; i < 6; i++) { await p.mouse.wheel({ deltaY: -120 }); await wait(80) } }
    await wait(400)
    const vz = await view(), sz = (await stop())!
    ok(vz.k > 1.8 && near(sz.x, s.x, 4) && near(sz.y, s.y, 4), `${tag}: zoomed x${vz.k.toFixed(2)} about the stop, it stays under the pointer`)
    if (sz.size > 0) {
      // DOM pin: the element under its centre is the pin (nothing over it, the layer did not eat it), and a real tap reaches it
      const hit = await p.evaluate((x, y, BOX) => { const e = document.elementFromPoint(x, y); const b = document.querySelector(`${BOX} [data-panzoom-layer] button`); return !!e && e === b }, sz.x, sz.y, BOX)
      ok(hit, `${tag}: at zoom the stop is what is under the pointer (clickable)`)
      const clicked = p.evaluate((BOX) => new Promise<boolean>(res => { const b = document.querySelector(`${BOX} [data-panzoom-layer] button`)!; const t = setTimeout(() => res(false), 2000); b.addEventListener('click', () => { clearTimeout(t); res(true) }, { once: true }) }), BOX)
      await wait(100)
      if (phone) await p.touchscreen.tap(sz.x, sz.y); else await p.mouse.click(sz.x, sz.y)
      ok(await clicked, `${tag}: and a real ${phone ? 'tap' : 'click'} on it lands as a click on the stop`)
      // and a DRAG that starts on the stop pans instead of clicking it
      const notClicked = p.evaluate((BOX) => new Promise<boolean>(res => { const b = document.querySelector(`${BOX} [data-panzoom-layer] button`)!; const t = setTimeout(() => res(true), 1500); b.addEventListener('click', () => { clearTimeout(t); res(false) }, { once: true }) }), BOX)
      await wait(100)
      if (phone) { await p.touchscreen.touchStart(sz.x, sz.y); for (let i = 1; i <= 6; i++) { await p.touchscreen.touchMove(sz.x - i * 6, sz.y - i * 5); await wait(16) } await p.touchscreen.touchEnd() }
      else { await p.mouse.move(sz.x, sz.y); await p.mouse.down(); for (let i = 1; i <= 6; i++) { await p.mouse.move(sz.x - i * 6, sz.y - i * 5); await wait(16) } await p.mouse.up() }
      const vd = await view()
      ok(await notClicked && (vd.x !== vz.x || vd.y !== vz.y), `${tag}: a drag that starts on a stop pans, it does not travel`)
    } else {
      // canvas: tap Rune Hold's door at zoom -> the continent steps you through to it
      const url0 = p.url()
      if (phone) await p.touchscreen.tap(sz.x, sz.y); else await p.mouse.click(sz.x, sz.y)
      let went = false
      for (let i = 0; i < 40 && !went; i++) { await wait(500); went = p.url() !== url0 && /at=/.test(p.url()) }
      ok(went, `${tag}: a tap on the door (${sz.id}) at zoom steps through (${p.url()})`)
    }
  }
}

/** Two-finger pinch about (x, y): fingers from d0 apart to d1 apart (CDP multi-touch). */
async function pinch(p: Page, x: number, y: number, d0: number, d1: number) {
  const cdp = await p.createCDPSession()
  const pts = (d: number) => [{ x: x - d / 2, y, id: 1 }, { x: x + d / 2, y, id: 2 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) })
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + ((d1 - d0) * i) / 10) }); await wait(20) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

const only = process.argv[2]
for (const [phone, which] of [[false, 'ather'], [true, 'ather'], [false, 'continent'], [true, 'continent']] as const) {
  if (only && !`${phone ? 'phone' : 'desk'}/${which}`.includes(only)) continue
  try { await run(phone, which) } catch (e) { ok(false, `${phone ? 'phone' : 'desk'}/${which}: threw ${String(e).slice(0, 200)}`) }
}
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS')
process.exit(fails ? 1 : 0)
