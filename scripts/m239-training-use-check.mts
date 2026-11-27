// ── BETA M239 SPIRITS USE THE TRAINING PIECES (2026-11-27, sprites-M239; M239b once a day + body-sized pieces) ─────────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters, BOTH in the party; ALL FOUR training pieces placed
// through the save (Goldwood Hurdle AGI, Push Stone PWR, Guard Posts GRD, Running Ring VIG). The keeper ALLOWS them first
// (ather.trainAssign.v1, the M118 s2 opt-in gate, seeded): the Vulnyx on the Guard Posts only (her 0.42 m body is the one the
// old sidestep left out), the Manalotl on all four (her piece = a seeded random pick per spirit + game day, training-use.ts
// dailyPiece). Nothing is clicked. Owner + ?spirits=3d. Run once at 390x844 and once at 1280x800 (--desktop). Watch up to WATCH s:
//  1. each spirit goes on her own to TODAY'S piece (the Vulnyx: the Guard Posts) and plays it visibly (mode 'play', at it); shot.
//  2. NEVER two spirits on one piece in the same sample.
//  3. ONE session a game day (Alex 11-27): her play gives +1 to that piece's stat (0 at the cap), the record is stamped with
//     today, and for 60 s after it she plays nothing more (trot plays and record plays stay 1).
//  4. her panel radar reads the record (round(base x (1 + g%))).   5. 0 page errors.
//   npx tsx scripts/m239-training-use-check.mts [--desktop] [--url http://localhost:3210]   (OWNER_KEY from env or .env; on the box)
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { FURNITURE } from '../src/app/shimmer/open/ather/furniture'
import { SPECIES_BASE } from '../src/app/shimmer/open/ather/spirit-growth'
import { TRAIN } from '../src/app/shimmer/open/ather/spirit-stats'
import { dailyPiece } from '../src/app/shimmer/open/ather/training-use'
import { gameDay } from '../src/app/shimmer/open/ather/spirit-seeds'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
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
const ALL = ['vx-check', 'mx-check'], ASSIGN = Object.fromEntries(TOYS.map(t => [t.id, t.id === 'gp-check' ? ALL : ['mx-check']]))
const ALLOWED = (id: string) => TOYS.filter(t => ASSIGN[t.id].includes(id)).map(t => t.id)
const SPOF: Record<string, 'fox' | 'axolotl'> = { 'vx-check': 'fox', 'mx-check': 'axolotl' }
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} [${tag}] ${m}`); if (!c) fails++ }
type Rec = { form?: string; g: Record<string, number>; plays: number; day?: number }
// a game day is 64 min: never let the watch straddle a day boundary (the pick and the session are per day)
{ const left = GAME_DAY_MS - Date.now() % GAME_DAY_MS, need = (WATCH + 180) * 1000; if (left < need) { console.log(`waiting ${(left / 1000 + 5).toFixed(0)} s for the next game day`); await sleep(left + 5000) } }
const DAY = gameDay(Date.now()), TODAY: Record<string, string> = Object.fromEntries(ALL.map(id => [id, dailyPiece(ALLOWED(id), id, DAY)!]))
console.log(`game day ${DAY}: today's pieces Vulnyx ${TODAY['vx-check']} / Manalotl ${TODAY['mx-check']}`)
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
  const visits: Record<string, Set<string>> = { 'vx-check': new Set(), 'mx-check': new Set() }
  const shown: Record<string, boolean> = {}, doneAt: Record<string, number> = {}
  const maxPlays: Record<string, number> = { 'vx-check': 0, 'mx-check': 0 }
  let both = 0, notAt = 0, samples = 0
  const b0 = await book()
  const g0 = Object.fromEntries(ALL.map(id => [id, { ...(b0[id]?.g ?? {}) }])) as Record<string, Record<string, number>>
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
      maxPlays[id] = Math.max(maxPlays[id], q.plays)
      if (q.playing) {
        const toy = TOYS.find(t => t.id === q.playing)
        if (toy) {
          visits[id].add(toy.id)
          if (q.mode === 'play') {
            if (Math.hypot(q.x - toy.x, q.z - toy.z) > 2.2) notAt++
            if (!shown[id]) { shown[id] = true; await p.screenshot({ path: `${SHOTS}/${tag}-${toy.kind}-${SPOF[id]}.png` }) }
          }
        }
      }
      if (doneAt[id] === undefined && (bk[id]?.plays ?? 0) > 0 && bk[id]?.day === DAY) doneAt[id] = Date.now()
    }
    const fin = ALL.every(id => doneAt[id] !== undefined)
    if (fin && Date.now() - Math.max(...ALL.map(id => doneAt[id])) > 60000) break
    await sleep(150)
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0), fin = await book()
  for (const id of ALL) {
    const want = TODAY[id], toy = TOYS.find(t => t.id === want)!, sp = SPOF[id]
    ok([...visits[id]].every(v => v === want) && visits[id].has(want) && !!shown[id], `1 ${sp} goes to today's piece ${want} (${toy.kind}) and plays it, in ${secs} s (visited ${[...visits[id]].join(',') || 'none'})`)
    const d = Object.fromEntries(['pwr', 'grd', 'agi', 'vig'].map(k => [k, (fin[id]?.g[k] ?? 0) - (g0[id][k] ?? 0)]))
    const atCap = (g0[id][toy.stat] ?? 0) >= TRAIN.cap
    const wantD = Object.fromEntries(['pwr', 'grd', 'agi', 'vig'].map(k => [k, k === toy.stat && !atCap ? TRAIN.gain : 0]))
    ok(JSON.stringify(d) === JSON.stringify(wantD), `3 ${sp}: her session = +${TRAIN.gain} ${toy.stat} (${JSON.stringify(d)} want ${JSON.stringify(wantD)})`)
    const quiet = doneAt[id] !== undefined ? ((Date.now() - doneAt[id]) / 1000).toFixed(0) : '-'
    ok(fin[id]?.day === DAY && fin[id]?.plays === 1 && maxPlays[id] === 1 && doneAt[id] !== undefined && Date.now() - doneAt[id] >= 60000,
      `3 ${sp}: ONE session today (record day ${fin[id]?.day} = ${DAY}, record plays ${fin[id]?.plays}, trot plays ${maxPlays[id]}, ${quiet} s quiet after it)`)
  }
  ok(notAt === 0, `1 while playing she is at her piece (${notAt} samples off it)`)
  ok(both === 0, `2 never two spirits on one piece (${both} of ${samples} samples)`)
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
