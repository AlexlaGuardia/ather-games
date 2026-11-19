// ── BETA M2/M3 on the CONTINENT page (/shimmer/open/continent), phone, fresh profile (2026-11-17, world lane) ──────
// The continent twin of beta-audit-2.mts. Touch emulation, taps "Tap to drive", then asserts:
//   M2  no two HUD elements overlap (bounding boxes of the HUD layer: touch buttons, status chip, minimap, hotbar,
//       compass, messages, speedometer...), at the given size
//   M3  every [data-touch] is topmost under its own centre (elementFromPoint); the move thumb-zone (stick hint) does
//       not sit on the hotbar; every tap-row chip opens its panel AND closes by tap; a left-thumb drag moves the car
//   npx tsx scripts/beta-audit-continent.mts [--url http://localhost:3201] [--w 390 --h 844] [--out /tmp/beta-cont]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/beta-cont')
const phase = flag('--phase', 'all') // drive | foot | all (a run is ~3 min on SwiftShader: split to fit a foreground call)
const W = Number(flag('--w', '390')), H = Number(flag('--h', '844'))
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.createBrowserContext()
const p = await ctx.newPage()
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await p.evaluateOnNewDocument('window.__name = (f) => f')
const errs: string[] = []
p.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 200)))
p.on('console', m => { if (m.type() === 'error') errs.push('console.error ' + m.text().slice(0, 200)) })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++ }
const car = () => p.evaluate(() => { const s = (window as any).__drive?.state?.(); return s ? { x: s.x as number, z: s.z as number } : null }).catch(() => null)
const shot = (n: string) => p.screenshot({ path: `${out}/${W}x${H}-${n}.png` }).catch(() => {})
const drag = async (x0: number, y0: number, dx: number, dy: number, ms: number) => {
  await p.touchscreen.touchStart(x0, y0)
  const n = Math.max(4, Math.round(ms / 100))
  for (let i = 1; i <= n; i++) { await p.touchscreen.touchMove(x0 + dx * Math.min(1, i / 4), y0 + dy * Math.min(1, i / 4)); await sleep(100) }
  await p.touchscreen.touchEnd()
}
console.log(`continent audit ${url} at ${W}x${H}`)
await p.goto(`${url}/shimmer/open/continent`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 180000 }).catch(() => {})
await sleep(3000)
// birth gate (fresh profile), then "Tap to drive"
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.touchscreen.tap(box.x, box.y); return true
}
await tapText(/^BE BORN/); await sleep(6000)
// M29 (11-19): the keeper creator follows the birth; a stranger takes the default with a real tap on Looks good
for (let i = 0; i < 20; i++) { const b = await p.evaluate(() => { const e = document.querySelector('[data-creator-done]'); const r = e?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }); if (b) { await p.touchscreen.tap(b.x, b.y); await sleep(2500); break } await sleep(500) }
ok(await tapText(/^Tap to drive$/), 'tapped "Tap to drive"'); await sleep(2500); await shot('start')

// ── M2 + M3 layout, run once driving and once on foot ──
const layout = async (mode: string) => {

const boxes = await p.evaluate(() => {
  const vis = (e: Element) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 }
  const sels: [string, string][] = [['touch', '[data-touch]'], ['hud', '[data-hud]'], ['hudbox', '[data-hud-box]']]
  const out: { id: string; x: number; y: number; w: number; h: number }[] = []
  for (const [k, s] of sels) document.querySelectorAll<HTMLElement>(s).forEach((e, i) => { if (vis(e)) { const r = e.getBoundingClientRect(); out.push({ id: `${k}:${e.dataset.touch ?? e.dataset.hud ?? e.dataset.hudBox ?? i}`, x: r.x, y: r.y, w: r.width, h: r.height }) } })
  // stick hint = the move thumb-zone
  document.querySelectorAll<HTMLElement>('div').forEach(e => { if (/^thumb here to/i.test((e.innerText ?? '').trim()) && e.children.length === 0 && vis(e)) { const r = e.getBoundingClientRect(); out.push({ id: 'stickhint', x: r.x, y: r.y, w: r.width, h: r.height }) } })
  return out
})
console.log('  HUD boxes:', boxes.map(b => `${b.id}[${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}]`).join(' '))
const hit: string[] = []
for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
  const a = boxes[i], c = boxes[j]
  const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y)
  if (ox > 2 && oy > 2) hit.push(`${a.id} x ${c.id} (${Math.round(ox)}x${Math.round(oy)})`)
}
ok(hit.length === 0, hit.length ? `M2[${mode}] overlaps: ${hit.join('; ')}` : `M2[${mode}] no overlap among ${boxes.length} HUD boxes`)
const offs = boxes.filter(b => b.x < -4 || b.y < -4 || b.x + b.w > W + 4 || b.y + b.h > H + 4)  // the phone hotbar is 364 wide: 2px per side at 360, a template number
ok(offs.length === 0, offs.length ? `M2[${mode}] off-screen: ${offs.map(o => o.id).join(', ')}` : `M2[${mode}] every HUD box on screen`)

