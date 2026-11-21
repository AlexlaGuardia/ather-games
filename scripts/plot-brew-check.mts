// BETA M57 slice 3b check (plot-brew-check): A BREWING with a party. Host A and guest B (party mates, B visiting A's plot) brew
// one Health Draught together over the relay; each step spends from the hand that takes it; both get bottles at the pour.
//   SETUP (stated): A's plot = the four alchemy pieces placed in a row (Crusher, Cauldron Nook, Still, Desk); A's bag = 2
//   Goldleaf + 2 Dewdrop Vine, B's bag = 2 Shimmerscale. Nobody holds an alchemist (no boon). Seeded in localStorage.
//   1. A at its Desk (E, aimed) clicks "Brew with your party: Health Draught" (real click).  2. B visits (the visit link), at the
//   Crusher E opens the BREWING panel (a guest's E at a mate's piece used to be refused) and takes the crush: B's scale leaves
//   B's bag.  3. A takes the steep at the Nook: A's crops leave A's bag.  4. once the steep is made, B takes the Still (from the
//   pool, nothing out of its bag).  5. A takes the Desk.  6. the pour lands on its own: total = totalBottles(2, 2 hands) = 4,
//   every hand >= 1, split by contribution (A 3, B 1 by the pure rule), each in its OWN bag.  7. 0 page errors.
//   Hooks: __ather.tp|state|look|ground (movement + aim), __brew / __visit / __mp READ; real clicks + keys.
//   --offline (hub 11-21): B's tab closes right after the Desk step is taken, so B is AWAY at the pour; the host must keep B's
//     share (owed) and pay it when B comes back (same browser, the visit link again), B acks, the host owes nothing.
//   --phone: B plays at 390x844 by touch (the 'use' chip for E, taps on the panel) and the brewing panel is shot to --out.
//   npx tsx scripts/plot-brew-check.mts [--url https://ather.games] [--phone] [--offline] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId } from '../src/app/shimmer/open/ather/plot'
import { totalBottles } from '../src/app/shimmer/open/ather/party-brew'
import { ALC_POTIONS } from '../src/app/shimmer/open/ather/alchemy-set'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), OFFLINE = process.argv.includes('--offline'), OUT = flag('--out', '/tmp/plot-brew')
import { mkdirSync } from 'fs'
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'PB' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [14, 12]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const P = (id: string, item: string, dx: number) => ({ id, item, x: spot!.x + dx, z: spot!.z, q: 0, placedAt: 1 })
const PIECES = { crusher: P('pb-crush', 'alc_mortar', -6), nook: P('pb-nook', 'alc_mixer', -2), still: P('pb-still', 'alc_still', 2), desk: P('pb-desk', 'alc_desk', 6) }
const WORKS = { v: 1, rooms: [], chests: [], pieces: Object.values(PIECES) }
const bagOf = (items: { id: string; n: number }[]) => { const slots: unknown[] = Array(32).fill(null); items.forEach((it, i) => { slots[8 + i] = it }); return { v: 1, slots, gifts: ['bait1'] } }
const TOTAL = totalBottles(ALC_POTIONS.health.makes, 2)
console.log(`set at ${spot.x},${spot.z}, party ${CODE}, a 2-hand Health Draught pours ${TOTAL}`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f)
const bag = async (p: Page) => { const r: Record<string, number> = {}; for (const s of ((await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const bottles = async (p: Page) => Object.entries(await bag(p)).filter(([id]) => id.startsWith('potion:health:')).reduce((a, [, n]) => a + n, 0)
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const click = async (p: Page, sel: string) => { const b = await p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
async function open(tag: string, items: { id: string; n: number }[], phone = false, ctx?: any): Promise<Page> {
  const p = await (ctx ?? await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1000, height: 680 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, w: string, b: string) => {
    if (localStorage.getItem('pbc')) return; localStorage.setItem('pbc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c)
    localStorage.setItem('open.works.v1', w); localStorage.setItem('open.inv.v1', b); localStorage.removeItem('open.brewing.v1')
  }, CODE, JSON.stringify(WORKS), JSON.stringify(bagOf(items)))
  return p
}
const isPhone = (p: Page) => p.evaluate(() => window.innerWidth < 500)
async function load(p: Page, q = '') {
  await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__mp && !!(window as any).__visit && !!(window as any).__brew, { timeout: 240000, polling: 1000 })
  await sleep(2000); await hideCard(p)
  if (await isPhone(p)) { await p.touchscreen.tap(195, 844 - 200); await sleep(600) }   // past the touch intro (lift-phone-check)
}
const tapOrClick = async (p: Page, sel: string) => { const b = await p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; if (await isPhone(p)) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y); return true }
/** stand 1.5 m in front of a piece, aim at it, press E; wait for `panel` to open */
async function useAt(p: Page, pc: { x: number; z: number }, panel: string) {
  for (let i = 0; i < 3; i++) {
    if (!(await isPhone(p))) { await p.keyboard.press('Escape'); await sleep(300) }   // on a phone Escape opens Options (not a phone input)
    else while (await p.$('[data-panel] button[aria-label="close"]')) { await tapOrClick(p, '[data-panel] button[aria-label="close"]'); await sleep(400) }   // a phone closes a panel with its X
    await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), pc.x, pc.z + 1.5); await sleep(1500)
    await aimAt(p, pc.x, pc.z, 0.6)
    if (await isPhone(p)) { if (await poll(() => p.evaluate(() => !!document.querySelector('[data-touch="use"][data-touch-near]')), 6000)) await tapOrClick(p, '[data-touch="use"][data-touch-near]') }
    else await p.keyboard.press('e')
    if (await poll(async () => !!(await p.$(`[data-panel="${panel}"]`)), 6000)) return true
  }
  return false
}
async function take(p: Page, k: number) {
  return await poll(async () => !!(await p.$(`[data-brew-step="${k}"][data-brew-state="open"] [data-act="brew-take"] button:not([disabled])`)), 30000)
    && await tapOrClick(p, `[data-brew-step="${k}"] [data-act="brew-take"] button`)
}
const runBy = (p: Page, k: number) => p.evaluate((i: number) => (window as any).__brew?.shown()?.runs?.[i]?.by ?? null, k)

try {
  const a = await open('A', [{ id: 'crop:goldleaf:D', n: 2 }, { id: 'crop:dewdrop_vine:D', n: 2 }]); await load(a)
  const idA = (await a.evaluate(() => localStorage.getItem('ather:mp:id')))!
  ok(await poll(async () => (await ev(a, '__mp', 'zone')) === `open:plot:${idA}` && (await ev(a, '__mp', 'status')) === 'live', 120000), `0. A hosts (${await ev(a, '__mp', 'zone')})`)
  // 1 · A opens a brewing at its Desk
  ok(await useAt(a, PIECES.desk, 'alchemy'), "1. A's E at its Desk opens the Desk")
  ok(await poll(async () => !!(await a.$('[data-act="brew-open"][data-potion="health"]')), 10000) && await click(a, '[data-act="brew-open"][data-potion="health"] button'), '1. A clicked "Brew with your party: Health Draught"')
  ok(await poll(async () => (await a.evaluate(() => (window as any).__brew.shown()?.potion)) === 'health', 8000), '1. a brewing of Health Draught is open on A')

  // 2 · B visits, takes the crush at the Crusher
  const bCtx = await br.createBrowserContext()
  let b = await open('B', [{ id: 'shimmerscale', n: 2 }], PHONE, bCtx)
  await load(b, `&visit=${idA}&vn=Ash`)
  ok(await poll(async () => (await ev(b, '__visit', 'hasSnap')) === true, 60000), '2. B is on A\'s plot')
  const idB = (await b.evaluate(() => localStorage.getItem('ather:mp:id')))!
  ok(await poll(async () => (await b.evaluate(() => (window as any).__brew.shown()?.potion)) === 'health', 20000), `2. B sees A's brewing (${JSON.stringify(await ev(b, '__brew', 'net'))})`)
  ok(await useAt(b, PIECES.crusher, 'brewing'), "2. B's E at A's Crusher opens the brewing panel")
  if (PHONE) {
    await sleep(800); try { await b.screenshot({ path: `${OUT}/brew-phone-panel.png` }) } catch { /* slow frame */ }
    const fit = await b.evaluate(() => { const e = document.querySelector('[data-panel="brewing"]') as HTMLElement | null; const r = e?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, w: window.innerWidth, scroll: document.documentElement.scrollWidth } : null })
    ok(!!fit && fit.l >= 0 && fit.r <= fit.w + 1 && fit.scroll <= fit.w + 1, `2. phone: the brewing panel fits 390 wide, no sideways scroll (${JSON.stringify(fit)}), shot ${OUT}/brew-phone-panel.png`)
  }
  ok(await take(b, 0), '2. B clicked Crush')
  ok(await poll(async () => (await runBy(a, 0)) === idB, 15000), "2. the host records B's crush")
  ok(await poll(async () => !(await bag(b)).shimmerscale, 10000), `2. B's Shimmerscale left B's bag (${JSON.stringify(await bag(b))})`)
  // 3 · A takes the steep at the Nook
  ok(await useAt(a, PIECES.nook, 'brewing'), "3. A's E at its Nook opens the brewing panel")
  ok(await take(a, 1), '3. A clicked the steep')
  ok(await poll(async () => (await runBy(a, 1)) === idA && !(await bag(a))['crop:goldleaf:D'], 10000), `3. A's crops left A's bag (${JSON.stringify(await bag(a))})`)
  // 4 · B takes the Still once the steep is made
  ok(await useAt(b, PIECES.still, 'brewing'), "4. B's E at A's Still opens the brewing panel")
  const bBefore = JSON.stringify(await bag(b))
  ok(await take(b, 2), '4. B clicked Distil (when the steep was made)')
  ok(await poll(async () => (await runBy(a, 2)) === idB, 15000) && JSON.stringify(await bag(b)) === bBefore, '4. B runs the Still from the pool, nothing out of its bag')
  // 5 · A takes the Desk
  ok(await useAt(a, PIECES.desk, 'brewing'), "5. A's E at its Desk now opens the brewing panel")
  ok(await take(a, 3), '5. A clicked the Desk step (when the dust and the extract were made)')
  // 6 · the pour
  if (OFFLINE) { await b.close(); console.log('   B\'s tab closed before the pour') }
  ok(await poll(async () => (await a.evaluate(() => (window as any).__brew.shown()?.poured)) === true, 40000), '6. the brewing poured on its own')
  if (OFFLINE) {
    const owed = await a.evaluate((id: string) => (window as any).__brew.owed()[id] ?? [], idB) as { n: number }[]
    ok(owed.length === 1 && owed[0].n === 1, `6. offline: the host keeps B's share owed (${JSON.stringify(owed)})`)
    b = await open('B', [], PHONE, bCtx); await load(b, `&visit=${idA}&vn=Ash`)
    ok(await poll(async () => (await ev(b, '__visit', 'hasSnap')) === true, 60000), '6. offline: B came back to A\'s plot (same browser)')
  }
  ok(await poll(async () => (await bottles(b)) >= 1, 20000), `6. B got its bottle in its own bag (${await bottles(b)})`)
  if (OFFLINE) {
    ok(await poll(async () => !(await a.evaluate((id: string) => (window as any).__brew.owed()[id], idB)), 15000), '6. offline: B acked, the host owes nothing')
    await sleep(6000)
    ok(await bottles(b) === 1, `6. offline: re-sends never pay twice (B holds ${await bottles(b)})`)
  }
  const nA = await bottles(a), nB = await bottles(b)
  ok(nA + nB === TOTAL && nA >= 1 && nB >= 1, `6. ${TOTAL} bottles poured, every hand at least one (A ${nA}, B ${nB})`)
  ok(nA === 3 && nB === 1, `6. split by contribution: A gave 4 crops + 2 steps, B 2 scale + 2 steps (A ${nA}, B ${nB})`)
  ok(errs.length === 0, `7. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
