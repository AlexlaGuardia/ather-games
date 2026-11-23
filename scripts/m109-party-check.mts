// ── M109 s3 THE PARTY OF 8 IN THE GRIMOIRE, OWNER-ONLY (2026-11-23, sprites-M109s3) ──────────────────────────────────────
// SETUP (stated): ten bloomed spirits in the book (one per species; the Vulnyx and the Manalotl on placed planters, so they
// are drawn and walk), a grimoire pedestal 6 m east of the Vulnyx, owner cookie + ?spirits=3d, 390x844 (SwiftShader).
//  1. E at the pedestal: the grimoire's roster lists all ten bloomed spirits (every species once); party 0 / 8.
//  2. Ask along, row by row: 8 join (party 8 / 8); the 9th is refused (the plain line on the HUD, party stays 8, she stays out).
//  3. Let roam on one: party 7 / 8, she is out.  4. Reload: the same 7 are in the party (roster + localStorage).
//  5. Call on the Vulnyx (keeper at the pedestal, she is > 3 m off): the panel closes, she walks to the keeper (within 2.2 m
//     inside 25 s, the probe reads calling while she goes).  0 page errors.  Without the flag: no roster on the grimoire.
//   npx tsx scripts/m109-party-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env)
import puppeteer, { type Page } from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, PED = { x: P.x + 6, z: P.z }
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 },
  { id: 'gp-check', item: 'grimoire_pedestal', x: PED.x, z: PED.z, q: 0, placedAt: 1 }]
const OTHERS = ['water-bear', 'turtle', 'owl', 'frog', 'firefly', 'rabbit', 'hummingbird', 'bat']
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true },
  ...Object.fromEntries(OTHERS.map((s, i) => [`pc-${s}`, { seed: `mana_seed_${s}`, at: at + 2 + i, bloomed: true }])) })
const FULL_LINE = 'Your party is full (8).'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }

async function run(withFlag: boolean) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); await p.close(); return null }
  await p.evaluateOnNewDocument((pieces: unknown[], pots: unknown) => {
    if (sessionStorage.getItem('m109p')) return; sessionStorage.setItem('m109p', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
    for (const k of ['ather.spiritParty.v1', 'ather.spiritFollow.v1', 'ather.spiritFed.v1']) localStorage.removeItem(k)
  }, PIECES, POTS(Date.now() - BLOOM_MS - 60000))
  await p.goto(`${url}/shimmer/open/ather?hour=14${withFlag ? '&spirits=3d' : ''}`, { waitUntil: 'load', timeout: 180000 })
  await ready(p, withFlag)
  return { p, errs }
}
async function ready(p: Page, models = true) {
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), P.x, P.z)
  if (!models) { await sleep(6000); return }
  for (let i = 0; i < 40; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
}
type Roster = { open: boolean; count: number | null; rows: { id: string; sp: string; inP: boolean; callOff: boolean }[] }
const roster = (p: Page) => p.evaluate(() => {
  const g = document.querySelector('[data-panel="grimoire"]'), c = g?.querySelector('[data-party-count]')
  return { open: !!g, count: c ? Number(c.getAttribute('data-party-count')) : null,
    rows: [...(g?.querySelectorAll('[data-roster-spirit]') ?? [])].map(r => ({ id: r.getAttribute('data-roster-spirit')!, sp: r.getAttribute('data-species')!, inP: r.getAttribute('data-in-party') === '1',
      callOff: !!(r.querySelector('[data-act="call"] button') as HTMLButtonElement | null)?.disabled })) }
}) as Promise<Roster>
async function openBook(p: Page) {
  for (let k = 0; k < 6; k++) {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 1.3, 0), PED.x, PED.z); await sleep(800)
    await aimAt(p, PED.x, PED.z, 0.9); await p.keyboard.press('e'); await sleep(1200)
    if ((await roster(p)).open) return true
    await p.keyboard.press('Escape'); await sleep(400)
  }
  return false
}
const act = (p: Page, id: string, a: string) => p.evaluate((id, a) => { const b = document.querySelector(`[data-roster-spirit="${id}"] [data-act="${a}"] button`) as HTMLButtonElement | null; b?.click(); return !!b }, id, a)
const hudNow = (p: Page) => p.evaluate(() => [...document.querySelectorAll('[data-say]')].map(e => e.textContent ?? '')) as Promise<string[]>
const party = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritParty.v1') ?? '[]')) as Promise<string[]>

