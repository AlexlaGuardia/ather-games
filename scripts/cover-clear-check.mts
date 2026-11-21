// ── BETA M23 check (2026-11-18, sprites): PLACED THINGS CLEAR THE GRASS ──────────────────────────────────────────────
// Alex 11-18: "when you place a room or anything really the floor of the garden should be cleared so the ground cover
// isn't poking through from the bottom". The plot's cover is sparse (a few tufts per 9 m² cell), so the check first
// FINDS a real tuft, then stands a Goldwood Table on it:
//   1 · a keeper with a standing Farm room loads: cover grows round the room, ZERO tufts inside its floor.
//   2 · reload with a Goldwood Table set on that tuft: zero tufts under the table (the room still clear).
//   3 · E at the table → Pick up (the real panel button): the tuft grows back on the same spot, with no reload.
// Reads __cover (ground-cover.tsx) and the works save; moves with __ather.tp. 0 page errors.
//   npx tsx scripts/cover-clear-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { footprint, pieceRect } from '../src/app/shimmer/open/ather/rooms'
import { CLEAR_PAD } from '../src/app/shimmer/open/ather/cover-clear'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const ROOM = { id: 'cc-room', kind: 'farm' as const, x: -100, z: 100, q: 0, placedAt: 0, doneAt: 0 }
const RF = footprint(ROOM.kind, ROOM.x, ROOM.z, ROOM.q)
const res: Record<string, unknown> = {}
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 640 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => { if (!localStorage.getItem('ather:shimmer:birthRune')) localStorage.setItem('ather:shimmer:birthRune', 'star') })
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const cover = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__cover?.[f]?.(...args), fn, a)
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await shot('_f'); await sleep(500) } return false }
const load = async (works: unknown) => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await p.evaluate((w: unknown) => { localStorage.setItem('open.works.v1', JSON.stringify(w)); localStorage.removeItem('open.pruned.v1') }, works)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__cover, { timeout: 180000, polling: 1000 })
}
const stand = async (x: number, z: number) => { await p.evaluate((a, b) => (window as any).__ather.tp(a, b, 0), x, z); await poll(async () => ((await cover('total')) as number) > 0, 30000) }
const pad = (r: { x0: number; x1: number; z0: number; z1: number }, d: number) => ({ x0: r.x0 - d, x1: r.x1 + d, z0: r.z0 - d, z1: r.z1 + d })
const inside = (r: { x0: number; x1: number; z0: number; z1: number }) => cover('inside', r.x0, r.x1, r.z0, r.z1) as Promise<number>

let pass = false
try {
  // 1 · the room alone
  await load({ v: 1, rooms: [ROOM], chests: [], pieces: [] })
  await stand(ROOM.x, ROOM.z + 10); await sleep(1500); await shot('cc-1-room')
  res.roomInside = await inside(RF)
  res.roundRoom = await inside(pad(RF, 8)) as number - (res.roomInside as number)
  // a tuft 2-8 m off the room's margin, to stand the table on
  const pts = await cover('points', RF.x0 - 8, RF.x1 + 8, RF.z0 - 8, RF.z1 + 8) as { x: number; z: number }[]
  const t = pts.find(q => (q.x < RF.x0 - CLEAR_PAD - 2.2 || q.x > RF.x1 + CLEAR_PAD + 2.2 || q.z < RF.z0 - CLEAR_PAD - 2.2 || q.z > RF.z1 + CLEAR_PAD + 2.2))
  if (!t) throw new Error(`no tuft beside the room to stand a table on (${pts.length} near)`)
  const TABLE_P = { id: 'cc-table', item: 'goldwood_table', x: +t.x.toFixed(2), z: +t.z.toFixed(2), q: 0, placedAt: 0 }
  const TF = pieceRect(TABLE_P.item, TABLE_P.x, TABLE_P.z, 0), TFP = pad(TF, 0.05)
  res.tuft = t
  // 2 · reload with the table on that tuft
  await load({ v: 1, rooms: [ROOM], chests: [], pieces: [TABLE_P] })
  await stand(TABLE_P.x, TABLE_P.z + 1.4); await sleep(1500); await shot('cc-2-table')
  res.tableInside = await inside(TFP)
  res.roomInside2 = await inside(RF)
  res.total2 = await cover('total')
  // 3 · lift it through the panel: the tuft grows back with no reload
  await aimAt(p, TABLE_P.x, TABLE_P.z, 0.5)
  await p.keyboard.press('KeyE')
  res.panel = await poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="piece"]')), 20000)
  const b = await p.evaluate(() => { const e = document.querySelector<HTMLElement>('[data-act="pickup-piece"] button'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (b) await p.mouse.click(b.x, b.y)
  res.lifted = await poll(async () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').pieces ?? []).length === 0), 20000)
  res.grewBack = await poll(async () => ((await inside(TFP)) as number) > 0, 30000)
  res.tableInsideAfter = await inside(TFP)
  await shot('cc-3-lifted')
  pass = res.roomInside === 0 && (res.roundRoom as number) > 0 && res.tableInside === 0 && res.roomInside2 === 0
    && res.panel === true && res.lifted === true && res.grewBack === true && errs.length === 0
} catch (e) { res.error = String(e).slice(0, 300) }
res.errors = errs
console.log(JSON.stringify(res))
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
