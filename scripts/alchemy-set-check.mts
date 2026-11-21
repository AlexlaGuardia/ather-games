// ── M57 THE ALCHEMY SET, PLAYED (2026-11-21, play / Jin play b7763e94) ─────────────────────────────────────────────
// Alex 11-20: alchemy is a FURNITURE SET (alchemy-set.ts), not a room. E at a placed piece opens ITS station (the steps it
// does across the potions), a step spends from the bag, runs with a live bar and drops its product in the bag; Pick up on a
// busy piece gives the inputs back. SETUP (stated): a Crusher Table (item id alc_mortar) already stands on open ground at (-130, 102.5)
// (seeded in open.works.v1: the bench recipe is gated ALC_LIVE=false until the names are ruled, so the check cannot craft it);
// the bag holds 4 Shimmerscale. Hooks: movement + reading only.
//   npx tsx scripts/alchemy-set-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { ALC_POTIONS } from '../src/app/shimmer/open/ather/alchemy-set'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/alchemy-set')
mkdirSync(out, { recursive: true })
const PIECE = { id: 'alc-check', item: 'alc_mortar', x: -130, z: 102.5, q: 0, placedAt: 1 }
const GRIND_MS = ALC_POTIONS.health.steps[0].ms
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((piece: typeof PIECE) => {
  if (sessionStorage.getItem('ac')) return; sessionStorage.setItem('ac', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[8] = { id: 'shimmerscale', n: 4 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [piece] }))
  for (const k of Object.keys(localStorage)) if (k.endsWith('open.alchemy.v1')) localStorage.removeItem(k)
}, PIECE)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const runs = () => p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.endsWith('open.alchemy.v1')); return k ? JSON.parse(localStorage.getItem(k) ?? '{}') : {} }) as Promise<Record<string, unknown>>
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const pieces = async () => ((await read('open.works.v1'))?.pieces ?? []) as { item: string }[]
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
await tp(-128.6, 104.3, Math.PI / 6); await shot('ac-0-piece')
// 1. E at the piece opens the MORTAR station (not the plain piece card), the grind step ready
await tp(PIECE.x, PIECE.z + 1.3, 0); await p.keyboard.press('e'); await sleep(900)
res.station = await p.evaluate(() => document.querySelector('[data-panel="alchemy"] [data-alc-station]')?.getAttribute('data-alc-station') ?? null)
res.plainCard = await p.evaluate(() => !!document.querySelector('[data-panel="piece"]'))
res.canGrind = await p.evaluate(() => document.querySelector('[data-alc-step="health:0"]')?.getAttribute('data-can') ?? null)
await shot('ac-1-panel')
// 2. grind: 2 scales spent at once, a run saved, the product lands in the bag when the bar fills
res.started = await click('[data-alc-step="health:0"] [data-act="alc-start"] button'); await sleep(500)
res.afterStart = { bag: await bag(), run: Object.keys(await runs()) }
res.bar = await p.evaluate(() => !!document.querySelector('[data-alc-run] [data-alc-bar]'))
await shot('ac-2-running')
res.ground = await poll(async () => Object.keys(await bag()).some(k => k.startsWith('alc:scale_powder')), GRIND_MS + 20000)
res.afterGrind = { bag: await bag(), run: Object.keys(await runs()) }
await shot('ac-3-ground')
// 3. start again, then Pick up mid-run: the piece AND the 2 scales come back, the run is gone
await click('[data-alc-step="health:0"] [data-act="alc-start"] button'); await sleep(500)
res.midRun = { bag: await bag(), run: Object.keys(await runs()) }
res.pickup = await click('[data-act="pickup-piece"] button'); await sleep(800)
res.afterPickup = { bag: await bag(), run: Object.keys(await runs()), pieces: (await pieces()).length }
res.errs = errs
console.log(JSON.stringify(res))
const st = res.afterStart as { bag: Record<string, number>; run: string[] }, gr = res.afterGrind as { bag: Record<string, number>; run: string[] }
const mid = res.midRun as { bag: Record<string, number>; run: string[] }, up = res.afterPickup as { bag: Record<string, number>; run: string[]; pieces: number }
const powder = (b: Record<string, number>) => Object.entries(b).filter(([k]) => k.startsWith('alc:scale_powder')).reduce((a, [, n]) => a + n, 0)
const pass = res.station === 'crusher' && res.plainCard === false && res.canGrind === '1' && res.started === true && res.bar === true
  && st.bag.shimmerscale === 2 && st.run.includes(PIECE.id)
  && res.ground === true && powder(gr.bag) === 1 && !gr.run.includes(PIECE.id)
  && !mid.bag.shimmerscale && mid.run.includes(PIECE.id)
  && res.pickup === true && up.pieces === 0 && up.bag.alc_mortar === 1 && up.bag.shimmerscale === 2 && powder(up.bag) === 1 && !up.run.includes(PIECE.id)
  && errs.length === 0
console.log(pass ? 'PASS: E at the Crusher Table opens its station → crush spends 2 scales, bar fills, Scale Powder lands → Pick up mid-run returns the piece + its scales' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
