// ── M45: THE HOTBAR IN HAND (2026-11-20, play / Jin 73581496) ─────────────────────────────────────────────────────
// Alex 11-20: "i should be able to see the item in the right hand and E to place or use that item .. the planning table
// took the placing of furniture". Plays: 1 equips two Goldwood Stools → a ghost stands ahead → an E tap sets one (bag -1) →
// an E HOLD turns the ghost (two quarters) → the tap sets the second at q=2 → the hand empties to stowed. The planning table
// has no Furnish / Found-Keepstone rows. 2 equips a Violet Keepstone → E sets it. 3 equips a Starlight Tincture → E drinks.
// Then a PHONE leg (390x844, touch): 1 equips a stool, the placing bar's Place sets it.
// SETUP (stated): the bag holds 2 stools, 1 Violet Keepstone, 1 tincture, an empty works. Hooks: tp + reading only.
//   npx tsx scripts/m45-hand-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE } from '../src/app/shimmer/open/ather/rooms'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m45hand')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
async function open(touch: boolean): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('m45')) return; sessionStorage.setItem('m45', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null)
    slots[0] = { id: 'goldwood_stool', n: 2 }; slots[1] = { id: 'keepstone_violet', n: 1 }; slots[2] = { id: 'starlight_tincture', n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] })); localStorage.removeItem('open.bank.v1')
  })
  await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
  return p
}
const res: Record<string, unknown> = { url }
let p = await open(false)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const works = async () => (await read('open.works.v1')) as { pieces: { item: string; q: number }[]; chests: { item?: string }[] }
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play') || d.textContent?.includes('Tap to start')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f') }
const held = () => p.evaluate(() => (window as any).__held?.() ?? null)
const placing = () => p.evaluate(() => document.querySelector('[data-placing]')?.getAttribute('data-placing') ?? null)
const pollUntil = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(250) } return false }

// 1. two stools in hand: tap sets one, hold turns, tap sets the second at q=2
await tp(-130, 102.5, 0)
await p.keyboard.press('Digit1'); await sleep(900)
res.held1 = await held(); res.ghost1 = await placing(); await shot('m45-1-stool-in-hand')
await p.keyboard.press('e')
res.set1 = await pollUntil(async () => (await works()).pieces.length === 1, 8000)
res.bagAfter1 = (await bag()).goldwood_stool ?? 0
await tp(-127, 102.5, 0)
await p.keyboard.down('e'); await sleep(900); await p.keyboard.up('e'); await sleep(400)   // a hold turns a quarter each 350 ms (a slow box may fire once)
res.piecesAfterHold = (await works()).pieces.length   // a hold must NOT place
await p.keyboard.press('e')
res.set2 = await pollUntil(async () => (await works()).pieces.length === 2, 8000)
res.q2 = (await works()).pieces[1]?.q
await sleep(800); res.handAfter = await held(); res.ghostAfter = await placing(); await shot('m45-2-two-stools')
// 2. the planning table (empty hand): no Furnish, no Found Keepstones
await tp(TABLE.x + 1.6, TABLE.z + 1.6, Math.PI / 4)
await p.keyboard.press('e'); await sleep(1000)
res.table = await p.evaluate(() => ({ open: !!document.querySelector('[data-panel="planning-table"]'), furnish: !!document.querySelector('[data-furnish]'), found: !!document.querySelector('[data-found-keepstones]') }))
await shot('m45-3-table'); await p.keyboard.press('Escape'); await sleep(600)
// 3. the Violet Keepstone from the hand
await tp(-130, 102.5, Math.PI)   // face south, away from the two stools
await p.keyboard.press('Digit2'); await sleep(900)
res.held2 = await held(); res.ghost2 = await placing(); await shot('m45-4-keepstone-in-hand')
await p.keyboard.press('e')
res.chest = await pollUntil(async () => (await works()).chests.length === 1 && !(await bag()).keepstone_violet, 8000)
res.chestWhy = await p.evaluate(() => [...document.querySelectorAll('div')].map(d => d.textContent ?? '').filter(t => /Keepstone|Build on|Leave room|wall|doorway|bench/.test(t) && t.length < 120).slice(-3)); await shot('m45-4b-keepstone-after-e')
// 4. the tincture: E drinks
await p.keyboard.press('Digit3'); await sleep(900)
res.held3 = await held(); await shot('m45-5-tincture-in-hand')
await p.keyboard.press('e')
res.drank = await pollUntil(async () => !(await bag()).starlight_tincture, 6000)
await p.close()
// 5. PHONE: equip by the hotbar key path, Place on the bar
p = await open(true)
await tp(-130, 102.5, 0)
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' })))
await sleep(900)
res.phoneGhost = await placing()
res.phoneBar = await p.evaluate(() => [...document.querySelectorAll('[data-placing] button')].map(b => b.textContent))
await shot('m45-6-phone-ghost')
const pb = await p.evaluate(() => { const e = document.querySelector<HTMLElement>('[data-placing] [data-act="place"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
if (pb) await p.touchscreen.tap(pb.x, pb.y)
res.phoneSet = await pollUntil(async () => (await works()).pieces.length === 1, 8000)
await shot('m45-7-phone-set')
res.errs = errs
console.log(JSON.stringify(res))
const h1 = res.held1 as { use?: string } | null, h2 = res.held2 as { use?: string } | null, h3 = res.held3 as { use?: string } | null, t = res.table as { open: boolean; furnish: boolean; found: boolean }
const pass = h1?.use === 'place-piece' && res.ghost1 === 'piece' && res.set1 === true && res.bagAfter1 === 1
  && res.piecesAfterHold === 1 && res.set2 === true && (res.q2 as number) >= 1 && (res.handAfter as { id: unknown } | null)?.id == null && res.ghostAfter === null
  && t.open && !t.furnish && !t.found && h2?.use === 'place-chest' && res.ghost2 === 'chest' && res.chest === true
  && h3?.use === 'drink' && res.drank === true && res.phoneGhost === 'piece' && res.phoneSet === true && errs.length === 0
console.log(pass ? 'PASS: stool in hand → E sets (bag -1) → E hold turns → empties to stowed · table has no furniture · Keepstone from hand · E drinks · phone Place sets' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
