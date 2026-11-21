// ── BETA M49 s4: THE SHIPYARD PLOTS, walked (2026-11-21, world; docs/M49-shipyards.md) ──────────────────────────────────────
// A fresh keeper (real BE BORN tap), the ledger SEEDED as holding the three bought shipyards (the buy is s7), a stool in the bag.
// For EACH plot (continent/shipyard-plot.tsx; Kael's above Rune Hold, Gale Haven, Veradyn, the Citadel):
//   1 · set down past the gate ramp's foot; the plot mounts, held (own) and built per its tier: home, garage block with one door
//       per bay (4 / 8 / 12), pad, look board, dock (tie-down mast + 4 posts, or a berth: bollards + slipway)
//   2 · real W up the ramp along the landing to the gate, then real W in: feet on the floor inside the fence
//   3 · a shot from the plot's back corner across it
// Kael's: 4 · a stool in hand, real E tap sets it on deed ground; 5 · reload keeps it (saved per shipyard)
// Veradyn: 6 · from the water past the slipway, real W + Space (swim up, as a player does) up the slipway into the yard
// PASS = all of that + 0 page errors. Hooks MOVE (__drive.footTp / look) and READ (__shipyards).
//   npx tsx scripts/shipyard-plot-check.mts [origin, default https://ather.games] [--out /tmp/shipyard-plots] [--only <key>]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : flag('--url', 'https://ather.games')).replace(/\/$/, '')
const out = flag('--out', '/tmp/shipyard-plots'), ONLY = flag('--only', '')
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
for (const key of [KAEL, ...BOUGHT]) {
  if (ONLY && key !== ONLY) continue
  const id = key === KAEL ? 'kael' : key.split(':')[2], r: Record<string, unknown> = {}; res.plots[id] = r
  say(`${id}: travel`)
  const s = await goTo(key)
  // 1 · built per its tier
  const pcs: any[] = await S(key, 'pieces'), n = (k: string) => pcs.filter(q => q.kind === k).length
  r.pieces = Object.fromEntries(['home', 'garage', 'bay', 'pad', 'board', 'mast', 'post', 'bollard'].map(k => [k, n(k)]))
  if (n('home') !== 1 || n('garage') !== 1 || n('pad') !== 1 || n('board') !== 1 || n('bay') !== s.tier.garage) await fail(`${id} pieces`, `tier ${JSON.stringify(s.tier)} but pieces ${JSON.stringify(r.pieces)}`)
  if (s.tier.dock === 'tie-down' ? n('mast') !== 1 || n('post') !== 4 : n('bollard') < 4 || !s.slip) await fail(`${id} dock`, `${s.tier.dock} but ${JSON.stringify(r.pieces)} slip ${JSON.stringify(s.slip)}`)
  if (!await S(key, 'own')) await fail(`${id} own`, 'the plot is not held though the ledger lists it')
  // 2 · up the ramp along the landing to the gate (face -x), then in (face +z)
  say(`${id}: walk in`)
  const gate = toW(s, 0, -52)
  await look(yawTo(gate.x - (await footAt()).x, gate.z - (await footAt()).z)); await sleep(800)
  const w1 = await walk(['KeyW'], f => toL(s, f.x, f.z).lx < 0.8, 150000, async () => { const q = await footAt(); await look(yawTo(gate.x - q.x, gate.z - q.z)) })
  const fa = await footAt(), la = toL(s, fa.x, fa.z)
  r.landing = { why: w1, lx: +la.lx.toFixed(2), lz: +la.lz.toFixed(2), feet: +fa.y.toFixed(2), floor: +s.floor.toFixed(2) }
  if (la.lx > 2 || Math.abs(fa.y - s.floor) > 0.3) await fail(`${id} ramp`, `did not climb the ramp to the gate: ${JSON.stringify(r.landing)}`)
  await look(yawTo(s.az[0], s.az[1])); await sleep(800)
  const w2 = await walk(['KeyW'], f => toL(s, f.x, f.z).lz > -42, 90000, () => look(yawTo(s.az[0], s.az[1])))
  const fb = await footAt(), lb = toL(s, fb.x, fb.z)
  r.gate = { why: w2, lx: +lb.lx.toFixed(2), lz: +lb.lz.toFixed(2), feet: +fb.y.toFixed(2) }
  if (lb.lz < -48 || Math.abs(fb.y - s.floor) > 0.1) await fail(`${id} gate`, `did not walk in through the gate onto the floor: ${JSON.stringify(r.gate)}`)
  await p.screenshot({ path: `${out}/${id}-1-gate.png` })
  // 3 · the shot: from the back-right corner, looking across to the gate
  const c = toW(s, 44, 44), m = toW(s, 0, -10)
  await tp(c.x, c.z, yawTo(m.x - c.x, m.z - c.z), -0.25); await sleep(4000)
  await p.screenshot({ path: `${out}/${id}-2-across.png` })
  // and from the air: 70 m out past the front-left corner, 45 m up, looking at the plot's middle (the hub LOOKS at this one)
  const air = toW(s, -70, -90)
  await p.evaluate((q: number[]) => (window as any).__drive.shot(q), [air.x, s.floor + 45, air.z, s.x, s.floor, s.z]); await sleep(5000)
  await p.screenshot({ path: `${out}/${id}-3-air.png` })
  await p.evaluate(() => (window as any).__drive.shot(null))
  if (key === KAEL) {
    // 4 · a stool on deed ground: stand at (-10, -10) facing deep (clear of the pad, home, garage, gate way), tap E
    say('kael: place')
    const sp = toW(s, -10, -10); await tp(sp.x, sp.z, yawTo(s.az[0], s.az[1]), -0.35)
    if (!await poll(async () => { const a = await S(key, 'aim'); return !!a?.inYard && !!a?.cell && Math.abs(a.cell.cx + 0.5 - 40) <= 1 && Math.abs(a.cell.cz + 0.5 - 41.4) <= 1 }, 60000)) await fail('kael place', `not aimed at the deed cell: ${JSON.stringify(await S(key, 'aim'))}`)
    await p.keyboard.press('Digit1'); await sleep(700); await tapE()
    const st = await S(key, 'state'); r.placed = st?.items
    if (st?.items?.length !== 1 || st.items[0].id !== STOOL) await fail('kael place', `expected one stool set: ${JSON.stringify(st?.items)} | hud ${String(await text()).slice(0, 300)}`)
    await p.screenshot({ path: `${out}/kael-4-stool.png` })
    // 5 · reload keeps it
    say('kael: reload'); const before = JSON.stringify(st.items)
    await loadContinent(); await goTo(KAEL)
    if (!await poll(async () => JSON.stringify((await S(KAEL, 'state'))?.items) === before, 30000)) await fail('kael reload', `stool not kept: ${before} -> ${JSON.stringify((await S(KAEL, 'state'))?.items)}`)
    r.reloadKept = true
  }
  if (s.slip) {
    // 6 · in from the water: past the slipway's foot, face the yard, W + Space (swim up) until inside
    say(`${id}: swim in`)
    const sea = toW(s, s.slip.lx, 50 + s.slip.L + 4), deep = toW(s, s.slip.lx, 40)
    await tp(sea.x, sea.z, yawTo(deep.x - sea.x, deep.z - sea.z), -0.1); await sleep(2500)
    const w3 = await walk(['KeyW', 'Space'], f => toL(s, f.x, f.z).lz < 46, 180000, async () => { const q = await footAt(); await look(yawTo(deep.x - q.x, deep.z - q.z), -0.1) })
    const fs = await footAt(), ls = toL(s, fs.x, fs.z)
    r.swimIn = { why: w3, lx: +ls.lx.toFixed(2), lz: +ls.lz.toFixed(2), feet: +fs.y.toFixed(2), floor: +s.floor.toFixed(2) }
    if (ls.lz > 48 || Math.abs(fs.y - s.floor) > 0.6) await fail(`${id} swim`, `a swimmer did not come up the slipway into the yard: ${JSON.stringify(r.swimIn)}`)
    await p.screenshot({ path: `${out}/${id}-5-slip.png` })
  }
}
if (errs.length) await fail('errors', `${errs.length} page errors: ${errs.slice(0, 3).join(' | ')}`)
await done(true, `PASS shipyard plots: ${Object.keys(res.plots).join(', ')} built per tier, walked in by the gate${res.plots.veradyn ? ', swum in by the slipway' : ''}${res.plots.kael ? ', a stool placed + kept on reload' : ''}, 0 page errors`)
