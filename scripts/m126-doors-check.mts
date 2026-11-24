// BETA M126 (Alex 11-24: "the trio cant leave the plot", "issues in the garden with doors"): PLAYED AT 390x844, NON-OWNER, REAL WALKER (KeyW).
// SETUP: 3 bloomed spirits FOLLOWING + the Gemdigger; a house 8 x 6 m raised 1.2 m with a 2 m door (and its steps) in its north wall.
// Fresh profile, every non-GET stubbed. Sampled every frame: __formation (where each stands), __spiritModel.rigs (their feet).
//  1 boot: all four beside the keeper (they follow since before they were drawn).  2 in through the door: all four inside, the spirits
//  on the raised floor.  3 out again: all four beside the keeper, on the ground.  4 nobody in a wall on any frame's step.
//  5 out of the plot by the path to the Green's gate: all four there.  6 back on the plot: all four there.
//  7 no jump: no 3 frames faster than 13 m/s (the walk's cap is 9) and no one frame past 2.4 m (9 m/s x the 0.25 s a frame may cover).  8 0 page errors.
//   npx tsx scripts/m126-doors-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { findRooms, type Walls } from '../src/app/shimmer/open/ather/plot-walls'
import { clusterFrame } from '../src/app/shimmer/open/ather/cluster'
import { GATE, GROUND_Y, PATH_START, THRESHOLD } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m126-doors'); mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const X0 = -144, X1 = -136, Z0 = 98, Z1 = 104, RAISE = 1.2, W: Record<string, Walls[string]> = {}
for (let i = X0; i < X1; i++) { W[`h,${i},${Z0}`] = i === -141 || i === -140 ? { mat: 'goldwood', kind: 'door' } : { mat: 'goldwood' }; W[`h,${i},${Z1}`] = { mat: 'goldwood' } }
for (let j = Z0; j < Z1; j++) { W[`v,${X0},${j}`] = { mat: 'goldwood' }; W[`v,${X1},${j}`] = { mat: 'goldwood' } }
const SOLID = Object.entries(W).filter(([, w]) => !w.kind).map(([k]) => { const [o, a, b] = k.split(','), i = +a, j = +b; return o === 'h' ? { x0: i, x1: i + 1, z0: j - 0.1, z1: j + 0.1 } : { x0: i - 0.1, x1: i + 0.1, z0: j, z1: j + 1 } })
const at0 = Date.now() - 20 * 86400000, pot = (sp: string, k: number) => ({ seed: `mana_seed_${sp}`, at: at0 + k, v: 2, tends: [], bloomed: true })
const S = { works: { v: 1, rooms: [], chests: [], pieces: ['pa', 'pb', 'pc'].map((id, k) => ({ id, item: 'spirit_planter', x: -124, z: 112 + k * 3, q: 0, placedAt: 1 })), walls: W, paid: { [findRooms(W)[0].key]: 48 }, found: RAISE },
  pots: { pa: pot('fox', 0), pb: pot('fox', 1), pc: pot('axolotl', 2) }, tut: { v: 1, live: false, folded: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none' } }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)), '0. a NON-owner keeper')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m126d')) return; sessionStorage.setItem('m126d', '1'); const L = localStorage
    L.setItem('ather:shimmer:birthRune', 'star'); L.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] })); L.setItem('open.works.v1', JSON.stringify(s.works)); L.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    L.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] })); L.setItem('ather.spiritFollow.v1', JSON.stringify(['pa', 'pb', 'pc'])); L.setItem('open.companion.v1', JSON.stringify({ active: 'gemdigger', met: ['gemdigger'], sentHome: false }))
  }, S)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000); await p.touchscreen.tap(195, 644)
  ok(await p.waitForFunction(() => (window as any).__formation?.members.length === 4 && Object.keys((window as any).__formation.pos).length === 4, { timeout: 90000 }).then(() => true).catch(() => false), 'the formation holds four'); await sleep(2500)
  type V = { x: number; z: number; y?: number }
  const read = () => p.evaluate(() => { const W = window as any, f = W.__formation, r = W.__spiritModel.rigs; return { k: { x: f.keeper.x, z: f.keeper.z }, layout: f.layout, pos: Object.fromEntries(Object.entries(f.pos).map(([id, q]: any) => [id, { x: q.x, z: q.z, y: r.get(id)?.y }])) } }) as Promise<{ k: V; layout: string; pos: Record<string, V> }>
  const say = (r: { k: V; pos: Record<string, V> }) => Object.entries(r.pos).map(([id, q]) => `${id} ${Math.hypot(q.x - r.k.x, q.z - r.k.z).toFixed(1)} m${q.y === undefined ? '' : ` y ${q.y.toFixed(2)}`}`).join(', ')
  const near = (r: { k: V; pos: Record<string, V> }, d = 5) => Object.keys(r.pos).length === 4 && Object.values(r.pos).every(q => Math.hypot(q.x - r.k.x, q.z - r.k.z) < d)
  // settle: up to `s` seconds for everyone to come (a slow phone), then the read
  const settle = async (good: (r: Awaited<ReturnType<typeof read>>) => boolean, s = 25) => { let r = await read(); for (let i = 0; i < s * 2 && !good(r); i++) { await sleep(500); r = await read() } return r }
  { const r = await read(); ok(near(r), `1. boot: beside the keeper (${say(r)})`) }
  await p.evaluate((walls: any) => { const w = window as any, D = w.__m126d = { wall: [] as string[], maxV: 0, maxM: 0, at: '', atM: '' }; let prev: any = null, t0 = performance.now()
    let hist: any[] = []   // speed over 3 frames on the page's own clock: the game's frame time and one frame's stamp differ by up to a frame on a software GPU
    const tick = () => { const now = performance.now(); t0 = now; const f = w.__formation; if (w.__m126skip) hist = []
      const h0 = hist.length >= 3 ? hist[hist.length - 3] : null, dt = h0 ? (now - h0.t) / 1000 : 9; if (f) hist.push({ t: now, pos: JSON.parse(JSON.stringify(f.pos)) }); if (hist.length > 4) hist.shift()
      if (f && prev && !w.__m126skip) for (const id of Object.keys(f.pos)) { const a = prev[id], b = f.pos[id]; if (!a) continue
        const m3 = h0?.pos[id] ? Math.hypot(b.x - h0.pos[id].x, b.z - h0.pos[id].z) : 0, m = Math.hypot(b.x - a.x, b.z - a.z), v = m3 / Math.max(dt, 0.016); if (m > D.maxM) { D.maxM = m; D.atM = `${id} ${a.x.toFixed(1)},${a.z.toFixed(1)} -> ${b.x.toFixed(1)},${b.z.toFixed(1)}, keeper ${f.keeper.x.toFixed(1)},${f.keeper.z.toFixed(1)}, ${(now - (hist[hist.length - 2]?.t ?? now)).toFixed(0)} ms` }; if (m3 > 0.3 && v > D.maxV) { D.maxV = v; D.at = `${id} ${m.toFixed(1)} m in ${dt.toFixed(2)} s at ${b.x.toFixed(1)},${b.z.toFixed(1)}` }
        for (let s = 1; s <= 12; s++) { const x = a.x + (b.x - a.x) * s / 12, z = a.z + (b.z - a.z) * s / 12; if (walls.some((q: any) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) { D.wall.push(`${id} ${x.toFixed(2)},${z.toFixed(2)}`); break } } }
      prev = f ? JSON.parse(JSON.stringify(f.pos)) : null; requestAnimationFrame(tick) }
    requestAnimationFrame(tick) }, SOLID)
  const tp = async (x: number, z: number) => { await p.evaluate((x: number, z: number) => { const w = window as any; w.__m126skip = true; w.__ather.tp(x, z, 0) }, x, z); await sleep(1500) }
  // the real walker: look at the point, hold W, until within 0.6 m
  const go = async (x: number, z: number, ms = 60000) => { const t = Date.now(); await p.keyboard.down('w')
    const got = await p.evaluate(async (x: number, z: number, ms: number) => { const A = (window as any).__ather, t = performance.now(); let best = 99
      while (performance.now() - t < ms) { const s = A.state(), px = s.px ?? s.x, pz = s.pz ?? s.z, d = Math.hypot(x - px, z - pz); best = Math.min(best, d); if (d < 0.7) return d; A.look(Math.atan2(-(x - px), -(z - pz)), 0); await new Promise(r => requestAnimationFrame(r)) } return best }, x, z, ms)
    await p.keyboard.up('w'); if (got > 1) console.log(`  (the keeper stopped ${got.toFixed(1)} m short of ${x},${z} after ${((Date.now() - t) / 1000).toFixed(0)} s)`); return got }
  await tp(-140, 92); await settle(r => near(r)); await p.evaluate(() => { (window as any).__m126skip = false })
  const inside = (q: V) => q.x > X0 && q.x < X1 && q.z > Z0 && q.z < Z1
  await go(-140, 96); await go(-140, 100.5); await go(-138, 102.3); await go(-142, 102.3)
  { const r = await settle(r => near(r) && Object.values(r.pos).every(inside)); ok(inside(r.k) && Object.values(r.pos).every(inside), `2. all four in through the door (keeper ${r.k.x.toFixed(1)},${r.k.z.toFixed(1)}; ${say(r)})`)
    ok(['pa', 'pb', 'pc'].every(i => Math.abs((r.pos[i].y ?? 0) - GROUND_Y - RAISE) < 0.15), `2. the spirits on the raised floor (want ${GROUND_Y + RAISE})`); await p.screenshot({ path: `${out}/inside.png` }).catch(() => {}) }
  await go(-140, 100.5); await go(-140, 94); await go(-130, 92)
  { const r = await settle(r => near(r) && !Object.values(r.pos).some(inside)); ok(near(r) && !Object.values(r.pos).some(inside), `3. out again, all four beside the keeper (${say(r)})`)
    ok(['pa', 'pb', 'pc'].every(i => Math.abs((r.pos[i].y ?? 0) - GROUND_Y) < 0.15), '3. the spirits on the ground') }
  const D1 = await p.evaluate(() => (window as any).__m126d); ok(D1.wall.length === 0, `4. nobody in a wall (${D1.wall.slice(0, 3).join(' ')})`)
  // 5 / 6: the path
  await tp(THRESHOLD.x, THRESHOLD.z); await settle(r => near(r)); await p.evaluate(() => { (window as any).__m126skip = false })
  const pts = clusterFrame(null, []).paths[0].pts as [number, number][], dd = (q: [number, number]) => Math.hypot(q[0] - PATH_START.x, q[1] - PATH_START.z), way = dd(pts[0]) < dd(pts[pts.length - 1]) ? pts : [...pts].reverse()
  for (const [x, z] of way) await go(x, z); await go(GATE.x + 5, GATE.z - 5)
  { const r = await settle(r => near(r)); ok(near(r) && r.k.x < -160, `5. out of the plot at the gate, all four (keeper ${r.k.x.toFixed(0)},${r.k.z.toFixed(0)}; ${say(r)}; ${r.layout})`); await p.screenshot({ path: `${out}/gate.png` }).catch(() => {}) }
  for (const [x, z] of [...way].reverse()) await go(x, z); await go(THRESHOLD.x, THRESHOLD.z)
  { const r = await settle(r => near(r)); ok(near(r) && r.k.x > -145, `6. back on the plot, all four (keeper ${r.k.x.toFixed(0)},${r.k.z.toFixed(0)}; ${say(r)})`) }
  const D = await p.evaluate(() => (window as any).__m126d); ok(D.maxV < 13 && D.maxM < 2.4, `7. no jump (longest frame ${D.maxM.toFixed(2)} m: ${D.atM}; the walk's cap is 2.25; fastest ${D.maxV.toFixed(1)} m/s: ${D.at})`); ok(errs.length === 0, `8. 0 page errors ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
