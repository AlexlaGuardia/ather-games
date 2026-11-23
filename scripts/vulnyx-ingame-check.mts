// ── M102 THE VULNYX IN GAME, OWNER-ONLY (2026-11-23, sprites-vulnyx-ingame) ─────────────────────────────────────────
// SETUP (stated): a Spirit Planter at (-130, 102.5) whose pot already BLOOMED (seeded in open.works.v1 + the book's pots).
//  A. owner cookie + ?spirits=3d: window.__spiritModel.mounted >= 1 (the group named 'spirit-model-vulnyx' is in the scene),
//     the glb answers 200, 0 page errors, frame time at 390x844 noted (SwiftShader, not a phone).
//  B. owner, NO flag / C. NOT owner + ?spirits=3d: since the M107 ship the models are drawn (2), but no spirit talk.
//  --shots <dir>: phone far / phone near / desktop / night (hour 21) from the owner + flag run.
// M102 Manalotl wire-in (sprites-manalotl): PER SPECIES. Two more bloomed planters: a Manalotl (axolotl seed) and an Athowl
//  (owl seed, no model yet). A also asserts: 2 models mounted (fox 1 + axolotl 1, the owl planter keeps the orb), the
//  manalotl glb 200, each model's measured world height near its registry height (0.55 / 0.15 m), the Manalotl moves and
//  is slower than the Vulnyx, never inside a planter or piece. --shots also writes both-in-frame spirits-phone / spirits-desk.
// M109 s1 (sprites-M109): TALK + FOLLOW + THE SPIRIT PANEL (run F, owner + flag, 390x844). For the Vulnyx and the Manalotl:
//  E at her = three answers Feed (greyed, 'soon') / Follow / Open; Follow + ~10 s of the keeper walking a loop on the plot
//  (stepped per animation frame at the 4.2 m/s walk, the same dt clamp as her trot): she stays within 3 m, never inside a
//  planter or piece; a reload keeps her following; Stay returns her to roaming; Open = the Hearth panel with the avatar
//  canvas, the radar = SPECIES_STATS_V2 and the moves = spiritSheet (born knowing + BASE_LEARNSET). 0 page errors. B and C:
//  E aimed at the planter never gives a spirit talk. --panel-shot <png> (default docs/looks/spirit-panel-2026-11-23.png).
//   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/vulnyx-ingame-check.mts [--url http://localhost:3202] [--shots dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { spiritSheet } from '../src/app/shimmer/open/ather/spirit-sheet'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), panelShot = flag('--panel-shot', 'docs/looks/spirit-panel-2026-11-23.png')
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

