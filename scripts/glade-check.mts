// ── M40: MOONWELL GLADE, LAYOUT B, ON THE LIVE PAGE (world d5a9e927, 11-19) ─────────────────────────────────────────────
// A born keeper lands at the waymark (?waymark=greg) and reads the Glade as built:
//   1. the five are drawn where the plan puts them (±1 m of moonwell-glade.ts gladeSpots), on the five lots
//   2. every lot's pad, the green and the waymark are LEVEL: the keeper stood on each reads the same feet height (±0.1 m)
//   3. the pond is a bowl under the water (feet at its middle sit > 1 m under the Glade floor) and the deployed MOONWELL is the
//      41 x 49 m pond (__rinquest.moonwell()); the rinn scale's bank spot is 'at the water'
//   4. every Moglin is reachable ON FOOT: from the green's centre, facing them, a real held W walks the keeper up to them
//   5. the five say five distinct things (their hello lines; @lark words come after this blockout)
//   6. --phone 390x844: shots from the green at four headings (Alex's look: the green shows all five with one turn); 0 errors
// Hooks: __ather.tp / look (stand + face only, stated), __ather.state / __folk.drawn / __rinquest (read). Walking is real W.
//   npx tsx scripts/glade-check.mts [--url https://ather.games] [--out dir] [--phone [--w 360 --h 780]]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GLADE_GREEN, MOONWELL, SCALE_AT, atWater } from '../src/app/shimmer/open/ather/moonwell'
import { GLADE_LOTS, gladeSpots, onLot, LOT_D, gladeFolk, GLADE_STATION_LINES } from '../src/app/shimmer/open/ather/moonwell-glade'
import { setGladeBlueprint, gladeLotBoxes, jettyBoxes } from '../src/app/shimmer/open/ather/glade-lots'
import { parseHouse } from '../src/app/shimmer/open/ather/plot-blueprint'
import { readFileSync, existsSync } from 'fs'
import { fromShore } from '../src/app/shimmer/open/ather/moonwell'
import { GLADE } from '../src/app/shimmer/open/ather/relief'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/glade-check'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// M39: lots with Alex's blueprints (world/house-blueprints/glade-<lot>.json, the files prod reads) put their Moglin at the door
const withBp = GLADE_LOTS.map(l => l.id).filter(l => { const f = `world/house-blueprints/glade-${l}.json`; if (!existsSync(f)) return false; setGladeBlueprint(l, parseHouse(JSON.parse(readFileSync(f, 'utf8')))); return true })
console.log(`blueprints on: ${withBp.join(', ') || 'none'}`)
const plan = gladeSpots(GLADE_LOTS.map(l => `moonwell:${l.id}`))
// a walking route round the walls: BFS on a 0.5 m grid over the Glade's solids (body radius), the pond kept out
const SOLID = [...gladeLotBoxes(0), ...jettyBoxes(-1)].filter(b => b.y0 <= 1.7 && b.y1 > 0.05)
const freeAt = (x: number, z: number) => fromShore(x, z) > 0.4 && !SOLID.some(b => x + 0.4 > b.x0 && x - 0.4 < b.x1 && z + 0.4 > b.z0 && z - 0.4 < b.z1)
function route(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number }[] | null {
  const C = 0.5, key = (i: number, j: number) => `${i},${j}`, at = (p: { x: number; z: number }) => [Math.round(p.x / C), Math.round(p.z / C)]
  const [si, sj] = at(from), [ti, tj] = at(to), prev = new Map<string, string | null>([[key(si, sj), null]]), q: [number, number][] = [[si, sj]]
  while (q.length) {
    const [i, j] = q.shift()!
    if (Math.hypot(i - ti, j - tj) * C < 1.6) { const out: { x: number; z: number }[] = []; let k: string | null = key(i, j); while (k) { const [a, b] = k.split(',').map(Number); out.unshift({ x: a * C, z: b * C }); k = prev.get(k)! } return out }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const n = key(i + di, j + dj); if (prev.has(n) || Math.hypot((i + di) * C - GLADE_GREEN.x, (j + dj) * C - GLADE_GREEN.z) > 48 || !freeAt((i + di) * C, (j + dj) * C)) continue; prev.set(n, key(i, j)); q.push([i + di, j + dj]) }
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
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const st = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py, z: a.pz } }) as Promise<{ x: number; y: number; z: number }>
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a: number, b: number, c: number) => (window as any).__ather.tp(a, b, c), x, z, yaw); await poll(async () => { const s = await st(); return Math.hypot(s.x - x, s.z - z) < 0.3 }, 10000); await sleep(1200) }

  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds'), 240000), 'arrived in the Wilds at the waymark')
  await sleep(4000); if (!phone) { await p.mouse.click(550, 340); await sleep(500) }
  else { const vp = p.viewport()!; await p.touchscreen.tap(vp.width / 2, vp.height * 0.6); await sleep(800) }   // phone: tap the start card away, or every phone shot is the card (phone pass 11-19)
  // 1. the five where the plan puts them
  ok(await poll(async () => ((await p.evaluate(() => (window as any).__folk?.drawn?.()?.moonwell?.length ?? 0)) as number) >= 5, 30000), 'the five are drawn at the Glade')
  // the blueprints arrive after the folk are first drawn (a fetch per lot), then the folk re-place: wait for that
  let off: number[] = []
  await poll(async () => {
    const drawn = await p.evaluate(() => (window as any).__folk.drawn().moonwell) as { id: string; x: number; z: number }[]
    off = plan.map(q => { const d = drawn.find(x => x.id === q.id); return d ? Math.hypot(d.x - q.x, d.z - q.z) : 99 })
    return off.every(d => d <= 1)
  }, 60000)
  ok(off.every(d => d <= 1), `1. each Moglin stands where the plan puts them, at the front of their lot (worst ${Math.max(...off).toFixed(2)} m)`)
  // 2. level: the green, the waymark, every lot's pad (stand on the pad's front corners, clear of the station)
  const ys: { at: string; y: number }[] = []
  await tp(GLADE_GREEN.x, GLADE_GREEN.z, 0); ys.push({ at: 'green', y: (await st()).y })
  await tp(GREG_WAYMARK.x, GREG_WAYMARK.z - 2, 0); ys.push({ at: 'waymark', y: (await st()).y })
  for (const l of GLADE_LOTS) for (const side of [-5.5, 5.5]) { const q = onLot(l.id, LOT_D / 2 - 0.5, side); await tp(q.x, q.z, 0); ys.push({ at: `${l.id}${side < 0 ? 'L' : 'R'}`, y: (await st()).y }) }
  const lo = Math.min(...ys.map(v => v.y)), hi = Math.max(...ys.map(v => v.y))
  ok(hi - lo < 0.1, `2. the green, the waymark and all ten pad corners are level (spread ${(hi - lo).toFixed(3)} m: ${ys.map(v => `${v.at} ${v.y.toFixed(2)}`).join(', ')})`)
  // 3. the pond
  await tp(MOONWELL.x, MOONWELL.z, 0); const deep = (await st()).y
  ok(deep < lo - 1, `3. the pond is a bowl under the water (feet ${deep.toFixed(2)} at its middle, floor ${lo.toFixed(2)})`)
  const mw = await p.evaluate(() => (window as any).__rinquest?.moonwell?.()) as { rx?: number; rz?: number } | null
  ok(!!mw && mw.rx === MOONWELL.rx && mw.rz === MOONWELL.rz && atWater(SCALE_AT.x, SCALE_AT.z), `   the deployed pond is ${MOONWELL.rx * 2} x ${MOONWELL.rz * 2} m and the scale's bank is at the water (${JSON.stringify(mw)})`)
  // 4. on foot: from the green's centre to each Moglin by a route round the walls (a door lot may open into a courtyard);
  //    real W, faced at each turn (tp at the keeper's OWN spot = face only)
  ok(withBp.every(l => true) && await poll(async () => { const b = await p.evaluate(() => (window as any).__glade?.blueprints?.() ?? []) as string[]; return withBp.every(l => b.includes(l)) }, 30000), `   the lots with Alex's blueprints stand them (${withBp.join(', ')})`)
  for (const q of plan) {
    const r = route({ x: GLADE_GREEN.x, z: GLADE_GREEN.z }, q)
    if (!r) { ok(false, `4. a route on foot to ${q.id.split(':')[1]} exists`); continue }
    await tp(GLADE_GREEN.x, GLADE_GREEN.z, 0); if (!phone) { await p.mouse.click(550, 340); await sleep(300) }
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
    ok(!stuck && Math.hypot(s.x - q.x, s.z - q.z) < 2.5, `4. walked from the green to ${q.id.split(':')[1]} on foot by ${turns(r).length - 1} legs (${Math.hypot(s.x - q.x, s.z - q.z).toFixed(1)} m off)`)
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
  await tp(GREG_WAYMARK.x, GREG_WAYMARK.z + 3, 0); await sleep(1500); await shot(`glade-${phone ? 'phone' : 'desk'}-arrival`)
  ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
