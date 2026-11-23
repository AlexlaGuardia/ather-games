// M106 fix (world-planter, 11-23): the planter BY TOUCH at 390 x 844 (isMobile, hasTouch), the way Alex met it on his phone.
//   Alex's prod save held two `planter_box` pieces (the goldwood decor "Planter Box") and no Spirit Planter: E at a box gave
//   only Turn / Pick up, so his Mana Seeds had nowhere to go. Every input below is a real tap (hotbar slot, Place, the 'use'
//   chip, the seed button). Hooks: __ather.tp / state / look / ground (movement + aim only). SETUP (stated): a fresh keeper
//   with a Planter Box, a Spirit Planter and one Mana Seed in the bag (how Alex holds his seeds), no pieces placed.
//   1. tap the Planter Box's slot, tap Place: it stands on the plot   2. aim at it, the 'use' chip shows, tap it: its panel
//      opens AND names the Spirit Planter + its recipe (the miss: Turn / Pick up only)   3. tap the Spirit Planter's slot,
//      Place   4. tap 'use' at it: the PLANTER panel (seed list, no Turn)   5. tap the seed: the pot is saved, the bag -1
//   6. 0 page errors
//   npx tsx scripts/planter-phone-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/planter-phone')
mkdirSync(out, { recursive: true })
const W = 390, H = 844, SEED = 'mana_seed_owl'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((seed: string) => {
  if (sessionStorage.getItem('pph')) return; sessionStorage.setItem('pph', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'planter_box', n: 1 }; slots[1] = { id: 'spirit_planter', n: 1 }; slots[2] = { id: seed, n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [], pots: {}, met: [] }))
}, SEED)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const pieces = async () => ((await read('open.works.v1'))?.pieces ?? []) as { id: string; item: string; x: number; z: number }[]
const bagN = async (id: string) => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const centre = (sel: string) => p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }, sel)
// the dev server's Next badge sits over hotbar slot 1 at 390 (prod has none): take it out before any tap
const tap = async (sel: string) => { await p.evaluate(() => document.querySelectorAll('nextjs-portal').forEach(e => e.remove())).catch(() => {}); const b = await centre(sel); if (b) { await p.touchscreen.tap(b.x, b.y); await sleep(700) } return !!b }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500) }
const aim = async (x: number, z: number, ty: number) => {
  await p.evaluate((c: number, d: number, e: number) => { const g = (window as any).__ather, s = g.state(), sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = c - sx, dz = d - sz
    g.look(Math.atan2(-dx, -dz), Math.atan2(g.ground(c, d) + e - (g.ground(sx, sz) + 1.6), Math.hypot(dx, dz))) }, x, z, ty)
  await sleep(900)
}
const USE = '[data-touch="use"][data-touch-near]'
// place the bag's piece in hotbar slot `i` by touch: tap the slot, tap Place; returns the new piece
const placeBySlot = async (i: number, item: string) => {
  const before = (await pieces()).length
  let bar = false   // a first tap can land while the HUD is still mounting (slow dev compile): tap again, up to 3
  for (let t = 0; t < 3 && !bar; t++) { await tap(`[data-hud="hotbar"] button[aria-label="slot ${i + 1}"]`); bar = await poll(async () => !!(await centre('[data-act="place"]')), 8000) }
  for (let t = 0; t < 4 && (await pieces()).length === before; t++) { await tap('[data-act="place"]'); await sleep(600) }
  const ps = await pieces()
  return { bar, piece: ps.length > before ? ps.find(x => x.item === item) ?? null : null }
}
const useAt = async (x: number, z: number, ty: number) => {
  const st = await p.evaluate(() => (window as any).__ather.state()), sx = st.px ?? st.x, sz = st.pz ?? st.z, d = Math.hypot(x - sx, z - sz)
  if (d > 2.2 || d < 1.2) { const ux = (sx - x) / (d || 1), uz = (sz - z) / (d || 1); await tp(x + ux * 1.7, z + uz * 1.7, 0) }
  await aim(x, z, ty)
  const chip = await poll(async () => !!(await centre(USE)), 8000)
  if (chip) await tap(USE)
  return chip
}

