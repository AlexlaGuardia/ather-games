// ── PARTY PLAY (BETA M156 s1, play / Jin, 11-25; Alex's 11-24 playtest) ───────────────────────────────────────────────────────
// PROD ONLY (the game socket + the party lobby are behind the tunnel). Two throwaway browsers in one party:
//   A = a keeper with a garden, on their own plot.   N = a newborn mid-tutorial in the Glade (no garden folded), on a phone size.
// PASS =
//   V1 N in the Glade is listed for A, NOT as on a plot and with no Visit button
//   V2 A opens N's visit link: refused, A never starts a visit, A's zone stays its own plot
//   V3 N's fold map lists no 'Your plot' stop; travel home puts N in the Glade
//   V4 N visits A (folded) by the real Visit button: the snapshot lands.  V5 N reloads there: N wakes in the Glade, never on a plot
//   W1 both in the Wilds, each sees the other.  W2 N walks (real W held): A's figure of N moves its feet; W3 A walks: N sees the same;
//   W4 standing still the feet rest; W5 a turn (real look hook) turns the figure
// MEASURED, never asserted: frame ms + draw calls with 0 and 1 mate in view (--frames N seconds); the infection ledger of each (the
//   host's Wilds question).    --only VWF picks parts.
// The scene is read through three's own devtools event (Scene / WebGLRenderer announce themselves), so any build can be read.
//   npx tsx scripts/m156-party-play-check.mts [--url https://ather.games] [--only VWF] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { freshTut } from '../src/app/shimmer/open/ather/glade-tutorial'
import { gladeNewbornSpot, GLADE_TILE } from '../src/app/shimmer/open/ather/glade-cluster'
import { makeSpot } from '../src/app/shimmer/open/ather/last-spot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), only = flag('--only', 'VWF'), secs = Number(flag('--frames', '12'))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'PV' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')
const WORKS = { v: 1, rooms: [], chests: [], pieces: [] }
const g0 = gladeNewbornSpot(), GLADE_SPOT = makeSpot(GLADE_TILE, g0.x, g0.z, g0.yaw)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const poll = async (fn: () => Promise<unknown>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f) as Promise<any>
const myId = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id')) as Promise<string>
async function open(tag: string, seed: Record<string, unknown>, w: number, h: number): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, s: string) => {
    const t = new EventTarget() as any, w = window as any
    w.__THREE_DEVTOOLS__ = t; w.__scenes = []; w.__gls = []
    t.addEventListener('observe', (e: any) => { const d = e.detail; if (d?.isScene) w.__scenes.push(d); else if (d?.info) w.__gls.push(d) })
    if (sessionStorage.getItem('m156')) return; sessionStorage.setItem('m156', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c)
    for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, JSON.stringify(v))
  }, CODE, JSON.stringify(seed))
  return p
}
async function load(p: Page, q = '') {
  await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.zone && !!(window as any).__mp && !!(window as any).__visit && !!(window as any).__lobby, { timeout: 240000, polling: 1000 })
  await sleep(2500)
}
const clickText = (p: Page, sel: string, text: string) => p.evaluate((s: string, t: string) => { const e = [...document.querySelectorAll<HTMLElement>(s)].find(x => x.textContent?.includes(t)); e?.click(); return !!e }, sel, text)
async function panel(p: Page) {
  for (let i = 0; i < 4; i++) {
    if (await p.$('[data-panel="play-together"]')) return true
    if (!(await p.$('[data-panel="options"]'))) { await p.keyboard.press('KeyO'); await poll(async () => !!(await p.$('[data-panel="options"]')), 8000) }
    await clickText(p, '[data-panel="options"] button', 'Play together')
    if (await poll(async () => !!(await p.$('[data-panel="play-together"]')), 6000)) return true
  }
  return false
}
const closePanels = async (p: Page) => { for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await sleep(400) } }
const zone = (p: Page, z: string, ms = 60000) => poll(async () => (await ev(p, '__ather', 'zone')) === z, ms)
const wilds = async (p: Page) => { for (let i = 0; i < 30 && (await ev(p, '__ather', 'zone')) !== 'wilds'; i++) {
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {}) } }
/** the figure the page draws for peer `id`: local foot + hand offsets and the body's facing, or null (visible figures only) */
const figure = (p: Page, id: string) => p.evaluate((id: string) => {
  const w = window as any, q = (w.__mp.peers() as any[]).find(x => x.id === id); if (!q) return null
  let best: any = null, bd = 1.2
  for (const s of w.__scenes) s.traverse((o: any) => {
    if (o.name !== 'foot-l') return
    for (let k = o; k; k = k.parent) if (!k.visible) return
    const e = o.matrixWorld.elements, d = Math.hypot(e[12] - q.x, e[14] - q.z); if (d < bd) { bd = d; best = o }
  })
  if (!best) return null
  const g = best.parent, at = (n: string) => g.getObjectByName(n).position, m = g.matrixWorld.elements
  return { lz: at('foot-l').z, ly: at('foot-l').y, hz: at('hand-r').z, yaw: Math.atan2(m[8], m[10]), x: q.x, z: q.z }
}, id)
/** watch a figure for `ms`: the span of its left foot (local z) and how far it travelled */
const watch = async (p: Page, id: string, ms: number) => {
  const r: any[] = []; for (const t = Date.now(); Date.now() - t < ms;) { const f = await figure(p, id); if (f) r.push(f); await sleep(60) }
  const span = (k: string) => r.length ? Math.max(...r.map(f => f[k])) - Math.min(...r.map(f => f[k])) : NaN
  return { n: r.length, foot: span('lz'), hand: span('hz'), went: r.length ? Math.hypot(r[r.length - 1].x - r[0].x, r[r.length - 1].z - r[0].z) : 0, yaw: r[r.length - 1]?.yaw as number }
}
const mm = (v: number) => `${(v * 100).toFixed(1)} cm`
/** frames over `secs`: rAF gaps, the JS time inside the frame callbacks, and draw calls per frame */
const frames = (p: Page, s: number) => p.evaluate(async (s: number) => {
  const w = window as any, gaps: number[] = [], js: number[] = [], calls: number[] = [], gl = w.__gls[w.__gls.length - 1], raf = window.requestAnimationFrame.bind(window)
  let acc = 0
  window.requestAnimationFrame = (f: FrameRequestCallback) => raf(t => { const a = performance.now(); f(t); acc += performance.now() - a })
  const proto = gl?.render; let c = 0
  if (gl) { gl.render = function (...a: any[]) { const r = proto.apply(gl, a); c += gl.info.render.calls; return r } }
  await new Promise<void>(done => { let last = 0; const t0 = performance.now(); const f = (t: number) => { if (last) { gaps.push(t - last); js.push(acc); calls.push(c) } acc = 0; c = 0; last = t; if (performance.now() - t0 > s * 1000) done(); else raf(f) }; raf(f) })
  window.requestAnimationFrame = raf; if (gl) gl.render = proto
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]
  return { n: gaps.length, ms: +med(gaps).toFixed(1), js: +med(js).toFixed(2), calls: med(calls) }
}, s)
try {
  const a = await open('A', { 'open.works.v1': WORKS }, 800, 500); await load(a)
  const n = await open('N', { 'open.tutorial.v1': freshTut(), 'open.lastspot.v1': GLADE_SPOT }, 390, 844); await load(n)
  const idA = await myId(a), idN = await myId(n)
  ok(await zone(n, 'glade'), `setup: N is in the Glade (${await ev(n, '__ather', 'zone')}), tutorial open`)
  if (only.includes('V')) {
    ok(await panel(a), 'V1 A opened Play together')
    const row = `[data-mate="${idN}"]`
    ok(await poll(async () => !!(await a.$(row)), 60000), 'V1 N is in the party list'); await sleep(2500)
    const said = await a.evaluate((s: string) => document.querySelector(s)?.textContent ?? '', row), btn = !!(await a.$(`${row} [data-act="visit-plot"]`))
    ok(!btn && !/plot/.test(said), `V1 N in the Glade is not visitable ("${said}", Visit button ${btn})`)
    await closePanels(a)
    if (btn) {   // the old build: press it, and say what happens
      await panel(a); await a.click(`${row} [data-act="visit-plot"]`); const landed = await zone(a, 'plot', 10000); await sleep(3000)
      console.log(`  (pressed: zone ${await ev(a, '__ather', 'zone')} ${landed}, visiting ${await ev(a, '__visit', 'host')}, snapshot ${await ev(a, '__visit', 'hasSnap')})`)
      const t = Date.now(); await poll(async () => ((await ev(a, '__visit', 'log')) as string[]).some(e => e.startsWith('end:')), 60000)
      console.log(`  (sent back after ${((Date.now() - t) / 1000 + 3).toFixed(0)} s: ${await ev(a, '__visit', 'log')})`)
    }
    await load(a, `&visit=${idN}&vn=Newborn`)
    ok(await poll(async () => ((await ev(a, '__visit', 'log')) as string[]).length > 0, 40000), 'V2 the link was answered'); await sleep(1500)
    const log = await ev(a, '__visit', 'log') as string[]
    ok(log.some(e => e.startsWith('refused:')) && !log.some(e => e.startsWith('start:')) && (await ev(a, '__mp', 'zone')) === `open:plot:${idA}`, `V2 a visit to an unfolded garden is refused, A never leaves (${log}; ${await ev(a, '__mp', 'zone')})`)
    if (log.some(e => e.startsWith('start:'))) await load(a)

    await n.evaluate(() => (window as any).__ather.open('gate')); await poll(async () => !!(await n.$('[data-panel="fold-map"]')), 15000)
    const stops = await n.evaluate(() => [...document.querySelectorAll('[data-panel="fold-map"] button')].map(b => b.textContent ?? '')) as string[]
    ok(stops.some(s => s.startsWith('Moonwell Glade')) && !stops.some(s => s.startsWith('Your plot')), `V3 N's fold map has no 'Your plot' stop (${stops.filter(s => /plot|Glade/.test(s))})`)
    await closePanels(n)
    await n.evaluate(() => (window as any).__ather.travel({ kind: 'home' })); await sleep(6000)
    ok((await ev(n, '__ather', 'zone')) === 'glade', `V3 travel home puts N in the Glade (${await ev(n, '__ather', 'zone')})`)

    ok(await panel(n), 'V4 N opened Play together')
    const rowA = `[data-mate="${idA}"] [data-act="visit-plot"]`
    ok(await poll(async () => !!(await n.$(rowA)), 60000), 'V4 A (folded) has a Visit button'); await n.evaluate((s: string) => document.querySelector<HTMLElement>(s)?.click(), rowA)
    ok(await poll(async () => (await ev(n, '__visit', 'hasSnap')) === true, 45000) && await zone(n, 'plot'), `V4 N is on A's plot, the snapshot landed (${await ev(n, '__visit', 'log')})`)
    await sleep(3500); await load(n); await sleep(3000)
    ok(await zone(n, 'glade', 15000), `V5 N reloads on A's plot and wakes in the Glade (${await ev(n, '__ather', 'zone')}, visiting ${await ev(n, '__visit', 'visiting')})`)
  }
  if (only.includes('W') || only.includes('F')) {
    for (const p of [a, n]) { await closePanels(p); await wilds(p) }
    ok(await poll(async () => (await ev(a, '__mp', 'peers'))?.some((q: any) => q.id === idN) && (await ev(n, '__mp', 'peers'))?.some((q: any) => q.id === idA), 90000), 'W1 both in the Wilds, each sees the other')
    const at = await ev(a, '__mp', 'me')
    await n.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), at.x + 3, at.z - 4); await sleep(6000)
    for (const [who, from, to, id] of [['W2 A sees N', n, a, idN], ['W3 N sees A', a, n, idA]] as const) if (only.includes('W')) {
      await from.bringToFront(); await from.mouse.click(200, 250); await sleep(500)
      ok(await poll(async () => !!(await figure(to, id)), 30000), `${who}: drawn as a keeper figure`)
      const still = await watch(to, id, 3000)
      ok(still.foot < 0.02, `W4 ${who} standing: feet at rest (${mm(still.foot)}, ${still.n} samples)`)
      await from.keyboard.down('KeyW'); await sleep(700)
      const walk = await watch(to, id, 7000); await from.keyboard.up('KeyW')
      ok(walk.went > 1, `${who} walk: the figure travels (${walk.went.toFixed(1)} m)`)
      ok(walk.foot > 0.06 && walk.hand > 0.05, `${who} walk: LIMBS move (foot ${mm(walk.foot)}, hand ${mm(walk.hand)}, ${walk.n} samples)`)
      await sleep(2500); const rest = await watch(to, id, 2500)
      ok(rest.foot < 0.02, `W4 ${who} stopped: feet at rest again (${mm(rest.foot)})`)
      const y0 = rest.yaw; await from.evaluate(() => { const g = (window as any).__ather; g.look?.(g.yaw() + 1.5, 0) }); await sleep(4000)
      const y1 = (await figure(to, id))?.yaw ?? NaN, d = Math.abs(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)))
      ok(d > 1 && d < 2, `W5 ${who} turn: the body turns with them (${d.toFixed(2)} rad)`)
    }
  }
  if (only.includes('F')) {
    const me = await ev(a, '__mp', 'me'), yaw = await ev(a, '__ather', 'yaw')
    const put = (d: number) => n.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), me.x - Math.sin(yaw) * d, me.z - Math.cos(yaw) * d)
    await a.bringToFront()
    for (const r of [1, 2]) {
      await put(5); await sleep(7000); console.log(`  F${r} mate 5 m in front: ${JSON.stringify(await frames(a, secs))}, figure ${!!(await figure(a, idN))}`)
      await put(-12); await sleep(7000); console.log(`  F${r} mate 12 m behind: ${JSON.stringify(await frames(a, secs))}`)
    }
    const led = async (p: Page) => ((await ev(p, '__ather', 'wmNodes')) as any[]).map(x => `${x.id}:${x.infected ? 'grey' : 'clear'}`).sort().join()
    const l0 = [await led(a), await led(n)]
    const id = ((await ev(a, '__ather', 'wmNodes')) as any[]).find(x => x.infected)?.id
    await a.evaluate((i: string) => (window as any).__ather.wmClear(i), id); await sleep(10000)
    const st = async (p: Page) => ((await ev(p, '__ather', 'wmNodes')) as any[]).find(x => x.id === id)?.infected ? 'grey' : 'clear'
    console.log(`  Q1 infection ledgers alike before: ${l0[0] === l0[1]}; A clears ${id}: A reads ${await st(a)}, N reads ${await st(n)} 10 s later; fight host A ${await ev(a, '__fight', 'host')} / N ${await ev(n, '__fight', 'host')}`)
    const c = await n.browserContext(); await c.close(); await sleep(9000)
    console.log(`  F3 alone (mate left): ${JSON.stringify(await frames(a, secs))}`)
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.join(' | ')}`)
} catch (e) { ok(false, `error: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
