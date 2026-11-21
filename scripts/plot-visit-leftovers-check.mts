// BETA M61 leftovers check (plot-visit-leftovers-check): a guest on a mate's plot sees THE HOST'S Moglins at work and THE
// HOST'S beds, and none of its own folk (Fennel) or village.
//   SETUP (stated): two party mates, seeded in localStorage (works / village / farm / rinquest), each validated in node first
//   through the game's own adopt functions. A: a raised Carpentry room 'pv-carp' with its carpenter Moglin 'a-mog' working it,
//   a raised Rinnshop, bed 1 = Goldleaf. B: its OWN Carpentry room with the SAME id 'pv-carp' and its own carpenter 'b-mog' in it
//   (the old leak shape: B's village drawn against A's rooms), its own Rinnshop, the Rinn quest active (= B's Fennel stands at
//   a Rinnshop), bed 1 = Ather Wheat.
//   1. B at home: draws b-mog, its wheat, its Fennel (the seeds work). 2. B visits A (the visit link): draws a-mog only, A's
//   Goldleaf, no Fennel. 3. B home again: its own village, wheat and Fennel back; B's saves untouched. 4. 0 page errors.
//   Hooks READ only: __moglinsDrawn (ids MoglinsAtWork drew), __farm.beds, __ather.fennelAt, __visit, __mp.
//   npx tsx scripts/plot-visit-leftovers-check.mts [--url https://ather.games] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { KEEP_CLEAR, ROOMS } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId } from '../src/app/shimmer/open/ather/plot'
import { adoptVillage } from '../src/app/shimmer/open/ather/moglins'
import { adoptFarm, BEDS } from '../src/app/shimmer/open/ather/farmroom'
import { migrate as adoptQuest, fennelHere } from '../src/app/shimmer/open/ather/rinquest'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'PM' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [18, 16, 14]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const now = Date.now()
const room = (id: string, kind: 'carpentry' | 'rinnshop', dx: number) => ({ id, kind, x: spot!.x + dx, z: spot!.z, q: 0, placedAt: now - 3_600_000, doneAt: now - 3_000_000 })
const WORKS = (rin: string) => ({ v: 1, chests: [], pieces: [], rooms: [room('pv-carp', 'carpentry', -6), room(rin, 'rinnshop', 6)] })
const mog = (id: string, name: string) => ({ id, name, home: 'glade', homeName: 'the Glade', grades: { craft: 2, yield: 2, trade: 2 }, dream: 'to see the sea', profession: 'carpenter', recruitedAt: now - 7_200_000, room: 'pv-carp', acc: 0 })
const VILLAGE = (m: object) => ({ v: 1, moglins: [m], lastTick: now })
const FARM = (crop: string) => ({ v: 1, starter: true, farm: { beds: Array.from({ length: BEDS }, (_, i) => (i === 0 ? { crop, grade: 'D', plantedAt: now - 60_000, watered: false } : null)), charge: 0 } })
const QUEST = { v: 1, state: 'active', step: 0 }
// the seeds go through the game's own adopters first: a seed the game would drop proves nothing
const vA = adoptVillage(VILLAGE(mog('a-mog', 'Ash')), now), vB = adoptVillage(VILLAGE(mog('b-mog', 'Birch')), now)
const fA = adoptFarm(FARM('goldleaf')), fB = adoptFarm(FARM('ather_wheat'))
const seedsOk = vA.moglins[0]?.room === 'pv-carp' && vB.moglins[0]?.id === 'b-mog' && fA.farm.beds[0]?.crop === 'goldleaf' && fB.farm.beds[0]?.crop === 'ather_wheat' && fennelHere(adoptQuest(QUEST))
console.log(`rooms at ${spot.x},${spot.z} (carpentry ${ROOMS.carpentry.w}x${ROOMS.carpentry.d}), party ${CODE}, seeds adopted: ${seedsOk}`)
if (!seedsOk) { console.log('a seed did not survive the game\'s adopt functions'); process.exit(1) }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f)
const drawn = (p: Page) => p.evaluate(() => (window as any).__moglinsDrawn?.() ?? null) as Promise<string[] | null>
const bed0 = async (p: Page) => ((await ev(p, '__farm', 'beds')) as (string | null)[] | undefined)?.[0] ?? null
const fennel = async (p: Page) => !!(await ev(p, '__ather', 'fennelAt'))
const saves = (p: Page) => p.evaluate(() => ['open.works.v1', 'open.village.v1', 'open.farm.v1'].map(k => localStorage.getItem(k)).join('|'))
async function open(tag: string, seed: Record<string, object>, phone = false): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1000, height: 640 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, s: string) => {
    if (sessionStorage.getItem('pmc')) return; sessionStorage.setItem('pmc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c)
    for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, JSON.stringify(v))
  }, CODE, JSON.stringify(seed))
  return p
}
async function load(p: Page, q = '') {
  await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__mp && !!(window as any).__visit && !!(window as any).__farm, { timeout: 240000, polling: 1000 })
  await sleep(2000)
}
const same = (a: string[] | null, b: string[]) => JSON.stringify(a) === JSON.stringify(b)

