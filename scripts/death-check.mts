// ── DEATH THAT COSTS SOMETHING, AND COMES BACK WHOLE, PLAYED (BETA M20, play / Jin 4 ccb58127, 11-18) ─────────────────
// Alex 11-18: let the Hollows bring him down and 'spawned in the home plot with 2 hp'. In the real page:
//   1. fall in the Wilds (hook __ather.fall = the 'down' event the fight sends) -> home on the plot, HUD hp = full (not the
//      last hp of the fight: the bug was the HUD going stale, the combat layer stops talking off the Wilds)
//   2. a pack stands where they fell holding the whole bag; the keeper carries nothing (save + store agree)
//   3. RELOAD with a nearly FULL bag (31 slots taken): walk onto the pack -> what fits comes back, the REST stays in the pack
//      (the pack is still there after, never silently lost) - hub's add 11-18
//   4. RELOAD with an empty bag: walk onto it -> everything back, the pack gone
//   5. fall again, age the pack past 5 min in the save (the clock hook), reload, walk onto the spot -> nothing given, gone
//   6. 0 page errors
// HOME (M71 s1, page.tsx goHome): a keeper whose garden Greg has FOLDED falls home to the plot; one who has no garden yet falls
//   home to the Glade, by design. This check's keeper is FOLDED (a tutorial save written at setup) and must reach the PLOT.
//   --unfolded: a newborn instead; step 1 must read the GLADE (never the plot), full health, then the check ends.
// SETUP (stated): born keeper (birthRune); the bag + pack written to localStorage between reloads (anon keeper = bare keys).
// Hooks: __ather.fall / hp / zone / tp / aim / pack, reading + movement only.
//   npx tsx scripts/death-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { PACK_KEY, PACK_LIFE_MS, type Pack } from '../src/app/shimmer/open/ather/backpack'
import { INV_KEY, SLOTS } from '../src/app/shimmer/open/shared/inventory'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
type Stack = { id: string; n: number } | null
const total = (s: Stack[]) => s.reduce((a, x) => a + (x?.n ?? 0), 0)
const bagOf = (items: [string, number][]) => { const slots: Stack[] = Array(SLOTS).fill(null); items.forEach(([id, n], i) => { slots[i] = { id, n } }); return { v: 1, slots, gifts: ['bait1', 'kael_invite'] } }   // M73: the note already handed, so the totals stay the bag's
const START: [string, number][] = [['waymark', 12], ['bait', 10], ['goldwood_log', 7]]   // 29 things

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const zone = () => p.evaluate(() => (window as any).__ather?.zone?.() ?? null) as Promise<string | null>
const store = (k: string) => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), k)
const put = (k: string, v: unknown) => p.evaluate((k, v) => { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) }, k, v)
async function intoWilds() {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await zone()) === 'wilds', 240000), 'in the Wilds')
  await poll(async () => p.evaluate(() => typeof (window as any).__ather?.fall === 'function' && typeof (window as any).__ather?.pack === 'function' && typeof (window as any).__ather?.tp === 'function'))
  await sleep(3000); await p.mouse.click(400, 250); await sleep(800)
}
const at = () => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px as number, z: s.pz as number } })
async function walkTo(x: number, z: number) {
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z), x, z)
  await poll(async () => { const q = await at(); return Math.hypot(q.x - x, q.z - z) < 0.5 }, 30000)
}

// ── 1 + 2: fall ──
await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'domcontentloaded', timeout: 240000 })
const unfolded = process.argv.includes('--unfolded'), HOME = unfolded ? 'glade' : 'plot'
// the legacy tutorial save (glade-tutorial.ts legacyTut: First Steps done, garden folded); --unfolded leaves a newborn's (none)
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
await p.evaluate((ik, pk, bag, tut) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem(ik, JSON.stringify(bag)); localStorage.removeItem(pk); if (tut) localStorage.setItem('open.tutorial.v1', JSON.stringify(tut)); else localStorage.removeItem('open.tutorial.v1') }, INV_KEY, PACK_KEY, bagOf(START), unfolded ? null : TUT)
await intoWilds()
const a0 = await at(), spot = { x: a0.x + 24, z: a0.z - 18 }
await walkTo(spot.x, spot.z)
const fell = await at()
// Alex's case: hurt to 2 first, and wait until the HUD says 2 (else a full-hp HUD would pass step 1 with the bug in)
await p.evaluate(() => { (window as any).__ather.combat().keeper.hp = 2; (window as any).__ather.combat().keeper.sinceHurt = 0 })
ok(await poll(async () => (await p.evaluate(() => (window as any).__ather.hp())) <= 2, 15000), '0. the HUD shows the keeper at 2 hp before the fall')
await p.evaluate(() => (window as any).__ather.fall())
{ const left = await poll(async () => { const z = await zone(); return z === 'plot' || z === 'glade' }, 30000), z = await zone()
  ok(left && z === HOME, `1. a fall sends the ${unfolded ? 'newborn (no garden yet) home to the Glade' : 'folded keeper home to the plot'} (it reads '${z}')`) }
