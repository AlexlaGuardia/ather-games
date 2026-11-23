// ── M109 s2 FEED A GARDEN SPIRIT, OWNER-ONLY (2026-11-23, sprites-M109s2) ─────────────────────────────────────────────
// SETUP (stated): two bloomed Spirit Planters (a Vulnyx at (-130, 102.5), a Manalotl beside it), owner cookie + ?spirits=3d,
// 390x844 (SwiftShader).
//  A. bag = 2 Glowfin + 1 Moonkoi. E at the Vulnyx: Feed is pickable, tagged with the food it would give (Glowfin). Feed:
//     Glowfin 2 -> 1, Moonkoi untouched, she plays her happy beat (probe: mode 'happy', cheers +1, a hop off the ground),
//     the fed record (localStorage ather.spiritFed.v1) = { n 1, item glowfin } on her planter id. The Manalotl: fed too
//     (Glowfin 1 -> 0), her own record. Reload: both records and the bag counts persist; the Vulnyx's Feed now reads Moonkoi.
//  B. bag = waymarks only. E at the Vulnyx -> Feed: the plain refusal line on the HUD, the bag unchanged, no fed record,
//     no happy beat.  0 page errors in both.
//   npx tsx scripts/m109-feed-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env)
import puppeteer, { type Page } from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 }]
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at, bloomed: true } })
const NONE_LINE = 'No spirit food in your bag.'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }

async function run(bag: [string, number][]) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); await p.close(); return null }
  await p.evaluateOnNewDocument((pieces: unknown[], pots: unknown, bag: [string, number][]) => {
    if (sessionStorage.getItem('m109f')) return; sessionStorage.setItem('m109f', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); bag.forEach(([id, n], i) => { slots[i] = { id, n } })
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
    localStorage.removeItem('ather.spiritFed.v1'); localStorage.removeItem('ather.spiritFollow.v1')
  }, PIECES, POTS(Date.now() - BLOOM_MS - 60000), bag)
  await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
  await ready(p)
  return { p, errs }
}
async function ready(p: Page) {
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), P.x, P.z)
  for (let i = 0; i < 40; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
}
const inv = (p: Page) => p.evaluate(() => { const v = JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}'); const c: Record<string, number> = {}; for (const s of v.slots ?? []) if (s) c[s.id] = (c[s.id] ?? 0) + s.n; return c }) as Promise<Record<string, number>>
const fed = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.spiritFed.v1') ?? '{}')) as Promise<Record<string, { n: number; last: number; item: string }>>
const opts = (p: Page) => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(b => ({ t: (b.textContent ?? '').replace('›', '').trim(), tag: b.querySelector('[data-talk-tag]')?.textContent ?? '', off: b.hasAttribute('data-talk-disabled') }))) as Promise<{ t: string; tag: string; off: boolean }[]>
const trotOf = (p: Page, sp: string) => p.evaluate((s) => { const t = (window as any).__spiritModel?.trots?.[s]; return t ? { x: t.x, z: t.z, y: t.y, h: t.h, mode: t.mode, cheers: t.cheers, yMax: t.yMax } : null }, sp) as Promise<{ x: number; z: number; y: number; h: number; mode: string; cheers: number; yMax: number } | null>
async function talkTo(p: Page, sp: string) {
  for (let k = 0; k < 8; k++) {
    const t = await trotOf(p, sp); if (!t) { await sleep(500); continue }
    await p.evaluate((x, z, away) => (window as any).__ather.tp(x, z + away, 0), t.x, t.z, sp === 'axolotl' ? 1.1 : 1.5)
    await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
    await p.keyboard.press('e'); await sleep(900)
    const o = await opts(p); if (o.length) return o
    await p.keyboard.press('Escape'); await sleep(400)
  }
  return []
}
const pick = (p: Page, label: string) => p.evaluate((l) => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith(l)) as HTMLButtonElement | undefined; b?.click(); return !!b }, label)   // the selected answer carries a '›'
/** pick Feed and watch her for 3 s (per animation frame): did she go 'happy', how many cheers, peak hop above her pre-feed y */
async function feedAndWatch(p: Page, sp: string) {
  const before = await trotOf(p, sp)
  ok(await pick(p, 'Feed'), `${sp}: picked Feed`)
  const seen = await p.evaluate(`new Promise(res => { const t0 = performance.now(), sp = ${JSON.stringify(sp)}; let happy = false, peak = -9, base = null; const hud = new Set()
    function f() { for (const e of document.querySelectorAll('[data-say]')) hud.add(e.textContent ?? ''); const t = window.__spiritModel?.trots?.[sp]; if (t) { if (base === null) base = t.y; if (t.mode === 'happy') { happy = true; peak = Math.max(peak, t.y - base) } }
      if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res({ happy, peak, hud: [...hud] }) } requestAnimationFrame(f) })`) as { happy: boolean; peak: number; hud: string[] }
  const after = await trotOf(p, sp)
  return { ...seen, cheers: (after?.cheers ?? 0) - (before?.cheers ?? 0), yMax: after?.yMax ?? 0 }
}