await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
await p.touchscreen.tap(W / 2, H - 200); await sleep(600)
// 1. the Planter Box
await tp(-130, 104, 0)
const box = await placeBySlot(0, 'planter_box')
ok(box.bar, '1. a tap on the Planter Box slot shows the placing bar (Place)')
ok(!!box.piece && (await bagN('planter_box')) === 0, `   a tap on Place stands it on the plot (${box.piece ? `${box.piece.x}, ${box.piece.z}` : 'none'})`)
await shot('pph-1-box')
// 2. use at the box: its panel names the Spirit Planter and the recipe
let boxPanel: { open: boolean; hint: string; turn: boolean } = { open: false, hint: '', turn: false }
if (box.piece) {
  ok(await useAt(box.piece.x, box.piece.z, 0.3), "2. at the Planter Box the phone shows its 'use' chip")
  await poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="piece"]')), 5000)
  boxPanel = await p.evaluate(() => { const e = document.querySelector('[data-panel="piece"]'); return { open: !!e, hint: e?.querySelector('[data-planter-hint]')?.textContent?.trim() ?? '', turn: !!e?.querySelector('[data-act="turn-piece"]') } })
  await shot('pph-2-box-panel')
}
const sp = FURNITURE.spirit_planter
ok(boxPanel.open, '   a tap on it opens the Planter Box panel')
ok(boxPanel.hint.includes(sp.name) && boxPanel.hint.includes('Starwillow Branch') && boxPanel.hint.includes('Starwillow Sap'), `   ...and it says Mana Seeds grow in a ${sp.name}, with the recipe ("${boxPanel.hint}")`)
await tap('[data-panel="piece"] [aria-label="Close"], [data-panel="piece"] button[title="Close"]'); await p.keyboard.press('Escape'); await sleep(600)
// 3. the Spirit Planter
await tp(-136, 104, 0)
const pl = await placeBySlot(1, 'spirit_planter')
ok(!!pl.piece && (await bagN('spirit_planter')) === 0, `3. the Spirit Planter placed by touch (${pl.piece ? `${pl.piece.x}, ${pl.piece.z}` : 'none'})`)
// 4. use at it: the planter panel with the seed
let planter = { open: false, seed: false, turn: true }
if (pl.piece) {
  ok(await useAt(pl.piece.x, pl.piece.z, 0.4), "4. at the Spirit Planter the phone shows its 'use' chip")
  await poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="planter"]')), 5000)
  planter = await p.evaluate((s: string) => { const e = document.querySelector('[data-panel="planter"]'); return { open: !!e, seed: !!e?.querySelector(`[data-act="plant-seed"][data-seed="${s}"]`), turn: !!e?.querySelector('[data-act="turn-piece"]') } }, SEED)
  await shot('pph-4-planter')
}
ok(planter.open && planter.seed && !planter.turn, `   a tap opens the PLANTER panel listing the bag's Mana Seed, no Turn (${JSON.stringify(planter)})`)
// 5. tap the seed
if (planter.seed) await tap(`[data-act="plant-seed"][data-seed="${SEED}"]`)
const pots = (await read('ather.grimoire.v1'))?.pots ?? {}
ok(!!pl.piece && pots[pl.piece.id]?.seed === SEED && (await bagN(SEED)) === 0, `5. a tap on the seed plants it: pot ${JSON.stringify(pl.piece ? pots[pl.piece.id] ?? null : null)}, bag ${await bagN(SEED)}`)
ok(await p.evaluate(() => !!document.querySelector('[data-planter="growing"]')), '   the panel turns to Growing')
await shot('pph-5-planted')
// 7-9. M106 melee fix (world-meleeplanter, 11-23): three melee hits pick the GROWING planter up (the phone's real 'hit' button);
//   the pot rides along (not lost, not bloomed); placed again by touch, the new planter holds the SAME pot: seed, planting
//   time, tends, so the same growth day. (Before: melee skipped the pot, so the seed was lost.)
const potBefore = pl.piece ? (await read('ather.grimoire.v1'))?.pots?.[pl.piece.id] ?? null : null
await tap('[data-panel="planter"] [aria-label="Close"], [data-panel="planter"] button[title="Close"]'); await p.keyboard.press('Escape'); await sleep(600)
let melee = { target: false, gone: false, inBag: 0, carried: null as unknown, seedsInBag: -1 }
if (pl.piece) {
  const st = await p.evaluate(() => (window as any).__ather.state()), sx = st.px ?? st.x, sz = st.pz ?? st.z, d = Math.hypot(pl.piece.x - sx, pl.piece.z - sz)
  if (d > 2 || d < 1.2) { const ux = (sx - pl.piece.x) / (d || 1), uz = (sz - pl.piece.z) / (d || 1); await tp(pl.piece.x + ux * 1.6, pl.piece.z + uz * 1.6, 0) }
  await aim(pl.piece.x, pl.piece.z, 0.3)
  const id = pl.piece.id
  melee.target = await poll(async () => p.evaluate((i: string) => (window as any).__melee?.target()?.id === i && !!document.querySelector('[data-touch="hit"]'), id), 8000)
  for (let k = 0; k < 3 && melee.target; k++) { await tap('[data-touch="hit"]'); await sleep(150) }
  melee.gone = await poll(async () => !(await pieces()).some(x => x.id === id), 5000)
  melee.inBag = await bagN('spirit_planter'); melee.seedsInBag = await bagN(SEED)
  melee.carried = (await read('ather.grimoire.v1'))?.pots?.['carried:' + id] ?? null
  await shot('pph-7-melee-lifted')
}
ok(melee.target, "7. aimed at the growing planter, the phone shows its 'hit' button")
ok(melee.gone && melee.inBag === 1, `   three hits: the planter is off the plot and back in the bag (${melee.inBag})`)
ok(!!potBefore && JSON.stringify(melee.carried) === JSON.stringify(potBefore), `8. its pot rides along unchanged, not lost (${JSON.stringify(melee.carried)})`)
// 9. place it again by touch: the new planter takes the same pot
const slot = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(x => x?.id === 'spirit_planter')
await tp(-133, 106, 0)
const again = slot >= 0 && slot < 8 ? await placeBySlot(slot, 'spirit_planter') : { bar: false, piece: null }
const potAfter = again.piece ? (await read('ather.grimoire.v1'))?.pots?.[again.piece.id] ?? null : null
const left = Object.keys((await read('ather.grimoire.v1'))?.pots ?? {}).filter(k => k.startsWith('carried:')).length
ok(!!again.piece && again.piece.id !== pl.piece?.id, `9. placed again by touch (slot ${slot + 1}, ${again.piece ? again.piece.id : 'none'})`)
ok(!!potBefore && JSON.stringify(potAfter) === JSON.stringify(potBefore) && left === 0, `   it holds the SAME pot: seed ${potAfter?.seed}, planted at ${potAfter?.at} (was ${potBefore?.at}), tends ${JSON.stringify(potAfter?.tends)}; carried left ${left}`)
let grow = { open: false, day: '' }
if (again.piece) {
  await useAt(again.piece.x, again.piece.z, 0.4)
  await poll(async () => p.evaluate(() => !!document.querySelector('[data-planter="growing"]')), 5000)
  grow = await p.evaluate(() => { const e = document.querySelector('[data-planter="growing"]'); return { open: !!e, day: (e?.closest('[data-panel="planter"]') ?? e)?.textContent?.match(/Day \d+ of \d+/)?.[0] ?? '' } })
  await shot('pph-9-replanted')
}
ok(grow.open && grow.day === 'Day 1 of 3', `   its panel shows it still Growing, on its own day ("${grow.day}")`)
ok(errs.length === 0, `6. 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS: by touch at 390, a Planter Box points at the Spirit Planter + its recipe; a Spirit Planter placed by hand lists the bag seed and one tap plants it; three melee hits lift the growing planter with its pot and, placed again, it holds the same seed on the same day')
process.exit(fails ? 1 : 0)
