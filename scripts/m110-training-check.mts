// ── M110 s1 TRAINING FURNITURE: STATS GROW BY PLAY, OWNER-ONLY (2026-11-23, sprites-M110s1) ─────────────────────────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters, BOTH in the party; one Goldwood Hurdle (the AGI
// piece) placed on the plot (through the save, as a set piece: the bench recipe is unit-tested, its UI is not driven here).
// The Manalotl's stat record starts at AGI +15 (34 -> 49, one under the Base cap); the Vulnyx has none (AGI 52, a species base
// already past the Base cap 50). Owner cookie + ?spirits=3d, 390x844 (SwiftShader). The keeper stands by; nothing is clicked.
//  1. Unprompted: each spirit goes to the hurdle ON HER OWN and plays (probe mode 'play' at the hurdle, a bound over it).
//  2. Her stat rises: the Manalotl's AGI 49 -> 50 after a play (the record, ather.spiritStats.v1).
//  3. At the cap it does not rise: a second Manalotl play leaves 50; the Vulnyx plays and her AGI stays 52 (no gain recorded).
//  4. Reload keeps the record.
//  5. The panel radar (E at her -> Open) shows AGI 50 for the Manalotl, 52 for the Vulnyx.
//  6. 0 page errors.
//   npx tsx scripts/m110-training-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer, { type Page } from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { FORM_CAP } from '../src/app/shimmer/open/ather/spirit-stats'
import { SPECIES_STATS_V2 } from '../src/app/shimmer/engine/party-stats'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, HD = { id: 'hd-check', x: P.x - 3, z: P.z + 4 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const MX0 = FORM_CAP.base - 1 - SPECIES_STATS_V2.axolotl.agi   // the Manalotl's AGI gains at the start: one under the cap
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 },
  { id: HD.id, item: 'goldwood_hurdle', x: HD.x, z: HD.z, q: 0, placedAt: 1 }]
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); await br.close(); process.exit(1) }
await p.evaluateOnNewDocument((pieces: unknown[], pots: unknown, mx0: number) => {
  if (sessionStorage.getItem('m110t')) return; sessionStorage.setItem('m110t', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
  for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1']) localStorage.removeItem(k)
  localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check', 'mx-check']))
  localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'mx-check': { form: 'base', g: { agi: mx0 }, plays: 0 } }))
}, PIECES, POTS(Date.now() - BLOOM_MS - 60000), MX0)
const open = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
}
type Rec = { form: string; g: Record<string, number>; plays: number }
const book = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritStats.v1') ?? '{}')) as Promise<Record<string, Rec>>
await open()