ok(await poll(async () => (await p.evaluate(() => (window as any).__ather.hp())) === 100, 15000), `1. ...at FULL health on the HUD (${await p.evaluate(() => (window as any).__ather.hp())})`)
if (unfolded) { ok(errs.length === 0, `0 page errors ${errs.slice(0, 2).join(' | ')}`); await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS (--unfolded: step 1 only)'); process.exit(fails ? 1 : 0) }
const pk = await p.evaluate(() => (window as any).__ather.pack()) as Pack | null
ok(!!pk && total(pk.items) === 29 && Math.hypot(pk.x - fell.x, pk.z - fell.z) < 1.5, `2. a pack lies where they fell holding the whole bag (${pk ? total(pk.items) : 'none'} things, ${pk ? Math.hypot(pk.x - fell.x, pk.z - fell.z).toFixed(2) : '-'} m off)`)
const saved = await store(PACK_KEY) as Pack | null, inv0 = await store(INV_KEY) as { slots: Stack[] }
ok(!!saved && total(saved.items) === 29 && total(inv0.slots) === 0, `2. saved per keeper: pack ${saved ? total(saved.items) : '-'}, bag ${total(inv0.slots)}`)

// ── 3: nearly full bag, partial take ──
const crowd = bagOf(Array.from({ length: SLOTS - 1 }, (_, i) => [`death_check_filler_${i}`, 1] as [string, number]))
await put(INV_KEY, crowd)
await intoWilds()
ok(!!(await p.evaluate(() => (window as any).__ather.pack())), '3. a reload keeps the pack')
await walkTo(pk!.x, pk!.z)
const partial = await poll(async () => { const q = await p.evaluate(() => (window as any).__ather.pack()) as Pack | null; return !!q && total(q.items) < 29 }, 20000)
const left = await p.evaluate(() => (window as any).__ather.pack()) as Pack | null, inv1 = await store(INV_KEY) as { slots: Stack[] }
const took = total(inv1.slots) - (SLOTS - 1)
ok(partial && !!left && took > 0 && took + total(left.items) === 29 && inv1.slots.every(s => s), `3. full bag: took ${took}, the pack still holds ${left ? total(left.items) : 0} (nothing lost: ${took + (left ? total(left.items) : 0)} = 29)`)
ok(!!(await store(PACK_KEY)), '3. ...and the pack is still saved')

// ── 4: empty bag, the rest comes back ──
await put(INV_KEY, bagOf(START.filter(() => false)))
await intoWilds()
await walkTo(pk!.x, pk!.z)
ok(await poll(async () => (await p.evaluate(() => (window as any).__ather.pack())) === null, 20000), '4. walking onto it empties the pack')
const inv2 = await store(INV_KEY) as { slots: Stack[] }
ok(total(inv2.slots) === total(left?.items ?? []) && (await store(PACK_KEY)) === null, `4. ...into the bag (${total(inv2.slots)} back) and the save forgets it`)

// ── 5: too late ──
await put(INV_KEY, bagOf(START))
await intoWilds()
const b0 = await at(), spot2 = { x: b0.x - 20, z: b0.z - 22 }
await walkTo(spot2.x, spot2.z)
await p.evaluate(() => (window as any).__ather.fall())
await poll(async () => (await zone()) === 'plot', 30000)
const pk2 = await store(PACK_KEY) as Pack
ok(!!pk2 && total(pk2.items) === 29, '5. a second fall leaves a fresh pack')
await put(PACK_KEY, { ...pk2, at: Date.now() - PACK_LIFE_MS - 60_000 })   // the clock hook: it has lain there 6 minutes
await intoWilds()
await walkTo(pk2.x, pk2.z); await sleep(3000)
const inv3 = await store(INV_KEY) as { slots: Stack[] }
ok((await p.evaluate(() => (window as any).__ather.pack())) === null && total(inv3.slots) === 0, `5. past 5 minutes it is gone: nothing given (${total(inv3.slots)}), no pack`)

ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `death-check: ${fails} FAIL` : 'death-check: PASS')
process.exit(fails ? 1 : 0)