try {
  const a = await open('A', { 'open.works.v1': WORKS('pv-rin-a'), 'open.village.v1': VILLAGE(mog('a-mog', 'Ash')), 'open.farm.v1': FARM('goldleaf') }); await load(a)
  const idA = (await a.evaluate(() => localStorage.getItem('ather:mp:id')))!
  ok(await poll(async () => (await ev(a, '__mp', 'zone')) === `open:plot:${idA}` && (await ev(a, '__mp', 'status')) === 'live', 120000), `0. A hosts (${await ev(a, '__mp', 'zone')})`)
  ok(await poll(async () => same(await drawn(a), ['a-mog'])), `0. A draws its own carpenter at work (${JSON.stringify(await drawn(a))})`)

  // 1 · B at home: the seeds work
  const b = await open('B', { 'open.works.v1': WORKS('pv-rin-b'), 'open.village.v1': VILLAGE(mog('b-mog', 'Birch')), 'open.farm.v1': FARM('ather_wheat'), 'open.rinquest.v1': QUEST }, PHONE)
  await load(b)
  ok(await poll(async () => same(await drawn(b), ['b-mog']), 30000), `1. B at home draws its own carpenter (${JSON.stringify(await drawn(b))})`)
  ok(await bed0(b) === 'ather_wheat', `1. B's bed 1 = its wheat (${await bed0(b)})`)
  ok(await fennel(b), "1. B's Fennel stands at its Rinnshop (the quest is active)")
  const bSaves = await saves(b)

  // 2 · B visits A
  await load(b, `&visit=${idA}&vn=Ash`)
  ok(await poll(async () => (await ev(b, '__visit', 'hasSnap')) === true, 60000), `2. B is on A's plot with the snapshot (${JSON.stringify(await ev(b, '__visit', 'net'))})`)
  ok(await poll(async () => same(await drawn(b), ['a-mog']), 20000), `2. B draws A's carpenter at A's bench, not its own (${JSON.stringify(await drawn(b))})`)
  ok(await poll(async () => (await bed0(b)) === 'goldleaf', 10000), `2. B sees A's Goldleaf in bed 1 (${await bed0(b)})`)
  ok(!(await fennel(b)), "2. B's Fennel does not stand at A's Rinnshop")
  { const now2 = await saves(b); if (now2 !== bSaves) { const x = bSaves.split('|'), y = now2.split('|'); ['works', 'village', 'farm'].forEach((k, i) => { if (x[i] !== y[i]) console.log(`   [${k} changed]\n     was ${x[i]?.slice(0, 400)}\n     now ${y[i]?.slice(0, 400)}`) }) } }
  ok(await saves(b) === bSaves, "2. B's own saves untouched")

  // 3 · home again
  await b.keyboard.press('KeyH')
  ok(await poll(async () => (await ev(b, '__visit', 'visiting')) === false, 15000), '3. B is home (H)')
  ok(await poll(async () => same(await drawn(b), ['b-mog']), 20000), `3. its own carpenter again (${JSON.stringify(await drawn(b))})`)
  ok(await poll(async () => (await bed0(b)) === 'ather_wheat', 10000) && await poll(() => fennel(b), 10000), '3. its own wheat and its Fennel again')
  ok(await saves(b) === bSaves, "3. B's saves still untouched")
  ok(errs.length === 0, `4. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
