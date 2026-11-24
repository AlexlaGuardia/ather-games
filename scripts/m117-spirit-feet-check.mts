// ── M117 s1 SPIRITS STEER ROUND PLANTERS + PLACED PIECES (2026-11-24, play-M117s1) ───────────────────────────────────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters, BOTH in the party; a planter box, a hurdle and a
// push stone placed through the save (q 0). The stone is ASSIGNED to the Manalotl, the hurdle to the Vulnyx (M118 s2 gate).
// Owner cookie + ?spirits=3d, 390x844 (SwiftShader). The keeper stands by; nothing is clicked.
//   A. over 2 min, sampled every 100 ms, neither spirit's body centre is ever inside a planter / piece footprint
//      (obstacles.ts centreIn: a planter / decor counts whole, a training piece its posts / stone). Count + closest distance.
//   B. a spirit sent to an allowed training piece still reaches it and plays it (her play count rises), and where she starts
//      the play (the approach point) is outside its footprint.
//   C. 0 page errors.
//   npx tsx scripts/m117-spirit-feet-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { plotFootprints, centreIn, centreClear } from '../src/app/shimmer/open/ather/obstacles'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PIECES = [
  { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 },
  { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 },
  { id: 'bx-check', item: 'planter_box', x: P.x + 1.6, z: P.z + 1.4, q: 0, placedAt: 1 },
  { id: 'hu-check', item: 'goldwood_hurdle', x: P.x + 1.5, z: P.z + 5, q: 0, placedAt: 1 },
  { id: 'ps-check', item: 'push_stone', x: P.x - 3, z: P.z + 4, q: 0, placedAt: 1 },
]
const FEET = plotFootprints(PIECES)
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
const ASSIGN = { 'ps-check': ['mx-check'], 'hu-check': ['vx-check'] }
const ROAM_S = Number(flag('--secs', '120'))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const br: Browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); await br.close(); process.exit(1) }
await p.evaluateOnNewDocument((pcs: unknown[], pots: unknown, asg: unknown) => {
  if (sessionStorage.getItem('m117s1')) return; sessionStorage.setItem('m117s1', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: pcs }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
  for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1', 'ather.spiritStats.v1']) localStorage.removeItem(k)
  localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check', 'mx-check']))
  localStorage.setItem('ather.trainAssign.v1', JSON.stringify(asg))
}, PIECES, POTS(Date.now() - BLOOM_MS - 60000), ASSIGN)
await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }

type S = { x: number; z: number; mode: string; playing: string | null; plays: number }
const st: Record<string, { n: number; inside: number; closest: number; first: string; plays0: number; plays: number; played: Set<string>; approach: { piece: string; clear: number; inPiece: string | null }[]; wasPlaying: string | null; modes: Set<string> }> = {}
const t0 = Date.now()
while (Date.now() - t0 < ROAM_S * 1000) {
  const s = await p.evaluate(() => { const t = (window as any).__spiritModel?.trots ?? {}, o: Record<string, S> = {}
    for (const sp of ['fox', 'axolotl']) { const q = t[sp]; if (q) o[sp] = { x: q.x, z: q.z, mode: q.mode, playing: q.playing, plays: q.plays ?? 0 } }
    return o }) as Record<string, S>
  for (const [sp, q] of Object.entries(s)) {
    const r = (st[sp] ??= { n: 0, inside: 0, closest: Infinity, first: '', plays0: q.plays, plays: q.plays, played: new Set(), approach: [], wasPlaying: null, modes: new Set() })
    r.n++; r.modes.add(q.mode)
    const c = centreIn(FEET, q.x, q.z); if (c) { r.inside++; r.first ||= `${c} at ${q.x.toFixed(2)},${q.z.toFixed(2)} (${q.mode})` }
    r.closest = Math.min(r.closest, centreClear(FEET, q.x, q.z))
    if (q.playing && q.playing !== r.wasPlaying) r.approach.push({ piece: q.playing, clear: centreClear(FEET, q.x, q.z), inPiece: c })
    if (q.playing) r.played.add(q.playing)
    r.wasPlaying = q.playing; r.plays = q.plays
  }
  await sleep(100)
}
const NAME: Record<string, string> = { fox: 'Vulnyx', axolotl: 'Manalotl' }
for (const sp of ['fox', 'axolotl']) {
  const r = st[sp]
  if (!r) { ok(false, `A ${NAME[sp]} was sampled`); continue }
  ok(r.n > ROAM_S * 4 && r.inside === 0, `A ${NAME[sp]}: ${r.n} samples over ${ROAM_S} s, body centre inside a planter / piece ${r.inside}x, closest ${r.closest.toFixed(3)} m ${r.first} (modes ${[...r.modes].join(',')})`)
}
const ax = st.axolotl, fx = st.fox
ok(!!ax && ax.plays > ax.plays0 && ax.played.has('ps-check') && !ax.played.has('hu-check'), `B the Manalotl reaches the stone she is allowed and plays it (${ax?.plays0} -> ${ax?.plays} plays; played ${[...(ax?.played ?? [])].join(',')})`)
const app = [...(ax?.approach ?? []), ...(fx?.approach ?? [])]
ok(app.length > 0 && app.every(a => a.inPiece === null), `B every play starts outside its piece: ${app.map(a => `${a.piece} ${a.clear.toFixed(2)} m`).join('; ')}`)
console.log(`   (Vulnyx: ${fx?.plays0} -> ${fx?.plays} plays at ${[...(fx?.played ?? [])].join(',') || 'none'})`)
ok(errs.length === 0, `C 0 page errors ${errs.join(' | ')}`)
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
