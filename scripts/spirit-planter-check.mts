// ── M76 SPIRIT PLANTER + GRIMOIRE PEDESTAL + THE ANEMONYX, PLAYED (2026-11-22, Jin play 3c848123) ─────────────────
// SETUP (stated): a Spirit Planter at (-130, 102.5) and a Grimoire Pedestal at (-126, 102.5) already stand on open ground
// (seeded in open.works.v1; crafting them is the bench's ordinary PIECE_JOBS path, proven by spirit-seeds.test + bench-tabs);
// the bag holds one Mana Seed (owl) because seeds are an event, and the book's start day is set so TODAY is an Anemonyx
// visit day. Hooks: movement + reading only.
//  1. E at the planter: its panel (not the plain piece card), plant the seed: bag -1, the pot saved.
//  2. the pot's planting time is moved back past BLOOM_MS in the save + reload (a bloom takes 16 real min): E at the planter
//     shows the BLOOMED species, and the book holds page 1 = that species, SEEN.
//  3. E at the pedestal: the grimoire panel; its page 1 + count == the save.  4. Pick up on the planter refuses (a spirit lives there).
//  5. the Anemonyx: the prompt 'E · the Anemonyx' at the Green's west edge; E = one Mana Seed in the bag, visit marked met;
//     a second E gives nothing.  6. phone 390x844: the grimoire panel fits.
//   npx tsx scripts/spirit-planter-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { BLOOM_MS, visitOn } from '../src/app/shimmer/open/ather/spirit-seeds'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
import { GATE } from '../src/app/shimmer/open/ather/plot'
import { MIDDLE_HALF } from '../src/app/shimmer/open/ather/cluster'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/spirit-planter')
mkdirSync(out, { recursive: true })
const ANEMONYX = { x: GATE.x - MIDDLE_HALF - 8, z: GATE.z, r: 6 }   // anemonyx-view.tsx › ANEMONYX (a .tsx with three imports)
const PLANTER = { id: 'sp-check', item: 'spirit_planter', x: -130, z: 102.5, q: 0, placedAt: 1 }
const PEDESTAL = { id: 'gp-check', item: 'grimoire_pedestal', x: -126, z: 102.5, q: 0, placedAt: 1 }
// a book start day that makes today a visit day (anonymous keeper: salt = 'anemonyx:<since>')
const today = Math.floor(Date.now() / GAME_DAY_MS)
let since = -1
for (let s = today - 5; s > today - 400; s--) if (visitOn(`anemonyx:${s}`, today - s) !== null) { since = s; break }
const KEY = 'ather.grimoire.v1'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((pieces: unknown[], key: string, since: number) => {
  if (sessionStorage.getItem('spc')) return; sessionStorage.setItem('spc', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }; slots[8] = { id: 'mana_seed_owl', n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
  localStorage.setItem(key, JSON.stringify({ v: 1, pages: [], pots: {}, met: [], since }))
}, [PLANTER, PEDESTAL], KEY, since)
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
const seeds = (b: Record<string, number>) => Object.entries(b).filter(([k]) => k.startsWith('mana_seed_')).reduce((a, [, n]) => a + n, 0)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f'); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const closeAll = async () => { await p.keyboard.press('Escape'); await sleep(500) }
const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500) }
const eAt = async (x: number, z: number, ty: number) => { await tp(x, z + 1.3, 0); await aimAt(p, x, z, ty); await p.keyboard.press('e'); await sleep(900) }
const res: Record<string, unknown> = { url, since }
await boot()
// 1. plant
await eAt(PLANTER.x, PLANTER.z, 0.4)
res.planterPanel = await p.evaluate(() => !!document.querySelector('[data-panel="planter"]'))
res.plainCard = await p.evaluate(() => !!document.querySelector('[data-panel="piece"]'))
await shot('sp-1-empty')
res.planted = await click('[data-act="plant-seed"][data-seed="mana_seed_owl"]'); await sleep(600)
res.growing = await p.evaluate(() => !!document.querySelector('[data-planter="growing"]'))
res.afterPlant = { seeds: seeds(await bag()), pot: (await read(KEY))?.pots?.[PLANTER.id] ?? null }
await shot('sp-2-growing'); await closeAll()
// 2. move the planting back past the bloom time, reload
await p.evaluate((key: string, id: string, back: number) => { const b = JSON.parse(localStorage.getItem(key)!); b.pots[id].at -= back; localStorage.setItem(key, JSON.stringify(b)) }, KEY, PLANTER.id, BLOOM_MS + 1000)
await boot()
await eAt(PLANTER.x, PLANTER.z, 0.4)
res.bloomed = await p.evaluate(() => document.querySelector('[data-planter="bloomed"]')?.getAttribute('data-species') ?? null)
res.bookAfterBloom = (await read(KEY))?.pages ?? null
await shot('sp-3-bloomed')
// 4. pick up refuses
res.pickup = await click('[data-act="pickup-piece"] button'); await sleep(600)
res.piecesAfterPickup = ((await read('open.works.v1'))?.pieces ?? []).length
await closeAll()
// 3. pedestal
await eAt(PEDESTAL.x, PEDESTAL.z, 0.9)
res.grimoire = await p.evaluate(() => ({ open: !!document.querySelector('[data-panel="grimoire"]'), count: document.querySelector('[data-grimoire-count]')?.getAttribute('data-grimoire-count'), p1: document.querySelector('[data-page="1"]')?.getAttribute('data-species'), s1: document.querySelector('[data-page="1"]')?.getAttribute('data-stage'), p2: document.querySelector('[data-page="2"]')?.getAttribute('data-stage'), slots: document.querySelectorAll('[data-page]').length }))
await click('[data-page="1"]'); await sleep(500)
res.pageOpen = await p.evaluate(() => !!document.querySelector('[data-page-open="1"]'))
await shot('sp-4-grimoire'); await closeAll()
// 5. the Anemonyx (stand on the Green's west edge, face her)
const seedsBefore = seeds(await bag())
await tp(ANEMONYX.x + ANEMONYX.r + 3, ANEMONYX.z, Math.PI / 2)
await p.evaluate((x: number, z: number) => { const g = (window as any).__ather, s = g.state(); g.look(Math.atan2(-(x - (s.px ?? s.x)), -(z - (s.pz ?? s.z))), 0.25) }, ANEMONYX.x, ANEMONYX.z)
await p.evaluate(`new Promise(r => { let k = 10; (function tick() { if (--k <= 0) r(0); else requestAnimationFrame(tick) })() })`)
res.prompt = await p.evaluate(() => document.body.innerText.includes('E · the Anemonyx'))
await shot('sp-5-anemonyx')
await p.keyboard.press('e'); await sleep(900)
res.afterMeet = { seeds: seeds(await bag()), met: (await read(KEY))?.met ?? null }
await p.keyboard.press('e'); await sleep(900)
res.afterSecond = seeds(await bag())
res.promptAfter = await p.evaluate(() => document.body.innerText.includes('E · the Anemonyx'))
// 6. phone
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await boot()   // a touch viewport remounts the page: reload into it
await eAt(PEDESTAL.x, PEDESTAL.z, 0.9)
res.phone = await p.evaluate(() => { const e = document.querySelector('[data-panel="grimoire"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth } })
await shot('sp-6-phone')
res.errs = errs
console.log(JSON.stringify(res))
const ap = res.afterPlant as { seeds: number; pot: { seed: string } | null }, bk = res.bookAfterBloom as { species: string; stage: string }[] | null
const g = res.grimoire as { open: boolean; count: string; p1: string; s1: string; p2: string; slots: number }
const m = res.afterMeet as { seeds: number; met: number[] | null }, ph = res.phone as { l: number; r: number; w: number } | null
const checks: Record<string, boolean> = {
  since: since > 0,
  planterPanel: res.planterPanel === true && res.plainCard === false,
  plant: res.planted === true && res.growing === true && ap.seeds === 0 && ap.pot?.seed === 'mana_seed_owl',
  bloom: res.bloomed === 'owl' && !!bk && bk.length === 1 && bk[0].species === 'owl' && bk[0].stage === 'seen',
  pickupRefused: res.piecesAfterPickup === 2,
  grimoire: g.open && g.count === '1' && g.p1 === 'owl' && g.s1 === 'seen' && g.p2 === 'empty' && g.slots === 10 && res.pageOpen === true,
  anemonyx: res.prompt === true && m.seeds === seedsBefore + 1 && (m.met?.length ?? 0) === 1 && res.afterSecond === seedsBefore + 1 && res.promptAfter === false,
  phone: !!ph && ph.l >= 0 && ph.r <= ph.w + 0.5,
  errors: errs.length === 0,
}
const pass = Object.values(checks).every(Boolean)
console.log(JSON.stringify(checks))
console.log(pass ? 'PASS: plant a Mana Seed -> its own species blooms + takes grimoire page 1 (SEEN) == save; pedestal shows it; a spirit-filled planter stays; the Anemonyx gives one seed on her day; phone fits' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
