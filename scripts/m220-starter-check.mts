// ── M220: THE FIRST KEEPSTONE, PUNCHED + MOVED (2026-11-27, play / play-M220) ─────────────────────────────────────
// Alex 11-26: "look at the first keepstone the player gets to make sure it can be melee punched and picked up, incase the player
// wants to move it". HUB CALL: a punch LANDS (counts, wobbles) but never knocks the starter into the bag; its card's Pick up goes
// straight to placing it; Cancel leaves it where it stood; Place moves it; the save keeps the spot; the bank is untouched.
// PHONE 390x844 (touch), a FRESH test keeper (own browser context; never Alex's save). SETUP (stated): bag holds a repeater + 40
// logs; the bank holds 12 blankstone; no works. Hooks: tp/look for MOVEMENT, __melee.target/hits + localStorage for READING. Every
// punch is the real 'hit' button tap, every E a key press, every Pick up / Cancel / Place a real tap on the button.
//   npx tsx scripts/m220-starter-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { STARTER_CHEST } from '../src/app/shimmer/open/ather/rooms'
import { CHEST_SLOTS } from '../src/app/shimmer/open/ather/garden-bank'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m220-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m220')) return; sessionStorage.setItem('m220', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_log', n: 40 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.removeItem('open.works.v1')
  localStorage.setItem('open.bank.v1', JSON.stringify({ v: 1, stacks: [{ id: 'blankstone', n: 12 }] }))
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const starter = async () => ((await read('open.works.v1'))?.starter ?? null) as { x: number; z: number; q: number } | null
const bankJson = async () => JSON.stringify((await read('open.bank.v1'))?.stacks ?? null)
const keepInBag = async () => ((await read('open.inv.v1'))?.slots ?? []).reduce((t: number, s: { id: string; n: number } | null) => t + (s?.id === 'keepstone' ? s.n : 0), 0) as number
const target = () => p.evaluate(() => (window as any).__melee?.target()?.id ?? null)
const hits = () => p.evaluate(() => (window as any).__melee?.hits()?.n ?? 0)
const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.touchscreen.tap(b.x, b.y); return !!b }
const tapText = async (txt: string) => { const b = await p.evaluate(t => { const e = [...document.querySelectorAll<HTMLElement>('button')].find(x => x.textContent?.trim() === t); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, txt); if (b) await p.touchscreen.tap(b.x, b.y); return !!b }
const pollUntil = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(250) } return false }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(2000) }
const panel = () => p.evaluate(() => !!document.querySelector('[data-panel="bank"]'))
const cap = () => p.evaluate(() => Number(document.querySelector('[data-bank-cap]')?.getAttribute('data-bank-cap') ?? -1))
const openBank = async (x: number, z: number) => { await tp(x, z + 1.3, 0); await aimAt(p, x, z, 0.5); await p.keyboard.press('e'); const o = await pollUntil(panel, 5000); await sleep(800); return o }   // the card settles before a tap
const boot = async () => {
  await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function' && !!(window as any).__melee, { timeout: 180000 }); await sleep(2500)
}
await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 }); await boot()
const S = STARTER_CHEST, bank0 = await bankJson()

// 1. PUNCH: facing the starter, the hit button shows; four taps all land (count 1, 2, then held under the break); it stays
await tp(S.x, S.z + 1.6, 0); await aimAt(p, S.x, S.z, 0.6)
ok(await pollUntil(async () => (await target()) === 'starter', 10000), `punch: aiming at the first Keepstone, a swing lands on it (${await target()})`)
ok(await pollUntil(() => p.evaluate(() => !!document.querySelector('[data-touch="hit"]')), 6000), 'punch: the phone hit button shows')
const ns: number[] = []
for (let i = 0; i < 5; i++) { const was = await hits(); await tap('[data-touch="hit"]'); await pollUntil(async () => (await hits()) !== was, 2500); await sleep(500); ns.push(await hits()) }   // a blow lands on the punch's strike key, later than the tap
ok(ns.includes(1) && ns.includes(2) && ns.filter(n => n === 2).length >= 2, `punch: the taps land and the count holds at 2, never the break (counts ${ns.join(',')}; a 0 first = the first touch after load is not a swing, see report)`)
ok((await starter()) === null && (await keepInBag()) === 0 && (await bankJson()) === bank0, 'punch: it still stands where it was, nothing in the bag, bank untouched')
await shot('m220-1-punched')

