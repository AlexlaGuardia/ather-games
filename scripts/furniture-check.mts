// ── THE CARPENTRY ROOM + FURNITURE, PLAYED (2026-11-17, play / Jin 2 95f19652) ───────────────────────────────────
// Alex 11-17: furniture is an ITEM crafted in carpentry from Ather woods, set on the plot and picked back up. A keeper
// saws logs into planks at the carpentry bench, makes a Goldwood Bench, sets it from the planning table, turns it, and
// picks it back up. SETUP (stated): a carpentry room already standing at (-100, 100) (seeded in open.works.v1, doneAt in
// the past: plot-rooms-check plays a raise); BAG slots hold 20 goldwood logs. Hooks: movement + reading only.
//   npx tsx scripts/furniture-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, TABLE, type Room } from '../src/app/shimmer/open/ather/rooms'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/furniture')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'carpentry-check', kind: 'carpentry', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((room: Room) => {
  if (sessionStorage.getItem('fc')) return; sessionStorage.setItem('fc', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[8] = { id: 'goldwood_log', n: 20 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
}, ROOM)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const pieces = async () => ((await read('open.works.v1'))?.pieces ?? []) as { item: string; q: number }[]
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
// 1. the carpentry bench: saw 2 logs into 4 planks, make a bench
const b = benchOf(ROOM)
await tp(b.x, b.z - 1.2, 0); await shot('fc-0-room')
await p.keyboard.press('e'); await sleep(900)
res.bench = await p.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-job="goldwood-plank"]'))
for (let k = 0; k < 2; k++) { await click('[data-job="goldwood-plank"] button'); await sleep(500) }
res.afterSaw = await bag(); await shot('fc-1-sawn')
res.made = await click('[data-job="goldwood_bench"] button'); await sleep(600)
res.afterMake = await bag(); await shot('fc-2-made')
await p.keyboard.press('Escape'); await sleep(500)
// 2. the planning table's Furnish row → Set → stand south of the spot facing north → E
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
res.furnish = await click('[data-piece="goldwood_bench"] button'); await sleep(800)
await tp(-130, 102.5, 0); await shot('fc-3-ghost')
await p.keyboard.press('e'); await sleep(1000)
res.placed = (await pieces()).map(x => x.item); res.benchesInBag = (await bag()).goldwood_bench ?? 0
await tp(-128.5, 104.5, Math.PI / 6); await shot('fc-4-placed')
// 3. E at it: turn, then pick up
await tp(-130, 101.3, 0); await p.keyboard.press('e'); await sleep(900)
res.piecePanel = await p.evaluate(() => !!document.querySelector('[data-panel="piece"]'))
await click('[data-act="turn-piece"] button'); await sleep(600)
res.turnedQ = (await pieces())[0]?.q
await shot('fc-5-turned')
await click('[data-act="pickup-piece"] button'); await sleep(700)
res.afterPickup = { pieces: (await pieces()).length, bag: await bag() }
res.errs = errs
console.log(JSON.stringify(res))
const s = res.afterSaw as Record<string, number>, m = res.afterMake as Record<string, number>, u = res.afterPickup as { pieces: number; bag: Record<string, number> }
const pass = res.bench === true && s.goldwood_plank === 4 && s.goldwood_log === 18 && m.goldwood_bench === 1 && !m.goldwood_plank
  && JSON.stringify(res.placed) === '["goldwood_bench"]' && res.benchesInBag === 0 && res.piecePanel === true && res.turnedQ === 1
  && u.pieces === 0 && u.bag.goldwood_bench === 1 && errs.length === 0
console.log(pass ? 'PASS: logs sawn into planks → Goldwood Bench made → set from the table → turned → picked back up' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
