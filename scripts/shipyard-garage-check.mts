// ── BETA M49 s5: THE SHIPYARD GARAGES, driven (2026-11-22, world; docs/M49-shipyards.md) ──────────────────────────────────
// A fresh keeper (real BE BORN tap) who owns two coursers (the Darter, driven, and an Ashcombe Dray), at Kael's shipyard above
// Rune Hold (4 bays):
//   1 · the courser set down on the ground short of the COURSER ramp's foot; the plot mounts
//   2 · DRIVEN (the real courser tick, steered through __drive.input by a pursuit run in the page each frame) up the ramp
//       along the landing, through the gate onto the floor, across to bay 1 and nose in; stopped -> the garage holds the Darter
//   3 · F: out of the car, on foot on the floor beside it; walk off across the yard
//   4 · reload: the garage still holds the Darter AND the car is back in bay 1 (not on the road)
//   5 · the Dray: the save seeded with it in bay 2 (a second courser parked earlier), reload; it stands in bay 2; on foot, the
//       crosshair on it + a real E tap takes it out: the Dray is now driven (fleet.active), in bay 2; the Darter stays in bay 1
//   6 · F in, back the Dray out of bay 2: bay 2 frees, bay 1 keeps the Darter
// Shots at each step (desktop; --phone = 390x844 for the parked shot). PASS = all of that + 0 page errors.
//   npx tsx scripts/shipyard-garage-check.mts [origin, default https://ather.games] [--out /tmp/shipyard-garage] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : flag('--url', 'https://ather.games')).replace(/\/$/, '')
const out = flag('--out', '/tmp/shipyard-garage'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const KAEL = 'front:shipyard', DARTER = 'darter', DRAY = 'dray'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.evaluateOnNewDocument('self.__name = (f) => f')   // tsx (esbuild keepNames) wraps named functions passed to evaluate in __name
await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, any> = { url, phone: PHONE }
const t00 = Date.now(), say = (m: string) => console.log(`[${((Date.now() - t00) / 1000).toFixed(0)}s] ${m}`)
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 900)).catch(() => '?')
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const fail = (step: string, why: string) => done(false, `FAIL at "${step}": ${why}`)
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 60) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.mouse.click(box.x, box.y); return true
}
const S = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__shipyards?.['front:shipyard']?.[f]?.(...args) ?? null, fn, a) as Promise<any>
const site = () => p.evaluate(() => ((window as any).__shipyards?.sites?.() ?? []).find((q: any) => q.key === 'front:shipyard')) as Promise<any>
const car = () => p.evaluate(() => (window as any).__drive.state()) as Promise<any>
const footState = () => p.evaluate(() => (window as any).__drive.foot()) as Promise<any>
/** F (in/out of the courser) is read in a game frame, about one a second headless: hold it across a frame, then wait on the mode */
const fTo = async (mode: 'foot' | 'drive') => { await p.keyboard.down('KeyF'); await sleep(1500); await p.keyboard.up('KeyF'); return poll(async () => (await footState())?.mode === mode, 30000) }
const fleet = () => p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const q = localStorage.key(i)!; if (q.endsWith('open.fleet.v1')) return JSON.parse(localStorage.getItem(q)!) } return null })
const toW = (s: any, lx: number, lz: number) => ({ x: s.x + s.ax[0] * lx + s.az[0] * lz, z: s.z + s.ax[1] * lx + s.az[1] * lz })
const toL = (s: any, x: number, z: number) => { const dx = x - s.x, dz = z - s.z; return { lx: dx * s.ax[0] + dz * s.ax[1], lz: dx * s.az[0] + dz * s.az[1] } }
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz)
const resume = async () => { if (/click to resume|tap to start/i.test(String(await text()))) { await p.mouse.click(PHONE ? 195 : 500, PHONE ? 420 : 320); await sleep(800) } }
const loadContinent = async () => {
  await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__shipyards?.sites, { timeout: 240000 }); await sleep(2500)
  await resume()
}
/** the pursuit, run IN the page once a frame (a node-side loop would steer at the RPC's pace, not the game's): heads for each
 *  world waypoint in turn through __drive.input (the real courser tick drives), handbrake on at the last. `rev` = back up. */
