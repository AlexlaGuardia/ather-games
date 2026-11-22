// ── BETA M49 s6: THE DOCK (2026-11-22, world / Jin; docs/M49-shipyards.md › s6, scope approved by hub 7f25d6a2) ─────────────
// Kael's BROKEN ship lies at his yard's tie-down: on its struts between the four posts, bow to the mast, the lift-runes cold;
// every bought yard's dock is EMPTY (no keeper owns another ship yet: business/shipyard-plots.ts › DOCKED_SHIPS). The pad
// stays the skyship's landing zone, empty.
// SETUP (stated, as shipyard-plot-check): a fresh keeper (real BE BORN tap), the ledger SEEDED as holding the three bought
// yards so they mount held. Never a real keeper's save.
//   1 · each plot mounts; its probe's ship() = Kael's {id kael, broken} at Kael's, null at the other three; the 'ship' piece
//       likewise; the pad still there
//   2 · at Kael's: set down beside the hull and walk real W into it: the walker stops at the hull, never inside its beam
//   3 · shots: the ship from the yard (broadside), and from the mast end
// PASS = all of that + 0 page errors. Hooks MOVE (__drive.footTp / look) and READ (__shipyards).
//   npx tsx scripts/shipyard-dock-check.mts [origin, default https://ather.games] [--out /tmp/shipyard-dock]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : flag('--url', 'https://ather.games')).replace(/\/$/, '')
const out = flag('--out', '/tmp/shipyard-dock')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const STOOL = 'goldwood_stool', KAEL = 'front:shipyard', BOUGHT = ['front:shipyard:gale-haven', 'front:shipyard:veradyn', 'front:shipyard:citadel']
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, any> = { url }
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
const S = (key: string, fn: string, ...a: unknown[]) => p.evaluate((k: string, f: string, args: unknown[]) => (window as any).__shipyards?.[k]?.[f]?.(...args) ?? null, key, fn, a) as Promise<any>
const sites = () => p.evaluate(() => (window as any).__shipyards?.sites?.() ?? []) as Promise<any[]>
const footAt = () => p.evaluate(() => { const f = (window as any).__drive.foot(); return { x: f.px, y: f.py, z: f.pz } }) as Promise<{ x: number; y: number; z: number }>
const toW = (s: any, lx: number, lz: number) => ({ x: s.x + s.ax[0] * lx + s.az[0] * lz, z: s.z + s.ax[1] * lx + s.az[1] * lz })
const toL = (s: any, x: number, z: number) => { const dx = x - s.x, dz = z - s.z; return { lx: dx * s.ax[0] + dz * s.ax[1], lz: dx * s.az[0] + dz * s.az[1] } }
/** the continent's yaw that faces world direction (dx, dz): forward = (-sin yaw, -cos yaw) */
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz)
const tp = (x: number, z: number, yaw: number, pitch = -0.2) => p.evaluate((a, b, w, q) => { (window as any).__drive.footTp(a, b, w, q); (window as any).__drive.look(w, q) }, x, z, yaw, pitch)
const look = (yaw: number, pitch = -0.2) => p.evaluate((w, q) => (window as any).__drive.look(w, q), yaw, pitch)
// hold real keys until `goal`, or the walker stalls (moved < 5 cm over 6 s: a far town under SwiftShader renders a frame every
// 1-2.5 s), or maxMs. Walks end on what the walker did, never on the clock.
const hold = async (keys: string[], goal: (f: { x: number; y: number; z: number }) => boolean, maxMs = 120000) => {
  for (const k of keys) await p.keyboard.down(k as any)
  const t0 = Date.now(); let last = await footAt(), lastT = Date.now(), why = 'timeout'
  while (Date.now() - t0 < maxMs) {
    await sleep(300); const f = await footAt()
    if (goal(f)) { why = 'arrived'; break }
    if (Math.hypot(f.x - last.x, f.z - last.z) > 0.05) { last = f; lastT = Date.now() } else if (Date.now() - lastT > 6000) { why = 'stalled'; break }
  }
  for (const k of keys) await p.keyboard.up(k as any)
  await sleep(400); return why
}
/** hold, and on a stall look again and resume (up to 2 more times) as long as the last try MOVED: a render hitch on the box
 *  outlasts the stall window; a wall does not move at all. Each stall leaves a shot. */
let stallN = 0
const walk = async (keys: string[], goal: (f: { x: number; y: number; z: number }) => boolean, maxMs: number, reaim: () => Promise<void>) => {
  let why = '', tries = 0
  for (; tries < 3; tries++) {
    const a = await footAt(); why = await hold(keys, goal, maxMs)
    if (why !== 'stalled') break
    await p.screenshot({ path: `${out}/stall-${++stallN}.png` })
    const b = await footAt(); if (Math.hypot(b.x - a.x, b.z - a.z) < 0.1) break
    await reaim(); await sleep(1500)
  }
  return `${why}${tries ? ` (+${tries} resumes)` : ''}`
}
const tapE = async () => { await p.keyboard.down('KeyE'); await sleep(80); await p.keyboard.up('KeyE'); await sleep(900) }
const resume = async () => { if (/click to resume/i.test(String(await text()))) { await p.mouse.click(500, 320); await sleep(800) } }
const loadContinent = async () => {
  await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__shipyards?.sites, { timeout: 240000 }); await sleep(2500)
  await p.keyboard.press('KeyW'); await sleep(500); await resume()
}
const goTo = async (key: string) => {
  const s = (await sites()).find(q => q.key === key); if (!s) await fail('travel', `no plot ${key}: ${JSON.stringify(await sites())}`)
  const g = 3, foot = toW(s, g + s.ramp.L + 2.5, -50 - 2)
  await tp(foot.x, foot.z, yawTo(-s.ax[0], -s.ax[1]))
  if (!await poll(async () => !!(await S(key, 'plot')), 120000)) await fail('travel', `${key} did not mount (foot ${JSON.stringify(await footAt())})`)
  return s
}

