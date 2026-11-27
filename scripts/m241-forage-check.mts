// BETA M241 (sprites-M241, 11-27): WILD MOONBERRY + FIREWORT, and the MOONBERRY BUSH in a Planter Box. A FRESH keeper (seeded
// bag, no owner key). 390 x 844 by touch (default) or --desk 1280 x 800 by keyboard + mouse.
//   A. the Wilds: at a woodland moonberry bush, E -> +2 Moonberry in the bag, the spot reads picked (no prompt); forageAge
//      (fast-forward one game day) -> it is unpicked again.
//   B. at a Firewort spot on the Scald's edge (forage.ts wildSpots), E -> +1 Firewort (+ its seed).
//   C. (unit-only: forage.test.ts + infusions.test.ts) pruning a Goldwood no longer turns up Firewort; no live step (a 12% roll).
//   D. home: a Planter Box lists the Moonberry, planting it shows the bush growing; aged to grown -> 'Pick berries' -> +2 Moonberry,
//      the bush then regrows; Pick up the box + set it down again -> the new box keeps the bush (sapling = moonberry, picked kept).
//   E. 0 page errors.
//   npx tsx scripts/m241-forage-check.mts [--desk] [--url http://localhost:3210] [--out docs/looks/m241-2026-11-27]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { wildSpots, type IndexTile } from '../src/app/shimmer/open/ather/forage'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const desk = process.argv.includes('--desk')
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m241-2026-11-27') + (desk ? '/desk' : '/390')
mkdirSync(out, { recursive: true })
const W = desk ? 1280 : 390, H = desk ? 800 : 844, KEY = 'ather.planterBox.v1'
const BOX = { id: 'pb-m241', item: 'planter_box', x: -130, z: 102.5, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.setViewport(desk ? { width: W, height: H } : { width: W, height: H, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((box: unknown) => {
  if (sessionStorage.getItem('m241')) return; sessionStorage.setItem('m241', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[1] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [box] }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [], pots: {}, met: [] }))
  localStorage.removeItem('ather.planterBox.v1'); localStorage.removeItem('ather.forage.v1')
}, BOX)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bagN = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play|Tap to start|Click to start/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.display = 'none' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const centre = (sel: string) => p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }, sel)
const tap = async (sel: string) => { const b = await centre(sel); if (b) { if (desk) await p.mouse.click(b.x, b.y); else await p.touchscreen.tap(b.x, b.y); await sleep(700) } return !!b }
const A = (k: string, ...a: unknown[]) => p.evaluate((k: string, a: unknown[]) => { const f = (window as any).__ather?.[k]; return typeof f === 'function' ? f(...a) : null }, k, a)
const tp = async (x: number, z: number) => { await A('tp', x, z, 0); await sleep(1500) }
const aim = async (x: number, z: number, ty: number) => {
  await p.evaluate((c: number, d: number, e: number) => { const g = (window as any).__ather, s = g.state(), sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = c - sx, dz = d - sz
    g.look(Math.atan2(-dx, -dz), Math.atan2(g.ground(c, d) + e - (g.ground(sx, sz) + 1.6), Math.hypot(dx, dz))) }, x, z, ty)
  await sleep(900)
}
const USE = '[data-touch="use"][data-touch-near]'
/** stand 1.7 m off (x, z), aim, then E (desk) or the phone 'use' chip; returns whether the near-thing was offered */
const useAt = async (x: number, z: number, ty: number, kind?: string) => {
  const st = await A('state') as any, sx = st.px ?? st.x, sz = st.pz ?? st.z, d = Math.hypot(x - sx, z - sz)
  if (d > 2.2 || d < 1.2) { const ux = (sx - x) / (d || 1), uz = (sz - z) / (d || 1); await tp(x + ux * 1.7, z + uz * 1.7) }
  await aim(x, z, ty)
  const near = await poll(async () => { const n = await A('near') as any; return kind ? n?.kind === kind : !!n }, 8000)
  if (desk) { await p.keyboard.press('e'); await sleep(800); return near }
  const chip = await poll(async () => !!(await centre(USE)), 8000)
  if (chip) await tap(USE)
  return near && chip
}
const boot = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500); await hideCard()
  if (!desk) { await p.touchscreen.tap(W / 2, H - 200); await sleep(600) }
}

// ── A + B: the Wilds ─────────────────────────────────────────────────────────────────────────────────────────────────────
await boot()
const idx = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: IndexTile[] }
const all = wildSpots(idx.tiles)
const pickAt = async (kind: 'moonberry' | 'firewort', ids: string[]) => {
  // go to a spot of this kind (travel by waymark), then take the nearest LOADED one the page offers
  for (const s of all.filter(s => s.kind === kind && !ids.includes(s.id)).filter((_, i) => i % 7 === 0).slice(0, 6)) {
    await A('wmGoto', s.x, s.z)
    await poll(async () => (await A('zone')) === 'wilds' && ((await A('forage', 40)) as any[] ?? []).some(f => f.kind === kind), 60000)
    await sleep(3000)
    const f = ((await A('forage', 60)) as any[] ?? []).find(f => f.kind === kind && !f.picked)
    if (!f) continue
    return f as { id: string; x: number; z: number; kind: string }
  }
  return null
}
const mb = await pickAt('moonberry', [])
ok(!!mb, `A the Wilds offer a moonberry bush (${mb?.id})`)
if (mb) {
  const b0 = await bagN('moonberry')
  const used = await useAt(mb.x, mb.z, 0.4, 'forage')
  const got = await poll(async () => (await bagN('moonberry')) === b0 + 2, 6000)
  ok(used && got, `A E at the bush: Moonberry ${b0} -> ${await bagN('moonberry')}`)
  const st = ((await A('forage', 60)) as any[]).find(f => f.id === mb.id)
  ok(!!st?.picked && (await A('near') as any)?.kind !== 'forage', 'A the bush shows picked (no berries, no prompt)')
  await shot('a-picked')
  await A('forageAge', GAME_DAY_MS + 1000); await sleep(2500)
  const st2 = ((await A('forage', 60)) as any[]).find(f => f.id === mb.id)
  ok(st2 && !st2.picked, 'A a game day on (fast-forward): the bush has regrown')
  await shot('a-regrown')
}
const fw = await pickAt('firewort', [])
ok(!!fw, `B a Firewort spot at the Scald's edge (${fw?.id})`)
if (fw) {
  const c0 = await bagN('crop:firewort:D'), s0 = await bagN('seed:firewort:D')
  const used = await useAt(fw.x, fw.z, 0.2, 'forage')
  const got = await poll(async () => (await bagN('crop:firewort:D')) === c0 + 1, 6000)
  ok(used && got && (await bagN('seed:firewort:D')) === s0 + 1, `B E at the spot: Firewort ${c0} -> ${await bagN('crop:firewort:D')}, seed ${s0} -> ${await bagN('seed:firewort:D')}`)
  await shot('b-firewort')
}

