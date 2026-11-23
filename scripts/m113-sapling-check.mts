// M113 s1 (world-M113, 11-23): THE PLANTER BOX GROWS A SAPLING, by touch at 390 x 844 (isMobile, hasTouch). Every input is a
//   real tap (the 'use' chip, the sapling button, the phone 'hit' button, hotbar slot + Place). Hooks: __ather.tp / state / look /
//   ground, __melee.target (movement, aim, reading only). SETUP (stated): a Planter Box already stands at (-130, 102.5); the
//   garden BANK holds one Goldwood Sapling (the bag none); the bag holds one Mana Seed.
//   1. tap 'use' at the box: the bank sapling is listed (bag 0 / bank 1) and the Mana Seed pointer line is still there
//   2. tap the sapling: the box save holds it, bank -1, the card says stage 1
//   3. its planting time moved back 2 game days + reload: the card says stage 3 (data-stage 2): the clock grows it, the save keeps it
//   4. three melee hits: the box is back in the bag, its sapling carried unchanged
//   5. placed again by touch: the new box holds the same sapling + planting time, card stage 3   6. 0 page errors
//   npx tsx scripts/m113-sapling-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m113-sapling')
mkdirSync(out, { recursive: true })
const W = 390, H = 844, SAP = 'goldwood_sapling', KEY = 'ather.planterBox.v1'
const BOX = { id: 'pb-check', item: 'planter_box', x: -130, z: 102.5, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((box: unknown, sap: string) => {
  if (sessionStorage.getItem('m113')) return; sessionStorage.setItem('m113', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[2] = { id: 'mana_seed_owl', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [box] }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [], pots: {}, met: [] }))
  localStorage.setItem('open.bank.v1', JSON.stringify({ v: 1, stacks: [{ id: sap, n: 1 }] }))   // the sapling is ONLY in the bank
  localStorage.removeItem('ather.planterBox.v1')
}, BOX, SAP)
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

const boot = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.touchscreen.tap(W / 2, H - 200); await sleep(600)
}
const bankN = async (id: string) => (((await read('open.bank.v1'))?.stacks ?? []) as { id: string; n: number }[]).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
const card = () => p.evaluate(() => { const e = document.querySelector('[data-panel="piece"]'), g = e?.querySelector('[data-sapling-box="growing"]')
  return { open: !!e, hint: e?.querySelector('[data-planter-hint]')?.textContent?.trim() ?? '', stage: g ? Number(g.getAttribute('data-stage')) : -1, sap: g?.getAttribute('data-sapling') ?? '', text: g?.textContent?.trim() ?? '' } })
const openBox = async (x: number, z: number) => { const c = await useAt(x, z, 0.3); await poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="piece"]')), 5000); return c }
const closeCard = async () => { await tap('[data-panel="piece"] [aria-label="Close"], [data-panel="piece"] button[title="Close"]'); await p.keyboard.press('Escape'); await sleep(600) }

await boot()
await tp(-130, 104.2, 0)
// 1. the bank sapling is listed, the Mana Seed pointer stays
ok(await openBox(BOX.x, BOX.z), "1. at the Planter Box the phone shows its 'use' chip")
const listed = await p.evaluate((s: string) => { const e = document.querySelector(`[data-act="plant-sapling"][data-sapling="${s}"]`); return e ? `${e.getAttribute('data-bag')}/${e.getAttribute('data-bank')}` : null }, SAP)
const c1 = await card()
ok(c1.open && listed === '0/1', `   the card lists the bank's Goldwood Sapling (bag/bank ${listed})`)
ok(c1.hint.includes(FURNITURE.spirit_planter.name), `   a Mana Seed still gets the pointer line ("${c1.hint}")`)
await shot('m113-1-list')
// 2. plant from the bank
await tap(`[data-act="plant-sapling"][data-sapling="${SAP}"] button`)
await poll(async () => (await card()).stage >= 0, 5000)
const saved = (await read(KEY))?.[BOX.id] ?? null, c2 = await card()
ok(saved?.sapling === SAP && (await bankN(SAP)) === 0, `2. a tap plants it from the bank: save ${JSON.stringify(saved)}, bank ${await bankN(SAP)}`)
ok(c2.stage === 0 && c2.sap === SAP, `   the card shows it growing, stage 1 ("${c2.text}")`)
await shot('m113-2-planted'); await closeCard()
// 3. two game days on (the clock seeded back) + reload
await p.evaluate((k: string, id: string, back: number) => { const b = JSON.parse(localStorage.getItem(k)!); b[id].at -= back; localStorage.setItem(k, JSON.stringify(b)) }, KEY, BOX.id, 2 * GAME_DAY_MS + 1000)
const at = (await read(KEY))?.[BOX.id]?.at
await boot(); await tp(-130, 104.2, 0)
await openBox(BOX.x, BOX.z)
const c3 = await card()
ok(c3.stage === 2 && c3.sap === SAP && (await read(KEY))?.[BOX.id]?.at === at, `3. two game days on, after a reload: stage 3 of 4 ("${c3.text}"), save kept`)
await shot('m113-3-grown'); await closeCard()
// 4. melee lift
let melee = { target: false, gone: false, inBag: 0, carried: null as unknown }
{
  await aim(BOX.x, BOX.z, 0.3)
  melee.target = await poll(async () => p.evaluate((i: string) => (window as any).__melee?.target()?.id === i && !!document.querySelector('[data-touch="hit"]'), BOX.id), 8000)
  for (let k = 0; k < 3 && melee.target; k++) { await tap('[data-touch="hit"]'); await sleep(150) }
  melee.gone = await poll(async () => !(await pieces()).some(x => x.id === BOX.id), 5000)
  melee.inBag = await bagN('planter_box')
  melee.carried = (await read(KEY))?.['carried:' + BOX.id] ?? null
  await shot('m113-4-lifted')
}
ok(melee.target && melee.gone && melee.inBag === 1, `4. three 'hit' taps: the box is back in the bag (${melee.inBag})`)
ok((melee.carried as any)?.sapling === SAP && (melee.carried as any)?.at === at, `   its sapling rides along unchanged (${JSON.stringify(melee.carried)})`)
// 5. place again by touch
const slot = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(x => x?.id === 'planter_box')
await tp(-134, 104.2, 0)
const again = slot >= 0 && slot < 8 ? await placeBySlot(slot, 'planter_box') : { bar: false, piece: null }
const after = again.piece ? (await read(KEY))?.[again.piece.id] ?? null : null
const left = Object.keys((await read(KEY)) ?? {}).filter(k => k.startsWith('carried:')).length
ok(!!again.piece && again.piece.id !== BOX.id && after?.sapling === SAP && after?.at === at && left === 0, `5. placed again by touch (slot ${slot + 1}): ${again.piece?.id ?? 'none'} holds ${JSON.stringify(after)}, carried left ${left}`)
let c5 = { stage: -1, text: '' } as Awaited<ReturnType<typeof card>>
if (again.piece) { await openBox(again.piece.x, again.piece.z); c5 = await card(); await shot('m113-5-replaced') }
ok(c5.stage === 2, `   its card: the same stage ("${c5.text}")`)
ok(errs.length === 0, `6. 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS: M113 by touch at 390: a bank-only sapling lists + plants in a Planter Box (bank -1), the Mana Seed pointer stays, it grows a stage per game day and a reload keeps it, three melee hits carry it and the box set down again holds the same sapling at the same stage')
process.exit(fails ? 1 : 0)