// 0 · born, seeded, to the continent
say('born')
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
if (!await tapText(/^BE BORN/)) await fail('born', 'BE BORN tap not found')
await sleep(6000)
res.seed = await p.evaluate((stool: string, keys: string[]) => {
  let ki: string | null = null, kl: string | null = null
  for (let i = 0; i < localStorage.length; i++) { const q = localStorage.key(i)!; if (q.endsWith('open.inv.v1')) ki = q; if (q.endsWith('ather:trade:trial-ledger')) kl = q }
  const inv = ki ? JSON.parse(localStorage.getItem(ki)!) : { v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }
  inv.slots[0] = { id: stool, n: 3 }; inv.slots[7] = null
  localStorage.setItem(ki ?? 'open.inv.v1', JSON.stringify(inv))
  const l = kl ? JSON.parse(localStorage.getItem(kl)!) : { marks: 1500, scale: 2, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }
  l.shipyards = keys; localStorage.setItem(kl ?? 'ather:trade:trial-ledger', JSON.stringify(l))
  return { inv: ki ?? 'new', ledger: kl ?? 'new' }
}, STOOL, BOUGHT)
say('continent'); await loadContinent()
const all = await sites(); res.sites = all.map(s => ({ key: s.key, owned: s.owned, tier: s.tier, floor: +s.floor.toFixed(2), ramp: +s.ramp.L.toFixed(1), slip: s.slip && +s.slip.L.toFixed(1) }))
if (all.length !== 4) await fail('sites', `expected 4 shipyard plots, got ${all.length}`)
if (!all.every(s => s.owned)) await fail('sites', `the seeded ledger should hold all four: ${JSON.stringify(res.sites)}`)

res.plots = {}
for (const key of [...BOUGHT, KAEL]) {
  const id = key === KAEL ? 'kael' : key.split(':')[2], r: Record<string, unknown> = {}; res.plots[id] = r
  say(`${id}: travel`)
  const s = await goTo(key)
  const pcs: any[] = await S(key, 'pieces'), ship = await S(key, 'ship')
  r.ship = ship; r.shipPieces = pcs.filter(q => q.kind === 'ship').length; r.pad = pcs.filter(q => q.kind === 'pad').length
  if (r.pad !== 1) await fail(`${id} pad`, `the landing zone is gone: ${r.pad} pads`)
  if (key === KAEL) {
    if (!ship || ship.id !== 'kael' || !ship.broken || r.shipPieces !== 1) await fail(`${id} ship`, `Kael's broken ship should lie at his dock: ${JSON.stringify(r)}`)
  } else if (ship || r.shipPieces !== 0) await fail(`${id} ship`, `a bought yard's dock should be empty: ${JSON.stringify(r)}`)
  if (key !== KAEL) continue
  // 2 · beside the hull (2.5 m off its starboard beam, +x), facing it, real W: the walker must stop at the hull
  const half = 3.5, beside = toW(s, ship.lx + half + 2.5, ship.lz), mid = toW(s, ship.lx, ship.lz)
  await tp(beside.x, beside.z, yawTo(mid.x - beside.x, mid.z - beside.z), -0.1); await sleep(2500)
  const f0 = await footAt(), l0 = toL(s, f0.x, f0.z)
  r.start = { lx: +(l0.lx - ship.lx).toFixed(2), feet: +f0.y.toFixed(2), floor: +s.floor.toFixed(2) }
  if (Math.abs(f0.y - s.floor) > 0.3) await fail('kael set down', `not on the yard floor beside the ship: ${JSON.stringify(r.start)}`)
  const why = await hold(['KeyW'], f => Math.abs(toL(s, f.x, f.z).lx - ship.lx) < half - 0.2, 20000)
  const f1 = await footAt(), l1 = toL(s, f1.x, f1.z)
  r.bump = { why, offBeam: +(l1.lx - ship.lx).toFixed(2), moved: +(l0.lx - l1.lx).toFixed(2) }
  if (why === 'arrived' || l1.lx - ship.lx < half - 0.2) await fail('kael hull', `walked into the hull: ${JSON.stringify(r.bump)}`)
  if (l0.lx - l1.lx < 0.5) await fail('kael hull', `never walked toward it (the test proved nothing): ${JSON.stringify(r.bump)}`)
  // 3 · the look shots: broadside from 14 m off the beam, then from the mast end looking aft down the ship
  const far = toW(s, ship.lx + 14, ship.lz)
  await tp(far.x, far.z, yawTo(mid.x - far.x, mid.z - far.z), -0.12); await sleep(3000)
  await p.screenshot({ path: `${out}/kael-1-broadside.png` })
  const fore = toW(s, ship.lx + 6, ship.lz - 14)
  await tp(fore.x, fore.z, yawTo(mid.x - fore.x, mid.z - fore.z), -0.15); await sleep(3000)
  await p.screenshot({ path: `${out}/kael-2-from-mast.png` })
}
await done(errs.length === 0, errs.length ? `FAIL: page errors ${errs[0]}` : 'PASS')
