// ── BETA M117 slice 3: HOLLOWS RESPECT BUILDINGS, ON THE LIVE PAGE ─────────────────────────────────────────────────────
// A fresh profile (born in the Glade, out by the gate's E, as node-check), then to a generated settlement whose trade
// buildings stand (settlement-check's travel). With one house between the keeper and the Hollows:
//   1. the house's walls are in the Hollows' structure query (__ather.walls)
//   2. a floater's spit at the keeper behind the house hits the WALL: combat.wallHits +1, keeper hp unchanged
//   3. a shambler chasing the keeper from the far side goes ROUND: never inside a wall box over the run, and comes within 3 m
//   4. 390x844, 0 page errors
// Hooks: __ather.travel / tp / state / zone / combat / walls, __settlements.built, __fight.hp. Positions are set in the sim.
//   npx tsx scripts/m117-hollows-walls-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { settlementLots } from '../src/app/shimmer/open/ather/settlement-lots'
import { segmentHit, type Structures } from '../src/app/shimmer/open/ather/obstacles'
import type { Box } from '../src/app/shimmer/open/terrain-world'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const st = net.settlements.find(s => s.id !== 'moonwell' && settlementLots(s, net.season).length >= 3)!
const tx = Math.floor((st.x + 500) / 1000), tz = Math.floor((st.z + 500) / 1000)
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const tile = tiles.tiles.find(t => t.tx === tx && t.ty === tz)!
console.log(`settlement ${st.name} (${st.id}) at ${st.x}, ${st.z}`)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const stt = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py, z: a.pz } }) as Promise<{ x: number; y: number; z: number }>
  // ── fresh profile: born in the Glade, out by the gate (node-check's route) ──
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  for (let t = 0; t < 90000 && !(await p.evaluate(() => (window as any).__ather.zone() === 'glade' || !!document.querySelector('[data-panel="birth"]') || !!document.querySelector('[data-creator-done]'))); t += 500) await sleep(500)
  if (await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))) {
    const box = await p.evaluate(() => { let best: DOMRect | null = null, area = Infinity
      for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) { const t = (e.innerText ?? '').trim(); if (!t || !/^BE BORN/i.test(t) || t.length > 40) continue
        const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue; if (r.width * r.height < area) { area = r.width * r.height; best = r } }
      return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 } })
    if (box) await p.mouse.click(box.x, box.y)
  }
  for (let t = 0; t < 45000 && !(await p.evaluate(() => (window as any).__ather.zone() === 'glade')); t += 500) { await p.evaluate(() => document.querySelector<HTMLElement>('[data-creator-done]')?.click()); await sleep(500) }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'glade', { timeout: 60000 })
  { const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
    await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
    await p.waitForFunction(() => /the gate \(the Wilds\)/.test(document.body.innerText), { timeout: 15000 }).catch(() => {})
    await p.keyboard.press('KeyE') }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 90000 })
  console.log('in the Wilds')
  // ── to the settlement ──
  await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'm117-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, st.x - tx * 1000, st.z - tz * 1000)
  await poll(async () => { const s = await stt(); return Math.hypot(s.x - st.x, s.z - st.z) < 80 }, 60000)
  await sleep(6000); await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(4000)
  const built = () => p.evaluate((id: string) => (((window as any).__settlements?.built?.() ?? []) as { id: string; lots: { id: string; x: number; z: number }[] }[]).find(b => b.id === id)?.lots ?? [], st.id) as Promise<{ id: string; x: number; z: number }[]>
  await poll(async () => (await built()).length > 0, 60000)
  const lots = await built()
  // walls of the first lot's house, from the Hollows' own query
  let walls: Box[] = []
  await poll(async () => { walls = await p.evaluate((x, z) => (window as any).__ather.walls(x - 9, z - 9, x + 9, z + 9), lots[0]?.x ?? st.x, lots[0]?.z ?? st.z) as Box[]; return walls.length > 0 }, 30000)
  ok(walls.length > 0, `1. the house's walls are in the Hollows' structure query (${walls.length} boxes near lot ${lots[0]?.id})`)
  if (!walls.length) throw new Error('no walls: nothing to test')
  // keep only this house's boxes (a neighbour's may sit inside 9 m): the cluster round the lot centre
  const bx0 = Math.min(...walls.map(b => b.x0)), bx1 = Math.max(...walls.map(b => b.x1)), bz0 = Math.min(...walls.map(b => b.z0)), bz1 = Math.max(...walls.map(b => b.z1))
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, gy = await p.evaluate(() => (window as any).__ather.state().py) as number
  const Q: Structures = (x0, z0, x1, z1) => walls.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0)
  // a line across the house that the walls block at both a floater's height and a keeper's chest (doors are gaps)
  let pick: { kx: number; kz: number; hx: number; hz: number } | null = null
  for (const axis of ['x', 'z'] as const) for (const off of [0, -1.5, 1.5, -3, 3]) for (const sgn of [1, -1]) {
    if (pick) break
    const half = axis === 'x' ? (bx1 - bx0) / 2 : (bz1 - bz0) / 2
    const kx = axis === 'x' ? cx + sgn * (half + 2.5) : cx + off, kz = axis === 'x' ? cz + off : cz + sgn * (half + 2.5)
    const hx = axis === 'x' ? cx - sgn * (half + 7) : cx + off, hz = axis === 'x' ? cz + off : cz - sgn * (half + 7)
    if (segmentHit(Q, hx, gy + 2.2, hz, kx, gy + 0.9, kz) && segmentHit(Q, hx, gy + 0.9, hz, kx, gy + 0.9, kz)) pick = { kx, kz, hx, hz }
  }
  ok(!!pick, `   a line across the house blocked by its walls: keeper ${pick?.kx.toFixed(1)},${pick?.kz.toFixed(1)} / Hollow ${pick?.hx.toFixed(1)},${pick?.hz.toFixed(1)}`)
  if (!pick) throw new Error('no blocked line')
  const { kx, kz, hx, hz } = pick
  await p.evaluate((x, z, yaw) => (window as any).__ather.tp(x, z, yaw), kx, kz, Math.atan2(-(hx - kx), -(hz - kz)))
  await poll(async () => { const s = await stt(); return Math.hypot(s.x - kx, s.z - kz) < 0.5 }, 8000); await sleep(1500)
  // clear the field: any Hollow already here goes (a check, not a fight), the keeper at full health
  const clear = () => p.evaluate(() => { const C = (window as any).__ather.combat(); C.hollows.length = 0; C.spits.length = 0; C.keeper.hp = C.keeper.maxHp })
  await clear(); await sleep(500)
  // ── 2. a floater's spit at the keeper behind the house ──
  const hp0 = await p.evaluate(() => (window as any).__fight.hp()) as number, w0 = await p.evaluate(() => (window as any).__ather.combat().wallHits ?? 0) as number
  await p.evaluate((x, z, y) => { const C = (window as any).__ather.combat()
    C.hollows.push({ id: C.nextId++, kind: 'floater', x, y: y + 2.2, z, yaw: 0, hp: 20, maxHp: 20, state: 'charge', t: 0.05, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }) }, hx, hz, gy)
  const hitWall = await poll(async () => (await p.evaluate(() => (window as any).__ather.combat().wallHits ?? 0) as number) > w0, 15000)
  const hp1 = await p.evaluate(() => (window as any).__fight.hp()) as number
  const spitAt = await p.evaluate(() => (window as any).__ather.combat().spits.length) as number
  ok(hitWall, `2. the floater's spit hit the WALL (wallHits ${w0} -> ${await p.evaluate(() => (window as any).__ather.combat().wallHits ?? 0)})`)
  ok(hp1 === hp0, `   keeper behind the house untouched (hp ${hp0} -> ${hp1}; spits in flight ${spitAt})`)
  await p.screenshot({ path: `${out}/m117-wall-spit.png` }).catch(() => {})
  await clear(); await sleep(500)
  // ── 3. a shambler chasing from the far side goes round ──
  await p.evaluate((x, z, y) => { const C = (window as any).__ather.combat()
    C.hollows.push({ id: C.nextId++, kind: 'shambler', x, y, z, yaw: 0, hp: 9999, maxHp: 9999, state: 'chase', t: 0, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }) }, hx, hz, gy)
  let inside = 0, samples = 0, closest = 99, worst = '', lastLog = 0
  const t0 = Date.now(), clock0 = await p.evaluate(() => (window as any).__ather.combat().clock ?? 0) as number
  while (Date.now() - t0 < 240000) {
    const h = await p.evaluate(() => { const C = (window as any).__ather.combat(), h = C.hollows.find((q: any) => q.kind === 'shambler'); C.keeper.hp = C.keeper.maxHp; return h ? { x: h.x, y: h.y, z: h.z, st: h.state, sm: h.sm, clock: C.clock } : null }) as { x: number; y: number; z: number; st: string; sm: unknown; clock: number } | null
    if (!h) break
    samples++
    if (Date.now() - lastLog > 10000) { lastLog = Date.now(); console.log(`   t ${((Date.now() - t0) / 1000).toFixed(0)} s (sim ${(h.clock - clock0).toFixed(1)} s): ${h.st} at ${h.x.toFixed(2)},${h.y.toFixed(2)},${h.z.toFixed(2)} sm ${JSON.stringify(h.sm)} ${Math.hypot(h.x - kx, h.z - kz).toFixed(1)} m`) }
    const inBox = walls.find(b => h.x > b.x0 && h.x < b.x1 && h.z > b.z0 && h.z < b.z1 && b.y1 > h.y + 0.6 && b.y0 < h.y + 1.75)
    if (inBox) { inside++; worst = `${h.x.toFixed(2)},${h.z.toFixed(2)} in ${JSON.stringify(inBox)}` }
    closest = Math.min(closest, Math.hypot(h.x - kx, h.z - kz))
    if (closest < 3) break
    await sleep(150)
  }
  ok(samples > 10 && inside === 0, `3. the shambler never stood inside a wall (${inside}/${samples} samples${worst ? `; ${worst}` : ''})`)
  ok(closest < 3, `   it came round to the keeper (closest ${closest.toFixed(2)} m, ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  await p.screenshot({ path: `${out}/m117-round.png` }).catch(() => {})
  await clear()
  ok(errs.length === 0, `4. 390x844, 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