const a = await run(true)
if (a) {
  ok(await openBook(a.p), 'E at the pedestal opens the grimoire')
  let r = await roster(a.p)
  const sps = new Set(r.rows.map(x => x.sp))
  ok(r.rows.length === 10 && sps.size === 10 && r.count === 0, `1 roster lists all 10 bloomed spirits, party 0 (${r.rows.length} rows, ${sps.size} species, party ${r.count})`)
  const ids = r.rows.map(x => x.id)
  for (let i = 0; i < 8; i++) { await act(a.p, ids[i], 'ask'); await sleep(250) }
  r = await roster(a.p)
  ok(r.count === 8 && ids.slice(0, 8).every(id => r.rows.find(x => x.id === id)?.inP), `2 eight asked along (party ${r.count})`)
  ok(await act(a.p, ids[8], 'ask'), '2 clicked Ask along on the 9th')
  await sleep(300); const hud = await hudNow(a.p); r = await roster(a.p)
  ok(r.count === 8 && !r.rows.find(x => x.id === ids[8])?.inP && hud.some(x => x.includes(FULL_LINE)), `2 the 9th is refused (party ${r.count}, HUD: ${hud.slice(-2).join(' | ')})`)
  const out = ids[1]
  await act(a.p, out, 'roam'); await sleep(300); r = await roster(a.p)
  ok(r.count === 7 && !r.rows.find(x => x.id === out)?.inP && (await party(a.p)).length === 7, `3 let roam: party ${r.count}, ${out} out`)
  const want = ids.slice(0, 8).filter(x => x !== out).sort().join()
  await a.p.keyboard.press('Escape'); await sleep(400)
  await a.p.reload({ waitUntil: 'load', timeout: 180000 }); await ready(a.p)
  ok(await openBook(a.p), '4 grimoire reopens after reload')
  r = await roster(a.p)
  ok(r.count === 7 && r.rows.filter(x => x.inP).map(x => x.id).sort().join() === want && (await party(a.p)).sort().join() === want, `4 the party persists across a reload (party ${r.count})`)
  // 5. call the Vulnyx home
  const vx = r.rows.find(x => x.sp === 'fox')
  ok(!!vx && !vx.callOff, `5 Call is live for the drawn Vulnyx (disabled ${vx?.callOff})`)
  const dist = () => a.p.evaluate(() => { const t = (window as any).__spiritModel?.trots?.fox, g = (window as any).__ather.state(); return t ? { d: Math.hypot(t.x - (g.px ?? g.x), t.z - (g.pz ?? g.z)), calling: !!t.calling } : null }) as Promise<{ d: number; calling: boolean } | null>
  const d0 = (await dist())?.d ?? 0
  await act(a.p, 'vx-check', 'call'); await sleep(400)
  const closed = !(await roster(a.p)).open
  let best = d0, calling = false, at = -1; const t0 = Date.now()
  while (Date.now() - t0 < 25000) { const s = await dist(); if (s) { best = Math.min(best, s.d); calling ||= s.calling; if (s.d < 2.2 && at < 0) at = (Date.now() - t0) / 1000 } if (at >= 0 && Date.now() - t0 > at * 1000 + 1500) break; await sleep(250) }
  ok(closed, '5 Call closes the grimoire so the keeper can watch')
  ok(d0 > 3 && best < 2.2 && calling, `5 called home: she walks to the keeper (${d0.toFixed(2)} m -> ${best.toFixed(2)} m${at >= 0 ? ` in ${at.toFixed(1)} s` : ''}, calling ${calling})`)
  ok(a.errs.length === 0, `A 0 page errors ${a.errs.join(' | ')}`)
  await a.p.close()
}
const b = await run(false)
if (b) {
  ok(await openBook(b.p), 'B no flag: the grimoire opens')
  const r = await roster(b.p)
  ok(r.count === null && r.rows.length === 0, `B no flag: no roster face (rows ${r.rows.length})`)
  ok(b.errs.length === 0, `B 0 page errors ${b.errs.join(' | ')}`)
  await b.p.close()
}
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
