// ── M102 THE VULNYX IN GAME, OWNER-ONLY (2026-11-23, sprites-vulnyx-ingame) ─────────────────────────────────────────
// SETUP (stated): a Spirit Planter at (-130, 102.5) whose pot already BLOOMED (seeded in open.works.v1 + the book's pots).
//  A. owner cookie + ?spirits=3d: window.__spiritModel.mounted >= 1 (the group named 'spirit-model-vulnyx' is in the scene),
//     the glb answers 200, 0 page errors, frame time at 390x844 noted (SwiftShader, not a phone).
//  B. owner, NO flag: nothing mounted (the orb, as today).   C. NOT owner + ?spirits=3d: nothing mounted.
//  --shots <dir>: phone far / phone near / desktop / night (hour 21) from the owner + flag run.
// M102 Manalotl wire-in (sprites-manalotl): PER SPECIES. Two more bloomed planters: a Manalotl (axolotl seed) and an Athowl
//  (owl seed, no model yet). A also asserts: 2 models mounted (fox 1 + axolotl 1, the owl planter keeps the orb), the
//  manalotl glb 200, each model's measured world height near its registry height (0.55 / 0.15 m), the Manalotl moves and
//  is slower than the Vulnyx, never inside a planter or piece. --shots also writes both-in-frame spirits-phone / spirits-desk.
//   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/vulnyx-ingame-check.mts [--url http://localhost:3202] [--shots dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', '')
if (shots) mkdirSync(shots, { recursive: true })
const OWNER_KEY = process.env.OWNER_KEY
if (!OWNER_KEY) { console.error('OWNER_KEY not set: set -a; . /root/ather-games/.env; set +a'); process.exit(2) }
const P = { x: -130, z: 102.5 }
const PLANTER = { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
// M107 s2: furniture near her planter, so the roam has real blockers to miss (checked below from FURNITURE's own sizes)
const NEAR = [{ id: 'vx-bench', item: 'goldwood_bench', x: P.x + 2.4, z: P.z, q: 0, placedAt: 1 }, { id: 'vx-box', item: 'planter_box', x: P.x - 0.4, z: P.z - 3.2, q: 0, placedAt: 1 },
  // M102 Manalotl wire-in: her planter, and a third species' (owl: no model yet = the gold orb)
  { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 }, { id: 'ox-check', item: 'spirit_planter', x: P.x + 2.8, z: P.z - 2.4, q: 0, placedAt: 1 }]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})

async function run(owner: boolean, withFlag: boolean, w = 390, h = 844, hour = 14) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  let glb = 0, mglb = 0; p.on('response', r => { if (r.url().includes('/open/spirits/vulnyx.glb')) glb = r.status(); if (r.url().includes('/open/spirits/manalotl.glb')) mglb = r.status() })
  if (owner) {
    // /owner redirects to siteOrigin (prod) even on a devwin, so hit it without following, then read /api/owner ON this origin
    await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(OWNER_KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    const o = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
    if (!o) { ok(false, 'owner cookie took'); await p.close(); return null }
  }
  await p.evaluateOnNewDocument((piece: unknown, bloomAt: number, near: unknown[]) => {
    if (sessionStorage.getItem('vxc')) return; sessionStorage.setItem('vxc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [piece, ...near] }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: bloomAt }], pots: { 'vx-check': { seed: 'mana_seed_fox', at: bloomAt, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: bloomAt, bloomed: true }, 'ox-check': { seed: 'mana_seed_owl', at: bloomAt, bloomed: true } }, met: [] }))
  }, PLANTER, Date.now() - BLOOM_MS - 60000, NEAR)
  await p.goto(`${url}/shimmer/open/ather?hour=${hour}${withFlag ? '&spirits=3d' : ''}`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), P.x, P.z)
  await sleep(owner && withFlag ? 9000 : 6000)
  const mounted = await p.evaluate(() => (window as any).__spiritModel?.mounted ?? 0) as number
  return { p, errs, glb: () => glb, mglb: () => mglb, mounted }
}
// M102: frame both spirits: wait (max 40 s) until they are within 2.6 m, then stand off their midpoint and look at it
const frameBoth = async (p: Page, dist: number) => {
  for (let i = 0; i < 80; i++) { const d = await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return t?.fox && t?.axolotl ? Math.hypot(t.fox.x - t.axolotl.x, t.fox.z - t.axolotl.z) : 99 }); if (d < 2.6) break; await sleep(500) }
  await p.evaluate(`(() => { const g = window.__ather, t = window.__spiritModel.trots, mx = (t.fox.x + t.axolotl.x) / 2, mz = (t.fox.z + t.axolotl.z) / 2; g.tp(mx + ${dist} * 0.35, mz + ${dist}, 0); window.__mid = [mx, mz] })()`)
  await sleep(300); const [mx, mz] = await p.evaluate(() => (window as any).__mid) as [number, number]
  await aimAt(p, mx, mz, 0.15)
}
const shot = async (p: Page, name: string) => { await hideCard(p); await sleep(400); try { await p.screenshot({ path: `${shots}/${name}.png` }) } catch { /* slow frame */ } }
const look = async (p: Page, dz: number, dx = 0) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), P.x + dx, P.z + dz); await sleep(2000); await aimAt(p, P.x, P.z, 0.85); await sleep(1500) }

