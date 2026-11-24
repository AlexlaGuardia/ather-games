// ── BETA M122 (1): A BLOOMED SPIRIT PLANTER TAKES THE NEXT MANA SEED (Magii RULED athernyx 756fdbb), PLAYED AT 390x844 ──
// SETUP (stated): an OLD save (pre-M122 grimoire): a Spirit Planter whose spirit (axolotl, the Manalotl) bloomed, its pot at the
// planter's own key, as Alex's save holds it; a fox Mana Seed in the bag. Hooks: movement + reading only.
//  1. E at the bloomed planter: the panel shows her (bloomed card) AND the seed list; plant the fox seed: bag -1, the new
//     seed is saved at '<planter>#2', the spirit's pot is byte-for-byte what it was.
//  2. reload: E shows the seed growing AND the spirit at home; Pick up is still refused (her home stays; pieces unchanged).
//  3. 0 page errors.
//   npx tsx scripts/m122-planter-reuse-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m122-planter')
mkdirSync(out, { recursive: true })
const PLANTER = { id: 'sp-m122', item: 'spirit_planter', x: -130, z: 102.5, q: 0, placedAt: 1 }
const KEY = 'ather.grimoire.v1'
const SPIRIT = { seed: 'mana_seed_axolotl', at: Date.now() - 9 * 86400000, v: 2, tends: [], bloomed: true }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((pieces: unknown[], key: string, spirit: unknown, pid: string) => {
  if (sessionStorage.getItem('m122')) return; sessionStorage.setItem('m122', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[8] = { id: 'mana_seed_fox', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
  localStorage.setItem(key, JSON.stringify({ v: 1, pages: [{ species: 'axolotl', stage: 'seen', at: 1 }], pots: { [pid]: spirit }, met: [] }))
}, [PLANTER], KEY, SPIRIT, PLANTER.id)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const foxes = async () => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(s => s?.id === 'mana_seed_fox').reduce((a, s) => a + s!.n, 0)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const closeAll = async () => { await p.keyboard.press('Escape'); await sleep(500) }
const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500) }
const eAt = async (x: number, z: number, ty: number) => { await tp(x, z + 1.3, 0); await aimAt(p, x, z, ty); await p.keyboard.press('e'); await sleep(900) }
const res: Record<string, unknown> = { url }
await boot()
await eAt(PLANTER.x, PLANTER.z, 0.4)
res.panel = await p.evaluate(() => ({ open: !!document.querySelector('[data-panel="planter"]'), bloomed: document.querySelector('[data-planter="bloomed"]')?.getAttribute('data-species') ?? null, list: [...document.querySelectorAll('[data-act="plant-seed"]')].map(e => e.getAttribute('data-seed')).join() }))
await shot('m122-1-bloomed-offers')
res.planted = await click('[data-act="plant-seed"][data-seed="mana_seed_fox"]'); await sleep(800)
const b1 = await read(KEY)
res.after = { foxes: await foxes(), spirit: b1?.pots?.[PLANTER.id] ?? null, slot2: b1?.pots?.[PLANTER.id + '#2'] ?? null, keys: Object.keys(b1?.pots ?? {}) }
res.growingNow = await p.evaluate(() => !!document.querySelector('[data-planter="growing"]'))
await shot('m122-2-planted'); await closeAll()
await boot()
await eAt(PLANTER.x, PLANTER.z, 0.4)
res.reload = await p.evaluate(() => ({ growing: !!document.querySelector('[data-planter="growing"]'), bloomed: document.querySelector('[data-planter="bloomed"]')?.getAttribute('data-species') ?? null, list: document.querySelectorAll('[data-act="plant-seed"]').length }))
res.pickup = await click('[data-act="pickup-piece"] button'); await sleep(700)
res.piecesAfterPickup = ((await read('open.works.v1'))?.pieces ?? []).length
res.potsAfterPickup = Object.keys((await read(KEY))?.pots ?? {})
await shot('m122-3-reload')
res.errs = errs
console.log(JSON.stringify(res))
const pn = res.panel as any, af = res.after as any, rl = res.reload as any
const checks: Record<string, boolean> = {
  offers: pn.open === true && pn.bloomed === 'axolotl' && pn.list === 'mana_seed_fox',
  plants: res.planted === true && res.growingNow === true && af.foxes === 0 && af.slot2?.seed === 'mana_seed_fox' && JSON.stringify(af.spirit) === JSON.stringify(SPIRIT),
  reload: rl.growing === true && rl.bloomed === 'axolotl' && rl.list === 0,
  liftRefused: res.piecesAfterPickup === 1 && JSON.stringify(res.potsAfterPickup) === JSON.stringify(af.keys),
  errors: errs.length === 0,
}
const pass = Object.values(checks).every(Boolean)
console.log(JSON.stringify(checks))
console.log(pass ? 'PASS: M122 an old-save bloomed planter (the Manalotl\'s) offers the seed list at 390x844 and plants a Mana Seed (bag -1, saved at #2, the spirit byte-for-byte); reload shows both; lift still refused; 0 page errors' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