const pilot = (pts: { x: number; z: number }[], rev = false) => p.evaluate((pts: { x: number; z: number }[], rev: boolean) => {
  const w = window as any, g = { k: 0, done: false, frames: 0 }; w.__gp = g
  const tick = () => {
    if (g.done) return
    g.frames++
    const c = w.__drive.state(), q = pts[g.k], dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz), last = g.k === pts.length - 1
    if (d < (last ? 0.7 : 2.0)) { g.k++; if (g.k >= pts.length) { g.done = true; w.__drive.input({ throttle: 0, steer: 0, handbrake: true }); return } }
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw), fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
    const side = (dx * rx + dz * rz) / (d || 1), fwd = (dx * fx + dz * fz) / (d || 1), sp = Math.hypot(c.vx, c.vz)
    if (rev) { w.__drive.input({ throttle: sp < 2.5 ? -0.5 : 0, steer: 0, handbrake: false }) }
    else {
      const want = last ? Math.min(3, d * 1.2) : 4.5
      w.__drive.input({ throttle: fwd < 0 ? 0.4 : sp < want ? 0.55 : 0, steer: Math.max(-1, Math.min(1, fwd < 0 ? Math.sign(side || 1) : side * 2.5)), handbrake: false })
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}, pts, rev)
const pilotDone = () => p.evaluate(() => (window as any).__gp ?? null) as Promise<any>
const stopPilot = () => p.evaluate(() => { const w = window as any; if (w.__gp) w.__gp.done = true; w.__drive.input({ throttle: 0, steer: 0, handbrake: true }) })
const shot = async (name: string, from?: { lx: number; lz: number; up: number }, at?: { lx: number; lz: number }) => {
  if (from && at) { const s = await site(), a = toW(s, from.lx, from.lz), b = toW(s, at.lx, at.lz); await p.evaluate((q: number[]) => (window as any).__drive.shot(q), [a.x, s.floor + from.up, a.z, b.x, s.floor, b.z]); await sleep(4000) }
  await p.screenshot({ path: `${out}/${name}.png` })
  if (from) await p.evaluate(() => (window as any).__drive.shot(null))
}

