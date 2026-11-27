// BETA M242 s1 (assets-M242s1, 11-27): PLANTER BOX STYLES + the LOCK + the box's own EXP. A FRESH keeper (seeded bag, no owner key).
// 390 x 844 by touch (default) or --desk 1280 x 800 (keys + mouse).
//   A. two STYLES (Banded Planter Box + Round Planter Tub, as if just made at the bench: the bench pick is planter-box-styles.test.ts)
//      go from the hotbar onto the plot by the Place button; both stand, each its own piece item.
//   B. plant a Moonberry in the banded box; its card reads 'Moonberry box · EXP 0'.
//   C. fast-forward to grown, harvest TWICE (regrow between) -> EXP 0 -> 1 -> 2, the card and the save say so.
//   D. LOCK: holding a sapling, the banded box offers nothing to plant and refuses it (__boxes.canPlant false); the empty tub offers it.
//   E. Pick up the banded box -> a banded box in the bag, its bush rides along (style stamp, EXP 2); set it down again ->
//      same style, same plant, same planting time (stage), same picks, same EXP; still locked.
//   F. reload: the piece, the plant, the EXP all kept; the card reads EXP 2.
//   G. 0 page errors.
//   npx tsx scripts/m242-planter-check.mts [--desk] [--url http://localhost:3210] [--out docs/looks/m242-2026-11-27]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const desk = process.argv.includes('--desk')
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m242-2026-11-27') + (desk ? '/desk' : '/390')
mkdirSync(out, { recursive: true })
const W = desk ? 1280 : 390, H = desk ? 800 : 844, KEY = 'ather.planterBox.v1'
const BANDED = 'planter_box_banded', TUB = 'planter_tub_round'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.setViewport(desk ? { width: W, height: H } : { width: W, height: H, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m242')) return; sessionStorage.setItem('m242', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[3] = { id: 'planter_box_banded', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'planter_tub_round', n: 1 }
  slots[10] = { id: 'moonberry', n: 2 }; slots[11] = { id: 'goldwood_sapling', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [], pots: {}, met: [] }))
  localStorage.removeItem('ather.planterBox.v1')
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const boxes = async (): Promise<Record<string, any>> => (await read(KEY)) ?? {}
const bagN = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play|Tap to start|Click to start/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.display = 'none' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const centre = (sel: string) => p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }, sel)
// desk: under pointer lock a mouse click lands on the locked canvas, not the button under the cursor -> click the element itself
const tap = async (sel: string) => { const b = await centre(sel); if (b) {
  if (desk && await p.evaluate(() => !!document.pointerLockElement)) await p.evaluate((s: string) => (document.querySelector(s) as HTMLElement | null)?.click(), sel)
  else if (desk) await p.mouse.click(b.x, b.y); else await p.touchscreen.tap(b.x, b.y); await sleep(700) } return !!b }
const A = (k: string, ...a: unknown[]) => p.evaluate((k: string, a: unknown[]) => { const f = (window as any).__ather?.[k]; return typeof f === 'function' ? f(...a) : null }, k, a)
const tp = async (x: number, z: number) => { await A('tp', x, z, 0); await sleep(1500) }
const aim = async (x: number, z: number, ty: number) => {
  await p.evaluate((c: number, d: number, e: number) => { const g = (window as any).__ather, s = g.state(), sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = c - sx, dz = d - sz
    g.look(Math.atan2(-dx, -dz), Math.atan2(g.ground(c, d) + e - (g.ground(sx, sz) + 1.6), Math.hypot(dx, dz))) }, x, z, ty)
  await sleep(900)
}
const USE = '[data-touch="use"][data-touch-near]'
const useAt = async (x: number, z: number, ty: number) => {
  const st = await A('state') as any, sx = st.px ?? st.x, sz = st.pz ?? st.z, d = Math.hypot(x - sx, z - sz)
  if (d > 2.2 || d < 1.2) { const ux = (sx - x) / (d || 1), uz = (sz - z) / (d || 1); await tp(x + ux * 1.7, z + uz * 1.7) }
  await aim(x, z, ty)
  const near = await poll(async () => !!(await A('near')), 8000)
  if (desk) { await p.keyboard.press('e'); await sleep(800); return near }
  const chip = await poll(async () => !!(await centre(USE)), 8000)
  if (chip) await tap(USE)
  return near && chip
}
const boot = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
  try { await dismissStartCard(p) } catch (e) { if (!desk) throw e }   // desktop: pointer lock may be refused headless; the card is pointer-events none
  await hideCard()
  if ((await A('zone')) !== 'plot') await A('travel', { kind: 'plot' }).catch(() => null)
  await poll(async () => (await A('zone')) === 'plot', 60000); await sleep(3000)
}
type Pc = { id: string; item: string; x: number; z: number }
const pieces = async () => ((await read('open.works.v1'))?.pieces ?? []) as Pc[]
const card = () => p.evaluate(() => { const e = document.querySelector('[data-panel="piece"]'), g = e?.querySelector('[data-sapling-box]')
  return { open: !!e, title: e?.querySelector('h1,h2,h3,[data-title]')?.textContent?.trim() ?? '', box: g?.getAttribute('data-sapling-box') ?? '', sap: g?.getAttribute('data-sapling') ?? '', exp: g?.getAttribute('data-exp') ?? '',
    tag: g?.querySelector('[data-box-tag]')?.textContent?.trim() ?? '', ripe: g?.getAttribute('data-ripe') ?? '', plants: [...(e?.querySelectorAll('[data-act="plant-sapling"]') ?? [])].map(x => x.getAttribute('data-sapling')), text: g?.textContent?.trim() ?? '' } })
