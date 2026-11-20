// ── M39 slice 3: GENERATED SETTLEMENTS STAND BLUEPRINTS, ON THE LIVE PAGE ───────────────────────────────────────────────
// Into the Wilds, tp to a generated settlement (folk-check's travel), and read it as built:
//   1. N buildings stand = the trades present among its folk (settlement-lots.ts), one lot each
//   2. the ground under each footprint is LEVEL (feet height at the footprint's four corners, spread <= 0.05 m)
//   3. each trade's Moglin stands at its building's front door (__folk.drawn vs lotDoorSpot, <= 0.5 m)
//   4. the walker reaches a door: real held W from in front of the building, through the door into the room
//   5. 0 page errors
// Hooks: __ather.travel / tp / state (movement + reading), __settlements.built / __folk.drawn (read). Walking is real W.
//   npx tsx scripts/settlement-check.mts [http://localhost:3201]  (or --url X) [--settlement s1-10]
import puppeteer from 'puppeteer-core'
import { readFileSync, existsSync } from 'node:fs'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { settlementLots, setTradeBlueprint, tradeBuilding, lotDoorSpot, lotPadOf, TRADES, tradeBlueprintId } from '../src/app/shimmer/open/ather/settlement-lots'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { parseHouse, placeBlueprint } from '../src/app/shimmer/open/ather/plot-blueprint'
const pos = process.argv.slice(2).filter(a => a.startsWith('http'))[0]
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = pos ?? flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
for (const t of TRADES) { const f = `world/house-blueprints/${tradeBlueprintId(t)}.json`; if (existsSync(f)) setTradeBlueprint(t, parseHouse(JSON.parse(readFileSync(f, 'utf8')))) }
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const want = flag('--settlement', '')
const st = net.settlements.find(s => (want ? s.id === want : s.id !== 'moonwell' && settlementLots(s, net.season).length >= 4))!
const lots = settlementLots(st, net.season), folk = folkOf(st, net.season)
console.log(`settlement ${st.name} (${st.id}, ${st.biome}): ${folk.length} folk, trades ${lots.map(l => l.profession).join(', ')}`)
const tx = Math.floor((st.x + 500) / 1000), tz = Math.floor((st.z + 500) / 1000)
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const tile = tiles.tiles.find(t => t.tx === tx && t.ty === tz)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 900, height: 560 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.village.v1'); localStorage.removeItem('open.trust.v1') })
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const stt = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py, z: a.pz } }) as Promise<{ x: number; y: number; z: number }>
  const tp = async (x: number, z: number, yaw = 0) => { await p.evaluate((a: number, b: number, c: number) => (window as any).__ather.tp(a, b, c), x, z, yaw); await poll(async () => { const s = await stt(); return Math.hypot(s.x - x, s.z - z) < 0.5 }, 8000); await sleep(400) }
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(2000)
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
    await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'settlement-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, st.x - tx * 1000, st.z - tz * 1000)
    await sleep(4000)
  }
  ok((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds', 'in the Wilds')
  await sleep(8000); await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(4000)
  await p.mouse.click(450, 300); await sleep(600)
  // 1. buildings = trades present
  const built = () => p.evaluate((id: string) => (((window as any).__settlements?.built?.() ?? []) as { id: string; lots: { id: string; profession: string }[] }[]).find(b => b.id === id)?.lots ?? [], st.id) as Promise<{ id: string; profession: string }[]>
  ok(await poll(async () => (await built()).length === lots.length, 60000), `1. ${lots.length} buildings stand = the trades present (${(await built()).length}): ${(await built()).map(l => l.profession).join(', ')}`)
  const trades = new Set(folk.map(f => f.profession))
  ok(lots.length === trades.size && (await built()).every(b => trades.has(b.profession as any)), '   one per trade present among the season\'s folk')
  // 2. level under each footprint
  const ys: number[] = [], per: string[] = []
  for (const l of lots) {
    const bp = tradeBuilding(l.profession), pl = placeBlueprint(bp, lotPadOf(l, 0)), v: number[] = []
    for (const [u, w] of [[-0.8, -0.8], [bp.w + 0.8, -0.8], [bp.w + 0.8, bp.d + 0.8], [-0.8, bp.d + 0.8]]) { const q = pl.toWorld(u, w); await tp(q.x, q.z); v.push((await stt()).y) }
    ys.push(...v); per.push(`${l.profession} ${(Math.max(...v) - Math.min(...v)).toFixed(3)}`)
    ok(Math.max(...v) - Math.min(...v) <= 0.05, `2. ground under the ${l.profession} house is level (spread ${(Math.max(...v) - Math.min(...v)).toFixed(3)} m)`)
  }
  // 3. each Moglin at its door
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(3000)
  let drawn: { id: string; x: number; z: number }[] = []
  await poll(async () => { drawn = await p.evaluate((id: string) => ((window as any).__folk?.drawn?.() ?? {})[id] ?? [], st.id) as typeof drawn; return drawn.length === folk.length && lots.every(l => { const d = drawn.find(q => q.id === l.folkId), s = lotDoorSpot(l); return d && Math.hypot(d.x - s.x, d.z - s.z) < 0.5 }) }, 60000)
  for (const l of lots) { const d = drawn.find(q => q.id === l.folkId), s = lotDoorSpot(l), off = d ? Math.hypot(d.x - s.x, d.z - s.z) : 99; ok(off < 0.5, `3. the ${l.profession}'s Moglin stands at its door (${off.toFixed(2)} m off, 1.2 m out)`) }
  // 4. the walker reaches a door: from 4 m in front of the building, real W through the door into the room
  const l0 = lots[0], bp0 = tradeBuilding(l0.profession), pl0 = placeBlueprint(bp0, lotPadOf(l0, 0))
  const doorU = [...Object.entries(bp0.walls)].filter(([k, w]) => w.kind === 'door' && k.startsWith('h,') && k.endsWith(',0')).map(([k]) => +k.split(',')[1] + 1)[0] ?? bp0.w / 2
  const from = pl0.toWorld(doorU, -4), inside = pl0.toWorld(doorU, 1.8)
  await tp(from.x, from.z, Math.atan2(-(inside.x - from.x), -(inside.z - from.z)))
  await p.keyboard.down('KeyW')
  const got = await poll(async () => { const s = await stt(); return Math.hypot(s.x - inside.x, s.z - inside.z) < 0.9 }, 30000 + 4 / 0.25 * 1000)
  await p.keyboard.up('KeyW')
  const s4 = await stt()
  ok(got, `4. the walker walked in through the ${l0.profession} house's front door (${Math.hypot(s4.x - inside.x, s4.z - inside.z).toFixed(2)} m from the room point)`)
  ok(errs.length === 0, `5. 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
