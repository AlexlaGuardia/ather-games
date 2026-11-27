// ── BETA M239 SPIRITS USE THE TRAINING PIECES (2026-11-27, sprites-M239) ────────────────────────────────────────────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters, BOTH in the party; ALL FOUR training pieces placed
// through the save (Goldwood Hurdle AGI, Push Stone PWR, Guard Posts GRD, Running Ring VIG), and the keeper has allowed BOTH
// spirits at every piece (ather.trainAssign.v1: the M118 s2 gate is the keeper's choice, seeded). The Vulnyx's AGI is already
// at the per-stat cap (TRAIN.cap) so the cap is exercised. The keeper stands by; nothing is clicked. Owner + ?spirits=3d.
// Run once at 390x844 and once at 1280x800 (--desktop). Watch up to WATCH s:
//  1. on their own they visit pieces; every piece kind is played by someone (a visible play: mode 'play', at the piece);
//     a shot per kind (docs/looks/m239-2026-11-27/).
//  2. NEVER two spirits on one piece in the same sample.
//  3. every finished play: +1 point to THAT piece's stat (spirit-stats.ts withPlay), except at the cap (AGI stays TRAIN.cap).
//  4. her panel radar reads the record (round(base x (1 + g%))).   5. 0 page errors.
//   npx tsx scripts/m239-training-use-check.mts [--desktop] [--url http://localhost:3210]   (OWNER_KEY from env or .env; on the box)
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { SPECIES_BASE } from '../src/app/shimmer/open/ather/spirit-growth'
import { TRAIN } from '../src/app/shimmer/open/ather/spirit-stats'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), desk = process.argv.includes('--desktop'), WATCH = Number(flag('--watch', '420'))
const VW = desk ? { width: 1280, height: 800 } : { width: 390, height: 844 }, tag = desk ? 'desk' : '390'
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const SHOTS = 'docs/looks/m239-2026-11-27'; mkdirSync(SHOTS, { recursive: true })
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PIECES = [
  { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z },
  { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0 },
  { id: 'hd-check', item: 'goldwood_hurdle', x: P.x - 3, z: P.z + 4 },
  { id: 'ps-check', item: 'push_stone', x: P.x - 4.6, z: P.z + 1.6 },
  { id: 'gp-check', item: 'guard_posts', x: P.x - 1.2, z: P.z + 6.0 },
  { id: 'rr-check', item: 'running_ring', x: P.x + 1.5, z: P.z + 5.2 },
].map(x => ({ ...x, q: 0, placedAt: 1 }))
const TOYS = PIECES.filter(x => FURNITURE[x.item].train).map(x => ({ id: x.id, x: x.x, z: x.z, stat: FURNITURE[x.item].train!, kind: FURNITURE[x.item].play ?? 'leap' }))
const ALL = ['vx-check', 'mx-check'], ASSIGN = Object.fromEntries(TOYS.map(t => [t.id, ALL]))
const SPOF: Record<string, 'fox' | 'axolotl'> = { 'vx-check': 'fox', 'mx-check': 'axolotl' }
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} [${tag}] ${m}`); if (!c) fails++ }
type Rec = { form?: string; g: Record<string, number>; plays: number }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(VW)
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((pieces: unknown[], pots: unknown, asg: unknown, cap: number) => {
    if (sessionStorage.getItem('m239')) return; sessionStorage.setItem('m239', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
    for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1']) localStorage.removeItem(k)
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check', 'mx-check']))
    localStorage.setItem('ather.trainAssign.v1', JSON.stringify(asg))
    localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'vx-check': { form: 'base', g: { agi: cap }, plays: 0 } }))   // AGI at the cap
  }, PIECES, POTS(Date.now() - BLOOM_MS - 60000), ASSIGN, TRAIN.cap)
  const book = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritStats.v1') ?? '{}')) as Promise<Record<string, Rec>>
  await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await dismissStartCard(p)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
  await aimAt(p, P.x - 0.5, P.z + 3.5, 0.3, 6)

  // 1-3. watch
  type S = { x: number; z: number; mode: string; playing: string | null; plays: number }
  const kinds = new Map<string, string>()          // kind -> who played it first
  const visits: Record<string, Set<string>> = { 'vx-check': new Set(), 'mx-check': new Set() }
  const last: Record<string, { playing: string | null; plays: number; rec: Rec | null }> = {}
  let both = 0, notAt = 0, samples = 0, checked = 0, badPlays: string[] = [], capHeld = true
  let b0 = await book()
  const t0 = Date.now()
  while (Date.now() - t0 < WATCH * 1000) {
    const s = await p.evaluate(() => { const t = (window as any).__spiritModel?.trots ?? {}
      const one = (q: any) => q ? { x: q.x, z: q.z, mode: q.mode, playing: q.playing ?? null, plays: q.plays ?? 0 } : null
      return { 'vx-check': one(t.fox), 'mx-check': one(t.axolotl) } }) as Record<string, S | null>
    samples++
    const a = s['vx-check'], b = s['mx-check']
    if (a?.playing && a.playing === b?.playing) both++
    const bk = await book()
    for (const id of ALL) {
      const q = s[id]; if (!q) continue
      if (q.playing) {
        const toy = TOYS.find(t => t.id === q.playing)
        if (toy) {
          visits[id].add(toy.id)
          if (q.mode === 'play') {
            if (Math.hypot(q.x - toy.x, q.z - toy.z) > 2.2) notAt++
            if (!kinds.has(toy.kind)) { kinds.set(toy.kind, SPOF[id]); await p.screenshot({ path: `${SHOTS}/${tag}-${toy.kind}-${SPOF[id]}.png` }) }
          }
        }
      }
      const L = last[id]
      if (L && q.plays > L.plays && L.playing) {   // one play finished: the piece she was on just before
        const toy = TOYS.find(t => t.id === L.playing)!, before = b0[id]?.g ?? {}, after = bk[id]?.g ?? {}
        const d = Object.fromEntries(['pwr', 'grd', 'agi', 'vig'].map(k => [k, (after[k] ?? 0) - (before[k] ?? 0)]))
        const atCap = (before[toy.stat] ?? 0) >= TRAIN.cap
        const want = Object.fromEntries(['pwr', 'grd', 'agi', 'vig'].map(k => [k, k === toy.stat && !atCap ? TRAIN.gain : 0]))
        if (q.plays - L.plays === 1) { checked++; if (JSON.stringify(d) !== JSON.stringify(want)) badPlays.push(`${SPOF[id]}@${toy.kind}: ${JSON.stringify(d)} want ${JSON.stringify(want)}`) }
        if ((after.agi ?? 0) > TRAIN.cap) capHeld = false
      }
      last[id] = { playing: q.playing, plays: q.plays, rec: bk[id] ?? null }
    }
    b0 = bk
    if (kinds.size === 4 && checked >= 4 && Date.now() - t0 > 90000) break
    await sleep(150)
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  ok(visits['vx-check'].size > 0 && visits['mx-check'].size > 0, `1 both go to pieces on their own in ${secs} s: Vulnyx ${[...visits['vx-check']].join(',')} / Manalotl ${[...visits['mx-check']].join(',')}`)
  ok(kinds.size === 4, `1 every piece kind played visibly (mode 'play'): ${[...kinds].map(([k, w]) => `${k} by ${w}`).join(', ')}`)
  ok(notAt === 0, `1 while playing she is at her piece (${notAt} samples off it)`)
  ok(both === 0, `2 never two spirits on one piece (${both} of ${samples} samples)`)
  ok(checked >= 3 && badPlays.length === 0, `3 every finished play = +${TRAIN.gain} to that piece's stat, 0 at the cap (${checked} plays checked) ${badPlays.join(' | ')}`)
  const fin = await book()
  ok(capHeld && (fin['vx-check']?.g.agi ?? 0) === TRAIN.cap, `3 the Vulnyx's AGI stays at the cap ${TRAIN.cap} (${fin['vx-check']?.g.agi}; she may still play the hurdle)`)
  // 4. her panel radar reads the record
  const panelAxes = async (sp: 'fox' | 'axolotl') => {
    for (let k = 0; k < 10; k++) {
      const t = await p.evaluate((s) => { const q = (window as any).__spiritModel?.trots?.[s]; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }, sp) as { x: number; z: number; y: number; h: number } | null
      if (!t) { await sleep(500); continue }
      await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), t.x, t.z + 1.5)
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await p.keyboard.press('e'); await sleep(900)
      const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
      if (!picked) { await p.keyboard.press('Escape'); await sleep(400); continue }
      await sleep(2000)
      const rec = (await book())[sp === 'fox' ? 'vx-check' : 'mx-check']
      const axes = await p.evaluate(() => { const pn = document.querySelector('[data-panel="spirit"]'); if (!pn) return null; const a: Record<string, number> = {}
        for (const x of pn.querySelectorAll('[data-spirit-axis]')) a[x.getAttribute('data-spirit-axis')!] = Number(x.getAttribute('data-spirit-axis-grade')); return a })
      await p.screenshot({ path: `${SHOTS}/${tag}-panel-${sp}.png` })
      await p.keyboard.press('Escape'); await sleep(600)
      return { axes, rec }
    }
    return null
  }
  for (const sp of ['fox', 'axolotl'] as const) {
    const r = await panelAxes(sp), g = r?.rec?.g ?? {}
    const want = Object.fromEntries((['pwr', 'grd', 'agi', 'vig'] as const).map(k => [k, Math.round(SPECIES_BASE[sp][k] * (1 + (g[k] ?? 0) / 100))]))
    ok(!!r?.axes && (['pwr', 'grd', 'agi', 'vig'] as const).every(k => r.axes![k] === want[k]), `4 ${sp} panel radar = the record: ${JSON.stringify(r?.axes)} want ${JSON.stringify(want)} (g ${JSON.stringify(g)})`)
  }
  ok(errs.length === 0, `5 0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
