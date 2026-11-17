// ── A WORKSHOP ROOM'S OWN STORE, PLAYED (2026-11-17, play / Jin 2 95f19652) ──────────────────────────────────────
// Alex 11-17: each room keeps its OWN inventory that takes only that room's materials. A keeper at the Rinnshop bench
// stocks the room from the bag (the logs stay behind), cuts bait from the room's own mast, and takes a catch back out.
// SETUP (stated): a Rinnshop already standing at (-100, 100) (seeded in open.works.v1 with doneAt in the past, so the
// check does not wait out 90 s of scaffolding; plot-rooms-check plays the raise); BAG slots hold 3 mast + 2 glowfin +
// 10 goldwood logs. Hooks: movement (__ather.tp) and reading localStorage only. E and every click are real inputs.
//   npx tsx scripts/room-store-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/roomstore')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'rinnshop-check', kind: 'rinnshop', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((room: Room) => {
  if (sessionStorage.getItem('rs')) return; sessionStorage.setItem('rs', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }
  slots[8] = { id: 'mast', n: 3 }; slots[9] = { id: 'glowfin', n: 2 }; slots[10] = { id: 'goldwood_log', n: 10 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [] })); localStorage.removeItem('open.bank.v1')
}, ROOM)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const tally = (st: ({ id: string; n: number } | null)[]) => { const r: Record<string, number> = {}; for (const s of st) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const bag = async () => tally((await read('open.inv.v1'))?.slots ?? [])
const store = async () => tally((await read('open.works.v1'))?.rooms?.[0]?.store ?? [])
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
const b = benchOf(ROOM)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.2); await sleep(1500); await shot('_f'); await shot('_f')
await p.keyboard.press('e'); await sleep(900)
res.bench = await p.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-room-store="rinnshop"]')); await shot('rs-1-bench')
res.stocked = await click('[data-act="stock-room"] button'); await sleep(700)
res.afterStock = { bag: await bag(), store: await store() }; await shot('rs-2-stocked')
res.cut = await click('[data-bait-from="mast"] button'); await sleep(700)
res.afterCut = { bag: await bag(), store: await store() }
const fin = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-room-slot]')].find(e => e.title.startsWith('Glowfin'))?.getAttribute('data-room-slot'))
res.took = fin != null && await click(`[data-room-slot="${fin}"]`); await sleep(700)
res.afterTake = { bag: await bag(), store: await store() }; await shot('rs-3-took')
res.errs = errs
console.log(JSON.stringify(res))
type T = { bag: Record<string, number>; store: Record<string, number> }
const s1 = res.afterStock as T, s2 = res.afterCut as T, s3 = res.afterTake as T
const pass = res.bench === true
  && s1.store.mast === 3 && s1.store.glowfin === 2 && !s1.store.goldwood_log && s1.bag.goldwood_log === 10 && !s1.bag.mast && s1.bag.bait === 10
  && s2.store.mast === 2 && s2.bag.bait === 12
  && s3.bag.glowfin === 2 && !s3.store.glowfin && errs.length === 0
console.log(pass ? 'PASS: Rinnshop store stocked from the bag (logs refused) → bait cut from the room\'s own mast → a catch taken back' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
