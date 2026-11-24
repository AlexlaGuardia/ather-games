// BETA M132 s2 + M102: THE RIGGED MANALOTL AND VULNYX on prod, 390x844 (SwiftShader). Fresh contexts, every non-GET stubbed, storage seeded.
//  OWNER  1 both Manalotls and the Vulnyx are rigged, one skeleton each, 0.90 m nose to tail / 0.70 m tall.  2 in the garden, up to 4 min:
//         she walks AND runs with her legs moving (joint swing), planted feet stay put in WORLD space, the tail trails behind,
//         she lies / sits down; a clip always plays (weights sum 1); no paw under the ground in any blend.  3 following a walking keeper: gait, how often the cadence cap bit (noted); 3b the Vulnyx behind a keeper at 4.2 and 6.5 m/s: drift.
//         4 the Wilds: she is rigged there too; home again = the Wilds body is thrown away (live count).  5 the panel's copy opens and goes.
//  PLAYER 6 not the owner: the OLD glb, 0 rigs, the rigged glb never asked for, she draws at 0.698 m.   7 0 page errors.
//  --stills: only the Vulnyx stills. --perf: 20 Manalotls (--perf --fox: 20 Vulnyxes), owner, `?rig=0` against rigged, same page + camera, A B A B (SwiftShader, not a phone).
//   OWNER_KEY=... npx tsx scripts/m132-rig-check.mts [--shots dir] [--perf]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { MANALOTL_RIG, SPIRIT_RIGS } from '../src/app/shimmer/open/ather/spirit-models'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY, perf = process.argv.includes('--perf')
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const at0 = Date.now() - 20 * 86400000, pot = (sp: string, k: number) => ({ seed: `mana_seed_${sp}`, at: at0 + k, v: 2, tends: [], bloomed: true })
const BEDS = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `p${k}`, item: 'spirit_planter', x: -134 + (k % 4) * 2.6, z: 100 + Math.floor(k / 4) * 2.6, q: 0, placedAt: 1 }))
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const errs: string[] = []
const launch = () => puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function open(br: any, owner: boolean, s: { pieces: unknown; pots: unknown; follow: string[]; party: string[] }, q = '') {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const got: string[] = []; p.on('pageerror', e => errs.push(`${owner ? 'owner' : 'player'}: ${String(e).slice(0, 200)}`)); p.on('response', r => { if (/open\/spirits\//.test(r.url())) got.push(`${r.url().split('/').pop()} ${r.status()}`) })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)) === owner, owner ? '0. the OWNER' : '0. NOT the owner')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m132')) return; sessionStorage.setItem('m132', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces })); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(s.follow)); localStorage.setItem('ather.spiritParty.v1', JSON.stringify(s.party))
  }, { ...s, tut: TUT })
  await p.goto(`${url}/shimmer/open/ather?hour=14${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(4000)
  await p.touchscreen.tap(195, 644); await sleep(500)
  return { p, got }
}
/** in page: sample every rig every frame: where its feet are in the world, its leg and tail bones, its clip */
const sampler = (p: Page) => p.evaluate(() => {
  const W = window as any, D: any = W.__m132 = { bodies: {}, sums: 0, n: 0 }, A = W.__ather
  const PAWS = ['fl', 'fr', 'hl', 'hr']
  const tick = () => {
    for (const r of W.__spiritModel.rigs.values()) {
      const b = r.body, st = b.state(), geo = b.meshes.body.geometry
      const B = D.bodies[r.id] ??= { sp: r.sp, soles: null, rows: [] }
      if (!B.soles) { const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight'), ps = geo.getAttribute('position'); B.soles = PAWS.map(f => { const bi = b.bones.findIndex((x: any) => x.name === `b_${f}_paw`), all: number[] = []
        for (let i = 0; i < ps.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k); if (w > 0.99) all.push(i) }
        const lo = Math.min(...all.map(i => ps.getY(i))); return all.filter(i => ps.getY(i) < lo + 0.03).slice(0, 10) }) }
      const V = b.bones[0].position.clone(), bone = (n: string) => b.bones.find((x: any) => x.name === n).getWorldPosition(V.clone())
      const feet = B.soles.map((s: number[]) => { let x = 0, y = 0, z = 0; for (const i of s) { b.at('body', i, V); x += V.x; y += V.y; z += V.z } return [x / s.length, y / s.length, z / s.length] })
      const t1 = bone('b_tail1'), t7 = bone(b.bones.some((x: any) => x.name === 'b_tail7') ? 'b_tail7' : 'b_tail4'), ta = Math.atan2(t7.x - t1.x, t7.z - t1.z) - (r.yaw + Math.PI)
      const e = b.root.matrixWorld.elements
      // the lowest vertex of her whole body while two clips are mixed, else the lowest sole, against the ground she stands on
      let low = Math.min(...feet.map((q: number[]) => q[1])) - r.y
      if (r.sp === 'fox' && Object.values(st.w).filter((x: any) => x > 0).length > 1) for (let i = 0, n = geo.getAttribute('position').count; i < n; i += 2) { b.at('body', i, V); low = Math.min(low, V.y - r.y) }
      B.rows.push({ t: performance.now(), x: e[12], y: e[13], z: e[14], yaw: Math.atan2(e[8], e[10]), v: r.v, mode: r.mode, clip: st.clip, w: st.w, capped: st.capped, rate: st.rate, lift: st.lift * r.h, low, feet, tail: Math.abs(Math.atan2(Math.sin(ta), Math.cos(ta))) })
      const sum = st.w.idle + st.w.walk + st.w.run + st.w.sit + st.w.lie; D.n++; if (Math.abs(sum - 1) > 1e-6) D.sums++
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick); void A
})
// SwiftShader draws ~5 frames a second and she takes ~3 strides a second, so two samples of a planted foot are often different
// strides. Feet that do not slide land a whole number of strides apart, so the drift is what is LEFT OVER of that (spirit-rig.test.ts
// measures the plain drift at 60 / 24 / 10 fps on the same body).
type Sp = 'axolotl' | 'fox'
const DUR = { axolotl: { walk: 0.57872, run: 0.51070 }, fox: { walk: 0.57018, run: 0.4325 } }
const STRIDE = (sp: Sp, c: 'walk' | 'run') => SPIRIT_RIGS[sp]!.rig!.clipV[c] * DUR[sp][c] * SPIRIT_RIGS[sp]!.h
type Row = { t: number; x: number; y: number; z: number; yaw: number; v: number; mode: string; clip: string; w: Record<string, number>; capped: boolean; rate: number; lift: number; low: number; feet: number[][]; tail: number }
/** the Vulnyx gallops with her feet down a fifth of the time and this box draws 3-7 frames a second, so a short stretch may hold no
 *  planted frame at all and its own lowest is a swing: here a foot is planted when it is within 1.5 mm of the lowest it EVER gets in a
 *  pure run, and two planted frames up to 4 frames apart are compared (whole strides taken off, as below) */
function gallop(rows: Row[], mode: string, minV = 0) {
  const pure = (r: Row) => r.clip === 'run' && r.w.run > 0.99 && !r.capped && r.mode === mode, run = rows.filter(pure), all: number[] = [], S = STRIDE('fox', 'run')
  const base = [0, 1, 2, 3].map(f => Math.min(9, ...run.map(r => r.feet[f][1] - r.y)))
  let swing = 0, tail = 0, v = 0, stuck = 0
  for (let f = 0; f < 4; f++) { const ah = run.map(r => (r.feet[f][0] - r.x) * Math.sin(r.yaw) + (r.feet[f][2] - r.z) * Math.cos(r.yaw)); swing = Math.max(swing, Math.max(...ah) - Math.min(...ah))
    let from = -1; for (let i = 0; i < rows.length; i++) { const r = rows[i], last = rows[i - 1]
      if (!pure(r) || r.v < minV || (last && pure(last) && (Math.abs(Math.atan2(Math.sin(r.yaw - last.yaw), Math.cos(r.yaw - last.yaw))) > 0.006 || Math.hypot(r.x - last.x, r.z - last.z) > 1.4))) { from = -1; continue }
      if (last && !pure(last)) from = -1
      if (r.feet[f][1] - r.y > base[f] + 0.0015) continue
      stuck++
      if (from >= 0 && i - from <= 4) { const q = rows[from].feet[f], along = Math.hypot(r.feet[f][0] - q[0], r.feet[f][2] - q[2]); all.push(Math.abs(along - Math.round(along / S) * S)) } from = i } }
  for (const r of run) { tail = Math.max(tail, r.tail); v += r.v }
  all.sort((a, b) => a - b)
  return { drift: all.at(-1) ?? 0, med: all[all.length >> 1] ?? NaN, p95: all[Math.floor(all.length * 0.95)] ?? NaN, n: all.length, spans: stuck, frames: run.length, swing, tail: tail * 57.3, v: run.length ? v / run.length : 0 }
}
/** planted-foot drift: over frames of one steady gait on a straight line (weight > 0.99, no cap, heading held), a foot is planted
 *  while it is within 2 mm of the lowest it gets in that stretch; the drift is the furthest it strays from where it came down */
function gait(rows: Row[], clip: 'walk' | 'run', sp: Sp = 'axolotl', mode = 'trot', turnMax = 0.004, minV = 0, min = 6) {
  let drift = 0, spans = 0, frames = 0, swing = 0, tail = 0, v = 0, all: number[] = [], cur: Row[] = []
  const flush = () => { if (cur.length >= min) { spans++; frames += cur.length
    for (let f = 0; f < 4; f++) { const lo = Math.min(...cur.map(r => r.feet[f][1])), ahead = cur.map(r => (r.feet[f][0] - r.x) * Math.sin(r.yaw) + (r.feet[f][2] - r.z) * Math.cos(r.yaw)); swing = Math.max(swing, Math.max(...ahead) - Math.min(...ahead))
      let from: number[] | null = null; for (const r of cur) { const q = r.feet[f]; if (q[1] < lo + 0.002) { if (from) { const along = Math.hypot(q[0] - from[0], q[2] - from[2]), d = Math.abs(along - Math.round(along / STRIDE(sp, clip)) * STRIDE(sp, clip)); all.push(d); drift = Math.max(drift, d) } else from = q } else from = null } }
    for (const r of cur) { tail = Math.max(tail, r.tail); v += r.v } } cur = [] }
  for (const r of rows) { const last = cur.at(-1), turn = last ? Math.abs(Math.atan2(Math.sin(r.yaw - last.yaw), Math.cos(r.yaw - last.yaw))) : 0
    if (r.clip === clip && r.w[clip] > 0.99 && !r.capped && turn < turnMax && r.mode === mode && r.v >= minV && (!last || Math.hypot(r.x - last.x, r.z - last.z) < 1.4)) cur.push(r); else flush() }
  flush(); all.sort((a, b) => a - b)
  return { drift, med: all[all.length >> 1] ?? NaN, p95: all[Math.floor(all.length * 0.95)] ?? NaN, n: all.length, spans, frames, swing, tail: tail * 57.3, v: frames ? v / frames : 0 }
}
const f3 = (g: ReturnType<typeof gait>) => `${g.spans} planted frames of ${g.frames}, drift median ${(g.med * 1000).toFixed(1)} p95 ${(g.p95 * 1000).toFixed(1)} mm, tail <= ${g.tail.toFixed(0)} deg`
const rowsOf = (p: Page) => p.evaluate(() => { const D = (window as any).__m132; return JSON.parse(JSON.stringify({ b: Object.fromEntries(Object.entries(D.bodies).map(([k, v]: any) => [k, v.rows])), sp: Object.fromEntries(Object.entries(D.bodies).map(([k, v]: any) => [k, v.sp])), n: D.n, sums: D.sums })) }) as Promise<{ b: Record<string, Row[]>; sp: Record<string, Sp>; n: number; sums: number }>
const hideCard = (p: Page) => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(d => !h.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
/** a chase cam: every frame the keeper is set beside her (three quarters on) and turned to her, so any frame is framed; the still is taken the moment `clip` is fully on */
async function still(p: Page, id: string, clip: string, name: string, away = 1.9) {
  if (!shots) return
  await hideCard(p); const hs = await p.evaluate((id: string) => ({ h: (window as any).__spiritModel.rigs.get(id)?.sp === 'fox' ? 0.35 : 0.2 }), id)
  await p.evaluate(`(() => { const W = window; W.__cam = true; const A = W.__ather; (function f() { if (!W.__cam) return; const r = W.__spiritModel.rigs.get('${id}'); if (r) { const a = r.yaw + 1.1, x = r.x + Math.sin(a) * ${away} + Math.sin(r.yaw) * r.v * 0.15, z = r.z + Math.cos(a) * ${away} + Math.cos(r.yaw) * r.v * 0.15; A.tp(x, z, 0); A.look(Math.atan2(x - r.x, z - r.z), Math.atan2(${hs.h} - 1.6, ${away})) } requestAnimationFrame(f) })() })()`)
  const w = () => p.evaluate((a: [string, string]) => { const r = (window as any).__spiritModel.rigs.get(a[0]); return r && !/perch|hop/.test(r.mode) ? r.body.state().w[a[1]] as number : 0 }, [id, clip] as [string, string])
  let took = false
  for (let i = 0; i < 300 && !took; i++) { if (await w() > 0.95) { await sleep(clip === 'run' ? 0 : 500); try { await p.screenshot({ path: `${shots}/${name}-390.png` }) } catch { continue } if (await w() > 0.8) took = true } else await sleep(150) }
  await p.evaluate(() => { (window as any).__cam = false }); await sleep(600)
  console.log(`   still ${name}: ${took ? 'taken' : 'NOT taken'}`)
}
const pieces = BEDS(3), pots = { p0: pot('axolotl', 0), p1: pot('fox', 1), p2: pot('axolotl', 2) }
const br = await launch()
try {
  if (process.argv.includes('--stills')) {
    const { p } = await open(br, true, { pieces: BEDS(1), pots: { p0: pot('fox', 0) }, follow: [], party: [] })
    await p.evaluate(() => (window as any).__ather.tp(-131, 108, 0)); await p.waitForFunction(() => (window as any).__spiritModel?.rigs?.size === 1, { timeout: 60000 }); await sleep(4000)
    await still(p, 'p0', 'run', 'fox-run'); await still(p, 'p0', 'sit', 'fox-sit'); await still(p, 'p0', 'idle', 'fox-stand'); await still(p, 'p0', 'run', 'fox-run2', 2.4)
  } else if (!perf) {
    const { p, got } = await open(br, true, { pieces, pots, follow: [], party: [] })
    await p.evaluate(() => (window as any).__ather.tp(-131, 108, 0))
    ok(await p.waitForFunction(() => (window as any).__spiritModel?.rigs?.size === 3, { timeout: 60000 }).then(() => true).catch(() => false), '1. owner: both Manalotls and the Vulnyx are rigged')
    ok(got.includes('manalotl-rigged.glb 200') && got.includes('vulnyx-rigged.glb 200'), `1. both rigged glbs answered (${got.join(', ')})`)
    const one = await p.evaluate(() => [...(window as any).__spiritModel.rigs.values()].map((r: any) => ({ sk: new Set(Object.values(r.body.meshes).map((m: any) => m.skeleton.uuid)).size, sp: r.sp, uuid: r.body.skeleton.uuid, bones: r.body.bones.length })))
    ok(one.every((x: any) => x.sk === 1 && x.bones === (x.sp === 'fox' ? 24 : 27)) && new Set(one.map((x: any) => x.uuid)).size === 3, `1. one skeleton each, not shared (${JSON.stringify(one.map((x: any) => [x.sk, x.bones]))})`)
    const c1 = await p.evaluate(() => ({ ...(window as any).__spiritModel.rigCount })); ok(c1.live === 3, `1. three live bodies ${JSON.stringify(c1)}`)
    await sampler(p)
    let G: any = null; const t0 = Date.now()
    while (Date.now() - t0 < 240000) { await sleep(10000)
      // the unused key keeps idle mode off
      await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F13', code: 'F13' })))
      const R = await rowsOf(p); const rows = Object.keys(R.b).filter(k => R.sp[k] === 'axolotl').map(k => R.b[k]), fox = Object.keys(R.b).filter(k => R.sp[k] === 'fox').flatMap(k => R.b[k]); const merge = (c: 'walk' | 'run') => { const g = rows.map(r => gait(r, c)); return { drift: Math.max(...g.map(x => x.drift)), p95: Math.max(...g.map(x => x.p95 || 0)), med: Math.max(...g.map(x => x.med || 0)), n: g.reduce((a, x) => a + x.n, 0), spans: g.reduce((a, x) => a + x.spans, 0), swing: Math.max(...g.map(x => x.swing)), tail: Math.max(...g.map(x => x.tail)), v: Math.max(...g.map(x => x.v)) } }
      const lay = rows.flat().filter(r => r.w.sit > 0.95).length; G = { walk: merge('walk'), run: merge('run'), lay, ground: rows.flat().filter(r => r.w.sit > 0.95 && r.mode === 'sit').length, sums: R.sums, n: R.n, modes: [...new Set(rows.flat().map(r => r.mode))], fox, foxRun: gallop(fox, 'trot'), foxSit: fox.filter(r => r.w.sit > 0.95).length, fps: rows[0].length / ((rows[0].at(-1)!.t - rows[0][0].t) / 1000) }
      if (G.walk.n > 40 && G.run.n > 40 && G.ground > 5 && G.foxRun.n > 15 && G.foxSit > 5 && Date.now() - t0 > 60000) break }
    const f = (g: any) => `${g.spans} straight stretches, ${g.n} planted samples, ${g.v.toFixed(2)} m/s, drift median ${(g.med * 1000).toFixed(1)} p95 ${(g.p95 * 1000).toFixed(1)} max ${(g.drift * 1000).toFixed(1)} mm, leg swing ${(g.swing * 1000).toFixed(0)} mm, tail <= ${g.tail.toFixed(0)} deg off behind`
    console.log(`   ${G.fps.toFixed(1)} fps, modes ${G.modes}`)
    for (const c of ['walk', 'run'] as const) { const g = G[c]
      ok(g.n > 0 && g.swing > 0.05, `2. she ${c}s with her legs moving: ${f(g)}`); ok(g.n > 0 && g.drift < 0.01, `2. ${c}: planted feet stay put (max ${(g.drift * 1000).toFixed(1)} mm, bar 10)`); ok(g.n > 0 && g.tail < 25, `2. ${c}: the tail trails behind (${g.tail.toFixed(0)} deg)`) }
    ok(G.lay > 5, `2. she lies down (${G.lay} frames, ${G.ground} on the ground)`); ok(G.sums === 0 && G.n > 100, `2. a clip always plays (${G.n} samples, ${G.sums} off)`)
    // M102 the Vulnyx
    { const X: Row[] = G.fox, g = G.foxRun; console.log(`   Vulnyx gallop: ${f3(g)}`); const gr = X.filter(r => !/hop/.test(r.mode)), bl = gr.filter(r => Object.values(r.w).filter(x => x > 0).length > 1), low = Math.min(...gr.map(r => r.low)), lift = Math.max(...gr.map(r => r.lift))
      const count = (c: string) => X.filter(r => r.w[c] > 0.5).length
      console.log(`   Vulnyx: ${X.length} frames, modes ${[...new Set(X.map(r => r.mode))]}, frames idle ${count('idle')} walk ${count('walk')} run ${count('run')} sit ${count('sit')}`)
      ok(g.n > 0 && g.swing > 0.1, `2. Vulnyx runs with her legs moving: ${f(g)}`); ok(g.n > 0 && g.drift < 0.01, `2. Vulnyx run: planted feet stay put (max ${(g.drift * 1000).toFixed(1)} mm, bar 10)`); ok(g.n > 0 && g.tail < 25, `2. Vulnyx run: the tail trails behind (${g.tail.toFixed(0)} deg)`)
      ok(count('walk') > 0, `2. Vulnyx walks her first steps (${count('walk')} frames)`); ok(G.foxSit > 5, `2. Vulnyx sits (${G.foxSit} frames)`)
      ok(bl.length > 5 && low > -0.02, `2. Vulnyx: nothing under the ground in ${gr.length} frames, ${bl.length} of them blends (lowest ${(low * 1000).toFixed(1)} mm, spec -20; lifted up to ${(lift * 1000).toFixed(0)} mm)`) }
    const sz = await p.evaluate(() => new Promise<any>(res => { let v = 0, k = 0; const iv = setInterval(() => { const t = (window as any).__spiritModel.trots; v = Math.max(v, t.fox.hWorld || 0); if (++k > 60) { clearInterval(iv); res({ l: t.axolotl.len, h: t.axolotl.hWorld, v, vh: t.fox.h }) } }, 500) }))
    ok(Math.abs(sz.l - 0.9) < 0.06 && sz.h > 0.35 && sz.h < 0.47, `1. hull included she is ${sz.l.toFixed(3)} m nose to tail, ${sz.h.toFixed(3)} m tall`); ok(Math.abs(sz.vh * 1.003 - 0.7) < 1e-6 && Math.abs(sz.v - 0.717) < 0.03, `1. the Vulnyx stands ${sz.v.toFixed(3)} m, hull included (grown 0.70 + hull 0.017; tallest over 30 s)`)
    await still(p, 'p0', 'walk', 'walk'); await still(p, 'p0', 'sit', 'lie'); await still(p, 'p0', 'idle', 'stand')
    await p.close()
    // 3 + 4: following, then the Wilds and home
    const w = await open(br, true, { pieces, pots, follow: ['p0', 'p1', 'p2'], party: ['p0', 'p1', 'p2'] }); const q = w.p
    await q.evaluate(() => (window as any).__ather.tp(-131, 110, 0)); await q.waitForFunction(() => (window as any).__spiritModel?.rigs?.size === 3, { timeout: 60000 }); await sleep(8000); await sampler(q)
    await q.evaluate(`new Promise(res => { let t0 = performance.now(), last = t0, a = 0; const A = window.__ather; (function f() { const n = performance.now(), dt = Math.min(0.25, (n - last) / 1000); last = n; a += 4.2 * dt / 5; A.tp(-131 + Math.sin(a) * 5, 110 + 5 - Math.cos(a) * 5, 0); if (n - t0 < 12000) requestAnimationFrame(f); else res(0) })() })`); await sleep(9000)
    const FB = await rowsOf(q), F = FB.b, fr = Object.values(F).flat().filter(r => r.mode === 'follow'), mv = fr.filter(r => r.v > 0.1), capped = mv.filter(r => r.capped).length, rest = Object.values(F).flatMap(b => b.filter(r => r.mode === 'follow' && r.t > b.at(-1)!.t - 3000))
    ok(mv.length > 10 && mv.every(r => r.clip === 'walk' || r.clip === 'run' || r.v < 0.2), `3. following she walks / runs (${mv.length} moving frames, top ${Math.max(0, ...mv.map(r => r.v)).toFixed(1)} m/s)`)
    console.log(`   3. the cadence cap bit on ${capped} of ${mv.length} moving frames (feet slide then)`); ok(rest.every(r => r.clip === 'idle' || r.clip === 'sit'), `3. stood by she is still (${[...new Set(rest.map(r => r.clip))]})`)
    { const fx = F.p1.filter(r => r.mode === 'follow' && r.v > 0.1); console.log(`   3. Vulnyx: cap bit on ${fx.filter(r => r.capped).length} of ${fx.length} moving frames, top ${Math.max(0, ...fx.map(r => r.v)).toFixed(1)} m/s`) }
    // 3b: straight legs at a keeper's walk and sprint
    for (const mps of [4.2, 6.5]) {
      await q.evaluate(() => { for (const b of Object.values((window as any).__m132.bodies) as any[]) b.rows.length = 0 })
      await q.evaluate(`new Promise(res => { let t0 = performance.now(), last = t0, s = 0; const A = window.__ather, L = 24; (function f() { const n = performance.now(), dt = Math.min(0.25, (n - last) / 1000); last = n; s += ${mps} * dt; const k = s % (2 * L), out = k < L; A.tp(-144 + (out ? k : 2 * L - k), 113, out ? -Math.PI / 2 : Math.PI / 2); if (n - t0 < 30000) requestAnimationFrame(f); else res(0) })() })`)
      const X = (await rowsOf(q)).b.p1, m = X.filter(r => r.mode === 'follow' && r.v > 0.3), g = gallop(X, 'follow', mps * 0.5), all = m.map(r => r.v).sort((a, b) => a - b)
      console.log(`   3b. behind ${mps} m/s: ${m.length} moving frames, median ${(all[all.length >> 1] ?? 0).toFixed(1)} m/s, cap bit on ${m.filter(r => r.capped).length}; ${f3(g)}`)
      ok(g.n > 3 && g.drift < 0.02, `3b. Vulnyx behind a keeper at ${mps} m/s: planted feet stay put (${g.n} planted samples at ${g.v.toFixed(1)} m/s, max ${(g.drift * 1000).toFixed(1)} mm, bar 20)`)
    }
    await q.evaluate(() => (window as any).__ather.tp(-131, 110, 0)); await sleep(3000)
    const c3 = await q.evaluate(() => ({ ...(window as any).__spiritModel.rigCount }))
    await q.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
    await q.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 })
    ok(await q.waitForFunction(() => (window as any).__spiritModel.mounted === 3 && (window as any).__spiritModel.rigs.size === 3, { timeout: 60000 }).then(() => true).catch(() => false), '4. in the Wilds all three followers are rigged')
    const c4 = await q.evaluate(() => ({ ...(window as any).__spiritModel.rigCount })); ok(c4.live === 3 && c4.disposed >= c3.disposed + 3, `4. the garden bodies are gone: ${JSON.stringify(c3)} -> ${JSON.stringify(c4)}`)
    await q.evaluate(() => { localStorage.setItem('ather.spiritFollow.v1', '[]') }); await q.close()
    // 4b: a Wilds visit with nobody following leaves nothing
    const z = await open(br, true, { pieces, pots, follow: [], party: [] })
    await z.p.evaluate(() => (window as any).__ather.tp(-131, 110, 0)); await z.p.waitForFunction(() => (window as any).__spiritModel?.rigs?.size === 3, { timeout: 60000 })
    await z.p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } })); await z.p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(5000)
    const c5 = await z.p.evaluate(() => ({ ...(window as any).__spiritModel.rigCount, rigs: (window as any).__spiritModel.rigs.size, mounted: (window as any).__spiritModel.mounted }))
    ok(c5.live === 0 && c5.rigs === 0 && c5.mounted === 0 && c5.made === c5.disposed, `4. nobody follows: nothing left after despawn ${JSON.stringify(c5)}`); await z.p.close()
    // 6: a player
    const n = await open(br, false, { pieces, pots, follow: [], party: [] })
    await n.p.evaluate(() => (window as any).__ather.tp(-131, 108, 0)); await sleep(12000)
    const pl = await n.p.evaluate(() => { const m = (window as any).__spiritModel; return { rigs: m.rigs.size, made: m.rigCount.made, mounted: m.mounted, h: m.trots.axolotl?.h, len: m.trots.axolotl?.len, fh: m.trots.fox?.h, tall: m.trots.axolotl?.hWorld } })
    ok(pl.rigs === 0 && pl.made === 0 && pl.mounted === 3 && Math.abs(pl.h - 0.9 / 1.29) < 1e-6 && Math.abs(pl.len - 0.9) < 0.09 && pl.fh === 0.7, `6. a player's Manalotl and Vulnyx are the old ones ${JSON.stringify(pl)}`)
    ok(n.got.includes('manalotl.glb 200') && n.got.includes('vulnyx.glb 200') && !n.got.some(x => x.includes('rigged')), `6. and the rigged glb is never asked for (${n.got.join(', ')})`)
    if (shots) { const m = await n.p.evaluate(() => (window as any).__spiritModel.trots.axolotl); await n.p.evaluate((x: number, z: number) => (window as any).__ather.tp(x + 1.5, z + 0.8, 0), m.x, m.z); await sleep(800); await aimAt(n.p, m.x, m.z, 0.3); await hideCard(n.p); await n.p.screenshot({ path: `${shots}/player-old-390.png` }).catch(() => {}) }
    await n.p.close()
  } else {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, k) => [`p${k}`, pot(process.argv.includes('--fox') ? 'fox' : 'axolotl', k)]))
    for (const r of [1, 2, 3]) for (const q of ['&rig=0', '']) {
      const { p } = await open(br, true, { pieces: BEDS(20), pots: many, follow: [], party: [] }, q)
      await p.evaluate(() => (window as any).__ather.tp(-130, 114, 0)); await sleep(15000)
      const m = await p.evaluate((ms: number) => new Promise<any>(res => { const d: number[] = [], M = (window as any).__spiritModel; let last = performance.now(); const end = last + ms, iv = setInterval(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F13', code: 'F13' })); (window as any).__ather.tp(-130, 114, 0) }, 3000)
        const f = () => { const n = performance.now(); d.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else { clearInterval(iv); d.sort((a, b) => a - b); res({ n: d.length, mean: d.reduce((a, b) => a + b) / d.length, p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], mounted: M.mounted, rigs: M.rigs.size }) } }; requestAnimationFrame(f) }), 30000)
      console.log(`   20 bodies run ${r} ${q ? 'OLD   ' : 'RIGGED'}: mean ${m.mean.toFixed(1)} ms, p50 ${m.p50.toFixed(1)}, p95 ${m.p95.toFixed(1)} (${m.n} frames, ${m.mounted} drawn, ${m.rigs} rigged)`)
      ok(m.mounted === 20 && m.rigs === (q ? 0 : 20), `perf: ${m.mounted} bodies`); if (shots && r === 1) await p.screenshot({ path: `${shots}/perf-${q ? 'old' : 'rigged'}.png` }).catch(() => {})
      await p.close()
    }
  }
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) }
await br.close()
ok(errs.length === 0, `7. 0 page errors ${errs.join(' | ')}`)
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
