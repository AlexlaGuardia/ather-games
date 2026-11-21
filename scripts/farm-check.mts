// ── THE FARM ROOM, PLAYED (2026-11-18, play / Jin 2) ─────────────────────────────────────────────────────────────────
// A keeper with logs builds the Farm through the planning table (real clicks: pick, Build, place), waits out the scaffolding,
// walks in, E at the standing spot. The starter packet is in the store. They plant a D Goldleaf, the FARM'S clock is moved on
// (hook __farm.skew: the farm's own time only, planting/harvesting stay real clicks), harvest: crop + 2 seeds land in the
// store, the bed empties. They feed the composter from the bag (a stack, "all of this stack"): charge climbs, Armed shows.
// Three armed harvests then return seeds one grade up (a Goldleaf seed · C appears), crops come in doubles (+1 yield).
// SETUP (stated): bag = 20 goldwood logs (the build costs 18) + 50 mast (compost). Hooks: movement (__ather.tp), the view
// (__build.to) and the farm clock (__farm.skew). 0 page errors.
//   npx tsx scripts/farm-check.mts [--url http://localhost:3204] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE, ROOMS, benchOf, footprint, type Room } from '../src/app/shimmer/open/ather/rooms'
import { seedId, cropId, CHARGE_CAP } from '../src/app/shimmer/open/ather/farming'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/farm')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 700 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('farm')) return; sessionStorage.setItem('farm', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[8] = { id: 'goldwood_log', n: 20 }; slots[9] = { id: 'mast', n: 50 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })); localStorage.removeItem('open.works.v1'); localStorage.removeItem('open.farm.v1')
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const store = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.store ?? []) as { id: string; n: number }[]) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const farmSave = () => read('open.farm.v1') as Promise<{ farm: { beds: ({ crop: string; grade: string } | null)[]; charge: number }; starter: boolean }>
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); await sleep(350); return !!b }
const attr = (sel: string, a: string) => p.evaluate((s, n) => document.querySelector(s)?.getAttribute(n) ?? null, sel, a)
const skew = (ms: number) => p.evaluate(m => (window as any).__farm.skew(m), ms)
const res: Record<string, unknown> = { url }
const step = (n: string) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${n}`)

await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
step('1. build it at th')
// 1. build it at the table
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(900)
res.pickOnTable = await p.evaluate(() => !!document.querySelector('[data-pick="farm"]'))
res.build = (await click('[data-pick="farm"]')) && (await sleep(400), await click('[data-build-card="farm"] [data-act="build"] button')); await sleep(1200)
await p.evaluate(() => (window as any).__build.to(-100, 100)); await sleep(2500)
const mid = await p.evaluate(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
await p.mouse.move(mid.x - 3, mid.y); await sleep(300); await p.mouse.move(mid.x, mid.y); await sleep(800)
await p.mouse.click(mid.x, mid.y); await sleep(1200); await click('[data-act="land"]'); await sleep(800)
const room: Room = (await read('open.works.v1')).rooms[0]
res.room = { kind: room?.kind, x: room?.x, z: room?.z }
res.logsAfter = (await bag()).goldwood_log ?? 0
res.starter = { flag: (await farmSave())?.starter, store: await store() }
await tp(room.x, room.z + 14, 0); await shot('farm-1-scaffold')
await sleep(Math.max(0, room.doneAt - Date.now()) + 3000)
step('2. in, E at the s')
// 2. in, E at the standing spot
const b = benchOf(room)
await tp(b.x, b.z - 1.2, 0)
await aimAt(p, b.x, b.z, 0.6)
await p.keyboard.press('e'); await sleep(900)
res.panel = await p.evaluate(() => !!document.querySelector('[data-panel="farm"]'))
res.beds = await p.evaluate(() => document.querySelectorAll('[data-bed]').length)
await shot('farm-2-panel')
step('3. plant a D Gold')
// 3. plant a D Goldleaf from the store
await click('[data-bed="0"] button'); res.picker = await p.evaluate(() => !!document.querySelector('[data-seed-picker]'))
await click(`[data-plant-seed="${seedId('goldleaf')}"] button`)
res.planted = { plant: await attr('[data-bed="0"]', 'data-plant'), phase: await attr('[data-bed="0"]', 'data-phase'), store: (await store())[seedId('goldleaf')] }
step('4. time moves')
// 4. time moves (the farm's clock): ready, harvest into the store
await skew(6 * 60_000); await sleep(1500)
res.ready = await attr('[data-bed="0"]', 'data-phase')
await click('[data-harvest="0"] button'); await sleep(400)
const s1 = await store()
res.harvest = { crop: s1[cropId('goldleaf')], seeds: s1[seedId('goldleaf')], bed: await attr('[data-bed="0"]', 'data-phase') }
step('5. the composter')
// 5. the composter: put a whole stack of mast in (all of this stack), Armed shows
res.unarmed = await attr('[data-composter]', 'data-armed')
const slot = ((await read('open.inv.v1')).slots as ({ id: string } | null)[]).findIndex(s => s?.id === 'mast')
await click(`[data-compost-slot="${slot}"]`); await click('[data-act="put-all"] button'); await click('[data-act="put-in"] button')
res.composter = { charge: await attr('[data-composter]', 'data-compost-charge'), armed: await attr('[data-composter]', 'data-armed'), label: await p.evaluate(() => document.querySelector('[data-armed-label]')?.textContent), mastLeft: (await bag()).mast ?? 0 }
await shot('farm-3-armed')
step('6. three armed')
// 6. three armed harvests: seeds come back a grade up
let cSeeds = 0, crops = 0
for (let k = 0; k < 3; k++) {
  const bedI = k + 1
  await click(`[data-bed="${bedI}"] button`); await click(`[data-plant-seed="${seedId('goldleaf')}"] button`)
  await skew(6 * 60_000); await sleep(1500)
  await click(`[data-harvest="${bedI}"] button`); await sleep(400)
}
const s2 = await store(); cSeeds = s2[seedId('goldleaf', 'C')] ?? 0; crops = s2[cropId('goldleaf')] ?? 0
res.armedHarvests = { cSeeds, crops, charge: (await farmSave()).farm.charge }
await shot('farm-4-panel-after')
// phone width: the panel at 390
await p.setViewport({ width: 390, height: 800 }); await sleep(800); await shot('farm-5-phone')
res.phoneOverflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
await p.setViewport({ width: 1100, height: 700 }); await sleep(500)
step('7. the rooms ins')
// 7. the room's inside, 3D: plant two more so the beds show growing plants
await click('[data-bed="0"] button'); await click(`[data-plant-seed="${seedId('goldleaf', 'C')}"] button`)
await click('[data-bed="3"] button'); await click(`[data-plant-seed="${seedId('goldleaf', 'D')}"] button`)
await skew(2.5 * 60_000); await sleep(2500)
await p.keyboard.press('Escape'); await sleep(600)
await tp(room.x + 0.3, room.z - 1.2, 0); await sleep(1000); await shot('farm-6-interior-beds')
await tp(room.x, room.z - 0.6, Math.PI); await sleep(1000); await shot('farm-7-interior-composter')
res.errs = errs
console.log(JSON.stringify(res))
const pl = res.planted as { plant: string; phase: string; store: number }, hv = res.harvest as { crop: number; seeds: number; bed: string }, cp = res.composter as { charge: string; armed: string; label: string }
const pass = res.pickOnTable === true && res.build === true && room?.kind === 'farm' && res.logsAfter === 20 - ROOMS.farm.cost[0].n
  && (res.starter as any).flag === true && (res.starter as any).store[seedId('goldleaf')] === 3 && (res.starter as any).store[seedId('ather_wheat')] === 3 && (res.starter as any).store[seedId('dewdrop_vine')] === 2
  && res.panel === true && res.beds === 6 && res.picker === true
  && pl.plant === 'goldleaf' && pl.phase === '0' && pl.store === 2
  && res.ready === '3' && hv.crop === 1 && hv.seeds === 4 && hv.bed === 'empty'
  && res.unarmed === 'false' && Number(cp.charge) === Math.min(CHARGE_CAP, 50) && cp.armed === 'true' && cp.label === 'Armed'
  && cSeeds >= 1 && crops >= 1 + 3 * 2 && res.phoneOverflow === false && errs.length === 0
console.log(pass ? 'PASS: built the Farm at the table (18 logs, starter packet) → planted a D Goldleaf → harvest into the store → fed the composter, Armed → armed harvests return Goldleaf seed · C, crops in doubles → 0 page errors' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
