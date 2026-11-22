// ── MOGLINS ON THE PLOT, PLAYED (2026-11-18, play / Jin 30bbef32) ─────────────────────────────────────────────────
// A cook from the garden village is put to work at the cooking room's hearth (Work here, at the bench), the keeper is
// "away" two hours (the village's lastTick wound back, the only time travel this check does), and on load the village
// catches up: roasts land in the room's store and the toast says what was made. Then Off duty clears the room.
// SETUP (stated): a cooking room at (-100, 100) with 10 Shimmerscale in its store; the village holds Heath, a fair cook
// (craft 1 = 3 an hour), unassigned. Hooks: movement, reading, __ather.village.
//   npx tsx scripts/moglin-duty-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/moglin')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'cooking-duty', kind: 'cooking', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [{ id: 'shimmerscale', n: 40 }] }   // M43a fold (11-20): the cook works the stockpile, which keeps 30 raw for the keeper: seed 10 over the reserve
const HEATH = { id: 'heath-check', name: 'Heath', home: 'tansybrake', grades: { craft: 1, yield: 2, trade: 1 }, dream: 'A warm kitchen with a window.', profession: 'cook', recruitedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const toasts: string[] = []; p.on('console', () => {})
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((room: Room, heath: unknown) => {
  if (sessionStorage.getItem('md')) return; sessionStorage.setItem('md', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
  localStorage.setItem('open.village.v1', JSON.stringify({ v: 1, moglins: [heath], lastTick: Date.now() }))
}, ROOM, HEATH)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const outOf = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.out ?? []) as { id: string; n: number }[]) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const store = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.store ?? []) as { id: string; n: number }[]) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const ready = async () => { await p.waitForFunction(() => !!(window as any).__ather?.village && typeof (window as any).__ather?.tp === 'function', { timeout: 180000 }); await sleep(2500) }
const bench = async () => { const b = benchOf(ROOM); await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(1800); await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e'); await sleep(900) }
const res: Record<string, unknown> = { url }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await ready()
// 1. at the hearth: Heath is offered; Work here
await bench()
await click('[data-bench-tab="keeper"]'); await sleep(300)   // bench tabs (11-20): the room keeper live on their own tab
res.offered = await p.evaluate(() => [...document.querySelectorAll('[data-moglin]')].map(e => e.getAttribute('data-moglin')))
res.assigned = await click('[data-moglin="heath-check"] [data-act="ask"] button'); await sleep(600)
res.here = await p.evaluate(() => document.querySelector('[data-moglin-here]')?.getAttribute('data-moglin-here') ?? null)
res.duty = await p.evaluate(() => document.querySelector('[data-moglin-here]')?.textContent ?? '')
await shot('md-1-assigned')
// the crafting panel (11-20) lands a run the moment its bar fills, so a roast may already be done before the clock is wound
const before = (await p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? 'null'); return (w?.rooms?.[0]?.out ?? []).filter((x: any) => x.id === 'roast_rinn').reduce((a: number, x: any) => a + x.n, 0) })) as number
// 2. away two hours: wind the village clock back, reload; the village catches up and says so
// since M43a the cook works the hearth's STOCKPILE on the station's own clock (room.work.last), so wind THAT back too
await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('open.village.v1')!); v.lastTick = Date.now() - 2 * 3_600_000; localStorage.setItem('open.village.v1', JSON.stringify(v))
  const w = JSON.parse(localStorage.getItem('open.works.v1')!), r = w.rooms[0]; r.work = { ...(r.work ?? { cur: 0 }), last: Date.now() - 2 * 3_600_000 }; localStorage.setItem('open.works.v1', JSON.stringify(w)) })
res.wound = ((await read('open.works.v1'))?.rooms?.[0]?.work?.last ?? 0) < Date.now() - 3_600_000
await p.reload({ waitUntil: 'load', timeout: 180000 }); await ready()
const toastNow = () => p.evaluate(() => document.body.innerText.match(/While you were away[^\n]*/)?.[0] ?? null)
res.toast = null; for (let t = 0; t < 15000 && !res.toast; t += 500) { res.toast = await toastNow(); if (!res.toast) await sleep(500) }   // the line joins every source ~1.5 s after the scene mounts
res.storeAfter = await store(); res.outAfter = await outOf()
await shot('md-2-away')
// 3. Off duty
await bench()
await click('[data-bench-tab="keeper"]'); await sleep(400)   // bench tabs (11-20): the room keeper has its own tab
res.inspect = await click('[data-moglin-here] [data-act="inspect"] button'); await sleep(900)
res.card = await p.evaluate(() => { const c = document.querySelector('[data-moglin-card-for="heath-check"] [data-moglin-card]'); return c ? { full: c.hasAttribute('data-card-full'), lit: c.querySelectorAll('[data-card-score]:not([data-score=""])').length, axes: c.querySelectorAll('[data-card-axis]:not([data-card-axis-grade="?"])').length } : null })
await shot('md-3-card')
res.offDuty = await click('[data-act="off-duty"] button'); await sleep(600)
res.roomAfterOff = ((await read('open.village.v1'))?.moglins?.[0]?.room) ?? null
res.errs = errs
console.log(JSON.stringify(res))
const s = res.storeAfter as Record<string, number>, o = res.outAfter as Record<string, number>
// 2 h at a fair cook (speed 1) = 10 roasts, bounded by the surplus over the 30-raw reserve (40 seeded); M46 luck may add +1 a run
const made = (o.roast_rinn ?? 0) + (s.roast_rinn ?? 0) - before   // made WHILE AWAY (not the one landed live before)
const checks: [boolean, string][] = [
  [JSON.stringify(res.offered) === '["heath-check"]', 'Heath offered at the hearth'],
  [res.here === 'heath-check', 'Heath put to work'],
  [/Cooking (fair|good|fine|gifted|rare)/.test(res.duty as string) && /stockpile/.test(res.duty as string), `duty row names the room's skill (${res.duty})`],
  [res.wound === true, 'station clock wound back 2 h'],
  [o.roast_rinn >= 10 && o.roast_rinn <= 20 && made >= 1, `roasts in the hearth's output (${o.roast_rinn})`],
  [s.shimmerscale === 30, `the 30-raw reserve kept (${s.shimmerscale})`],
  [new RegExp(`made ${made} Roast Rinn`).test((res.toast as string) ?? ''), `the 'while you were away' line says ${made} Roast Rinn (${res.toast})`],
  [res.inspect === true && !!res.card && (res.card as any).full && (res.card as any).lit === 9 && (res.card as any).axes === 5, `M46/M65: Inspect on a RECRUITED Moglin opens its full card, 9 skill scores + all 5 radar axes graded (${JSON.stringify(res.card)})`],
  [res.offDuty === true && res.roomAfterOff === null, 'Off duty clears the room'],
  [errs.length === 0, `0 page errors ${errs.join(' | ')}`],
]
for (const [c, m] of checks) console.log(c ? '  ok  ' : '  FAIL', m)
const pass = checks.every(([c]) => c)
console.log(pass ? 'PASS: Heath at the hearth → two hours away → roasts in the hearth output + the "while you were away" line → Off duty' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
