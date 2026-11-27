// ── M231: THE FIRST KEEPSTONE POPS LIKE ANY FURNITURE (2026-11-27, play / play-M231) ─────────────────────────────────────
// Alex 11-27: "the keepstone should just pop off like the other furniture does when punched" (reverses M220's 'never pops').
// Punch the first Keepstone three times -> it is in the bag; the bag says where the bank opens; hold it, set it down -> E opens
// the same bank, every stack intact. A FRESH test keeper (own browser context; never Alex's save). SETUP (stated): bag holds a
// repeater + 40 logs; the bank holds 12 blankstone + 30 logs; no works. Phone 390x844: every punch is the real 'hit' button tap.
// Desktop (--desk, 1280x800): every punch is the 'Melee' key the pad's R2 sends (M232 pad.ts › the punch), so the pad path is
// the one proven. Hooks: tp/look for MOVEMENT, __melee.target + localStorage for READING.
//   npx tsx scripts/m231-keepstone-pop-check.mts [--desk] [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { STARTER_CHEST } from '../src/app/shimmer/open/ather/rooms'
import { CHEST_SLOTS } from '../src/app/shimmer/open/ather/garden-bank'
import { MELEE_HITS } from '../src/app/shimmer/open/ather/melee'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const desk = process.argv.includes('--desk'), tag = desk ? 'desk' : '390'
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m231-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} [${tag}] ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m231')) return; sessionStorage.setItem('m231', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_log', n: 40 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.removeItem('open.works.v1')
  localStorage.setItem('open.bank.v1', JSON.stringify({ v: 1, stacks: [{ id: 'blankstone', n: 12 }, { id: 'goldwood_log', n: 30 }] }))
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const works = async () => (await read('open.works.v1')) as { starterOut?: true; starter?: { x: number; z: number; q: number }; chests?: unknown[] } | null
const bankJson = async () => JSON.stringify((await read('open.bank.v1'))?.stacks ?? null)
const invSlots = async () => ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]
const keepInBag = async () => (await invSlots()).reduce((t, s) => t + (s?.id === 'keepstone' ? s.n : 0), 0)
const target = () => p.evaluate(() => (window as any).__melee?.target()?.id ?? null)
const hits = () => p.evaluate(() => (window as any).__melee?.hits()?.n ?? 0)
const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; if (desk) await p.mouse.click(b.x, b.y); else await p.touchscreen.tap(b.x, b.y); return true }
const pollUntil = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(250) } return false }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/m231-${tag}-${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(2000) }
const panel = () => p.evaluate(() => !!document.querySelector('[data-panel="bank"]'))
const cap = () => p.evaluate(() => Number(document.querySelector('[data-bank-cap]')?.getAttribute('data-bank-cap') ?? -1))
const openBank = async (x: number, z: number) => { await tp(x, z + 1.3, 0); await aimAt(p, x, z, 0.5); await p.keyboard.press('e'); const o = await pollUntil(panel, 5000); await sleep(800); return o }
const punch = async () => { if (desk) await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Melee' }))); else await tap('[data-touch="hit"]') }
await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function' && !!(window as any).__melee, { timeout: 180000 }); await sleep(2500)
await dismissStartCard(p)
const S = STARTER_CHEST, bank0 = await bankJson()

// 1. the bank opens at the first Keepstone (the before)
ok(await openBank(S.x, S.z), 'before: E at the first Keepstone opens the bank')
ok((await cap()) === CHEST_SLOTS, `before: cap ${await cap()} = ${CHEST_SLOTS}`)
await p.keyboard.press('Escape'); await sleep(700)

// 2. PUNCH: three blows pop it into the bag
await tp(S.x, S.z + 1.6, 0); await aimAt(p, S.x, S.z, 0.6)
ok(await pollUntil(async () => (await target()) === 'starter', 10000), `punch: aimed at the first Keepstone (${await target()})`)
if (!desk) ok(await pollUntil(() => p.evaluate(() => !!document.querySelector('[data-touch="hit"]')), 6000), 'punch: the phone hit button shows')
const ns: number[] = []   // the three blows go inside MELEE_RESET_MS (4 s): a slow software GPU stretches every probe, so no reads between taps
for (let round = 0; round < 2 && (await keepInBag()) === 0; round++) {
  for (let i = 0; i < MELEE_HITS; i++) { await punch(); await sleep(600) }
  await pollUntil(async () => (await keepInBag()) > 0, 5000); ns.push(await hits())
}
const w1 = await works()
ok((await keepInBag()) === 1, `punch: the Keepstone is in the bag (counts ${ns.join(',')})`)
ok(w1?.starterOut === true, `punch: the save marks it out (${JSON.stringify(w1?.starterOut)})`)
ok((await bankJson()) === bank0, 'punch: the bank is untouched')
ok(await pollUntil(async () => (await target()) !== 'starter', 3000), 'punch: nothing left standing to hit')
await shot('1-popped')

// 3. THE HINT: the bag says where the bank opens
await p.keyboard.press('i')
ok(await pollUntil(() => p.evaluate(() => !!document.querySelector('[data-panel="pack-bag"]')), 5000), 'hint: the bag opens')
const hint = await p.evaluate(() => document.querySelector('[data-bank-door-hint]')?.textContent ?? '')
ok(/Keepstone/.test(hint) && /bank/.test(hint), `hint: the bag footer says it ("${hint}")`)
await shot('2-hint')
await p.keyboard.press('Escape'); await sleep(700)
ok(!(await openBank(S.x, S.z)), 'gone: E at the old spot opens no bank')

// 4. RE-PLACE: hold it from the hotbar, set it down; E opens the same bank, items intact
const at = (await invSlots()).findIndex(s => s?.id === 'keepstone')
ok(at >= 0 && at < 8, `hold: the Keepstone sits on the hotbar (slot ${at})`)
await tp(-100, 111.8, 0); await sleep(500)
await p.keyboard.press(`Digit${at + 1}`)
let placing = await pollUntil(() => p.evaluate(() => document.querySelector('[data-placing]')?.getAttribute('data-placing') === 'chest'), 5000)
if (!placing && !desk) { await tap(`[data-hot="${at}"]`); placing = await pollUntil(() => p.evaluate(() => document.querySelector('[data-placing]')?.getAttribute('data-placing') === 'chest'), 5000) }
ok(placing, 'hold: holding it shows the Keepstone ghost')
ok(await tap('[data-act="place"]'), 'place: tapped Place')
ok(await pollUntil(async () => (await works())?.starterOut !== true, 5000), 'place: the save no longer marks it out')
const w2 = await works(), sp = w2?.starter
ok(!!sp && Math.hypot(sp.x + 100, sp.z - 110) < 1.5 && (w2?.chests ?? []).length === 0, `place: it stands as the first Keepstone at ${JSON.stringify(sp)}`)
ok((await keepInBag()) === 0, 'place: it left the bag')
await shot('3-replaced')
await p.reload({ waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 180000 }); await sleep(2500); await dismissStartCard(p)
const sp2 = (await works())?.starter ?? { x: -100, z: 110 }
ok(await openBank(sp2.x, sp2.z), 'reload: E at the re-placed Keepstone opens the bank')
ok((await cap()) === CHEST_SLOTS, `reload: cap back to ${await cap()}`)
ok((await bankJson()) === bank0, `reload: every stack intact (${await bankJson()})`)
await p.keyboard.press('Escape'); await sleep(700); await p.keyboard.press('i'); await pollUntil(() => p.evaluate(() => !!document.querySelector('[data-panel="pack-bag"]')), 5000)
ok(!(await p.evaluate(() => !!document.querySelector('[data-bank-door-hint]'))), 'reload: with a Keepstone standing the bag shows no hint')
await shot('4-bank')
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `m231-keepstone-pop-check [${tag}]: ${fails} FAIL` : `m231-keepstone-pop-check [${tag}]: PASS`)
process.exit(fails ? 1 : 0)