// ── M3: reach ──
const reach = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-touch]')].map(e => {
  const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return { b: e.dataset.touch, ok: !!top && e.contains(top), on: top && !e.contains(top) ? (top.textContent ?? top.tagName).trim().slice(0, 30) : undefined }
}))
const covered = reach.filter(r => !r.ok)
ok(reach.length > 0 && covered.length === 0, covered.length ? `M3[${mode}] covered: ${JSON.stringify(covered)}` : `M3[${mode}] all ${reach.length} touch buttons topmost under their centre`)

}
const panelUp = () => p.evaluate(() => !!document.querySelector('[data-panel], [aria-label="close"], [role="dialog"]'))
const ROW = ['map', 'pack', 'options', 'camera', 'garage', 'road', 'friends', 'journal']
const rowShown = () => p.evaluate((rows: string[]) => [...document.querySelectorAll<HTMLElement>('[data-touch]')].map(e => (e.dataset.touch ?? '').toLowerCase()).filter(l => rows.includes(l)), ROW)
const tapTouch = async (l: string) => {
  const pt = await p.evaluate((l: string) => { const e = document.querySelector<HTMLElement>(`[data-touch="${l}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, l)
  if (pt) await p.touchscreen.tap(pt.x, pt.y)
  return !!pt
}
// MENU: at rest only the menu chip shows from the row; tap it to open, tap again to fold
const menuRest = async (mode: string) => {
  const shown = await rowShown()
  const hasMenu = await p.evaluate(() => !!document.querySelector('[data-touch="menu"]'))
  ok(hasMenu && shown.length === 0, `MENU[${mode}] at rest only the menu chip: menu=${hasMenu} row buttons visible=[${shown}]`)
  await tapTouch('menu'); await sleep(400)
  const open = await rowShown()
  ok(open.length > 0, `MENU[${mode}] tapping the chip opens the row: [${open}]`)
  await tapTouch('menu'); await sleep(400)
  ok((await rowShown()).length === 0, `MENU[${mode}] tapping the chip again folds it`)
}
const chip = async (l: string, mode: string) => {
  if (!(await rowShown()).includes(l)) { await tapTouch('menu'); await sleep(400) }
  const pt = await p.evaluate((l: string) => { const e = document.querySelector<HTMLElement>(`[data-touch="${l}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, l)
  if (!pt) { ok(false, `M3[${mode}] chip "${l}" missing from the tap row`); return }
  await p.touchscreen.tap(pt.x, pt.y); await sleep(1800)
  const opened = await panelUp(); await shot(`${mode}-chip-${l}`)
  ok(opened, `M3[${mode}] ${l} opens its panel`)
  if (!opened) return
  const x = await p.$('[aria-label="close"]')
  let closed = false
  if (x) { await x.tap().catch(() => {}); await sleep(900); closed = !(await panelUp()) }
  ok(closed, `M3[${mode}] ${l} panel closes by tap${x ? '' : ' (no [aria-label=close] found)'}`)
  ok((await rowShown()).length === 0, `MENU[${mode}] picking ${l} folded the row`)
  if (!closed) { await p.keyboard.press('Escape').catch(() => {}); await sleep(500) }
}
if (phase !== 'foot') {
await layout('drive')
await menuRest('drive')
// ── M3: a left-thumb drag moves the car ──
const c0 = await car()
await drag(90, H - 260, 0, -70, 4000); await sleep(600)
const c1 = await car()
const moved = c0 && c1 ? Math.hypot(c1.x - c0.x, c1.z - c0.z) : 0
ok(moved > 3, `M3 thumb moves the car (${moved.toFixed(1)} m)`)
await shot('after-drag')

// ── M3: every tap-row chip opens a panel and the panel closes by tap ──
for (const l of ['map', 'options', 'pack']) await chip(l, 'drive')
}
if (phase !== 'drive') {
// ── on foot: get out, same layout checks, thumb moves the keeper ──
await p.evaluate(() => { const d = (window as any).__drive, s = d.state(); d.footTp(s.x, s.z, s.yaw ?? 0) }); await sleep(3500); await shot('foot')
await layout('foot')
await menuRest('foot')
const f0 = await p.evaluate(() => { const s = (window as any).__drive?.foot?.(); return s && s.mode === 'foot' ? { x: s.px as number, z: s.pz as number } : null })
ok(!!f0, 'M3 get out put the keeper on foot')
await drag(90, H - 260, 0, -70, 4000); await sleep(600)
const f1 = await p.evaluate(() => { const s = (window as any).__drive?.foot?.(); return s && s.mode === 'foot' ? { x: s.px as number, z: s.pz as number } : null })
const fm = f0 && f1 ? Math.hypot(f1.x - f0.x, f1.z - f0.z) : 0
ok(fm > 1, `M3 thumb moves the keeper (${fm.toFixed(1)} m)`)
for (const l of ['map', 'options', 'pack']) await chip(l, 'foot')
}
const real = errs.filter(e => !/favicon|Failed to load resource/.test(e))
ok(real.length === 0, real.length ? `errors: ${real.slice(0, 4).join(' | ')}` : 'no page/console errors')
console.log(fails ? `RESULT ${W}x${H}: ${fails} FAIL` : `RESULT ${W}x${H}: PASS`)
await b.close()
process.exit(fails ? 1 : 0)