// A. with food
const a = await run([['waymark', 12], ['glowfin', 2], ['moonkoi', 1]])
if (a) {
  const o = await talkTo(a.p, 'fox')
  ok(o.length === 3 && o[0].t.startsWith('Feed') && !o[0].off && o[0].tag === 'Glowfin', `A Vulnyx: Feed pickable, tagged with the food it gives (${JSON.stringify(o)})`)
  const w = await feedAndWatch(a.p, 'fox'), i1 = await inv(a.p), f1 = await fed(a.p)
  ok(i1.glowfin === 1 && i1.moonkoi === 1, `A Vulnyx fed: Glowfin 2 -> ${i1.glowfin}, Moonkoi ${i1.moonkoi} (one item consumed)`)
  ok(w.happy && w.cheers === 1 && w.yMax > 0.05, `A Vulnyx reacts: the happy beat (seen ${w.happy}, cheers +${w.cheers}, peak hop ${w.yMax.toFixed(3)} m)`)
  ok(f1['vx-check']?.n === 1 && f1['vx-check']?.item === 'glowfin', `A Vulnyx: fed record ${JSON.stringify(f1['vx-check'])}`)
  ok(w.hud.some(x => x.includes('Vulnyx') && x.includes('Glowfin')), `A HUD note after the feed (${w.hud.slice(-2).join(' | ')})`)
  const o2 = await talkTo(a.p, 'axolotl')
  ok(o2[0]?.tag === 'Glowfin', `A Manalotl: Feed tagged Glowfin (${o2[0]?.tag})`)
  const w2 = await feedAndWatch(a.p, 'axolotl'), i2 = await inv(a.p), f2 = await fed(a.p)
  ok(!i2.glowfin && i2.moonkoi === 1 && w2.happy && w2.cheers === 1, `A Manalotl fed: Glowfin -> ${i2.glowfin ?? 0}, happy ${w2.happy}, cheers +${w2.cheers}, peak ${w2.yMax.toFixed(3)} m`)
  ok(f2['mx-check']?.n === 1 && f2['vx-check']?.n === 1, `A per-spirit records ${JSON.stringify(f2)}`)
  // reload: everything persists
  await a.p.reload({ waitUntil: 'load', timeout: 180000 }); await ready(a.p)
  const i3 = await inv(a.p), f3 = await fed(a.p)
  ok(f3['vx-check']?.n === 1 && f3['vx-check']?.item === 'glowfin' && f3['mx-check']?.n === 1 && !i3.glowfin && i3.moonkoi === 1, `A after reload: records ${JSON.stringify(f3)}, bag glowfin ${i3.glowfin ?? 0} moonkoi ${i3.moonkoi}`)
  const o3 = await talkTo(a.p, 'fox')
  ok(o3[0]?.tag === 'Moonkoi', `A after reload: the Vulnyx's Feed now gives Moonkoi (${o3[0]?.tag})`)
  await a.p.keyboard.press('Escape')
  ok(a.errs.length === 0, `A 0 page errors ${a.errs.join(' | ')}`)
  await a.p.close()
}
// B. no food
const b = await run([['waymark', 12], ['roast_rinn', 2]])
if (b) {
  const i0 = await inv(b.p)
  const o = await talkTo(b.p, 'fox')
  ok(o.length === 3 && o[0].t === 'Feed' && !o[0].off && !o[0].tag, `B Vulnyx, no spirit food: Feed shown, no food tag (${JSON.stringify(o)})`)
  const w = await feedAndWatch(b.p, 'fox'), i1 = await inv(b.p), f1 = await fed(b.p)
  ok(w.hud.some(x => x.includes(NONE_LINE)), `B the plain refusal on the HUD (${w.hud.slice(-2).join(' | ')})`)
  ok(JSON.stringify(i1) === JSON.stringify(i0), `B nothing consumed (${JSON.stringify(i1)})`)
  ok(!Object.keys(f1).length && !w.happy && w.cheers === 0, `B no fed record, no happy beat (${JSON.stringify(f1)}, happy ${w.happy})`)
  ok(b.errs.length === 0, `B 0 page errors ${b.errs.join(' | ')}`)
  await b.p.close()
}
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
