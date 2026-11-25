// ── M40: MOONWELL GLADE, LAYOUT B, ON THE LIVE PAGE (world d5a9e927, 11-19; retargeted M67 s1b-3, 11-22) ───────────────
// ★ M67 s1b-2: the Glade LEFT the Wilds. Its pond, green, five lots, Greg's home and jetty stand in GREG'S GARDEN in the closed
//   Glade (zone 'glade', its own coords: moonwell.ts GLADE_ANCHOR), floor y 2. A born keeper is sent there with the real
//   __ather.travel({ kind: 'glade' }) (it sets them down where a newborn wakes, facing Greg) and reads the Glade as built:
//   1. the five are drawn where the plan puts them (±1 m of folk-spots.ts folkSpots(GLADE): Fennel at her lot in Greg's garden,
//      the other four in the FRIENDS' gardens, 220-316 m away; their lots stay in Greg's garden as backdrop). Probe: __glade.folk
//   2. every lot's pad, the green and the Glade's ANCHOR (the open south end of the green, where the Wilds waymark stood) are
//      LEVEL: the keeper stood on each reads the same feet height (±0.1 m)
//   3. (M157) over the pond + shore the DRAWN ground is the walked ground (a ray down on the live meshes, 3 cm), the keeper's feet are
//      on it, the UNSCULPTED base is a bowl > 1 m under the floor (pure: the live layer may be sculpted), and the deployed MOONWELL is the
//      41 x 49 m pond (__rinquest.moonwell()); the rinn scale's bank spot is 'at the water'
//   4. every Moglin is reachable ON FOOT: the ground runs unbroken from the green to each of the five (pure BFS), and a real
//      held W walks the keeper up to them (Fennel: from the green's centre; the four friends' folk: from 12 m out in their own
//      garden, the 200-315 m trek from the green being too long for one real-W walk at 1-2 fps)
//   5. the five say five distinct things (their hello lines; @lark words come after this blockout)
//   6. --phone 390x844: shots from the green at four headings (Alex's look: the green shows all five with one turn); 0 errors
// Hooks: __ather.travel (the way a keeper gets here) / tp / look (stand + face only, stated), __ather.state / __glade / __rinquest
// (read). Walking is real W.
//   npx tsx scripts/glade-check.mts [--url https://ather.games] [--out dir] [--phone [--w 360 --h 780]]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GLADE_GREEN, MOONWELL, SCALE_AT, atWater } from '../src/app/shimmer/open/ather/moonwell'
import { GLADE_LOTS, GLADE, onLot, LOT_D, gladeFolk, GLADE_STATION_LINES, newbornSpot } from '../src/app/shimmer/open/ather/moonwell-glade'
import { setGladeBlueprint, gladeLotBoxes, jettyBoxes } from '../src/app/shimmer/open/ather/glade-lots'
import { parseHouse } from '../src/app/shimmer/open/ather/plot-blueprint'
import { readFileSync, existsSync } from 'fs'
import { fromShore } from '../src/app/shimmer/open/ather/moonwell'
import { GLADE_ANCHOR } from '../src/app/shimmer/open/ather/moonwell'
import { gladeZoneGround } from '../src/app/shimmer/open/ather/glade-cluster'
import { folkSpots } from '../src/app/shimmer/open/ather/folk-spots'
import { aimAt } from './lib/aim.mts'
import { newInv, GIFT_YARROW_TAUGHT } from '../src/app/shimmer/open/shared/inventory'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/glade-check'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// M39: lots with Alex's blueprints (world/house-blueprints/glade-<lot>.json, the files prod reads) put their Moglin at the door
const withBp = GLADE_LOTS.map(l => l.id).filter(l => { const f = `world/house-blueprints/glade-${l}.json`; if (!existsSync(f)) return false; setGladeBlueprint(l, parseHouse(JSON.parse(readFileSync(f, 'utf8')))); return true })
console.log(`blueprints on: ${withBp.join(', ') || 'none'}`)
// where each of the five stands now: Fennel at her lot in Greg's garden, the four friends' folk in the friends' gardens (s1b-2)
const plan = folkSpots(GLADE, GLADE_LOTS.map(l => `moonwell:${l.id}`))
// a walking route round the walls: BFS on a 0.5 m grid over the Glade's solids (body radius), the pond kept out, and (new in the
// closed Glade, whose ground ends at the garden's edge) only where the Glade zone has ground at all
const SOLID = [...gladeLotBoxes(0), ...jettyBoxes(-1)].filter(b => b.y0 <= 1.7 && b.y1 > 0.05)
const onGround = (x: number, z: number) => Number.isFinite(gladeZoneGround(x, z))
const freeAt = (x: number, z: number) => onGround(x, z) && fromShore(x, z) > 0.4 && !SOLID.some(b => x + 0.4 > b.x0 && x - 0.4 < b.x1 && z + 0.4 > b.z0 && z - 0.4 < b.z1)
// pure reachability from the green over the Glade's ground (1 m grid; pond and solids out): the premise "every Moglin is
// reachable on foot" now spans three gardens, and the real-W walk below only covers the last stretch for the friends' folk
const reach = (() => {
  const C = 1, key = (i: number, j: number) => i * 100003 + j, i0 = Math.round(GLADE_GREEN.x / C), j0 = Math.round(GLADE_GREEN.z / C)
  const seen = new Set<number>([key(i0, j0)]), q: [number, number][] = [[i0, j0]]
  for (let h = 0; h < q.length; h++) { const [i, j] = q[h]; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = key(i + a, j + b), x = (i + a) * C, z = (j + b) * C; if (seen.has(n) || Math.abs(x - GLADE_GREEN.x) > 500 || Math.abs(z - GLADE_GREEN.z) > 500 || !freeAt(x, z)) continue; seen.add(n); q.push([i + a, j + b]) } }
  return (p: { x: number; z: number }) => seen.has(key(Math.round(p.x / C), Math.round(p.z / C)))
})()
function route(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number }[] | null {
  const C = 0.5, key = (i: number, j: number) => `${i},${j}`, at = (p: { x: number; z: number }) => [Math.round(p.x / C), Math.round(p.z / C)]
  const [si, sj] = at(from), [ti, tj] = at(to), prev = new Map<string, string | null>([[key(si, sj), null]]), q: [number, number][] = [[si, sj]]
  while (q.length) {
    const [i, j] = q.shift()!
    if (Math.hypot(i - ti, j - tj) * C < 1.6) { const out: { x: number; z: number }[] = []; let k: string | null = key(i, j); while (k) { const [a, b] = k.split(',').map(Number); out.unshift({ x: a * C, z: b * C }); k = prev.get(k)! } return out }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const n = key(i + di, j + dj); if (prev.has(n) || Math.hypot((i + di) * C - from.x, (j + dj) * C - from.z) > 48 || !freeAt((i + di) * C, (j + dj) * C)) continue; prev.set(n, key(i, j)); q.push([i + di, j + dj]) }
  }
  return null
}
// keep only the turns
const turns = (pts: { x: number; z: number }[]) => pts.filter((p, k) => k === 0 || k === pts.length - 1 || Math.abs(Math.atan2(pts[k + 1].z - p.z, pts[k + 1].x - p.x) - Math.atan2(p.z - pts[k - 1].z, p.x - pts[k - 1].x)) > 0.01)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: Number(flag('--w', '390')), height: Number(flag('--h', '844')), isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  // Yarrow's teach beat (yarrow-teach-check covers it) runs first for a keeper who has held a rinstick and re-arms on leaving,
  // which hides her station lines: this keeper has already been taught
  const taught = JSON.stringify({ ...newInv(), gifts: [GIFT_YARROW_TAUGHT] })
  await p.evaluateOnNewDocument((inv: string) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!localStorage.getItem('open.inv.v1')) localStorage.setItem('open.inv.v1', inv) }, taught)
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const st = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py, z: a.pz } }) as Promise<{ x: number; y: number; z: number }>
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a: number, b: number, c: number) => (window as any).__ather.tp(a, b, c), x, z, yaw); await poll(async () => { const s = await st(); return Math.hypot(s.x - x, s.z - z) < 0.3 }, 10000); await sleep(1200) }

  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  // the Glade is no longer the Wilds' waymark: a keeper goes there by the real travel (set down where a newborn wakes, facing Greg)
  await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await p.evaluate(() => (window as any).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'glade'), 240000), 'arrived in the closed Glade (travel glade)')
  await sleep(4000); if (!phone) { await p.mouse.click(550, 340); await sleep(500) }
  else { const vp = p.viewport()!; await p.touchscreen.tap(vp.width / 2, vp.height * 0.6); await sleep(800) }   // phone: tap the start card away, or every phone shot is the card (phone pass 11-19)
  // 1. the five where the plan puts them
  ok(await poll(async () => ((await p.evaluate(() => (window as any).__glade?.folk?.length ?? 0)) as number) >= 5, 30000), 'the five are drawn in the Glade (__glade.folk)')
  // the blueprints arrive after the folk are first drawn (a fetch per lot), then the folk re-place: wait for that
  let off: number[] = []
  await poll(async () => {
    const drawn = await p.evaluate(() => (window as any).__glade.folk) as { id: string; x: number; z: number }[]
    off = plan.map(q => { const d = drawn.find(x => x.id === q.id); return d ? Math.hypot(d.x - q.x, d.z - q.z) : 99 })
    return off.every(d => d <= 1)
  }, 60000)
  ok(off.every(d => d <= 1), `1. each Moglin stands where the plan puts them: Fennel at the front of her lot in Greg's garden, the four in their friends' gardens (worst ${Math.max(...off).toFixed(2)} m)`)
  // 2. level: the green, the anchor (the open south end of the green; the Wilds waymark stood here before s1b-2), every lot's pad
  //    (stand on the pad's front corners, clear of the station)
  const ys: { at: string; y: number }[] = []
  await tp(GLADE_GREEN.x, GLADE_GREEN.z, 0); ys.push({ at: 'green', y: (await st()).y })
  await tp(GLADE_ANCHOR.x, GLADE_ANCHOR.z - 2, 0); ys.push({ at: 'anchor', y: (await st()).y })
  for (const l of GLADE_LOTS) for (const side of [-5.5, 5.5]) { const q = onLot(l.id, LOT_D / 2 - 0.5, side); await tp(q.x, q.z, 0); ys.push({ at: `${l.id}${side < 0 ? 'L' : 'R'}`, y: (await st()).y }) }
  const lo = Math.min(...ys.map(v => v.y)), hi = Math.max(...ys.map(v => v.y))
  ok(hi - lo < 0.1, `2. the green, the anchor and all ten pad corners are level (spread ${(hi - lo).toFixed(3)} m: ${ys.map(v => `${v.at} ${v.y.toFixed(2)}`).join(', ')})`)
  // 3. the pond
  await tp(MOONWELL.x, MOONWELL.z, 0); const deep = (await st()).y
  // M157: the owner may sculpt the pond (v16 levels it to ~1.9), so 'a bowl on the live page' is only true of the BASE: what must hold
  // on any layer is that the drawn ground IS the walked ground (grid below), and the base under it is still a bowl (pure)
  const grid = await p.evaluate(() => {
    const M = (window as any).__moonwell; let worst = 0, n = 0, at = ''
    for (let x = -146; x <= -96; x += 1.7) for (let z = 80; z <= 141; z += 1.7) { const d = M.drawnAt(x, z), w = M.walkAt(x, z); if (d === null) return { worst: 99, n, at: `no ground drawn at ${x},${z}`, poolY: 0 }; n++; if (Math.abs(d - w) > worst) { worst = Math.abs(d - w); at = `${x.toFixed(1)},${z.toFixed(1)} drawn ${d.toFixed(2)} walked ${w.toFixed(2)}` } }
    return { worst, n, at, poolY: M.poolY }
  }).catch(e => ({ worst: 99, n: 0, at: String(e).slice(0, 80), poolY: 0 }))
  ok(grid.worst < 0.03 && grid.n > 900, `3. the pond: drawn = walked over ${grid.n} points (worst ${grid.worst.toFixed(3)} m ${grid.at})`)
  const walked = await p.evaluate((x: number, z: number) => (window as any).__moonwell?.walkAt?.(x, z) ?? 99, MOONWELL.x, MOONWELL.z)
  ok(Math.abs(deep - walked) < 0.05, `   the keeper's feet are on it at the middle (feet ${deep.toFixed(2)}, ground ${walked.toFixed(2)}, water ${grid.poolY})`)
  const baseDeep = gladeZoneGround(MOONWELL.x, MOONWELL.z), baseFloor = gladeZoneGround(GLADE_GREEN.x, GLADE_GREEN.z)
  ok(baseDeep < baseFloor - 1, `   unsculpted, the pond is a bowl under the water (${baseDeep.toFixed(2)}, floor ${baseFloor.toFixed(2)})`)
  const mw = await p.evaluate(() => (window as any).__rinquest?.moonwell?.()) as { rx?: number; rz?: number } | null
  ok(!!mw && mw.rx === MOONWELL.rx && mw.rz === MOONWELL.rz && atWater(SCALE_AT.x, SCALE_AT.z), `   the deployed pond is ${MOONWELL.rx * 2} x ${MOONWELL.rz * 2} m and the scale's bank is at the water (${JSON.stringify(mw)})`)
  // 4. on foot: from the green's centre to each Moglin by a route round the walls (a door lot may open into a courtyard);
  //    real W, faced at each turn (tp at the keeper's OWN spot = face only)
  ok(withBp.every(l => true) && await poll(async () => { const b = await p.evaluate(() => (window as any).__glade?.blueprints?.() ?? []) as string[]; return withBp.every(l => b.includes(l)) }, 30000), `   the lots with Alex's blueprints stand them (${withBp.join(', ')})`)
  for (const q of plan) {
    const name = q.id.split(':')[1]
    ok(reach(q), `4. the Glade's ground runs unbroken from the green to ${name} (${q.x.toFixed(0)},${q.z.toFixed(0)}, ${Math.hypot(q.x - GLADE_GREEN.x, q.z - GLADE_GREEN.z).toFixed(0)} m)`)
    // Fennel stands in Greg's garden: walk from the green's centre as before. The four friends' folk stand 200-315 m off in the
    // friends' gardens: walk the last stretch, from the first of 8 bearings 12 m out that has a route
    // TODO s1b-3: should the four friends' folk be walked to from the GREEN (200-315 m of real W, ~15 min each at 1-2 fps), or is the
    //   pure ground-continuity assert above + this last-stretch walk the intended new-world equivalent?
    let from = { x: GLADE_GREEN.x, z: GLADE_GREEN.z }
    if (Math.hypot(q.x - GLADE_GREEN.x, q.z - GLADE_GREEN.z) > 60) {
      const cand = Array.from({ length: 8 }, (_, k) => ({ x: q.x + Math.cos(k * Math.PI / 4) * 12, z: q.z + Math.sin(k * Math.PI / 4) * 12 })).find(c => freeAt(c.x, c.z) && route(c, q))
      if (!cand) { ok(false, `4. a start 12 m out from ${name} with a route on foot exists`); continue }
      from = cand
    }
    const r = route(from, q)
    if (!r) { ok(false, `4. a route on foot to ${name} exists`); continue }
    await tp(from.x, from.z, 0); if (!phone) { await p.mouse.click(550, 340); await sleep(300) }
    let stuck = false
    for (const w of turns(r).slice(1)) {
      const s0 = await st(); await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), s0.x, s0.z, Math.atan2(-(w.x - s0.x), -(w.z - s0.z)))
      await p.keyboard.down('KeyW')
      const legT = 20000 + Math.hypot(w.x - s0.x, w.z - s0.z) / 0.25 * 1000   // ~0.4 m/s at 1-2 fps: time by the leg's length, not a fixed 40 s
      const got = await poll(async () => { const s1 = await st(); return Math.hypot(s1.x - w.x, s1.z - w.z) < 0.7 }, legT)
      await p.keyboard.up('KeyW')
      if (!got) { stuck = true; break }
    }
    const s = await st()
    ok(!stuck && Math.hypot(s.x - q.x, s.z - q.z) < 2.5, `4. walked to ${q.id.split(':')[1]} on foot by ${turns(r).length - 1} legs from ${Math.hypot(from.x - q.x, from.z - q.z).toFixed(0)} m out (${Math.hypot(s.x - q.x, s.z - q.z).toFixed(1)} m off)`)
    // talk: the first E is the station line, a second talk the alternate (lark, SIGNED 40bf1c6)
    const k = q.id.split(':')[1], lines = GLADE_STATION_LINES[k]
    await aimAt(p, q.x, q.z, 0.4)   // M60: E only on what the crosshair is on
    await p.keyboard.press('KeyE'); const b1 = await poll(() => p.evaluate(() => !!document.querySelector('[data-talk-bubble]')), 8000)
    const t1 = await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
    await p.keyboard.press('Escape'); await poll(() => p.evaluate(() => !document.querySelector('[data-talk-bubble]')), 8000); await sleep(500)
    await p.keyboard.press('KeyE'); await poll(() => p.evaluate(() => !!document.querySelector('[data-talk-bubble]')), 8000)
    const t2 = await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
    await p.keyboard.press('Escape'); await sleep(500)
    ok(b1 && t1.includes(lines.main) && t2.includes(lines.alt), `   ${k}: first talk = the station line, the next = the alternate (${t1.slice(0, 40)}... / ${t2.slice(0, 40)}...)`)
  }
  // 5. five distinct hellos (the deployed data: gladeFolk's dreams)
  const hellos = gladeFolk().map(f => f.dream)
  ok(new Set(hellos).size === 5, `5. the five say five distinct things (${hellos.map(h => h.slice(0, 24)).join(' | ')})`)
  // 6. shots from the green, four headings
  for (const [k, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) { await tp(GLADE_GREEN.x, GLADE_GREEN.z + 4, yaw); await sleep(1500); await shot(`glade-${phone ? 'phone' : 'desk'}-${k}`) }
  { const nb = newbornSpot(); await tp(nb.x, nb.z, nb.yaw) }; await sleep(1500); await shot(`glade-${phone ? 'phone' : 'desk'}-arrival`)   // the arrival a keeper gets now: where a newborn wakes, facing Greg
  ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