// 2. CANCEL: E → bank card → Pick up → placing (no keepstone in the bag) → walk off → Cancel: it never moved
ok(await openBank(S.x, S.z), 'card: E at the first Keepstone opens the bank')
const cap0 = await cap(); ok(cap0 === CHEST_SLOTS, `card: cap ${cap0} = one Keepstone (${CHEST_SLOTS})`)
ok(await tap('[data-act="move-keepstone"] button'), 'card: the first Keepstone has a Pick up')
const isPlacing = () => p.evaluate(() => document.querySelector('[data-placing]')?.getAttribute('data-placing') === 'chest')
let pickTaps = 1; if (!(await pollUntil(isPlacing, 3000))) { pickTaps = 2; await tap('[data-act="move-keepstone"] button') }
console.log(`   (Pick up took ${pickTaps} tap(s))`)
const placingNow = await pollUntil(isPlacing, 4000)
ok(placingNow, `pick up: straight into placing it${placingNow ? '' : ' (panel ' + await panel() + ', hud: ' + await p.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n/g, ' | ')) + ')'}`)
ok((await keepInBag()) === 0, 'pick up: it never sits in the bag')
await tp(-100, 111.8, 0); await shot('m220-2-moving')
ok(await tapText('Cancel (Esc)'), 'cancel: tapped Cancel')
await sleep(800)
ok((await starter()) === null && !(await p.evaluate(() => !!document.querySelector('[data-placing]'))), 'cancel: it stays where it stood, placing ends')

// 3. MOVE: E → Pick up → stand so the ghost is ~1.8 m ahead at (-100, 110) → Place
ok(await openBank(S.x, S.z), 'move: the bank opens again at the old spot')
await tap('[data-act="move-keepstone"] button'); if (!(await pollUntil(isPlacing, 3000))) { console.log('   (Pick up took 2 tap(s))'); await tap('[data-act="move-keepstone"] button') }
ok(await pollUntil(isPlacing, 4000), 'move: Pick up goes into placing')
await tp(-100, 111.8, 0); await sleep(1000)
ok(await tap('[data-act="place"]'), 'move: tapped Place')
const sp = await pollUntil(async () => (await starter()) !== null, 4000) ? await starter() : null
ok(!!sp && Math.hypot(sp.x + 100, sp.z - 110) < 1, `move: the save holds the new spot (${JSON.stringify(sp)})`)
ok((await keepInBag()) === 0 && (await bankJson()) === bank0, 'move: nothing in the bag, the bank unchanged')
await shot('m220-3-moved')

// 4. RELOAD: it stands where it was put; its bank opens there with the same cap; a punch still lands there
await p.reload({ waitUntil: 'load', timeout: 180000 }); await boot()
const sp2 = await starter()
ok(!!sp && !!sp2 && sp2.x === sp.x && sp2.z === sp.z, `reload: still at ${JSON.stringify(sp2)}`)
const at = sp2 ?? { x: -100, z: 110 }
ok(await openBank(at.x, at.z), 'reload: E at the new spot opens the bank')
const cap1 = await cap(); ok(cap1 === cap0, `reload: the cap is unchanged (${cap1})`)
ok((await bankJson()) === bank0, `reload: the bank is unchanged (${await bankJson()})`)
await shot('m220-4-reloaded')
await p.keyboard.press('Escape'); await sleep(600)
await tp(at.x, at.z + 1.6, 0); await aimAt(p, at.x, at.z, 0.6)
ok(await pollUntil(async () => (await target()) === 'starter', 8000), 'reload: a swing lands on it at the new spot')
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `m220-starter-check: ${fails} FAIL` : 'm220-starter-check: PASS')
process.exit(fails ? 1 : 0)
