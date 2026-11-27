// BETA M134 s1: THE SMITHY OPENS + FIT / WEAR / BREAK / REFIT, on the live Ather page (390x844, a FRESH context, never a real save).
// SETUP (stated, not played): a raised Smithy on the plot, a Starwillow Pruner in hand (no edge), 6 Venium + 6 Eurleen in the bag
// (no player source for metal yet: s2 buys it on the Nyx side). Then, real E + real clicks:
//   1. E at the Smithy's bench -> the panel -> Edges tab -> Fit Venium: 3 Venium spent, the pruner's dial gets a PURPLE ring (full)
//   2. the Wilds: the edge set to warnAt+1 uses left (stated), a Starwillow pruned -> the warning line; set to 1, another pruned ->
//      it BREAKS AWAY: no edge, the pruner + its tier still in hand, no ring
//   3. home, E at the Smithy -> Fit Eurleen -> a GOLD ring; reload -> the Eurleen edge is still on, the gold ring still drawn; 0 errors
//   npx tsx scripts/m134-smithy-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { type Zone } from '../src/app/shimmer/open/ather/forestry'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { EDGE, FIT_METAL, warnAt } from '../src/app/shimmer/open/ather/edges'
import { METAL_RING } from '../src/app/shimmer/ui/tool-stage'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m134')
mkdirSync(out, { recursive: true })
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows')
const lone = (k: string, skip: string[] = []) => W.trees.find(t => t.kind === k && !skip.includes(t.id) && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)!
const sw1 = lone('starwillow'), sw2 = lone('starwillow', [sw1.id])
const smith: Room = { id: 'smith-m134', kind: 'smith', x: -100, z: 100, q: 0, placedAt: 0, doneAt: 0, store: [] }
const res: Record<string, unknown> = { url, sw1: sw1?.id, sw2: sw2?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const ctx = await br.createBrowserContext()   // a fresh context: no real keeper's save
const p = await ctx.newPage(); await p.setViewport({ width: 390, height: 844 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((rooms: Room[]) => {
  if (localStorage.getItem('m134-seeded')) return; localStorage.setItem('m134-seeded', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[8] = { id: 'venium', n: 6 }; slots[9] = { id: 'eurleen', n: 6 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms, chests: [], pieces: [] }))
  localStorage.setItem('open.skills.v1', JSON.stringify([{ id: 'forestry', level: 10, xp: 0 }, { id: 'prospecting', level: 4, xp: 0 }]))
  localStorage.setItem('open.tools.v1', JSON.stringify({ forestry: { toolId: 'starwillow_blade', usesRemaining: 200, speedBonus: 0.8, xpBonus: 1.35 } }))
  localStorage.removeItem('open.pruned.v1')
}, [smith])
const tools = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.tools.v1') ?? '{}'))
const bagN = (id: string) => p.evaluate((x: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === x ? s.n : 0), 0), id)
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b2, c) => (window as any).__ather.tp(a, b2, c), x, z, yaw); await sleep(1500); await frame(); await frame() }
const click = (sel: string) => p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return false; e.click(); return true }, sel)
const bodyText = () => p.evaluate(() => document.body.innerText)
// the ring on the forestry dial: the stroke colours drawn in the tool gauges (phone pips / corner) + the corner's data-ring
const ring = () => p.evaluate(() => ({
  strokes: [...document.querySelectorAll('circle')].map(c => c.getAttribute('stroke') ?? '').filter(s => s.startsWith('#')),
  dataRing: document.querySelector('[data-socket="forestry"]')?.getAttribute('data-ring') ?? null,
}))
const hasRing = async (col: string) => { for (let i = 0; i < 10; i++) { const r = await ring(); if (r.strokes.includes(col)) return r; await sleep(400) } return await ring() }
const load = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
}
const fitAt = async (metal: 'venium' | 'eurleen', shot: string) => {
  const at = benchOf(smith); await tp(at.x, at.z - 1.2, 0)
  await aimAt(p, at.x, at.z, 0.6)
  await p.keyboard.press('e'); await sleep(1000)
  const panel = await p.evaluate(() => !!document.querySelector('[data-panel="bench"]'))
  const tab = await click('[data-bench-tab="edges"]'); await sleep(400)
  const fit = await click(`[data-edge-family="forestry"] [data-edge-metal="${metal}"] button`); await sleep(800)
  await p.screenshot({ path: `${out}/${shot}` }).catch(() => {})
  const on = await p.evaluate(() => document.querySelector('[data-edge-family="forestry"]')?.getAttribute('data-edge-on') ?? null)
  await p.keyboard.press('Escape'); await sleep(600)
  return { panel, tab, fit, on }
}
await load()
res.smithyCard = await p.evaluate(() => document.body.innerText.includes('Smithy'))
// 1. Fit Venium
res.fitVenium = await fitAt('venium', 'a-fit-venium.png')
const t1 = await tools(); res.tools1 = t1.forestry
res.veniumLeftInBag = await bagN('venium')
res.ring1 = await hasRing(METAL_RING.venium)
await p.screenshot({ path: `${out}/b-purple-ring.png` }).catch(() => {})
// 2. the Wilds: warn, then break
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(6000)
const setLeft = async (n: number) => { await p.evaluate((k: number) => { const t = JSON.parse(localStorage.getItem('open.tools.v1') ?? '{}'); t.forestry.edge = { on: 'venium', left: { venium: k } }; localStorage.setItem('open.tools.v1', JSON.stringify(t)); window.dispatchEvent(new Event('open:tools')) }, n); await sleep(800) }
const chan = () => p.evaluate(() => (window as any).__ather.chan?.() ?? null)
const pruneOut = async (t: { x: number; z: number }) => {
  await tp(t.x + 6, t.z, Math.PI / 2); await p.evaluate(() => (window as any).__ather.setMana(100))
  let started = false
  for (let i = 0; i < 6 && !started; i++) { await p.evaluate(() => (window as any).__ather.prune()); await sleep(500); started = !!(await chan()); if (!started) await frame() }
  for (let i = 0; i < 160 && await chan(); i++) { await p.evaluate(() => (window as any).__ather.setMana(100)); await frame() }
  await sleep(800)
  return { started, text: ((await bodyText()).match(/\+\d+ Forestry[^\n]*/) ?? [''])[0] }
}
await setLeft(warnAt('venium') + 1)
res.prune1 = await pruneOut(sw1)
res.left1 = (await tools()).forestry?.edge?.left?.venium
await p.screenshot({ path: `${out}/c-warning.png` }).catch(() => {})
await setLeft(1)
res.prune2 = await pruneOut(sw2)
const t2 = await tools(); res.tools2 = t2.forestry
res.ring2 = await ring()
await p.screenshot({ path: `${out}/d-broke.png` }).catch(() => {})
// 3. home, refit Eurleen, reload
await p.evaluate(() => (window as any).__ather.travel({ kind: 'home' }))
await p.waitForFunction(() => (window as any).__ather.zone() === 'plot', { timeout: 120000 }).catch(() => {}); await sleep(5000)
res.zoneHome = await p.evaluate(() => (window as any).__ather.zone())
res.fitEurleen = await fitAt('eurleen', 'e-fit-eurleen.png')
res.ring3 = await hasRing(METAL_RING.eurleen)
res.eurleenLeftInBag = await bagN('eurleen')
await load()
const t4 = await tools(); res.tools4 = t4.forestry
res.ring4 = await hasRing(METAL_RING.eurleen)
await p.screenshot({ path: `${out}/f-reload-gold.png` }).catch(() => {})
res.errs = errs
console.log(JSON.stringify(res, null, 1))
const fv = res.fitVenium as { panel: boolean; tab: boolean; fit: boolean; on: string }, fe = res.fitEurleen as typeof fv
const r1 = res.ring1 as { strokes: string[] }, r2 = res.ring2 as typeof r1, r3 = res.ring3 as typeof r1, r4 = res.ring4 as typeof r1
const checks: [string, boolean][] = [
  ['Smithy panel + Edges tab + Fit Venium', fv.panel && fv.tab && fv.fit && fv.on === 'venium'],
  ['Venium edge saved full', t1.forestry?.edge?.on === 'venium' && t1.forestry.edge.left.venium === EDGE.venium.uses],
  [`${FIT_METAL} Venium spent`, res.veniumLeftInBag === 6 - FIT_METAL],
  ['purple ring on the dial', r1.strokes.includes(METAL_RING.venium)],
  ['prune 1 warns', (res.prune1 as { text: string }).text.includes(`wearing thin: ${warnAt('venium')} uses left`) && res.left1 === warnAt('venium')],
  ['prune 2 breaks it away', (res.prune2 as { text: string }).text.includes('broke away')],
  ['broken: edge gone, pruner kept', t2.forestry?.toolId === 'starwillow_blade' && !t2.forestry.edge?.on && !t2.forestry.edge?.left?.venium],
  ['broken: no purple ring', !r2.strokes.includes(METAL_RING.venium)],
  ['home + Fit Eurleen', res.zoneHome === 'plot' && fe.panel && fe.tab && fe.fit && fe.on === 'eurleen'],
  ['gold ring', r3.strokes.includes(METAL_RING.eurleen) && res.eurleenLeftInBag === 6 - FIT_METAL],
  ['reload keeps Eurleen + gold ring', t4.forestry?.edge?.on === 'eurleen' && t4.forestry.edge.left.eurleen === EDGE.eurleen.uses && r4.strokes.includes(METAL_RING.eurleen)],
  ['0 page errors', errs.length === 0],
]
for (const [n, c] of checks) console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`)
const pass = checks.every(c => c[1])
console.log(pass ? 'PASS: Smithy opens -> Venium fitted (purple ring) -> warns -> breaks away (pruner kept) -> Eurleen refit (gold ring) -> reload keeps it, 0 errors' : `FAIL (${checks.filter(c => !c[1]).length})`)
await br.close(); process.exit(pass ? 0 : 1)