const closeCard = async () => { await p.keyboard.press('Escape'); await sleep(600); if (await p.evaluate(() => !!document.querySelector('[data-panel="piece"]'))) { await p.evaluate(() => (document.querySelector('[data-panel="piece"] button[aria-label="Close"]') as HTMLElement | null)?.click()); await sleep(500) } }
const openBox = async (pc: Pc) => {
  for (let t = 0; t < 4; t++) {
    await useAt(pc.x, pc.z, 0.3)
    if (await poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="piece"]')), 6000)) return true
    await closeCard(); await tp(pc.x + (t % 2 ? 1.7 : -1.7), pc.z + 1.7); await sleep(1200)
  }
  return false
}
/** hold the item from the hotbar, tap Place; returns the new piece (or null) */
const placeFromBag = async (item: string, at: [number, number]): Promise<Pc | null> => {
  const slot = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(x => x?.id === item)
  if (slot < 0 || slot >= 8) { console.log(`  (${item} not on the hotbar: slot ${slot})`); return null }
  const had = new Set((await pieces()).map(x => x.id))
  await tp(at[0], at[1]); await A('look', 0, -0.35).catch(() => null); await sleep(600)
  // the hotbar button by pointer on both (desk digit keys only count once the game has input = pointer lock, refused headless)
  if (desk) await p.keyboard.press(String(slot + 1))
  if (!(await poll(async () => !!(await centre('[data-act="place"]')), desk ? 2000 : 1))) await tap(`[data-hud="hotbar"] button[aria-label="slot ${slot + 1}"]`)
  await poll(async () => !!(await centre('[data-act="place"]')), 8000)
  for (let t = 0; t < 5; t++) {
    await tap('[data-act="place"]'); await sleep(900)
    const n = (await pieces()).find(x => x.item === item && !had.has(x.id)); if (n) return n
    await A('look', (t + 1) * 0.8, -0.35).catch(() => null); await sleep(500)
  }
  return null
}

// ── A: two styles onto the plot ───────────────────────────────────────────────────────────────────────────────────────
await boot()
ok((await A('zone')) === 'plot', `boot: on the plot (zone ${await A('zone')})`)
const banded = await placeFromBag(BANDED, [-134, 104.2])
const tub = await placeFromBag(TUB, [-124, 104.2])
ok(!!banded && !!tub && (await bagN(BANDED)) === 0 && (await bagN(TUB)) === 0, `A two styles placed: ${banded?.item}@${banded?.id} + ${tub?.item}@${tub?.id}`)
if (banded) await tp(banded.x - 2.5, banded.z + 3); await sleep(1500); await shot('a-two-styles')
if (!banded || !tub) { console.log('FAIL (cannot go on without both boxes)'); await br.close(); process.exit(1) }

// ── B: plant a Moonberry in the banded box ──────────────────────────────────────────────────────────────────────────
ok(await openBox(banded), 'B the banded box card opens')
const c0 = await card()
ok(c0.plants.includes('moonberry') && c0.plants.includes('goldwood_sapling'), `B an empty box offers what the keeper holds (${c0.plants})`)
await tap('[data-act="plant-sapling"][data-sapling="moonberry"] button'); await sleep(900)
const c1 = await card()
ok(c1.box === 'bush' && c1.sap === 'moonberry' && c1.exp === '0' && c1.tag === 'Moonberry box · EXP 0', `B planted: "${c1.tag}" / "${c1.text}"`)
await shot('b-planted'); await closeCard()