// ── D: home, the Planter Box ─────────────────────────────────────────────────────────────────────────────────────────────
await boot()
if ((await A('zone')) !== 'plot') await A('travel', { kind: 'plot' }).catch(() => null); await poll(async () => (await A('zone')) === 'plot', 60000); await sleep(3000)
const card = () => p.evaluate(() => { const e = document.querySelector('[data-panel="piece"]'), g = e?.querySelector('[data-sapling-box]')
  return { open: !!e, box: g?.getAttribute('data-sapling-box') ?? '', sap: g?.getAttribute('data-sapling') ?? '', stage: Number(g?.getAttribute('data-stage') ?? -1), ripe: g?.getAttribute('data-ripe') ?? '', text: g?.textContent?.trim() ?? '' } })
const closeCard = async () => { await p.keyboard.press('Escape'); await sleep(600) }
const openBox = async (x: number, z: number) => { await useAt(x, z, 0.3); return poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="piece"]')), 6000) }
await tp(-130, 104.2)
ok(await openBox(BOX.x, BOX.z), 'D the Planter Box card opens')
ok(!!(await centre('[data-act="plant-sapling"][data-sapling="moonberry"]')), 'D the card offers the Moonberry')
await tap('[data-act="plant-sapling"][data-sapling="moonberry"] button'); await sleep(900)
const c1 = await card()
ok(c1.box === 'bush' && c1.sap === 'moonberry' && c1.stage === 0, `D planted: a young bush ("${c1.text}")`)
await shot('d-1-planted'); await closeCard()
await p.evaluate(() => (window as any).__boxes.age(4 * 64 * 60 * 1000)); await sleep(1500)
await openBox(BOX.x, BOX.z)
const c2 = await card()
ok(c2.ripe === '1' && !!(await centre('[data-act="pick-bush"]')), `D grown (fast-forward): berries ready ("${c2.text}")`)
await shot('d-2-ripe')
const m0 = await bagN('moonberry')
await tap('[data-act="pick-bush"] button'); await sleep(900)
const c3 = await card()
ok((await bagN('moonberry')) === m0 + 2 && c3.ripe === '0' && c3.box === 'bush', `D Pick berries: Moonberry ${m0} -> ${await bagN('moonberry')}, then regrowing ("${c3.text}")`)
const before = (await read(KEY))?.[BOX.id]
await shot('d-3-picked')
// lift (Pick up) + set down again
await tap('[data-act="pickup-piece"] button'); await sleep(1200)
const carried = (await read(KEY))?.['carried:' + BOX.id]
ok(carried?.sapling === 'moonberry' && carried?.picked === before?.picked, `D Pick up: the bush rides along (${JSON.stringify(carried)})`)
await closeCard()
const slot = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(x => x?.id === 'planter_box')
await tp(-134, 104.2)
const pieces = async () => ((await read('open.works.v1'))?.pieces ?? []) as { id: string; item: string; x: number; z: number }[]
let placed: { id: string; x: number; z: number } | null = null
if (slot >= 0 && slot < 8) {
  if (desk) { await p.keyboard.press(String(slot + 1)); await sleep(800); for (let t = 0; t < 3 && !placed; t++) { await p.keyboard.press('e'); await sleep(1200); placed = (await pieces()).find(x => x.item === 'planter_box') ?? null } }
  else { await tap(`[data-hud="hotbar"] button[aria-label="slot ${slot + 1}"]`); await poll(async () => !!(await centre('[data-act="place"]')), 8000); for (let t = 0; t < 4 && !placed; t++) { await tap('[data-act="place"]'); await sleep(800); placed = (await pieces()).find(x => x.item === 'planter_box') ?? null } }
}
const after = placed ? (await read(KEY))?.[placed.id] : null
ok(!!placed && after?.sapling === 'moonberry' && after?.picked === before?.picked, `D set down again (slot ${slot + 1}): ${placed?.id ?? 'none'} keeps the bush ${JSON.stringify(after)}`)
if (placed) { await openBox(placed.x, placed.z); const c4 = await card(); ok(c4.box === 'bush', `D its card: still the bush ("${c4.text}")`); await shot('d-4-replaced') }
ok(errs.length === 0, `E 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : `PASS: M241 forage ${desk ? 'desk' : '390'}`)
process.exit(fails ? 1 : 0)