// 1-3: watch, the keeper standing still. Sample each spirit's probe every 200 ms: play seen AT the hurdle, its bound, the plays.
type Seen = { atHurdle: number; far: number; yMax: number; plays: number; firstAt: number; agiAfter1?: number }
const seen: Record<string, Seen> = { fox: { atHurdle: 0, far: 0, yMax: 0, plays: 0, firstAt: -1 }, axolotl: { atHurdle: 0, far: 0, yMax: 0, plays: 0, firstAt: -1 } }
const t0 = Date.now()
while (Date.now() - t0 < 300000) {
  const s = await p.evaluate((hx, hz) => { const t = (window as any).__spiritModel?.trots ?? {}; const o: Record<string, { play: boolean; d: number; plays: number; y: number }> = {}
    for (const sp of ['fox', 'axolotl']) { const q = t[sp]; if (q) o[sp] = { play: q.mode === 'play' && q.playing === 'hd-check', d: Math.hypot(q.x - hx, q.z - hz), plays: q.plays ?? 0, y: q.playYMax ?? 0 } }
    return o }, HD.x, HD.z)
  for (const sp of ['fox', 'axolotl'] as const) { const q = s[sp], r = seen[sp]; if (!q) continue
    if (q.play) { if (q.d < 1.0) r.atHurdle++; else r.far++; if (r.firstAt < 0) r.firstAt = (Date.now() - t0) / 1000 }
    r.yMax = Math.max(r.yMax, q.y)
    if (sp === 'axolotl' && q.plays >= 1 && r.plays < 1) r.agiAfter1 = SPECIES_STATS_V2.axolotl.agi + ((await book())['mx-check']?.g.agi ?? 0)
    r.plays = Math.max(r.plays, q.plays) }
  if (seen.fox.plays >= 1 && seen.axolotl.plays >= 2) break
  await sleep(200)
}
for (const [sp, name] of [['fox', 'Vulnyx'], ['axolotl', 'Manalotl']] as const) {
  const r = seen[sp]
  ok(r.plays >= 1 && r.atHurdle > 3 && r.far === 0, `1 ${name} goes to the hurdle unprompted and plays: first play at ${r.firstAt.toFixed(1)} s, ${r.plays} finished, ${r.atHurdle} samples at it (${r.far} away)`)
  ok(r.yMax > 0.03, `1 ${name} bounds over it (peak ${r.yMax.toFixed(3)} m)`)
}
const b1 = await book()
const mxAgi = SPECIES_STATS_V2.axolotl.agi + (b1['mx-check']?.g.agi ?? 0), vxAgi = SPECIES_STATS_V2.fox.agi + (b1['vx-check']?.g.agi ?? 0)
ok(seen.axolotl.agiAfter1 === FORM_CAP.base, `2 the Manalotl's AGI rose ${FORM_CAP.base - 1} -> ${seen.axolotl.agiAfter1} after her first play`)
ok(seen.axolotl.plays >= 2 && mxAgi === FORM_CAP.base && (b1['mx-check']?.plays ?? 0) >= 2, `3 at the cap it does not rise: after ${b1['mx-check']?.plays} plays AGI ${mxAgi} (cap ${FORM_CAP.base})`)
ok((b1['vx-check']?.plays ?? 0) >= 1 && vxAgi === SPECIES_STATS_V2.fox.agi && !b1['vx-check']?.g.agi, `3 the Vulnyx (AGI ${SPECIES_STATS_V2.fox.agi}, past the Base cap) played ${b1['vx-check']?.plays}x and stays ${vxAgi}`)

// 4. reload keeps it
await open()
const b2 = await book()
ok(JSON.stringify(b2['mx-check']?.g) === JSON.stringify(b1['mx-check']?.g) && (b2['mx-check']?.plays ?? 0) >= (b1['mx-check']?.plays ?? 0), `4 reload keeps the record ${JSON.stringify(b2['mx-check'])}`)

// 5. the panel radar (E at her -> Open)
const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => (b.textContent ?? '').replace('›', '').trim())) as Promise<string[]>
const trotOf = (sp: string) => p.evaluate((s) => { const t = (window as any).__spiritModel?.trots?.[s]; return t ? { x: t.x, z: t.z, y: t.y, h: t.h } : null }, sp) as Promise<{ x: number; z: number; y: number; h: number } | null>
async function panelAgi(sp: string): Promise<number | null> {
  for (let k = 0; k < 8; k++) {
    const t = await trotOf(sp); if (!t) { await sleep(500); continue }
    await p.evaluate((x, z, away) => (window as any).__ather.tp(x, z + away, 0), t.x, t.z, sp === 'axolotl' ? 1.1 : 1.5)
    await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
    await p.keyboard.press('e'); await sleep(900)
    if ((await opts()).length) {
      const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
      if (!picked) return null
      await sleep(2000)
      const v = await p.evaluate(() => { const g = document.querySelector('[data-panel="spirit"] [data-spirit-axis="agi"]'); return g ? Number(g.getAttribute('data-spirit-axis-grade')) : null })
      await p.keyboard.press('Escape'); await sleep(600)
      return v
    }
    await p.keyboard.press('Escape'); await sleep(400)
  }
  return null
}
const pm = await panelAgi('axolotl'), pv = await panelAgi('fox')
ok(pm === FORM_CAP.base, `5 the Manalotl's panel radar reads AGI ${pm} (record ${mxAgi})`)
ok(pv === SPECIES_STATS_V2.fox.agi, `5 the Vulnyx's panel radar reads AGI ${pv}`)
ok(errs.length === 0, `6 0 page errors ${errs.join(' | ')}`)
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
