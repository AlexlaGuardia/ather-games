// ── M109 s4 THE PARTY KEEPS NEAR THE KEEPER, OWNER-ONLY (2026-11-23, sprites-M109s4) ─────────────────────────────────────
// SETUP (stated): the Vulnyx and the Manalotl bloomed on two placed planters; the Vulnyx is in the PARTY (ather.spiritParty.v1),
// the Manalotl is not. Owner cookie + ?spirits=3d, 390x844 (SwiftShader). No Follow on either (Follow is s1's tight trail).
//  1. The probe reads near=true for the Vulnyx, near=false for the Manalotl (the party list reached the trot).
//  2. The keeper walks ~20 m east of the planters (stepped teleports, ~4 m/s) and stands.
//  3. Within 30 s the Vulnyx's distance to the keeper falls under NEAR.r (8 m); the Manalotl's never does (she roams by home).
//  4. 0 page errors.
//   npx tsx scripts/m109-party-near-check.mts [--url http://localhost:3202]      (OWNER_KEY from env or .env; run on the box)
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { NEAR } from '../src/app/shimmer/open/ather/spirit-trot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, WALK = 20
const PIECES = [{ id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'mx-check', item: 'spirit_planter', x: P.x - 2.6, z: P.z + 1.0, q: 0, placedAt: 1 }]
const POTS = (at: number) => ({ 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true }, 'mx-check': { seed: 'mana_seed_axolotl', at: at + 1, bloomed: true } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); await br.close(); process.exit(1) }
await p.evaluateOnNewDocument((pieces: unknown[], pots: unknown) => {
  if (sessionStorage.getItem('m109n')) return; sessionStorage.setItem('m109n', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots, met: [] }))
  for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1']) localStorage.removeItem(k)
  localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check']))
}, PIECES, POTS(Date.now() - BLOOM_MS - 60000))
await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), P.x, P.z)
for (let i = 0; i < 40; i++) { await sleep(500); if (await p.evaluate(() => { const t = (window as any).__spiritModel?.trots; return !!(t?.fox && t?.axolotl) })) break }
type S = { vx: number; mx: number; vNear: boolean; mNear: boolean; kx: number; kz: number } | null
const read = () => p.evaluate(() => {
  const t = (window as any).__spiritModel?.trots, g = (window as any).__ather.state(); if (!t?.fox || !t?.axolotl) return null
  const kx = g.px ?? g.x, kz = g.pz ?? g.z
  return { vx: Math.hypot(t.fox.x - kx, t.fox.z - kz), mx: Math.hypot(t.axolotl.x - kx, t.axolotl.z - kz), vNear: !!t.fox.near, mNear: !!t.axolotl.near, kx, kz }
}) as Promise<S>
await sleep(6000)
const s0 = await read()
ok(!!s0 && s0.vNear && !s0.mNear, `1 the party reached the trot: Vulnyx near=${s0?.vNear}, Manalotl near=${s0?.mNear}`)
// 2. the walk: ~4 m/s in 0.25 s steps
const k0 = s0 ? { x: s0.kx, z: s0.kz } : { x: P.x, z: P.z + 5 }
for (let i = 1; i <= WALK; i++) { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), k0.x + i, k0.z); await sleep(250) }
const s1 = await read()
const walked = s1 ? Math.hypot(s1.kx - k0.x, s1.kz - k0.z) : 0
ok(walked > WALK - 2, `2 the keeper walked ${walked.toFixed(1)} m (Vulnyx ${s1?.vx.toFixed(1)} m, Manalotl ${s1?.mx.toFixed(1)} m off as he stops)`)
let backAt = -1, vBest = 99, mBest = 99; const t0 = Date.now()
while (Date.now() - t0 < 30000) {
  const s = await read(); if (s) { vBest = Math.min(vBest, s.vx); mBest = Math.min(mBest, s.mx); if (s.vx < NEAR.r && backAt < 0) backAt = (Date.now() - t0) / 1000 }
  await sleep(250)
}
ok((s1?.vx ?? 0) > NEAR.r && backAt >= 0, `3 the party Vulnyx drifts back: ${s1?.vx.toFixed(1)} m -> under ${NEAR.r} m in ${backAt.toFixed(1)} s (nearest ${vBest.toFixed(2)} m)`)
ok(mBest > NEAR.r, `3 the non-party Manalotl does not track the keeper (nearest ${mBest.toFixed(2)} m over 30 s)`)
ok(errs.length === 0, `4 0 page errors ${errs.join(' | ')}`)
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