// A. owner + flag (phone)
const a = await run(true, true)
if (a) {
  ok(a.mounted >= 1, `A owner + ?spirits=3d: Vulnyx mounted on the bloomed planter (mounted=${a.mounted})`)
  ok(a.glb() === 200, `A glb /open/spirits/vulnyx.glb answered ${a.glb()}`)
  // M102 Manalotl wire-in: per species
  const sm = await a.p.evaluate(() => ({ ...((window as any).__spiritModel?.species ?? {}) })) as Record<string, number>
  ok(a.mounted === 2 && sm.fox === 1 && sm.axolotl === 1 && !sm.owl, `A per species: Vulnyx + Manalotl mounted, the owl planter keeps the gold orb (mounted=${a.mounted} ${JSON.stringify(sm)})`)
  ok(a.mglb() === 200, `A glb /open/spirits/manalotl.glb answered ${a.mglb()}`)
  await look(a.p, 4.5)
  // M107 s1+s2: THE TROT, THEN THE ROAM. Sample her (window.__spiritModel.trot, world xz/y + mode) every 100 ms for 15 s:
  // she moves, leaves her 1.5 m ring and reaches a spot > 3 m from the planter, is never inside the planter or a piece
  // (rectangles from FURNITURE here, not from the nav under test), her y bobs while trotting, and she pauses at least once.
  // Coming home + hopping up over a longer run is unit-tested (src/app/shimmer/open/ather/spirit-trot.test.ts).
  const both = await a.p.evaluate(`new Promise(res => { const out = [], mx = []; const t0 = performance.now(); const id = setInterval(() => { const tr = window.__spiritModel?.trot, m = window.__spiritModel?.trots?.axolotl; if (tr) out.push({ ...tr, t: performance.now() - t0 }); if (m) mx.push({ ...m, t: performance.now() - t0 }); if (performance.now() - t0 > 15000) { clearInterval(id); res([out, mx]) } }, 100) })`) as { x: number; y: number; z: number; mode: string; home: { x: number; z: number }; rMin: number; rMax: number; homes: number; t: number; tilt: number; h: number; hWorld?: number }[][]
  const samples = both[0], msamp = both[1]
  ok(samples.length > 40, `A trot probe sampled (${samples.length} samples over 15 s)`)
  if (samples.length) {
    const h = samples[0].home, r = (s: typeof samples[0]) => Math.hypot(s.x - h.x, s.z - h.z)
    const ground = samples.filter(s => !['perch', 'hopDown', 'hopUp'].includes(s.mode)), trots = samples.filter(s => s.mode === 'trot')
    let far = 0; for (const s of samples) for (const o of samples) far = Math.max(far, Math.hypot(s.x - o.x, s.z - o.z))
    const ys = trots.map(s => s.y), rFar = Math.max(0, ...ground.map(r))
    ok(far > 0.5, `A she moves: ${far.toFixed(2)} m between the farthest two samples (home ${h.x},${h.z})`)
    ok(rFar > 3, `A she roams: leaves the ${samples[0].rMax} m ring and reaches ${rFar.toFixed(2)} m from the planter (> 3)`)
    const rect = (pc: { item: string; x: number; z: number }, pad: number) => { const f = FURNITURE[pc.item]; return { x0: pc.x - f.w / 2 - pad, x1: pc.x + f.w / 2 + pad, z0: pc.z - f.d / 2 - pad, z1: pc.z + f.d / 2 + pad } }
    const rs = [rect(PLANTER, 0.15), ...NEAR.map(n => rect(n, 0.05))], inside = ground.filter(s => rs.some(b => s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1))
    ok(!inside.length, `A never inside the planter or a piece (${ground.length} ground samples vs ${rs.length} rects)${inside.length ? ` ${inside[0].mode} at ${inside[0].x.toFixed(2)},${inside[0].z.toFixed(2)}` : ''}`)
    ok(ys.length > 3 && Math.max(...ys) - Math.min(...ys) > 0.02, `A y bobs while she trots: ${ys.length ? (Math.max(...ys) - Math.min(...ys)).toFixed(3) : '-'} m over ${ys.length} trot samples`)
    const firstTrot = samples.findIndex(s => s.mode === 'trot'), paused = firstTrot >= 0 && samples.slice(firstTrot).some(s => ['check', 'look', 'sit', 'sniff', 'perch'].includes(s.mode))
    ok(paused, `A she pauses at least once after trotting (modes seen: ${[...new Set(samples.map(s => s.mode))].join(',')}; homes ${samples.at(-1)!.homes})`)
    // M102 Manalotl wire-in: the Manalotl over the same 15 s. Speed = path length / time while trotting, both spirits.
    const pace = (ss: typeof samples) => { let d = 0, tt = 0; for (let i = 1; i < ss.length; i++) if (ss[i].mode === 'trot' && ss[i - 1].mode === 'trot') { d += Math.hypot(ss[i].x - ss[i - 1].x, ss[i].z - ss[i - 1].z); tt += (ss[i].t - ss[i - 1].t) / 1000 } return tt > 0.5 ? d / tt : NaN }
    ok(msamp.length > 40, `A Manalotl trot probe sampled (${msamp.length} samples)`)
    if (msamp.length) {
      let mfar = 0; for (const s of msamp) for (const o of msamp) mfar = Math.max(mfar, Math.hypot(s.x - o.x, s.z - o.z))
      const vp = pace(samples), mp = pace(msamp)
      ok(mfar > 0.3, `A Manalotl moves: ${mfar.toFixed(2)} m between the farthest two samples (modes ${[...new Set(msamp.map(s => s.mode))].join(',')}; tilt max ${Math.max(...msamp.map(s => Math.abs(s.tilt))).toFixed(2)})`)
      ok(Number.isFinite(mp) && Number.isFinite(vp) && mp < vp * 0.6, `A Manalotl is slower: ${mp.toFixed(2)} m/s vs the Vulnyx ${vp.toFixed(2)} m/s while trotting`)
      const mg = msamp.filter(s => !['perch', 'hopDown', 'hopUp'].includes(s.mode)), mrs = [rect(PLANTER, 0.15), ...NEAR.map(n => rect(n, n.item === 'spirit_planter' && n.id === 'mx-check' ? 0.15 : 0.05))]
      const min = mg.filter(s => mrs.some(b => s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1))
      ok(!min.length, `A Manalotl never inside a planter or a piece (${mg.length} ground samples)${min.length ? ` ${min[0].mode} at ${min[0].x.toFixed(2)},${min[0].z.toFixed(2)}` : ''}`)
      // sizes: measured world bbox height of each model group (Box3 of the drawn meshes, hull included, so ~1.0..1.25 x h)
      const hv = samples.at(-1)!.hWorld ?? 0, hm = msamp.at(-1)!.hWorld ?? 0
      ok(hv > 0.55 * 0.85 && hv < 0.55 * 1.3, `A Vulnyx measured height ${hv.toFixed(3)} m (registry 0.55)`)
      ok(hm > 0.15 * 0.85 && hm < 0.15 * 1.3, `A Manalotl measured height ${hm.toFixed(3)} m (registry 0.15, heel-high)`)
    }
  }
  const fps = await a.p.evaluate(`new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / 5) } requestAnimationFrame(f) })`) as number
  console.log(`   frame: ${fps.toFixed(2)} fps = ${(1000 / fps).toFixed(0)} ms/frame at 390x844 near the planter (SwiftShader, not a phone)`)
  if (shots) { await shot(a.p, 'phone-far'); await look(a.p, 1.9, 0.5); await shot(a.p, 'phone-near'); await frameBoth(a.p, 2.2); await shot(a.p, 'spirits-phone') }

  // M107 s2: the roam clip: a chase cam (the keeper is set 3.8 m behind-right of her each frame, looking at her)
  if (shots) { await hideCard(a.p)
    for (let i = 0; i < 36; i++) { await a.p.evaluate(`(() => { const g = window.__ather, t0 = window.__spiritModel?.trot; if (!t0) return; g.tp(t0.x + 1.2, t0.z + 3.6, 0); const s = g.state(), t = t0; const sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = t.x - sx, dz = t.z - sz; g.look(Math.atan2(-dx, -dz), Math.atan2(g.ground(t.x, t.z) + 0.3 - (g.ground(sx, sz) + 1.6), Math.hypot(dx, dz))) })()`); try { await a.p.screenshot({ path: `${shots}/roam-${String(i).padStart(2, '0')}.png` }) } catch { /* slow frame */ } } }
  ok(a.errs.length === 0, `A 0 page errors ${a.errs.join(' | ')}`)
  await a.p.close()
}
// B. owner, no flag
const b = await run(true, false)
if (b) { ok(b.mounted === 0, `B owner, no flag: nothing mounted (mounted=${b.mounted})`); ok(b.errs.length === 0, `B 0 page errors ${b.errs.join(' | ')}`); await b.p.close() }
// C. not owner + flag
const c = await run(false, true)
if (c) { ok(c.mounted === 0, `C not owner + ?spirits=3d: nothing mounted (mounted=${c.mounted})`); ok(c.errs.length === 0, `C 0 page errors ${c.errs.join(' | ')}`); await c.p.close() }
if (shots) {
  const d = await run(true, true, 1280, 800)
  if (d) { await look(d.p, 3.2, 0.8); await shot(d.p, 'desk'); await frameBoth(d.p, 2.4); await shot(d.p, 'spirits-desk'); await d.p.close() }
  const n = await run(true, true, 390, 844, 21)
  if (n) { await look(n.p, 2.6, 0.5); await shot(n.p, 'night'); await n.p.close() }
}
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
