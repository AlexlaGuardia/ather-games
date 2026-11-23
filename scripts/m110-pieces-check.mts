// ── M110 s2 THE PWR / GRD / VIG TRAINING PIECES, OWNER-ONLY (2026-11-23, sprites-M110s2) ──────────────────────────────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters, BOTH in the party, no stat record (species bases:
// Vulnyx PWR 54 / GRD 40 / VIG 44, Manalotl PWR 30 / GRD 46 / VIG 54; Base cap 50). Pieces placed through the save, as set
// pieces (the bench recipes are unit-tested, the craft UI is not driven here). Owner cookie + ?spirits=3d, 390x844
// (SwiftShader). The keeper stands by; nothing is clicked. Two phases, each a fresh browser context (its own save):
//   A. the Push Stone (PWR) alone: the Manalotl (PWR 30) shoves at it on her own and her PWR rises; the Vulnyx (PWR 54, past
//      the cap) may play it too and stays 54.
//   B. the Guard Posts (GRD) and the Running Ring (VIG): the Vulnyx plays each on her own; GRD and VIG each rise.
// Every finished play is attributed: the piece she was playing just before her play count rose, and the record's change for
// that one play = +1 to THAT piece's stat and nothing else (or nothing, when that stat is at / past the cap).
// Motion per play (probe): shove = at the stone, braced (lean); guard = braced (crouch), at the gap; laps = at the ring's radius.
//   C. reload keeps the record.   D. 0 page errors.
//   npx tsx scripts/m110-pieces-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { FORM_CAP } from '../src/app/shimmer/open/ather/spirit-stats'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { SPECIES_STATS_V2 } from '../src/app/shimmer/engine/party-stats'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PLANTERS = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 }]
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
type Piece = { id: string; item: string; x: number; z: number }
const PS: Piece = { id: 'ps-check', item: 'push_stone', x: P.x - 3, z: P.z + 4 }
const GP: Piece = { id: 'gp-check', item: 'guard_posts', x: P.x - 3, z: P.z + 4 }
const RR: Piece = { id: 'rr-check', item: 'running_ring', x: P.x + 1.5, z: P.z + 5 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const br: Browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
type Rec = { form: string; g: Record<string, number>; plays: number }
const SP = { 'vx-check': 'fox', 'mx-check': 'axolotl' } as const
const ID_OF = { fox: 'vx-check', axolotl: 'mx-check' } as const

async function phase(tag: string, pieces: Piece[], want: { sp: 'fox' | 'axolotl'; piece: Piece }[], maxS: number) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 200)}`))
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, `${tag} owner cookie took`); return null }
  const all = [...PLANTERS, ...pieces.map(x => ({ ...x, q: 0, placedAt: 1 }))]
  await p.evaluateOnNewDocument((pcs: unknown[], pots: unknown) => {
    if (sessionStorage.getItem('m110p')) return; sessionStorage.setItem('m110p', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: pcs }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
    for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1', 'ather.spiritStats.v1']) localStorage.removeItem(k)
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check', 'mx-check']))
  }, all, POTS(Date.now() - BLOOM_MS - 60000))
  const open = async () => {
    await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
    for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
  }
  const book = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritStats.v1') ?? '{}')) as Promise<Record<string, Rec>>
  await open()
  // watch: per spirit, the piece she is playing (last seen), her play count, motion samples while playing each piece
  type Mo = { n: number; dMin: number; dMax: number; brace: number; yMax: number }
  const st = { fox: { last: '', plays: 0 }, axolotl: { last: '', plays: 0 } }
  const mo: Record<string, Mo> = {}
  const plays: { sp: string; piece: string; delta: Record<string, number> }[] = []
  let prevBook = await book()
  const done = () => want.every(w => plays.some(x => x.sp === w.sp && x.piece === w.piece.id && (x.delta[FURNITURE[w.piece.item].train!] ?? 0) > 0))
  const t0 = Date.now(), firstAt: Record<string, number> = {}
  while (Date.now() - t0 < maxS * 1000 && !done()) {
    const s = await p.evaluate(() => { const t = (window as any).__spiritModel?.trots ?? {}; const o: Record<string, { playing: string | null; plays: number; x: number; z: number; y: number; br: number }> = {}
      for (const sp of ['fox', 'axolotl']) { const q = t[sp]; if (q) o[sp] = { playing: q.playing, plays: q.plays ?? 0, x: q.x, z: q.z, y: q.playYMax ?? 0, br: q.braceMax ?? 0 } }
      return o })
    for (const sp of ['fox', 'axolotl'] as const) { const q = s[sp]; if (!q) continue
      if (q.playing) { st[sp].last = q.playing; const pc = pieces.find(x => x.id === q.playing); if (pc) {
        const key = `${sp}:${pc.id}`, m = (mo[key] ??= { n: 0, dMin: 9, dMax: 0, brace: 0, yMax: 0 }), d = Math.hypot(q.x - pc.x, q.z - pc.z)
        m.n++; m.dMin = Math.min(m.dMin, d); m.dMax = Math.max(m.dMax, d); m.brace = Math.max(m.brace, q.br); m.yMax = Math.max(m.yMax, q.y)
        firstAt[key] ??= (Date.now() - t0) / 1000 } }
      if (q.plays > st[sp].plays) {
        const b = await book(), id = ID_OF[sp], g0 = prevBook[id]?.g ?? {}, g1 = b[id]?.g ?? {}, delta: Record<string, number> = {}
        for (const k of new Set([...Object.keys(g0), ...Object.keys(g1)])) if ((g1[k] ?? 0) !== (g0[k] ?? 0)) delta[k] = (g1[k] ?? 0) - (g0[k] ?? 0)
        // another spirit's play landing in the same poll is folded into her own entry below; this one's change is HER record only
        plays.push({ sp, piece: st[sp].last, delta }); prevBook = { ...prevBook, [id]: b[id] }; st[sp].plays = q.plays
      } }
    await sleep(200)
  }
  // attribution: every finished play changed only its piece's stat, by +1, or nothing (at / past the cap)
  for (const x of plays) {
    const pc = pieces.find(y => y.id === x.piece), stat = pc ? FURNITURE[pc.item].train! : '?', base = SPECIES_STATS_V2[x.sp as 'fox'][stat as 'pwr']
    const keys = Object.keys(x.delta), right = keys.length === 0 ? base >= FORM_CAP.base : keys.length === 1 && keys[0] === stat && x.delta[stat] === 1
    ok(!!pc && right, `${tag} ${x.sp} played ${pc?.item ?? x.piece}: record change ${JSON.stringify(x.delta)} (only ${stat.toUpperCase()}, base ${base})`)
  }
  for (const w of want) {
    const stat = FURNITURE[w.piece.item].train!, key = `${w.sp}:${w.piece.id}`, m = mo[key], b = (await book())[ID_OF[w.sp]]?.g ?? {}
    const name = w.sp === 'fox' ? 'Vulnyx' : 'Manalotl', base = SPECIES_STATS_V2[w.sp][stat]
    ok(plays.some(x => x.sp === w.sp && x.piece === w.piece.id && (x.delta[stat] ?? 0) > 0), `${tag} ${name} plays the ${FURNITURE[w.piece.item].name} unprompted (first at ${firstAt[key]?.toFixed(1)} s) and her ${stat.toUpperCase()} rises ${base} -> ${base + (b[stat] ?? 0)}`)
    const kind = FURNITURE[w.piece.item].play
    if (m) ok(kind === 'shove' ? m.dMax < 1.3 && m.dMin > 0.3 && m.brace > 0.5 && m.yMax < 0.1
      : kind === 'guard' ? m.dMax < 0.8 && m.brace > 0.5 && m.yMax < 0.1
      : kind === 'laps' ? m.dMin > 0.9 && m.dMax < 1.35 && m.yMax < 0.1 : true,
      `${tag} ${name} plays it its own way (${kind}): ${m.n} samples, ${m.dMin.toFixed(2)}..${m.dMax.toFixed(2)} m from it, brace ${m.brace.toFixed(2)}, peak ${m.yMax.toFixed(3)} m`)
    else ok(false, `${tag} ${name}: no motion samples at the ${w.piece.item}`)
  }
  return { p, open, book }
}

const A = await phase('A', [PS], [{ sp: 'axolotl', piece: PS }], 300)
const B = await phase('B', [GP, RR], [{ sp: 'fox', piece: GP }, { sp: 'fox', piece: RR }], 240)
if (B) {   // C. reload keeps it
  const b1 = await B.book(); await B.open(); const b2 = await B.book()
  ok(JSON.stringify(b2['vx-check']?.g) === JSON.stringify(b1['vx-check']?.g) && !!b1['vx-check']?.g.grd && !!b1['vx-check']?.g.vig, `C reload keeps the record ${JSON.stringify(b2['vx-check'])}`)
}
if (A) { const b = (await A.book())['mx-check']; ok(!!b?.g.pwr && Object.keys(b.g).length === 1, `A the Manalotl's record holds PWR only ${JSON.stringify(b)}`) }
ok(errs.length === 0, `D 0 page errors ${errs.join(' | ')}`)
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
