// GROWN SPIRIT SIZES on prod (sprites-sizes, 2026-11-24; Alex "the manalotl is way too small", Magii RULED-AFK athernyx 2a8b028).
// Owner + ?spirits=3d at 390x844, the vulnyx-ingame-check setup (bloomed Vulnyx + Manalotl planters). Asserts, from the scene:
//  the Vulnyx's drawn box height ~0.70 m (+-10%), the Manalotl's nose-to-tail ~0.90 m (+-10%), both walk (moved > 0.3 m within
//  120 s; the calm dials can hold a sit for ~50 s wall at SwiftShader frame rates), the ground keep applied and never > 0.1 m,
//  0 page errors. --shots <dir>: one close shot of each, framed from the keeper's eye (1.62 m), so the eye line is the scale.
//   OWNER_KEY=... npx tsx scripts/sizes-grown-check.mts [--url ...] [--shots docs/looks/sizes-2026-11-24]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { GROWN } from '../src/app/shimmer/sprites/creature-size'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', '')
if (shots) mkdirSync(shots, { recursive: true })
const OWNER_KEY = process.env.OWNER_KEY
if (!OWNER_KEY) { console.error('OWNER_KEY not set'); process.exit(2) }
const P = { x: -130, z: 102.5 }
const PLANTER = { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
// M107 s2: furniture near her planter, so the roam has real blockers to miss (checked below from FURNITURE's own sizes)
const NEAR = [{ id: 'vx-bench', item: 'goldwood_bench', x: P.x + 2.4, z: P.z, q: 0, placedAt: 1 }, { id: 'vx-box', item: 'planter_box', x: P.x - 0.4, z: P.z - 3.2, q: 0, placedAt: 1 },
  // M102 Manalotl wire-in: her planter, and a third species' (owl: no model yet = the gold orb)
  { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 }, { id: 'ox-check', item: 'spirit_planter', x: P.x + 2.8, z: P.z - 2.4, q: 0, placedAt: 1 }]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})

async function run(owner: boolean, withFlag: boolean, w = 390, h = 844, hour = 14) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  let glb = 0, mglb = 0; p.on('response', r => { if (r.url().includes('/open/spirits/vulnyx.glb')) glb = r.status(); if (r.url().includes('/open/spirits/manalotl.glb')) mglb = r.status() })
  if (owner) {
    // /owner redirects to siteOrigin (prod) even on a devwin, so hit it without following, then read /api/owner ON this origin
    await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(OWNER_KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    const o = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
    if (!o) { ok(false, 'owner cookie took'); await p.close(); return null }
  }
  await p.evaluateOnNewDocument((piece: unknown, bloomAt: number, near: unknown[]) => {
    if (sessionStorage.getItem('vxc')) return; sessionStorage.setItem('vxc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [piece, ...near] }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: bloomAt }], pots: { 'vx-check': { seed: 'mana_seed_fox', at: bloomAt, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: bloomAt, bloomed: true }, 'ox-check': { seed: 'mana_seed_owl', at: bloomAt, bloomed: true } }, met: [] }))
  }, PLANTER, Date.now() - BLOOM_MS - 60000, NEAR)
  await p.goto(`${url}/shimmer/open/ather?hour=${hour}${withFlag ? '&spirits=3d' : ''}`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), P.x, P.z)
  await sleep(owner && withFlag ? 9000 : 6000)
  const mounted = await p.evaluate(() => (window as any).__spiritModel?.mounted ?? 0) as number
  return { p, errs, glb: () => glb, mglb: () => mglb, mounted }
}

const a = await run(true, true)
if (a) {
  const p = a.p
  ok(a.mounted >= 2, `owner + flag: both models mounted (${a.mounted})`)
  const start = await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return { fx: t?.fox?.x, fz: t?.fox?.z, mx: t?.axolotl?.x, mz: t?.axolotl?.z } }) as Record<string, number>
  let fm = 0, mm = 0, modes = new Set<string>(), last: any = null
  for (let i = 0; i < 120 && (fm < 0.3 || mm < 0.3); i++) {
    await sleep(1000)
    last = await p.evaluate(() => JSON.parse(JSON.stringify((window as any).__spiritModel?.trots ?? {})))
    if (last.fox) fm = Math.max(fm, Math.hypot(last.fox.x - start.fx, last.fox.z - start.fz))
    if (last.axolotl) { mm = Math.max(mm, Math.hypot(last.axolotl.x - start.mx, last.axolotl.z - start.mz)); modes.add(last.axolotl.mode) }
  }
  ok(fm > 0.3, `the Vulnyx walks: ${fm.toFixed(2)} m from where she started`)
  ok(mm > 0.3, `the Manalotl walks: ${mm.toFixed(2)} m from where she started (modes ${[...modes].join(',')})`)
  await sleep(1500); last = await p.evaluate(() => JSON.parse(JSON.stringify((window as any).__spiritModel?.trots ?? {})))
  const hv = last.fox?.hWorld ?? 0, lm = last.axolotl?.len ?? 0, hm = last.axolotl?.hWorld ?? 0, gv = GROWN.fox.height, gl = GROWN.axolotl.length!
  ok(hv > gv * 0.9 && hv < gv * 1.1, `Vulnyx scene-box height ${hv.toFixed(3)} m (grown ${gv}, +-10%)`)
  ok(lm > gl * 0.9 && lm < gl * 1.1, `Manalotl scene-box length ${lm.toFixed(3)} m nose to tail (grown ${gl}, +-10%); her height ${hm.toFixed(3)} m`)
  const kv = last.fox?.keepMax ?? -1, km = last.axolotl?.keepMax ?? -1
  ok(kv >= 0 && kv < 0.1 && km >= 0 && km < 0.1, `ground keep applied: max lift Vulnyx ${kv.toFixed(3)} m, Manalotl ${km.toFixed(3)} m (none sinks, none floats > 0.1)`)
  if (shots) for (const sp of ['fox', 'axolotl'] as const) {
    const t = last[sp]; if (!t) continue
    await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x + 0.9, z + 1.9, 0), t.x, t.z); await sleep(1500)
    const now = await p.evaluate((s: string) => (window as any).__spiritModel?.trots?.[s], sp) as any
    await aimAt(p, now.x, now.z, (now.h ?? 0.5) * 0.4); await sleep(800)
    await hideCard(p); try { await p.screenshot({ path: `${shots}/${sp === 'fox' ? 'vulnyx' : 'manalotl'}-grown-390.png` }) } catch { /* slow frame */ }
  }
  ok(a.errs.length === 0, `0 page errors ${a.errs.join(' | ')}`)
  await p.close()
}
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
