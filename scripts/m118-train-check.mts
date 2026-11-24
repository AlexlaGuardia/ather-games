// ── BETA M118 s2 THE TRAINING POOL: ASSIGN A PIECE, PREVIEW, SPEND (2026-11-24, play-M118s1), OWNER + ?spirits=3d ─────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters, BOTH in the party; one Goldwood Hurdle (AGI)
// placed through the save; NOBODY assigned to it. The Vulnyx's record is an OLD M110-shaped save ({form, g: {agi: 3}, plays: 2})
// so the load is the migration test. 390x844, SwiftShader, fresh profile.
//  1. The Vulnyx's panel (E at her -> Open): 'Training points' = pool - 3, no NaN; the hurdle row is NOT allowed and PREVIEWS
//     one play: spend 1, AGI from -> to, pool after. The keeper taps Allow (the UI, not the save): the row reads allowed.
//  2. Watch: the Vulnyx goes to the hurdle on her own and plays; after her first play the record = EXACTLY the preview (AGI
//     +1, the pool one smaller). The Manalotl (never assigned) does not play it and has no record.
//  3. Her panel again: the radar's AGI = the preview's 'to' (+ any later plays), the pool = the record's.
//  4. 0 page errors.
//   npx tsx scripts/m118-train-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { SPECIES_BASE } from '../src/app/shimmer/open/ather/spirit-growth'
import { TRAIN } from '../src/app/shimmer/open/ather/spirit-stats'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, HD = { id: 'hd-check', x: P.x - 3, z: P.z + 4 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 },
  { id: HD.id, item: 'goldwood_hurdle', x: HD.x, z: HD.z, q: 0, placedAt: 1 }]
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((pieces: unknown[], pots: unknown) => {
    if (sessionStorage.getItem('m118t')) return; sessionStorage.setItem('m118t', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
    for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1', 'ather.trainAssign.v1']) localStorage.removeItem(k)
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check', 'mx-check']))
    localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'vx-check': { form: 'base', g: { agi: 3 }, plays: 2 } }))   // an M110 save
  }, PIECES, POTS(Date.now() - BLOOM_MS - 60000))
  type Rec = { g: Record<string, number>; plays: number }
  const book = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritStats.v1') ?? '{}')) as Promise<Record<string, Rec>>
  await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
  // the panel: E at her -> Open; read radar grades, the growth bar, the panel's text and width
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => (b.textContent ?? '').replace('›', '').trim())) as Promise<string[]>
  type Pan = { axes: Record<string, number>; growth: number | null; text: string; w: number; overflow: boolean; pool: number | null; row: Record<string, string> | null }
  async function panel(sp: 'fox' | 'axolotl', act?: () => Promise<void>): Promise<Pan | null> {
    for (let k = 0; k < 10; k++) {
      const t = await p.evaluate((s) => { const q = (window as any).__spiritModel?.trots?.[s]; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }, sp) as { x: number; z: number; y: number; h: number } | null
      if (!t) { await sleep(500); continue }
      await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 1.5, 0), t.x, t.z)
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await p.keyboard.press('e'); await sleep(900)
      if ((await opts()).length) {
        const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
        if (!picked) return null
        await sleep(2000)
        const v = await p.evaluate(() => {
          const pn = document.querySelector<HTMLElement>('[data-panel="spirit"]'); if (!pn) return null
          const axes: Record<string, number> = {}
          for (const a of pn.querySelectorAll('[data-spirit-axis]')) axes[a.getAttribute('data-spirit-axis')!] = Number(a.getAttribute('data-spirit-axis-grade'))
          const g = pn.querySelector('[data-spirit-growth]'), r = pn.getBoundingClientRect()
          const tr = pn.querySelector('[data-spirit-training]'), row = pn.querySelector('[data-train-piece="hd-check"]')
          const rowA = row ? Object.fromEntries([...row.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value])) : null
          return { axes, growth: g ? Number(g.getAttribute('data-spirit-growth')) : null, text: pn.innerText, w: r.width, overflow: r.right > innerWidth + 0.5 || r.left < -0.5 || document.documentElement.scrollWidth > innerWidth, pool: tr ? Number(tr.getAttribute('data-pool-left')) : null, row: rowA }
        })
        if (act) { await act(); await sleep(800) }
        await p.keyboard.press('Escape'); await sleep(600)
        return v
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return null
  }
  // 1. the panel, the preview, Allow
  let allowedAfter: string | null = null
  const p1 = await panel('fox', async () => { allowedAfter = await p.evaluate(() => { const b = document.querySelector<HTMLButtonElement>('[data-train-toggle="hd-check"]'); b?.click(); return null })
    await sleep(500); allowedAfter = await p.evaluate(() => document.querySelector('[data-train-piece="hd-check"]')?.getAttribute('data-train-on') ?? null) })
  const pv = p1?.row ?? null
  const from = SPECIES_BASE.fox.agi + 3
  ok(p1?.pool === TRAIN.pool - 3, `1 the old save loads: training points ${p1?.pool} of ${TRAIN.pool} (3 spent), no NaN: ${JSON.stringify(p1?.axes)}`)
  ok(!!pv && pv['data-train-on'] === '0' && pv['data-preview-stat'] === 'agi' && pv['data-preview-spend'] === '1' && Number(pv['data-preview-from']) === from && Number(pv['data-preview-to']) === from + 1 && Number(pv['data-preview-left']) === TRAIN.pool - 4,
    `1 the hurdle row: not allowed, previews one play ${JSON.stringify(pv)}`)
  ok(!!p1 && /Training points/.test(p1.text) && new RegExp(`AGI ${from} → ${from + 1}`).test(p1.text), `1 the preview is in the panel's text ('AGI ${from} → ${from + 1}')`)
  ok(allowedAfter === '1', `1 Allow tapped: the row reads allowed (${allowedAfter})`)
  ok(JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('ather.trainAssign.v1') ?? '{}'))) === '{"hd-check":["vx-check"]}', '1 the assignment is saved (the Vulnyx only)')
  ok(!!p1 && !p1.overflow && p1.w <= 390, `1 the panel fits 390 wide (${p1?.w.toFixed(0)} px)`)
  // 2. watch (the keeper back where she stands by: a piece is played only near the keeper)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  const seen = { fox: { at: 0, plays0: -1, first: null as null | Rec }, axolotl: { at: 0 } }
  const t0 = Date.now()
  while (Date.now() - t0 < 300000) {
    const s = await p.evaluate(() => { const t = (window as any).__spiritModel?.trots ?? {}; return { fox: t.fox ? { playing: t.fox.playing, plays: t.fox.plays ?? 0 } : null, axolotl: t.axolotl ? { playing: t.axolotl.playing, plays: t.axolotl.plays ?? 0 } : null } })
    if (s.fox?.playing === 'hd-check') seen.fox.at++
    if (s.axolotl?.playing === 'hd-check') seen.axolotl.at++
    if (s.fox && seen.fox.plays0 < 0) seen.fox.plays0 = s.fox.plays
    if (s.fox && s.fox.plays > seen.fox.plays0 && !seen.fox.first) seen.fox.first = (await book())['vx-check'] ?? null
    if (seen.fox.first && Date.now() - t0 > 60000) break
    await sleep(200)
  }
  const f = seen.fox.first
  ok(seen.fox.at > 3 && !!f, `2 the Vulnyx plays the hurdle on her own (${seen.fox.at} samples, first play in ${((Date.now() - t0) / 1000).toFixed(0)} s window)`)
  ok(!!f && f.g.agi === 4 && TRAIN.pool - (f.g.agi ?? 0) === Number(pv?.['data-preview-left']) && SPECIES_BASE.fox.agi + f.g.agi === Number(pv?.['data-preview-to']), `2 the spend = the preview exactly: ${JSON.stringify(f)}`)
  const bk = await book()
  ok(seen.axolotl.at === 0 && !bk['mx-check'], `2 the Manalotl (not assigned) never plays it, no record (${seen.axolotl.at} samples, ${JSON.stringify(bk['mx-check'] ?? null)})`)
  // 3. the panel again
  const p3 = await panel('fox'), r3 = (await book())['vx-check']
  ok(!!p3 && !!r3 && p3.axes.agi === SPECIES_BASE.fox.agi + r3.g.agi && p3.axes.agi >= from + 1 && p3.pool === TRAIN.pool - Object.values(r3.g).reduce((a, b) => a + b, 0),
    `3 the panel: AGI ${p3?.axes.agi}, points left ${p3?.pool} (record ${JSON.stringify(r3?.g)})`)
  ok(errs.length === 0, `4 0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