// F. M109 s1: talk + follow + the spirit panel (owner + flag, phone)
const RECTS = [PLANTER, ...NEAR].map(pc => { const f = FURNITURE[pc.item], pad = 0.05; return { x0: pc.x - f.w / 2 - pad, x1: pc.x + f.w / 2 + pad, z0: pc.z - f.d / 2 - pad, z1: pc.z + f.d / 2 + pad } })
const opts = (p: Page) => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => ({ t: (b.textContent ?? '').replace('›', '').trim(), off: b.hasAttribute('data-talk-disabled') }))) as Promise<{ t: string; off: boolean }[]>
const trotOf = (p: Page, sp: string) => p.evaluate((s) => { const t = (window as any).__spiritModel?.trots?.[s]; return t ? { x: t.x, z: t.z, y: t.y, h: t.h, mode: t.mode } : null }, sp) as Promise<{ x: number; z: number; y: number; h: number; mode: string } | null>
async function talkTo(p: Page, sp: string): Promise<{ t: string; off: boolean }[]> {
  for (let k = 0; k < 8; k++) {
    let t = await trotOf(p, sp); if (!t) { await sleep(500); continue }
    // a FOLLOWING spirit re-slots whenever the keeper moves, so never teleport beside her: the keeper stands, she settles
    // by them (a player's case), then aim where she stands now
    if (t.mode === 'follow') { await sleep(3000); t = (await trotOf(p, sp)) ?? t }
    else await p.evaluate((x, z, away) => (window as any).__ather.tp(x, z + away, 0), t.x, t.z, sp === 'axolotl' ? 1.1 : 1.5)
    await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
    await p.keyboard.press('e'); await sleep(900)
    const o = await opts(p); if (o.length) return o
    await p.keyboard.press('Escape'); await sleep(400)
  }
  return []
}
const pick = (p: Page, label: string) => p.evaluate((l) => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').includes(l)) as HTMLButtonElement | undefined; b?.click(); return !!b }, label)
/** walk the keeper a loop for `secs` (stepped per frame), sampling every following spirit; returns per-species max distance + inside hits */
async function walk(p: Page, secs: number, sps: string[]) {
  const path = [[P.x - 4, P.z + 4.5], [P.x + 5, P.z + 4.5], [P.x + 5, P.z + 7.5], [P.x - 4, P.z + 7.5]]
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), path[0][0], path[0][1]); await sleep(2500)
  return p.evaluate(`new Promise(res => { const path = ${JSON.stringify(path)}, sps = ${JSON.stringify(sps)}, out = {}; for (const s of sps) out[s] = []
    let i = 1, x = path[0][0], z = path[0][1], last = performance.now(); const t0 = last
    function f() { const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now
      let step = 4.2 * dt; while (step > 0) { const [tx, tz] = path[i % path.length], dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz); if (d <= step) { x = tx; z = tz; step -= d; i++ } else { x += dx / d * step; z += dz / d * step; step = 0; window.__ather.tp(x, z, Math.atan2(-dx, -dz)) } }
      const g = window.__ather.state(), kx = g.px ?? g.x, kz = g.pz ?? g.z
      for (const s of sps) { const t = window.__spiritModel?.trots?.[s]; if (t) out[s].push({ d: Math.hypot(t.x - kx, t.z - kz), x: t.x, z: t.z, mode: t.mode, t: now - t0 }) }
      if (now - t0 < ${secs * 1000}) requestAnimationFrame(f); else res(out) }
    requestAnimationFrame(f) })`) as Promise<Record<string, { d: number; x: number; z: number; mode: string; t: number }[]>>
}
const f = await run(true, true)
if (f) {
  for (const sp of ['fox', 'axolotl']) {
    const name = sp === 'fox' ? 'Vulnyx' : 'Manalotl'
    const o = await talkTo(f.p, sp)
    // M109 s2: Feed is live (no longer greyed 'soon'); this bag holds no spirit food, so it carries no food tag (m109-feed-check.mts)
    ok(o.length === 3 && o[0].t === 'Feed' && !o[0].off && o[1].t === 'Follow' && !o[1].off && o[2].t === 'Open' && !o[2].off,
      `F ${name}: E = Feed / Follow / Open (${JSON.stringify(o)})`)
    ok(await pick(f.p, 'Follow'), `F ${name}: picked Follow`); await sleep(600)
    const w = await walk(f.p, 10, [sp]), ss = (w[sp] ?? []).filter(x => x.t > 3000)   // first 3 s = her catch-up to the loop's start
    const maxD = Math.max(0, ...ss.map(x => x.d)), inside = ss.filter(x => RECTS.some(b => x.x > b.x0 && x.x < b.x1 && x.z > b.z0 && x.z < b.z1))
    ok(ss.length > 5 && ss.every(x => x.mode === 'follow') && maxD < 3, `F ${name}: follows the walking keeper, within 3 m over ${((ss.at(-1)?.t ?? 0) - (ss[0]?.t ?? 0)) / 1000 | 0} s (max ${maxD.toFixed(2)} m, ${ss.length} frames)`)
    ok(!inside.length, `F ${name}: never inside a planter or piece while following${inside.length ? ` (${inside[0].x.toFixed(2)},${inside[0].z.toFixed(2)})` : ''}`)
  }
  // a reload keeps both following
  await f.p.reload({ waitUntil: 'load', timeout: 180000 }); await f.p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await f.p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), P.x - 1, P.z + 5)
  let modes: (string | undefined)[] = []
  for (let i = 0; i < 40; i++) { await sleep(500); modes = [(await trotOf(f.p, 'fox'))?.mode, (await trotOf(f.p, 'axolotl'))?.mode]; if (modes.every(m => m === 'follow')) break }
  ok(modes.every(m => m === 'follow'), `F follow persists across a reload (modes ${modes.join(',')})`)
  const want = (sp: 'fox' | 'axolotl') => spiritSheet(sp)
  for (const sp of ['fox', 'axolotl'] as const) {
    const name = sp === 'fox' ? 'Vulnyx' : 'Manalotl'
    const o = await talkTo(f.p, sp)
    ok(o.map(x => x.t.replace(/soon$/i, '').trim()).join('/') === 'Feed/Stay/Open', `F ${name}: while she follows the answer reads Stay (${o.map(x => x.t).join('/')})`)
    await pick(f.p, 'Stay'); let m = ''
    for (let i = 0; i < 10; i++) { await sleep(500); m = (await trotOf(f.p, sp))?.mode ?? ''; if (m && m !== 'follow') break }
    ok(m !== '' && m !== 'follow', `F ${name}: Stay returns her to roaming (mode ${m})`)
    await talkTo(f.p, sp); await pick(f.p, 'Open'); await sleep(2500)
    const pn = await f.p.evaluate(() => { const r = document.querySelector('[data-panel="spirit"]'); if (!r) return null
      return { name: r.querySelector('[data-spirit-name]')?.getAttribute('data-spirit-name'), canvas: !!r.querySelector('[data-spirit-avatar] canvas'),
        axes: Object.fromEntries([...r.querySelectorAll('[data-spirit-axis]')].map(g => [g.getAttribute('data-spirit-axis'), Number(g.getAttribute('data-spirit-axis-grade'))])),
        moves: [...r.querySelectorAll('[data-spirit-move]')].map(e => e.getAttribute('data-spirit-move')), empty: !!r.querySelector('[data-spirit-moves-empty]'),
        box: (() => { const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom } })() } }) as null | { name: string; canvas: boolean; axes: Record<string, number>; moves: string[]; empty: boolean; box: { l: number; r: number; t: number; b: number } }
    const sh = want(sp)
    ok(!!pn && pn.name === sh.name && pn.canvas, `F ${name}: Open = the spirit panel, named ${pn?.name}, avatar canvas ${pn?.canvas}`)
    ok(!!pn && sh.axes.every(a => pn.axes[a.stat] === a.value) && Object.keys(pn.axes).length === 6, `F ${name}: radar = SPECIES_STATS_V2 ${JSON.stringify(pn?.axes)}`)
    ok(!!pn && (sh.moves.length ? JSON.stringify(pn.moves) === JSON.stringify(sh.moves.map(x => x.id)) : pn.empty), `F ${name}: moves = the data (${pn?.moves.join(',')})`)
    ok(!!pn && pn.box.l >= 0 && pn.box.r <= 390 && pn.box.t >= 0 && pn.box.b <= 844, `F ${name}: the panel fits 390x844 (${JSON.stringify(pn?.box)})`)
    if (sp === 'fox' && panelShot) { await hideCard(f.p); await sleep(1500); try { await f.p.screenshot({ path: panelShot }); console.log(`   panel shot: ${panelShot}`) } catch { ok(false, 'panel shot') } }
    await f.p.keyboard.press('Escape'); await sleep(600)
  }
  ok(f.errs.length === 0, `F 0 page errors ${f.errs.join(' | ')}`)
  await f.p.close()
}
// no talk without the flag / the owner: E aimed at the planter never shows the spirit answers
const noTalk = async (p: Page) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), P.x, P.z + 1.6); await aimAt(p, P.x, P.z, 0.7); await p.keyboard.press('e'); await sleep(900)
  const o = await opts(p); await p.keyboard.press('Escape'); return !o.some(x => x.t === 'Follow' || x.t === 'Stay') }
