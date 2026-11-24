// ── BETA M126 s1: FOLLOWER FORMATION, PLAYED AT 390x844 AS A NON-OWNER ─────────────────────────────────────────────────
// SETUP (stated): 3 bloomed spirits on 3 Spirit Beds (pa Vulnyx, pb Vulnyx, pc Manalotl), all three FOLLOWING
// (ather.spiritFollow.v1), a Mana'mal out (Gemdigger, open.companion.v1), and a goldwood wall along z = 101 from x -147 to
// -131 with a 2 m DOOR at x -140..-138. Hooks: __ather.tp / state (movement + reading), __formation (read-only probe,
// shared/follow-formation.ts: members, slots, where each really stands, layout).
//  1. Boot: the formation holds 4 (the Mana'mal + 3 spirits).
//  2. Walk away from the wall (-z), turn 180, walk back, stop: at rest no two followers (or the keeper) closer than the sum
//     of their body radii; every one behind the keeper's facing; the Mana'mal 3-4.5 m out, behind and off to one side, outside the spirits' arc (s3; was: nearer than
//     the spirits, at heel); layout arc.
//  2b. (s3) Small steps of the keeper (1 m ahead, 1 m back) do not move the Mana'mal at all.
//  3. Walk on through the door: single file is taken while crossing; every follower crosses the wall line INSIDE the door;
//     never two abreast at the door (within 1 m of the wall line, 0.6 m apart in depth at least); past it and stopped: spaced again, behind.
//  4. 0 page errors.
//   npx tsx scripts/m126-formation-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m126-formation')
mkdirSync(out, { recursive: true })
const BEDS = ['pa', 'pb', 'pc'].map((id, k) => ({ id, item: 'spirit_planter', x: -146, z: 90 + k * 3, q: 0, placedAt: 1 }))
const at0 = Date.now() - 20 * 86400000
const POTS = {
  pa: { seed: 'mana_seed_fox', at: at0, v: 2, tends: [], bloomed: true },
  pb: { seed: 'mana_seed_fox', at: at0 + 1, v: 2, tends: [], bloomed: true },
  pc: { seed: 'mana_seed_axolotl', at: at0 + 2, v: 2, tends: [], bloomed: true },
}
const WALL_Z = 101, DOOR = [-140, -138] as const
const WALLS: Record<string, { mat: string; kind?: string }> = {}
for (let i = -147; i < -131; i++) WALLS[`h,${i},${WALL_Z}`] = i >= DOOR[0] && i < DOOR[1] ? { mat: 'goldwood', kind: 'door' } : { mat: 'goldwood' }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
type V = { x: number; z: number }
type F = { layout: string; lagYaw: number; stopped: boolean; keeper: V & { yaw: number }; members: { id: string; kind: string; r: number }[]; pos: Record<string, V>; slots: Record<string, V> }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  ok(!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)), '0. a NON-owner keeper')
  await p.evaluateOnNewDocument((s: { pieces: unknown[]; pots: unknown; tut: unknown; walls: unknown }) => {
    if (sessionStorage.getItem('m126')) return; sessionStorage.setItem('m126', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces, walls: s.walls }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['pa', 'pb', 'pc']))
    localStorage.setItem('open.companion.v1', JSON.stringify({ active: 'gemdigger', met: ['gemdigger'], sentHome: false }))
    for (const k of ['ather.spiritFed.v1', 'ather.trainAssign.v1', 'open.bank.v1', 'ather.spiritParty.v1']) localStorage.removeItem(k)
  }, { pieces: BEDS, pots: POTS, tut: TUT, walls: WALLS })
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const form = () => p.evaluate(() => JSON.parse(JSON.stringify((window as any).__formation ?? null))) as Promise<F | null>
  const tpF = (x: number, z: number, yaw: number) => p.evaluate((a: number, b: number, c: number) => { (window as any).__ather?.tp?.(a, b, c); return JSON.parse(JSON.stringify((window as any).__formation ?? null)) }, x, z, yaw) as Promise<F | null>
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000); await hideCard()
  await p.touchscreen.tap(195, 644); await sleep(600)

  // walk in small tp steps (~3 m/s), reading the formation each step
  let K = { x: -139, z: 97, yaw: 0 }
  const samples: F[] = []
  const walk = async (to: V, yaw: number, mps = 3) => {
    const d = Math.hypot(to.x - K.x, to.z - K.z), n = Math.max(1, Math.ceil(d / 0.25))
    for (let i = 1; i <= n; i++) { const t0 = Date.now(); const x = K.x + (to.x - K.x) * i / n, z = K.z + (to.z - K.z) * i / n
      const f = await tpF(x, z, yaw); if (f) samples.push(f); const wait = 250 / mps - (Date.now() - t0); if (wait > 0) await sleep(wait) }
    K = { x: to.x, z: to.z, yaw }
  }
  const rest = async (s: number) => { const until = Date.now() + s * 1000; while (Date.now() < until) { const f = await tpF(K.x, K.z, K.yaw); if (f) samples.push(f); await sleep(250) } }
  await tpF(K.x, K.z, K.yaw); await sleep(1500)
  // 1. the formation holds all four
  const ok4 = await (async () => { for (let t = 0; t < 60; t++) { await tpF(K.x, K.z, K.yaw); const f = await form(); if (f && f.members.length === 4 && Object.keys(f.pos).length === 4) return f; await sleep(500) } return form() })()
  ok(!!ok4 && ok4.members.length === 4 && ok4.members.filter(m => m.kind === 'spirit').length === 3 && ok4.members.some(m => m.kind === 'manamal'), `1. the formation holds the Mana'mal + 3 spirits (${JSON.stringify(ok4?.members.map(m => `${m.id}:${m.kind}:${m.r.toFixed(2)}`))})`)

  const fwd = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })
  const atRest = (tag: string, f: F | null) => {
    if (!f) { ok(false, `${tag}: no formation`); return }
    const k = f.keeper, body = [...f.members.map(m => ({ id: m.id, r: m.r, p: f.pos[m.id] })), { id: 'keeper', r: 0.35, p: { x: k.x, z: k.z } }]
    let worst = ''
    for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) { const a = body[i], b = body[j]; if (!a.p || !b.p) { worst ||= `${a.id}/${b.id} missing`; continue }
      const d = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z); if (d < a.r + b.r) worst ||= `${a.id}-${b.id} ${d.toFixed(2)} < ${(a.r + b.r).toFixed(2)}` }
    ok(!worst, `${tag}: no two closer than the sum of their body radii (${worst || 'all clear'}; ${f.members.map(m => `${m.id}@${f.pos[m.id]?.x.toFixed(1)},${f.pos[m.id]?.z.toFixed(1)}`).join(' ')})`)
    const fw = fwd(k.yaw), back = (q: V) => -((q.x - k.x) * fw.x + (q.z - k.z) * fw.z)
    ok(f.members.every(m => f.pos[m.id] && back(f.pos[m.id]) > 0.3), `${tag}: every follower is behind the keeper's facing (${f.members.map(m => back(f.pos[m.id] ?? k).toFixed(2)).join(', ')})`)
    const mm = f.members.find(m => m.kind === 'manamal')!, near = (id: string) => Math.hypot(f.pos[id].x - k.x, f.pos[id].z - k.z)
    const q = f.pos[mm.id], sd = (q.x - k.x) * -fw.z + (q.z - k.z) * fw.x
    ok(near(mm.id) >= 3 && near(mm.id) <= 4.5, `${tag}: the Mana'mal gives room, 3-4.5 m out (${near(mm.id).toFixed(2)})`)
    ok(back(q) > 1 && Math.abs(sd) > 1, `${tag}: the Mana'mal behind and off to one side (back ${back(q).toFixed(2)}, side ${sd.toFixed(2)})`)
    ok(f.members.filter(m => m.kind === 'spirit').every(m => near(m.id) < near(mm.id)), `${tag}: the Mana'mal outside the spirits' arc`)
    ok(f.layout === 'arc', `${tag}: in the open, the arc (${f.layout})`)
  }
  // 2. walk away from the wall, turn 180, walk back, stop
  await walk({ x: -139, z: 91 }, 0)
  await walk({ x: -139, z: 94 }, Math.PI)
  await rest(7)
  atRest('2. walk / turn 180 / stop', await form()); await shot('m126-2-rest')
  // 2b. small steps
  { const mm0 = (await form())!.pos.manamal, from = samples.length
    await walk({ x: -139, z: 95 }, Math.PI); await rest(1.5); await walk({ x: -139, z: 94 }, Math.PI); await rest(1.5)
    const mv = Math.max(...samples.slice(from).map(f => Math.hypot(f.pos.manamal.x - mm0.x, f.pos.manamal.z - mm0.z)))
    ok(mv < 0.05, `2b. 1 m ahead and back: the Mana'mal stays where it is (moved ${mv.toFixed(2)})`) }
  // 3. through the door
  samples.length = 0
  await walk({ x: -139, z: 105 }, Math.PI, 2)
  await rest(9)
  const sawFile = samples.some(s => s.layout === 'file')
  ok(sawFile, `3. single file while crossing the door (layouts: ${[...new Set(samples.map(s => s.layout))].join(',')})`)
  const cross: Record<string, number | null> = {}
  // single file = never two ABREAST at the door: of any two within 1 m of the wall line, one is at least 0.6 m behind the other
  let abreast = ''
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], near: { id: string; p: V }[] = []
    for (const m of b.members) { const p0 = a.pos[m.id], p1 = b.pos[m.id]; if (!p0 || !p1) continue
      if (p0.z < WALL_Z && p1.z >= WALL_Z && !(m.id in cross)) cross[m.id] = p0.x + (p1.x - p0.x) * ((WALL_Z - p0.z) / ((p1.z - p0.z) || 1))
      if (Math.abs(p1.z - WALL_Z) < 1 && p1.x > DOOR[0] - 1 && p1.x < DOOR[1] + 1) near.push({ id: m.id, p: p1 }) }
    for (let x = 0; x < near.length; x++) for (let y = x + 1; y < near.length; y++) if (Math.abs(near[x].p.z - near[y].p.z) < 0.6) abreast ||= `${near[x].id}/${near[y].id} at z ${near[x].p.z.toFixed(2)}/${near[y].p.z.toFixed(2)}`
  }
  const last = await form()
  ok(!!last && last.members.every(m => typeof cross[m.id] === 'number' && cross[m.id]! > DOOR[0] && cross[m.id]! < DOOR[1]), `3. every follower crossed the wall inside the door (${JSON.stringify(Object.fromEntries(Object.entries(cross).map(([k, v]) => [k, v?.toFixed(2)])))})`)
  ok(!abreast, `3. single file: never two abreast at the door (${abreast || 'one behind the other'})`)
  atRest('3. past the door, stopped', last); await shot('m126-3-past-door')
  ok(errs.length === 0, `4. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
