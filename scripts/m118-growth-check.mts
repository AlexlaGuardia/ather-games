// ── BETA M118 s1 SPIRIT GROWTH: HIDDEN LEVELS, OWNER + ?spirits=3d (2026-11-24, play-M118s1) ───────────────────────────────
// SETUP (stated): the Vulnyx bloomed on a placed planter, in the party AND walking with the keeper (Follow). Her stat record
// is an OLD M110-shaped save ({form, g: {agi: 3}, plays: 2}: no xp, no growth) so the load is the migration test.
// 390x844, SwiftShader, fresh profile.
//  1. Panel at home (E at her -> Open): the radar = the REBASED fixed base (+3 AGI from the old save), no NaN; the growth bar
//     is there and empty; the panel's text has no level number ('Lv' / 'level'); it fits 390 wide.
//  2. Out in the Wilds, Hollows dispersed beside the keeper (spawned, taken to 0: the same kill path a round takes) fill HER
//     bar: 3 kills = xp 3 of a 4-bar, no growth yet.
//  3. The 4th fills it: she GROWS (grown 1) and the HUD says '<name> has grown stronger.'; one more = xp 1 into the next bar.
//  4. Home again, the panel: every stat higher than in 1, the bar part-filled (1/5), still no level number.
//  5. 0 page errors.
//   npx tsx scripts/m118-growth-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer from 'puppeteer-core'
import { TRAIN_UI } from '../src/app/shimmer/open/ather/training-lines'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { SPECIES_BASE, expNeed, grownStat } from '../src/app/shimmer/open/ather/spirit-growth'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }]
const STATS = ['pwr', 'grd', 'foc', 'res', 'agi', 'vig'] as const
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
  await p.evaluateOnNewDocument((pieces: unknown[], at: number) => {
    if (sessionStorage.getItem('m118g')) return; sessionStorage.setItem('m118g', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true } }, met: [] }))
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'vx-check': { form: 'base', g: { agi: 3 }, plays: 2 } }))   // an M110 save
  }, PIECES, Date.now() - BLOOM_MS - 60000)
  type Rec = { g: Record<string, number>; plays: number; xp?: number; grown?: number }
  const rec = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritStats.v1') ?? '{}')['vx-check']) as Promise<Rec | undefined>
  await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  const home = async () => {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
    for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  }
  await home()
  // the panel: E at her -> Open; read radar grades, the growth bar, the panel's text and width
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => (b.textContent ?? '').replace('›', '').trim())) as Promise<string[]>
  type Pan = { axes: Record<string, number>; growth: number | null; text: string; w: number; overflow: boolean }
  async function panel(): Promise<Pan | null> {
    for (let k = 0; k < 25; k++) {
      const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
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
          return { axes, growth: g ? Number(g.getAttribute('data-spirit-growth')) : null, text: pn.innerText, w: r.width, overflow: r.right > innerWidth + 0.5 || r.left < -0.5 || document.documentElement.scrollWidth > innerWidth }
        })
        await p.keyboard.press('Escape'); await sleep(600)
        return v
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return null
  }
  const noLevel = (t: string) => !/\bLv\b|\blevel\b|\bLVL\b/i.test(t)
  const p1 = await panel()
  const want1 = Object.fromEntries(STATS.map(k => [k, SPECIES_BASE.fox[k] + (k === 'agi' ? 3 : 0)]))
  ok(!!p1 && STATS.every(k => p1.axes[k] === want1[k]), `1 radar = the rebased fixed base + the old save's AGI +3: ${JSON.stringify(p1?.axes)} want ${JSON.stringify(want1)}`)
  ok(!!p1 && STATS.every(k => Number.isFinite(p1.axes[k])), '1 the M110 save loaded: no NaN')
  ok(p1?.growth === 0, `1 the growth bar is there and empty (${p1?.growth})`)
  ok(!!p1 && noLevel(p1.text) && /Growth/.test(p1.text), `1 panel text: 'Growth', no level number (${JSON.stringify(p1?.text.replace(/\s+/g, ' ').slice(0, 160))})`)
  ok(!!p1 && p1.text.includes(TRAIN_UI.none), `1 no training piece placed: '${TRAIN_UI.none}'`)
  ok(!!p1 && !p1.overflow && p1.w <= 390, `1 the panel fits 390 wide (${p1?.w.toFixed(0)} px)`)
  // 2-3. the Wilds
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(3000)
  const C = (f: string) => p.evaluate(`(() => { const A = window.__ather, C = A.combat(); ${f} })()`) as Promise<any>
  const kill = async () => {
    const n0 = await C('C.hollows.length = 0; C.spits.length = 0; C.keeper.hp = C.keeper.maxHp; C.packs = {}; A.spawn(0, -6, "shambler"); return C.hollows.map(h => h.id)') as number[]
    await sleep(300)
    await C(`for (const h of C.hollows) if (${JSON.stringify(n0)}.includes(h.id)) h.hp = 0`)
    for (let i = 0; i < 40; i++) { await sleep(250); if (await C(`return !C.hollows.some(h => ${JSON.stringify(n0)}.includes(h.id))`)) break }
    await C('C.hollows.length = 0; C.keeper.hp = C.keeper.maxHp')
  }
  const need0 = expNeed(0)
  for (let i = 0; i < need0 - 1; i++) await kill()
  await sleep(600)
  const r2 = await rec()
  ok(r2?.xp === need0 - 1 && (r2?.grown ?? 0) === 0 && r2?.g.agi === 3, `2 ${need0 - 1} Hollows beside her: xp ${r2?.xp} of ${need0}, no growth yet, old AGI +3 kept (${JSON.stringify(r2)})`)
  const toastSeen = p.waitForFunction(() => /Vulnyx has grown stronger\./.test(document.body.innerText), { timeout: 15000 }).then(() => true).catch(() => false)
  await kill()
  const toast = await toastSeen
  const r3a = await rec()
  ok(r3a?.grown === 1 && r3a?.xp === 0, `3 the ${need0}th fills the bar: she grew (${JSON.stringify(r3a)})`)
  ok(toast, `3 the HUD said 'Vulnyx has grown stronger.'`)
  await kill(); await sleep(600)
  const r3 = await rec()
  ok(r3?.grown === 1 && r3?.xp === 1, `3 one more: xp 1 into the next bar (${JSON.stringify(r3)})`)
  // 4. home: the panel shows the growth
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'home' }))
  await p.waitForFunction(() => (window as any).__ather.zone() !== 'wilds', { timeout: 120000 }); await sleep(2500)
  await home()
  const p4 = await panel()
  const want4 = Object.fromEntries(STATS.map(k => [k, Math.round(grownStat('fox', k, 1) + (k === 'agi' ? 3 : 0))]))
  ok(!!p4 && !!p1 && STATS.every(k => p4.axes[k] > p1.axes[k]), `4 every stat rose: ${JSON.stringify(p1?.axes)} -> ${JSON.stringify(p4?.axes)}`)
  ok(!!p4 && STATS.every(k => p4.axes[k] === want4[k]), `4 = the species curve at one growth: want ${JSON.stringify(want4)}`)
  ok(!!p4 && Math.abs((p4.growth ?? -1) - 1 / expNeed(1)) < 0.002, `4 the bar part-filled ${p4?.growth} (= 1/${expNeed(1)})`)
  ok(!!p4 && noLevel(p4.text), '4 still no level number in the panel')
  ok(!!p4 && p4.text.includes(TRAIN_UI.none) && !p4.overflow, `4 no training piece placed: '${TRAIN_UI.none}', fits 390`)
  ok(errs.length === 0, `5 0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
