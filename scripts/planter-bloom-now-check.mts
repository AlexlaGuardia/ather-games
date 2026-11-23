// Owner dev control (play-bloomff, 11-23): at the Spirit Planter, the owner sees 'Bloom now (owner dev)' + '+1 day'; Bloom now
//   makes the pot due and it blooms through the normal ripen path (panel turns to Bloomed, the grimoire gets the page).
//   A NON-owner keeper sees neither button. Both runs are FRESH anonymous keepers in their own browser contexts (never
//   Alex's account); the owner run gets the ather_owner cookie via /owner?key=. 390 x 844, touch, every input a real tap.
//   OWNER_KEY=... npx tsx scripts/planter-bloom-now-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/planter-bloom-now')
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
mkdirSync(out, { recursive: true })
const W = 390, H = 844, SEED = 'mana_seed_owl'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

async function run(owner: boolean) {
const tag = owner ? 'owner' : 'player'
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((seed: string) => {
  if (sessionStorage.getItem('pbn')) return; sessionStorage.setItem('pbn', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'spirit_planter', n: 1 }; slots[1] = { id: seed, n: 1 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [], pots: {}, met: [] }))
}, SEED)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
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

if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'load', timeout: 120000 })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
const who = await p.evaluate(async () => (await (await fetch('/api/owner', { cache: 'no-store' })).json()).owner).catch(() => null)
ok(who === owner, `[${tag}] /api/owner says owner=${who}`)
await p.touchscreen.tap(W / 2, H - 200); await sleep(600)
await tp(-136, 104, 0)
const pl = await placeBySlot(0, 'spirit_planter')
ok(!!pl.piece, `[${tag}] Spirit Planter placed by touch`)
let planted = false
if (pl.piece) {
  await useAt(pl.piece.x, pl.piece.z, 0.4)
  await poll(async () => p.evaluate(() => !!document.querySelector('[data-panel="planter"]')), 5000)
  await tap(`[data-act="plant-seed"][data-seed="${SEED}"]`)
  planted = await poll(async () => p.evaluate(() => !!document.querySelector('[data-planter="growing"]')), 5000)
}
ok(planted, `[${tag}] seed planted, panel shows Growing`)
await sleep(2500)   // the owner check resolves
const btn = await p.evaluate(() => ({ now: !!document.querySelector('[data-act="planter-bloom-now"]'), day: !!document.querySelector('[data-act="planter-day"]') }))
await shot(`${tag}-1-growing`)
if (!owner) {
  ok(!btn.now && !btn.day, `[player] no Bloom now / +1 day control (${JSON.stringify(btn)})`)
} else {
  ok(btn.now && btn.day, `[owner] Bloom now + +1 day shown (${JSON.stringify(btn)})`)
  const at0 = pl.piece ? (await read('ather.grimoire.v1'))?.pots?.[pl.piece.id]?.at : null
  await tap('[data-act="planter-day"]')
  const at1 = pl.piece ? (await read('ather.grimoire.v1'))?.pots?.[pl.piece.id]?.at : null
  const day = await p.evaluate(() => document.querySelector('[data-panel="planter"]')?.textContent?.match(/Day \d+ of \d+/)?.[0] ?? '')
  ok(typeof at0 === 'number' && typeof at1 === 'number' && at0 - at1 === 64 * 60 * 1000 && day === 'Day 2 of 3', `[owner] +1 day: planted ${at0 && at1 ? (at0 - at1) / 60000 : '?'} min earlier, "${day}"`)
  await tap('[data-act="planter-bloom-now"]')
  const bloomed = await poll(async () => p.evaluate(() => document.querySelector('[data-planter="bloomed"]')?.getAttribute('data-species') === 'owl'), 6000)
  const bk = await read('ather.grimoire.v1'), pot = pl.piece ? bk?.pots?.[pl.piece.id] : null
  await shot('owner-2-bloomed')
  ok(bloomed, '[owner] Bloom now: the panel turns to Bloomed (owl)')
  ok(pot?.bloomed === true && pot?.seed === SEED && (bk?.pages ?? []).some((x: any) => x.species === 'owl'), `[owner] the save: pot bloomed, its own seed, grimoire page owl (pages ${JSON.stringify(bk?.pages)})`)
}
ok(errs.length === 0, `[${tag}] 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
await p.close()
}
await run(false)
await run(true)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS: the owner sees Bloom now / +1 day at a growing Spirit Planter and Bloom now blooms it the normal way; a player sees neither')
process.exit(fails ? 1 : 0)
