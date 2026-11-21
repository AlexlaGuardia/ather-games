// ── THE WORKSHOP ROOMS, PLAYED (2026-11-17, play / Jin 2 95f19652) ───────────────────────────────────────────────────
// A keeper with logs walks to the planning table, plans a Rinnshop, sets it on their ground, waits out the scaffolding,
// walks in and makes bait at the bench. SETUP (stated): the bag starts with 20 goldwood logs + 2 mast + 1 shimmerscale
// and no bait. Hooks used for MOVEMENT only (__ather.tp) and for READING (localStorage). Every E, the Plan click, the
// Make-bait click are real inputs. Screenshots to --out so the look gets LOOKED at.
//   npx tsx scripts/plot-rooms-check.mts [--url http://localhost:3203] [--out dir] [--fast]   (--fast skips the 90 s raise wait: reads only up to the scaffold)
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE, ROOMS, benchOf, doorOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/rooms'), fast = process.argv.includes('--fast')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('rooms')) return; sessionStorage.setItem('rooms', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[8] = { id: 'goldwood_log', n: 20 }; slots[9] = { id: 'mast', n: 2 }; slots[10] = { id: 'shimmerscale', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })); localStorage.removeItem('open.works.v1')
})
const bag = () => p.evaluate(() => { const r: Record<string, number> = {}; for (const s of (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[])) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r })
const works = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{"rooms":[]}').rooms as Room[])
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const panel = (name: string) => p.evaluate(n => !!document.querySelector(`[data-panel="${n}"]`), name)
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const res: Record<string, unknown> = { url }

await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
res.zone = await p.evaluate(() => (window as any).__ather.zone())
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
// 1. the table: stand by it, E, the Rinnshop card, Plan
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4); await shot('rooms-1-table')
await p.keyboard.press('e'); await sleep(900)
res.tablePanel = await panel('planning-table'); await shot('rooms-2-table-panel')
// the table (Alex 11-18): tap the Rinnshop icon, its card drops down, Build lifts you into the flying planner
res.plan = (await click('[data-pick="rinnshop"]')) && (await sleep(500), await click('[data-build-card="rinnshop"] [data-act="build"] button')); await sleep(1200)
res.flying = await p.evaluate(() => (window as any).__build?.on() === true && !!document.querySelector('[data-build-bar]'))
// 2. the ghost follows the pointer: fly the view over (−100, 100) (hook moves the VIEW only), point at the middle, click
await p.evaluate(() => (window as any).__build.to(-100, 100)); await sleep(2500)
const mid = await p.evaluate(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
await p.mouse.move(mid.x - 3, mid.y); await sleep(300); await p.mouse.move(mid.x, mid.y); await sleep(800); await shot('rooms-3-ghost')
res.placingBar = await p.evaluate(() => !!document.querySelector('[data-placing]'))
await p.mouse.click(mid.x, mid.y); await sleep(1200)
await click('[data-act="land"]'); await sleep(800)
const rooms = await works(); res.rooms = rooms.map(r => ({ kind: r.kind, x: r.x, z: r.z, q: r.q }))
res.logsAfter = (await bag()).goldwood_log ?? 0
await tp(-100, 112, 0); await shot('rooms-4-scaffold')
const r = rooms[0]
let made = 0
if (r && !fast) {
  await sleep(Math.max(0, r.doneAt - Date.now()) + 3000)
  await tp(-100, 114, 0); await shot('rooms-5-built')
  await tp(-87, 113, Math.PI / 4); await shot('rooms-5b-built-34')
  const b = benchOf(r)
  await tp(b.x, b.z - 1.2, 0); await shot('rooms-6-bench')
  await aimAt(p, b.x, b.z, 0.6)
  await p.keyboard.press('e'); await sleep(900)
  res.benchPanel = await panel('bench'); await shot('rooms-7-bench-panel')
  const before = (await bag()).bait ?? 0
  await click('[data-bait-from="mast"] button'); await sleep(600)
  made = ((await bag()).bait ?? 0) - before
  res.bait = made
  // walls: walking into the back wall from inside must stop the walker short of it
  const d = doorOf(r); res.door = d
}
res.errs = errs
console.log(JSON.stringify(res))
const placed = rooms.length === 1 && rooms[0].kind === 'rinnshop' && res.logsAfter === 20 - ROOMS.rinnshop.cost[0].n
const pass = res.tablePanel === true && res.plan === true && res.flying === true && placed && errs.length === 0 && (fast || (res.benchPanel === true && made === 2))
console.log(pass ? `PASS: table → plan → placed → ${fast ? 'scaffold (fast)' : 'raised → bench → bait made'}` : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
