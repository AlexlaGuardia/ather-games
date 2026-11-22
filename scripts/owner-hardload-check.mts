// ── P1 11-22 (sprites): A SIGNED-IN HARD LOAD KEEPS THE KEEPER'S LEVEL ────────────────────────────────────────────────
// Alex's playtest: Forestry L6 read L1 after a morning hard load, and the first prune saved L1 over his account (local +
// cloud). Cause: forestry.ts read its slot at module evaluation, before SaveOwnerBoot named the account (anonymous slot).
// This replays it on prod with a FAKED session (request interception, like beta-m12-cloud: the server refuses the fake
// user's cloud lease with 401, so no real save is read or written). The session answer is HELD 4 s so the page chunk
// evaluates well before the owner is known, which is the order a real hard load takes.
//   1. seed the fake account's slot at Forestry L6 (and an anonymous slot at L1, the trap); hard load /shimmer/open/ather
//   2. go to the Wilds, prune a goldwood: the XP bar must read Lv 6, the account slot must stay L6 with more XP,
//      and the anonymous slot must be untouched
//   3. hard RELOAD, prune a second goldwood: same again (the second load is the one Alex hit)
//   npx tsx scripts/owner-hardload-check.mts [--url https://ather.games] [--out dir]
import { aimAt } from './lib/aim.mts'
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { withGlade, clearing, roadField, SEASON, type Network } from '../src/app/shimmer/open/ather/network'
import { makeVoids } from '../src/app/shimmer/open/ather/wilds-voids'
import { type Zone } from '../src/app/shimmer/open/ather/forestry'
import { NODE_DEFS } from '../src/app/shimmer/world/resources'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
// the trees THE PAGE stands: its path clearing, roads and M41 cloud voids (11-22 sweep: the raw tile put g1's stand spot on a
// void lip, weight 0.59 >= FALL_W, so the keeper fell home before it could aim, and g2 no longer exists once voids carve)
const NW = withGlade(JSON.parse(readFileSync(D + `network-s${SEASON}.json`, 'utf8')) as Network), VOIDS = makeVoids(idx, NW)
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows', clearing(NW), true, roadField(NW), VOIDS)
// two lone goldwoods with a clear line on their east side (forestry-check's rule)
const lone = W.trees.filter(t => t.kind === 'goldwood' && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400 && VOIDS.weight(t.x + 6, t.z) === 0 && VOIDS.weight(t.x, t.z) === 0)   // stand (6 m east) + tree on whole ground
const [g1, g2] = lone
const XP = NODE_DEFS.goldwood.xp
const USER = 'owner-hardload-check', SK = `u:${USER}:open.skills.v1`, LEVEL = 6
const res: Record<string, unknown> = { g1: g1?.id, g2: g2?.id }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors: string[] = [], cloud: string[] = []
const ctx = await br.createBrowserContext()
const p: Page = await ctx.newPage(); await p.setViewport({ width: 1100, height: 680 })
p.on('pageerror', e => errors.push(String(e).slice(0, 160)))
p.on('response', r => { if (r.url().includes('/api/saves')) cloud.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`) })
await p.setRequestInterception(true)
p.on('request', r => {
  if (!r.url().includes('/api/auth/session')) { void r.continue(); return }
  setTimeout(() => void r.respond({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ session: { user_id: USER, username: 'hardload', character_id: null, avatar: null } }) }), 4000)
})
await p.evaluateOnNewDocument('window.__name = (f) => f')   // tsx wraps the seed's inner arrow in __name(), absent in the page
// seed ONCE per tab (a sessionStorage flag), so the reload in step 3 keeps whatever the game saved
await p.evaluateOnNewDocument((sk: string, user: string, lvl: number) => {
  if (sessionStorage.getItem('hardload-seeded')) return
  sessionStorage.setItem('hardload-seeded', '1')
  localStorage.clear()
  const set = (lv: number) => JSON.stringify([{ id: 'farming', level: 1, xp: 0 }, { id: 'forestry', level: lv, xp: 0 }, { id: 'prospecting', level: 1, xp: 0 },
    { id: 'rinning', level: 1, xp: 0 }, { id: 'alchemy', level: 1, xp: 0 }, { id: 'mana', level: 1, xp: 0 }])
  localStorage.setItem(`u:${user}:ather:shimmer:birthRune`, 'star')
  localStorage.setItem(sk, set(lvl))
  localStorage.setItem('open.skills.v1', set(1))                                    // the trap: the anonymous slot at L1
}, SK, USER, LEVEL)
const slot = (k: string) => p.evaluate((key: string) => { const a = JSON.parse(localStorage.getItem(key) ?? '[]'); return a.find((s: { id: string }) => s.id === 'forestry') ?? null }, k) as Promise<{ level: number; xp: number } | null>
const barLevel = (timeout = 180000) => p.waitForFunction(() => { const e = document.querySelector('[data-hud=xp-bar]') as HTMLElement | null; return e?.dataset.shown === '1' && e.dataset.skill === 'forestry' ? e.dataset.level : false },
  { timeout, polling: 'mutation' }).then(h => h.jsonValue() as Promise<string>)
const frame = async (name = '_frame') => { try { await p.screenshot({ path: `${out}/${name}.png` }) } catch { /* slow frame */ } }
const toWilds = async () => {
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000, polling: 1000 })
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
    await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {})
  }
  if ((await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds') throw new Error('never reached the Wilds')
  await sleep(4000)
}
const pruneAt = async (t: { x: number; z: number; id: string }) => {
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + 6, t.z)
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.aim())) !== t.id; i++) { await aimAt(p, t.x, t.z, 0.7); await frame(); await sleep(500) }
  if ((await p.evaluate(() => (window as any).__ather.aim())) !== t.id) throw new Error(`never aimed ${t.id}`)
  await p.evaluate(() => (window as any).__ather.prune())
}

let pass = false
try {
  // ── 1 + 2: first hard load, a prune ────────────────────────────────────────────────────────────────────────────
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await toWilds()
  res.slot0 = await slot(SK)
  let lv = barLevel(); await pruneAt(g1); res.bar1 = await lv; await frame('hardload-1')
  await sleep(1500)
  res.slot1 = await slot(SK); res.anon1 = await slot('open.skills.v1')
  // ── 3: hard reload (seed skipped), a second prune ──────────────────────────────────────────────────────────────
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await toWilds()
  lv = barLevel(); await pruneAt(g2); res.bar2 = await lv; await frame('hardload-2')
  await sleep(1500)
  res.slot2 = await slot(SK); res.anon2 = await slot('open.skills.v1')
  const s0 = res.slot0 as { level: number; xp: number }, s1 = res.slot1 as { level: number; xp: number }, s2 = res.slot2 as { level: number; xp: number }
  const a1 = res.anon1 as { level: number; xp: number }, a2 = res.anon2 as { level: number; xp: number }
  pass = s0?.level === LEVEL
    && res.bar1 === String(LEVEL) && s1?.level === LEVEL && s1.xp >= XP
    && res.bar2 === String(LEVEL) && s2?.level === LEVEL && s2.xp >= s1.xp + XP
    && a1?.level === 1 && a1.xp === 0 && a2?.level === 1 && a2.xp === 0
    && cloud.every(c => / 40[13]$/.test(c))   // the fake user never reached a real cloud save
    && errors.length === 0
} catch (e) { res.error = String(e).slice(0, 300) }
res.cloud = [...new Set(cloud)]; res.errors = errors
console.log(JSON.stringify(res, null, 1))
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
