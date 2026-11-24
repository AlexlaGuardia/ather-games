// ── M107 SHIP (2026-11-23, play-M107ship): THE SPIRIT ROAM FOR EVERY KEEPER, CALMER ─────────────────────────────────────
// Alex 11-23: ship the spirit trot to ALL players + MORE PAUSES. SETUP (stated): a fresh anonymous keeper (never Alex's save,
// no owner cookie, NO ?spirits=3d) whose save holds two BLOOMED Spirit Planters (a Vulnyx at (-130, 102.5), a Manalotl
// 2.6 m west), seeded the way vulnyx-ingame-check.mts seeds them. 390x844 (SwiftShader).
//  P. player: both models drawn; over ~60 s (sampled every 250 ms) she roams past 3 m from her planter, and OFF the perch the
//     two of them stand still (check/look/sniff/sit/tilt) 40..75% of the samples (before the ship ~31%: trot ~70% of ground
//     time); E aimed at her GIVES her spirit talk (M123 s2: Feed/Follow/Open ship to every keeper); she never follows unasked; 0 page errors.
//  O. owner + ?spirits=3d (this box only): E at the Vulnyx still gives Feed / Follow / Open (the dev gate still opens).
//   OWNER_KEY=... npx tsx scripts/m107-ship-check.mts [--url https://ather.games] [--no-owner]
import puppeteer, { type Page } from 'puppeteer-core'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), noOwner = process.argv.includes('--no-owner'), OWNER_KEY = process.env.OWNER_KEY
const P = { x: -130, z: 102.5 }
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 },
  { id: 'vx-bench', item: 'goldwood_bench', x: P.x + 2.4, z: P.z, q: 0, placedAt: 1 }]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
type T = { x: number; z: number; y: number; h: number; mode: string; home: { x: number; z: number }; near: boolean }
const trotOf = (p: Page, sp: string) => p.evaluate((s) => (window as any).__spiritModel?.trots?.[s] ?? null, sp) as Promise<T | null>
const opts = (p: Page) => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => (b.textContent ?? '').replace('›', '').trim())) as Promise<string[]>

async function open(owner: boolean, withFlag: boolean) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (owner) {
    await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(OWNER_KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); await p.close(); return null }
  }
  await p.evaluateOnNewDocument((pieces: unknown[], bloomAt: number) => {
    if (sessionStorage.getItem('m107s')) return; sessionStorage.setItem('m107s', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: bloomAt }, { species: 'axolotl', stage: 'seen', at: bloomAt }],
      pots: { 'vx-check': { seed: 'mana_seed_fox', at: bloomAt, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: bloomAt, bloomed: true } } }))
  }, PIECES, Date.now() - BLOOM_MS - 60000)
  await p.goto(`${url}/shimmer/open/ather?hour=14${withFlag ? '&spirits=3d' : ''}`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), P.x, P.z + 6)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
  return { p, errs }
}

// P. a fresh player keeper, no flag
const a = await open(false, false)
if (a) {
  const { p } = a
  const vis = await p.evaluate(() => document.visibilityState)
  const m = await p.evaluate(() => ({ mounted: (window as any).__spiritModel?.mounted ?? 0, species: { ...((window as any).__spiritModel?.species ?? {}) } })) as { mounted: number; species: Record<string, number> }
  ok(m.mounted === 2 && m.species.fox === 1 && m.species.axolotl === 1, `P player (no owner, no flag): Vulnyx + Manalotl drawn on their planters (${JSON.stringify(m)}; tab ${vis})`)
  const owner = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
  ok(!owner, `P the keeper is NOT the owner (/api/owner = ${owner})`)
  const S = await p.evaluate(`new Promise(res => { const out = { fox: [], axolotl: [] }, t0 = performance.now(); const id = setInterval(() => { const t = window.__spiritModel?.trots ?? {}
    for (const s of ['fox', 'axolotl']) if (t[s]) out[s].push({ x: t[s].x, z: t[s].z, mode: t[s].mode, home: t[s].home, near: t[s].near })
    if (performance.now() - t0 > 60000) { clearInterval(id); res(out) } }, 250) })`) as Record<string, (T & { near: boolean })[]>
  const MOVE = new Set(['trot', 'hopDown', 'hopUp'])
  let still = 0, grnd = 0
  for (const sp of ['fox', 'axolotl']) {
    const ss = S[sp] ?? [], g = ss.filter(s => s.mode !== 'perch'), st = g.filter(s => !MOVE.has(s.mode)).length
    still += st; grnd += g.length
    const far = Math.max(0, ...ss.map(s => Math.hypot(s.x - s.home.x, s.z - s.home.z)))
    const modes = [...new Set(ss.map(s => s.mode))]
    ok(ss.length > 150 && far > (sp === 'fox' ? 3 : 1.6), `P ${sp}: roams the plot (${ss.length} samples over 60 s, reached ${far.toFixed(2)} m from her planter; modes ${modes.join(',')})`)
    ok(!modes.includes('follow') && !ss.some(s => s.near), `P ${sp}: never follows / keeps with a party unasked (empty party)`)
    console.log(`   ${sp}: still ${st}/${g.length} = ${(st / Math.max(1, g.length) * 100).toFixed(0)}% of her ground samples`)
  }
  const share = still / Math.max(1, grnd)
  ok(share >= 0.4 && share <= 0.75, `P calm: off the perch the two stand still ${(share * 100).toFixed(0)}% of ~60 s (want 40..75%; before the ship ~31%)`)
  // E aimed at the Vulnyx: her spirit talk, for a player too (M123 s2; was: none before the ship)
  let got: string[] = []
  for (let k = 0; k < 4 && !got.length; k++) {
    const t = await trotOf(p, 'fox'); if (!t) break
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 1.5, 0), t.x, t.z)
    await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
    await p.keyboard.press('e'); await sleep(900); got = await opts(p); await p.keyboard.press('Escape'); await sleep(300)
  }
  ok(got.some(x => /Follow|Feed|Open/.test(x)), `P (M123 s2) E at her gives her spirit talk to a player (options: ${JSON.stringify(got)})`)
  ok(a.errs.length === 0, `P 0 page errors ${a.errs.join(' | ')}`)
  await p.close()
}
// O. owner + flag: the dev gate still opens the talk
if (!noOwner && OWNER_KEY) {
  const o = await open(true, true)
  if (o) {
    let got: string[] = []
    for (let k = 0; k < 8 && !got.length; k++) {
      const t = await trotOf(o.p, 'fox'); if (!t) { await sleep(500); continue }
      await o.p.evaluate((x, z) => (window as any).__ather.tp(x, z + 1.5, 0), t.x, t.z)
      await aimAt(o.p, t.x, t.z, t.y - (await o.p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await o.p.keyboard.press('e'); await sleep(900); got = await opts(o.p); if (!got.length) { await o.p.keyboard.press('Escape'); await sleep(400) }
    }
    ok(got.join('/') === 'Feed/Follow/Open', `O owner + ?spirits=3d: E at the Vulnyx = Feed / Follow / Open (${got.join('/')})`)
    ok(o.errs.length === 0, `O 0 page errors ${o.errs.join(' | ')}`)
    await o.p.close()
  }
} else console.log('   O skipped (no OWNER_KEY / --no-owner)')
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