// 0 · born; two coursers owned, the Darter driven; no garage saved
say('born')
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
if (!await tapText(/^BE BORN/)) await fail('born', 'BE BORN tap not found')
await sleep(6000)
const seedFleet = (garage: (string | null)[] | null) => p.evaluate((d: string, y: string, gar: (string | null)[] | null) => {
  let pre = ''
  for (let i = 0; i < localStorage.length; i++) { const q = localStorage.key(i)!; if (q.endsWith('open.inv.v1')) pre = q.slice(0, -'open.inv.v1'.length) }
  localStorage.setItem(pre + 'open.fleet.v1', JSON.stringify({ v: 1, owned: [d, y], active: d }))
  if (gar) localStorage.setItem(pre + 'open.garage:kael', JSON.stringify({ v: 1, bays: gar })); else localStorage.removeItem(pre + 'open.garage:kael')
  return pre
}, DARTER, DRAY, garage)
res.prefix = await seedFleet(null)
say('continent'); await loadContinent()
const s = await site(); if (!s) await fail('site', 'no Kael shipyard')
const ramp = (await p.evaluate(() => (window as any).__shipyards?.sites?.()?.[0]?.ramp)) // walker ramp (for the record)
// 1 · the courser on the ground short of the courser ramp's foot (the ramp's length is the plot probe's; mount first)
const g = 3, pre = toW(s, -g - 30, -52)
await p.evaluate((x: number, z: number, w: number) => (window as any).__drive.tp(x, z, w), pre.x, pre.z, yawTo(s.ax[0], s.ax[1]))
if (!await poll(async () => !!(await S('plot')), 120000)) await fail('mount', `Kael's plot did not mount (car ${JSON.stringify(await car())})`)
const cr = await S('carRamp'); res.carRamp = cr; res.walkerRamp = ramp
const start = toW(s, -g - cr.L - 4, -52)
await p.evaluate((x: number, z: number, w: number) => (window as any).__drive.tp(x, z, w), start.x, start.z, yawTo(s.ax[0], s.ax[1])); await sleep(2000)
await shot('g0-ramp-foot', { lx: -g - cr.L - 16, lz: -70, up: 8 }, { lx: -g - cr.L / 2, lz: -52 })
// 2 · drive in
say('drive in')
const b0 = await S('bayPose', 0), b0L = toL(s, b0.x, b0.z)
const path = [toW(s, -g - 1, -52), toW(s, 0, -46), toW(s, 0, -40), toW(s, b0L.lx - 10, b0L.lz), toW(s, b0L.lx - 3.5, b0L.lz), { x: b0.x, z: b0.z }]
await pilot(path)
// a stall is counted in the GAME's frames (SwiftShader on a busy box draws ~1 a second), never in wall-clock seconds
const t1 = Date.now(); let lastK = -1, lastKF = 0
while (Date.now() - t1 < 900000) {
  await sleep(2000); const gp = await pilotDone(); if (gp?.done) break
  if (gp?.k !== lastK) { lastK = gp?.k; lastKF = gp?.frames ?? 0 } else if ((gp?.frames ?? 0) - lastKF > 600) break
}
await poll(async () => (await S('garage'))?.bays?.[0] === 'darter', 120000)   // stopping takes GAME time (a frame a second here)
const c1 = await car(), l1 = toL(s, c1.x, c1.z), g1 = await S('garage')
res.driveIn = { pilot: await pilotDone(), lx: +l1.lx.toFixed(2), lz: +l1.lz.toFixed(2), y: +c1.y.toFixed(2), floor: +s.floor.toFixed(2), garage: g1 }
await stopPilot()
if (!(await pilotDone())?.k || g1?.bays?.[0] !== DARTER) {
  await shot('g1-FAIL'); await fail('drive in', `the Darter did not end parked in bay 1: ${JSON.stringify(res.driveIn)}`)
}
if (Math.abs(c1.y - s.floor) > 0.4) await fail('drive in', `parked but not on the floor: ${JSON.stringify(res.driveIn)}`)
if (!/parked in bay 1/i.test(String(await text())) && !String(g1.stored ?? '').includes(DARTER)) await fail('drive in', `no save: ${JSON.stringify(g1)}`)
await shot('g1-parked', { lx: b0L.lx - 16, lz: b0L.lz - 10, up: 6 }, { lx: b0L.lx, lz: b0L.lz })
// 3 · F out, walk off
say('step out')
// F is read in a game frame (about one a second headless): hold it across a frame, wait on the mode, one retry if unseen
if (!await fTo('foot')) await fTo('foot')
await sleep(1500)
const f3 = await footState()
if (f3?.mode !== 'foot' || Math.abs(f3.py - s.floor) > 0.4) await fail('step out', `not on foot on the floor: ${JSON.stringify(f3)}`)
res.stepOut = { feet: +f3.py.toFixed(2), ...(() => { const l = toL(s, f3.px, f3.pz); return { lx: +l.lx.toFixed(1), lz: +l.lz.toFixed(1) } })() }
const away = toW(s, 0, 0)
await p.evaluate((x: number, z: number, w: number) => (window as any).__drive.footTp(x, z, w), away.x, away.z, yawTo(b0.x - away.x, b0.z - away.z)); await sleep(2500)
const g3 = await S('garage'); if (g3?.bays?.[0] !== DARTER) await fail('walk off', `walking off unparked it: ${JSON.stringify(g3)}`)
await shot('g3-walked-off')
// 4 · reload: still parked, and the car is in its bay
say('reload')
await loadContinent()
const c4 = await car(), d4 = Math.hypot(c4.x - b0.x, c4.z - b0.z)
if (d4 > 1.5) await fail('reload', `the car did not come back to bay 1 (${d4.toFixed(1)} m off): ${JSON.stringify({ x: c4.x, z: c4.z })}`)
if (!await poll(async () => !!(await S('plot')), 120000)) await fail('reload', 'plot did not mount')
await sleep(2000)
const g4 = await S('garage'); res.reload = { carOff: +d4.toFixed(2), y: +c4.y.toFixed(2), garage: g4 }
if (g4?.bays?.[0] !== DARTER || g4.carBay !== 0) await fail('reload', `not parked after reload: ${JSON.stringify(res.reload)}`)
// 5 · the Dray parked in bay 2 earlier: reload, take it out by the crosshair + E
say('the Dray')
await seedFleet([DARTER, DRAY, null, null])
const dump = () => p.evaluate(() => { const o: Record<string, string | null> = {}; for (let i = 0; i < localStorage.length; i++) { const q = localStorage.key(i)!; if (/open\.(fleet|garage)/.test(q)) o[q] = localStorage.getItem(q) } return o })
res.seeded = await dump()
await loadContinent()
res.afterReload = await dump()
if (!await poll(async () => !!(await S('plot')), 120000)) await fail('dray', 'plot did not mount')
await sleep(2500)
const b1 = await S('bayPose', 1), b1L = toL(s, b1.x, b1.z), stand = toW(s, b1L.lx - 4.2, b1L.lz)
if (!await fTo('foot')) await fTo('foot')   // out of the Darter (it stays in bay 1)
await p.evaluate((x: number, z: number, w: number) => { (window as any).__drive.footTp(x, z, w, -0.35); (window as any).__drive.look(w, -0.35) }, stand.x, stand.z, yawTo(b1.x - stand.x, b1.z - stand.z))
if (!await poll(async () => (await S('garage'))?.aimBay === 1, 30000)) await fail('dray aim', `crosshair not on the Dray: ${JSON.stringify(await S('garage'))} seeded ${JSON.stringify(res.seeded)} after ${JSON.stringify(res.afterReload)} now ${JSON.stringify(await dump())}`)
await shot('g5-dray-aimed')
// the E prompt: a touch pill on --phone, the yard prompt (E · Take out) on desktop
const promptSel = PHONE ? '[data-touch="take out"]' : '[data-yard-prompt="take out"]'
if (!await poll(async () => !!(await p.$(promptSel)), 30000)) await fail('dray prompt', `no ${promptSel}: ${String(await text()).slice(0, 300)}`)
await p.keyboard.down('KeyE'); await sleep(1500); await p.keyboard.up('KeyE'); await poll(async () => (await fleet())?.active === DRAY, 30000); await sleep(1500)
const fl5 = await fleet(), c5 = await car(), g5 = await S('garage')
res.takeOut = { fleet: fl5, carOffBay2: +Math.hypot(c5.x - b1.x, c5.z - b1.z).toFixed(2), garage: g5 }
if (fl5?.active !== DRAY || res.takeOut.carOffBay2 > 1 || g5?.bays?.[0] !== DARTER || g5?.bays?.[1] !== DRAY) await fail('take out', JSON.stringify(res.takeOut))
// 6 · in, back the Dray out
say('back out')
await p.evaluate((x: number, z: number, w: number) => (window as any).__drive.footTp(x, z, w), toW(s, b1L.lx - 2.2, b1L.lz).x, toW(s, b1L.lx - 2.2, b1L.lz).z, 0)
await sleep(1000); if (!await fTo('drive')) await fTo('drive')
if ((await footState())?.mode !== 'drive') await fail('back out', `could not get into the Dray: ${JSON.stringify(await footState())}`)
await pilot([toW(s, b1L.lx - 8, b1L.lz)], true)
await poll(async () => { const c = await car(); return toL(s, c.x, c.z).lx < b1L.lx - 6 }, 120000)
await stopPilot(); await sleep(2500)
const g6 = await S('garage'); res.backOut = g6
if (g6?.bays?.[1] !== null || g6?.bays?.[0] !== DARTER) await fail('back out', `bay 2 should free and bay 1 keep the Darter: ${JSON.stringify(g6)}`)
await shot('g6-dray-out', { lx: b1L.lx - 18, lz: b1L.lz - 8, up: 6 }, { lx: b1L.lx - 4, lz: b1L.lz })
if (errs.length) await fail('errors', `${errs.length} page errors: ${errs.slice(0, 3).join(' | ')}`)
await done(true, `PASS shipyard garage (Kael's): driven up the courser ramp + through the gate into bay 1, parked + saved, out on foot, kept on reload (car back in its bay), the Dray taken out of bay 2 by crosshair + E and backed out (bay 2 freed), 0 page errors`)
