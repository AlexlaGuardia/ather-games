// ── BETA M201 SECOND-FORM STAT GATE: OWNER + ?spirits=3d (2026-11-26, play-M201) ─────────────────────────────────────────
// SETUP (stated): the Vulnyx bloomed on a placed planter, in the party AND walking with the keeper. Her stat record has grown 10
// times and played +5 PWR. 390x844, SwiftShader, fresh profile.
//  1. The spirit panel (E at her -> Open) shows a 'Second form' section: four bars (mana/storm/earth/water), each reads the
//     element's gate stat (second-form-gate.ts GATE_STAT), need = SECOND_FORM_BAR.fox[el], have = her live stat rounded.
//  2. The block reason: the open world has no elemental pour yet, so 'no-infusions' and its line; no bar met at 10 growths.
//  3. No level number in the panel; it fits 390 wide; 0 page errors.
//   npx tsx scripts/m201-form-gate-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer from 'puppeteer-core'
import { SECOND_FORM_BAR, GATE_STAT, FORM_ELEMENTS } from '../src/app/shimmer/spirits/second-form-gate'
import { statValue, type StatRec } from '../src/app/shimmer/open/ather/spirit-stats'
import { SECOND_FORM_UI } from '../src/app/shimmer/open/ather/second-form-view'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }]
const REC: StatRec = { form: 'base', g: { pwr: 5 }, plays: 5, xp: 0, grown: 10 }
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
  await p.evaluateOnNewDocument((pieces: unknown[], at: number, rec: unknown) => {
    if (sessionStorage.getItem('m201')) return; sessionStorage.setItem('m201', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true } }, met: [] }))
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'vx-check': rec }))
  }, PIECES, Date.now() - BLOOM_MS - 60000, REC)
  await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => (b.textContent ?? '').replace('›', '').trim())) as Promise<string[]>
  type Bar = { el: string; stat: string; have: number; need: number; met: string }
  type Pan = { bars: Bar[]; blocker: string | null; reason: string; text: string; w: number; overflow: boolean }
  async function panel(): Promise<Pan | null> {
    for (let k = 0; k < 10; k++) {
      // M126 s4: a FOLLOWING spirit's place comes along with the keeper, so a tp beside her sends her off again; stand still, let her
      // settle, then turn and aim from there (a player's case)
      await sleep(3000)
      const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
      if (!t) { await sleep(500); continue }
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await p.keyboard.press('e'); await sleep(900)
      if ((await opts()).length) {
        const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
        if (!picked) return null
        await sleep(2000)
        const v = await p.evaluate(() => {
          const pn = document.querySelector<HTMLElement>('[data-panel="spirit"]'); if (!pn) return null
          const f = pn.querySelector('[data-second-form]'), r = pn.getBoundingClientRect()
          const bars = [...pn.querySelectorAll('[data-form-bar]')].map(b => ({ el: b.getAttribute('data-form-bar')!, stat: b.getAttribute('data-form-stat')!, have: Number(b.getAttribute('data-form-have')), need: Number(b.getAttribute('data-form-need')), met: b.getAttribute('data-form-met')! }))
          return { bars, blocker: f?.getAttribute('data-form-blocker') ?? null, reason: (pn.querySelector('[data-form-reason]')?.textContent ?? '').trim(), text: pn.innerText, w: r.width, overflow: r.right > innerWidth + 0.5 || r.left < -0.5 || document.documentElement.scrollWidth > innerWidth }
        })
        await p.keyboard.press('Escape'); await sleep(600)
        return v
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return null
  }
  const p1 = await panel()
  ok(!!p1 && p1.bars.length === 4, `1 the panel has the 'Second form' section with four bars (${p1?.bars.length})`)
  for (const el of FORM_ELEMENTS) {
    const b = p1?.bars.find(x => x.el === el), stat = GATE_STAT[el], want = Math.round(statValue('fox', REC, stat))
    ok(!!b && b.stat === stat && b.need === SECOND_FORM_BAR.fox[el] && b.have === want && b.met === '0', `1 ${el}: ${stat} ${b?.have}/${b?.need} (want ${want}/${SECOND_FORM_BAR.fox[el]}, not met)`)
  }
  const want = SECOND_FORM_UI.reason({ blocker: 'no-infusions', lean: null, bars: [] }, k => k)
  ok(p1?.blocker === 'no-infusions' && p1.reason === want, `2 block reason: ${p1?.blocker} '${p1?.reason}'`)
  ok(!!p1 && /Second form/.test(p1.text) && !/\bLv\b|\blevel\b|\bLVL\b/i.test(p1.text), '3 no level number in the panel')
  ok(!!p1 && !p1.overflow && p1.w <= 390, `3 the panel fits 390 wide (${p1?.w.toFixed(0)} px)`)
  ok(errs.length === 0, `3 0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