// ── C: harvest twice -> EXP rises ───────────────────────────────────────────────────────────────────────────────────
const harvest = async (n: number, ageMs: number) => {
  await p.evaluate((ms: number) => (window as any).__boxes.age(ms), ageMs); await sleep(1200)
  await openBox(banded)
  const m0 = await bagN('moonberry')
  const ready = !!(await centre('[data-act="pick-bush"]'))
  await tap('[data-act="pick-bush"] button'); await sleep(900)
  const c = await card(), saved = (await boxes())[banded.id]
  ok(ready && (await bagN('moonberry')) > m0 && c.exp === String(n) && saved?.exp === n && c.tag === `Moonberry box · EXP ${n}`, `C harvest ${n}: Moonberry ${m0} -> ${await bagN('moonberry')}, "${c.tag}", saved exp ${saved?.exp}`)
  return c
}
await harvest(1, 4 * GAME_DAY_MS)
await harvest(2, GAME_DAY_MS / 2 + 60_000)
await shot('c-exp-2')

// ── D: the LOCK ─────────────────────────────────────────────────────────────────────────────────────────────────────
const cL = await card()
const refuse = await p.evaluate((id: string) => (window as any).__boxes.canPlant(id, 'goldwood_sapling'), banded.id)
ok(cL.plants.length === 0 && (await bagN('goldwood_sapling')) === 1 && refuse === false, `D locked: holding a sapling, the Moonberry box offers [${cL.plants}] and refuses it (canPlant ${refuse})`)
await closeCard()
const tubFree = await p.evaluate((id: string) => (window as any).__boxes.canPlant(id, 'goldwood_sapling'), tub.id)
ok(tubFree === true, `D the empty tub is free (canPlant ${tubFree})`)

// ── E: lift into the bag + set down again ───────────────────────────────────────────────────────────────────────────
const before = (await boxes())[banded.id]
await openBox(banded)
await tap('[data-act="pickup-piece"] button'); await sleep(1200)
const carried = (await boxes())['carried:' + banded.id]
ok((await bagN(BANDED)) === 1 && carried?.sapling === 'moonberry' && carried?.box === BANDED && carried?.exp === 2 && carried?.at === before?.at, `E Pick up: a banded box in the bag, its bush rides along ${JSON.stringify(carried)}`)
await closeCard()
const back = await placeFromBag(BANDED, [-129, 104.2])
const after = back ? (await boxes())[back.id] : null
ok(!!back && back.item === BANDED && after?.sapling === 'moonberry' && after?.at === before?.at && after?.picked === before?.picked && after?.exp === 2 && !(await boxes())['carried:' + banded.id],
  `E set down again: ${back?.item}@${back?.id} = same style, plant, stage, picks + EXP ${JSON.stringify(after)}`)
if (back) {
  const re = await p.evaluate((id: string) => (window as any).__boxes.canPlant(id, 'goldwood_sapling'), back.id)
  ok(re === false, `E still locked after the move (canPlant ${re})`)
  await openBox(back); const c4 = await card(); ok(c4.tag === 'Moonberry box · EXP 2', `E its card: "${c4.tag}"`); await shot('e-replaced'); await closeCard()
}

// ── F: reload ───────────────────────────────────────────────────────────────────────────────────────────────────────
await boot()
const pcs = await pieces(), saved = back ? (await boxes())[back.id] : null
const rb = back ? pcs.find(x => x.id === back.id) : null
ok(!!rb && rb.item === BANDED && pcs.some(x => x.id === tub.id && x.item === TUB) && saved?.sapling === 'moonberry' && saved?.exp === 2 && saved?.at === before?.at, `F reload keeps both styles + the bush + EXP ${JSON.stringify(saved)}`)
if (rb) { await openBox(rb); const c5 = await card(); ok(c5.tag === 'Moonberry box · EXP 2' && c5.plants.length === 0, `F after reload the card: "${c5.tag}"`); await shot('f-reloaded') }
ok(errs.length === 0, `G 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : `PASS: M242 planter ${desk ? 'desk' : '390'}`)
process.exit(fails ? 1 : 0)
