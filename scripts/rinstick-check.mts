// ── RINSTICKS AT THE RINNSHOP, PLAYED (2026-11-17, play / Jin 30bbef32) ─────────────────────────────────────────────
// Canon: a rinstick is built from rinn. A keeper makes a Basic Rinstick at the Rinnshop bench (4 Shimmerscale from the
// room's store, 4 Clickclaw from the bag), it is in hand at once (the page's live tools), it survives a reload, and the
// bench then refuses nothing it should allow. SETUP (stated): a Rinnshop standing at (-100, 100) with 4 Shimmerscale in
// its store; bag slot 8 holds 4 Clickclaw. Hooks: movement, reading, __ather.tools.
//   npx tsx scripts/rinstick-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/rinstick')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'rinnshop-check', kind: 'rinnshop', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [{ id: 'shimmerscale', n: 4 }] }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((room: Room) => {
  if (sessionStorage.getItem('rc')) return; sessionStorage.setItem('rc', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[8] = { id: 'clickclaw', n: 4 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
}, ROOM)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const held = () => p.evaluate(() => (window as any).__ather.tools()?.rinning ?? null)
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.tools && typeof (window as any).__ather?.tp === 'function', { timeout: 180000 }); await sleep(2500)
res.before = await held()
const b = benchOf(ROOM)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(2000)
await aimAt(p, b.x, b.z, 0.6)
await p.keyboard.press('e'); await sleep(900)
await click('[data-bench-tab="rinsticks"]'); await sleep(300)   // bench tabs (11-20): rinsticks live on their own tab
res.list = await p.evaluate(() => [...document.querySelectorAll('[data-rinstick]')].map(e => e.getAttribute('data-rinstick')))
res.made = await click('[data-rinstick="basic_rinstick"] button'); await sleep(700)
res.panelHeld = await p.evaluate(() => document.querySelector('[data-rinstick-held]')?.getAttribute('data-rinstick-held'))
res.after = await held(); res.bag = await bag(); res.store = ((await read('open.works.v1'))?.rooms?.[0]?.store ?? []).length
res.usesText = await p.evaluate(() => /catches left|\d+ catches|never wears/.test(document.body.innerText))
await shot('rc-1-made')
// M133: a save from before, the stick on its last use: whole again after the reload below
await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.includes('open.tools.v1'))!, t = JSON.parse(localStorage.getItem(k)!); t.rinning.usesRemaining = 1; localStorage.setItem(k, JSON.stringify(t)) })
await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.tools && typeof (window as any).__ather?.tp === 'function', { timeout: 180000 }); await sleep(2500)
res.reloaded = await held()
res.errs = errs
console.log(JSON.stringify(res))
const a = res.after as { toolId: string; usesRemaining: number } | null, rl = res.reloaded as typeof a
const pass = (res.before as { toolId: string })?.toolId === 'worn_rinstick' && JSON.stringify(res.list) === '["basic_rinstick","glowfin_rinstick","moonkoi_rinstick"]'
  && res.made === true && res.panelHeld === 'basic_rinstick' && a?.toolId === 'basic_rinstick' && a.usesRemaining === 50
  && !(res.bag as Record<string, number>).clickclaw && res.store === 0 && rl?.toolId === 'basic_rinstick' && rl.usesRemaining === 50 && res.usesText === false && errs.length === 0
console.log(pass ? 'PASS: Basic Rinstick made at the Rinnshop (scale from the store, claw from the bag) → in hand at once → still in hand after a reload' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