// B. owner, no flag
const b = await run(true, false)
// M107 ship (Alex 11-23): the models + roam are for every keeper now; only talk/party/training stay owner + flag
if (b) { ok(b.mounted === 2, `B owner, no flag: the models are drawn for everyone since the M107 ship (mounted=${b.mounted})`); ok(await noTalk(b.p), 'B owner, no flag: no spirit talk'); ok(b.errs.length === 0, `B 0 page errors ${b.errs.join(' | ')}`); await b.p.close() }
// C. not owner + flag
const c = await run(false, true)
if (c) { ok(c.mounted === 2, `C not owner + ?spirits=3d: the models are drawn (M107 ship) (mounted=${c.mounted})`); ok(await noTalk(c.p), 'C not owner + ?spirits=3d: no spirit talk'); ok(c.errs.length === 0, `C 0 page errors ${c.errs.join(' | ')}`); await c.p.close() }
if (shots) {
  const d = await run(true, true, 1280, 800)
  if (d) { await look(d.p, 3.2, 0.8); await shot(d.p, 'desk'); await frameBoth(d.p, 2.4); await shot(d.p, 'spirits-desk'); await d.p.close() }
  const n = await run(true, true, 390, 844, 21)
  if (n) { await look(n.p, 2.6, 0.5); await shot(n.p, 'night'); await n.p.close() }
}
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
