// ── TERRAIN EDITOR, PLAYED (BETA M62 slice 1, world lane, 11-21) ───────────────────────────────────────────────────────────
// The owner sculpts the REAL Wilds at /shimmer/dev?mode=terrain and the game walks on it:
//   A. a non-owner gets 403 on the page AND on POST /shimmer/save-wilds-edit
//   B. owner: open a tile, raise a RIDGE (three overlapping raises, 10 m), FLATTEN a pad, prove one undo/redo round trip, SAVE
//   C. the game (fresh page, ?waymark=greg, tp onto that tile): its ground under the ridge and pad = the editor's heights
//      (5 cm), the pad is flat, the ridge's flank is steeper than the walker may climb (terrain-world MAX_WALK_GRADIENT)
//   D. ALWAYS (finally): the tile's edit maps go back to what they were before the check (it edits the live world file)
//   0 page errors on both pages.
// SETUP (stated): OWNER_KEY from .env or env. Tile default w-4_-2 (far west, 99.8 % land, nothing staged there).
//   npx tsx scripts/terrain-editor-check.mts [--url https://ather.games] [--tile w-4_-2] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { MAX_WALK_GRADIENT } from '../src/app/shimmer/open/terrain-world'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), TILE = flag('--tile', 'w-4_-2'), out = flag('--out', '/tmp/terrain-editor-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')).tiles as { name: string; tx: number; ty: number }[]
const T = tiles.find(t => t.name === TILE)!; if (!T) { console.log(`no tile ${TILE}`); process.exit(2) }
const ring = tiles.filter(t => Math.abs(t.tx - T.tx) <= 1 && Math.abs(t.ty - T.ty) <= 1).map(t => t.name)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const fetchEditsFile = async (): Promise<{ tiles: Record<string, Record<string, number>> }> => {   // retried: a dev server answers 404 mid-recompile
  for (let i = 0; ; i++) { const r = await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' }); if (r.ok) return r.json(); if (i >= 5) throw new Error(`wilds-edits GET ${r.status}`); await sleep(3000) }
}
const before = (await fetchEditsFile()).tiles ?? {}
const orig: Record<string, Record<string, number>> = Object.fromEntries(ring.map(n => [n, before[n] ?? {}]))
const beforeW = ((await fetchEditsFile()) as { water?: Record<string, Record<string, number>> }).water ?? {}
const origW: Record<string, Record<string, number>> = Object.fromEntries(ring.map(n => [n, beforeW[n] ?? {}]))
console.log(`tile ${TILE} (${T.tx},${T.ty}); ring ${ring.length} tiles; edits there before: ${ring.filter(n => before[n]).join(', ') || 'none'}`)

const owner = await br.createBrowserContext()
try {
  // ── A. the gate ──
  const anon = await br.createBrowserContext(), ap = await anon.newPage()
  const r1 = await ap.goto(`${url}/shimmer/dev?mode=terrain`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  ok(r1?.status() === 403, `non-owner: the editor page answers ${r1?.status()} (want 403)`)
  const r2 = await ap.evaluate(async t => (await fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile: t, d: { '100': 50 } }) })).status, TILE)
  ok(r2 === 403, `non-owner: POST save-wilds-edit answers ${r2} (want 403)`)
  await anon.close()
  ok(JSON.stringify((await fetchEditsFile()).tiles?.[TILE] ?? {}) === JSON.stringify(orig[TILE]), '...and the world file did not change')

  // ── B. the editor ──
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const r3 = await p.goto(`${url}/shimmer/dev?mode=terrain`, { waitUntil: 'load', timeout: 240000 })
  ok(r3?.status() === 200, `owner: the editor page answers ${r3?.status()}`)
  await p.waitForSelector('select', { timeout: 120000 })
  await p.waitForFunction('window.__terrain?.ready === true', { timeout: 240000, polling: 500 })
  await p.select('select', TILE)
  await p.waitForFunction(`window.__terrain?.ready === true && window.__terrain?.tile === ${JSON.stringify(TILE)}`, { timeout: 240000, polling: 500 })
  // a dry, gentle spot for the ridge and one for the pad, read on the editor's own ground
  const spots = await p.evaluate(`(() => { const t = window.__terrain, out = []
    for (let r = 0; r < 420 && out.length < 3; r += 20) for (let a = 0; a < 12 && out.length < 3; a++) {
      const x = 4 * Math.round(Math.cos(a / 12 * Math.PI * 2) * r / 4), z = 4 * Math.round(Math.sin(a / 12 * Math.PI * 2) * r / 4)   // on a grid vertex (cell 4 m)
      const h = t.heightAt(x, z); if (!(h > 3)) continue
      if (out.some(o => Math.hypot(o.x - x, o.z - z) < 140)) continue
      const g = Math.abs(t.heightAt(x + 8, z) - t.heightAt(x - 8, z)) / 16 + Math.abs(t.heightAt(x, z + 8) - t.heightAt(x, z - 8)) / 16
      if (g < 0.25) out.push({ x, z, h })
    }
    return out })()`) as { x: number; z: number; h: number }[]
  ok(spots.length === 3, `found a ridge, a pad and a pond spot on dry land (${JSON.stringify(spots)})`)
  const [R, P, Q] = spots
  const h0 = await p.evaluate(`window.__terrain.heightAt(${R.x}, ${R.z})`) as number
  // RIDGE: three raises along x, 10 ticks of 1 m each
  for (const dx of [-12, 0, 12]) await p.evaluate(`window.__terrain.stroke('raise', ${R.x + dx}, ${R.z}, 10, 1, 10)`)
  const hR = await p.evaluate(`window.__terrain.heightAt(${R.x}, ${R.z})`) as number
  ok(hR - h0 > 9, `the ridge stands up (${(hR - h0).toFixed(1)} m above the old ground)`)
  // undo / redo round trip on one more stroke
  await p.evaluate(`window.__terrain.stroke('raise', ${R.x}, ${R.z}, 10, 1, 3)`)
  const hUp = await p.evaluate(`window.__terrain.heightAt(${R.x}, ${R.z})`) as number
  await p.evaluate('window.__terrain.undo()'); await sleep(200)
  const hUndo = await p.evaluate(`window.__terrain.heightAt(${R.x}, ${R.z})`) as number
  await p.evaluate('window.__terrain.redo()'); await p.evaluate('window.__terrain.undo()'); await sleep(200)
  ok(hUp - hR > 2 && Math.abs(hUndo - hR) < 1e-4, `undo takes back a stroke (${hR.toFixed(2)} -> ${hUp.toFixed(2)} -> ${hUndo.toFixed(2)})`)
  // PAD: lift a bump first so flatten has work, then flatten 14 ticks from the spot's old height
  await p.evaluate(`window.__terrain.stroke('raise', ${P.x + 6}, ${P.z + 6}, 8, 1, 4)`)
  const padY = await p.evaluate(`window.__terrain.heightAt(${P.x}, ${P.z})`) as number
  await p.evaluate(`window.__terrain.stroke('flatten', ${P.x}, ${P.z}, 20, 1, 14)`)
  const padPts: [number, number][] = [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [6, 6]].map(([a, b]) => [P.x + a, P.z + b])
  const padE = await p.evaluate(`${JSON.stringify(padPts)}.map(([x, z]) => window.__terrain.heightAt(x, z))`) as number[]
  const spread = Math.max(...padE) - Math.min(...padE)
  ok(spread < 0.3, `the pad is flat in the editor (spread ${spread.toFixed(2)} m around ${padY.toFixed(1)})`)
  const ridgePts: [number, number][] = [[R.x, R.z], [R.x + 12, R.z], [R.x - 12, R.z], [R.x, R.z + 4], [R.x, R.z + 5], [R.x, R.z + 6]]
  const ridgeE = await p.evaluate(`${JSON.stringify(ridgePts)}.map(([x, z]) => window.__terrain.heightAt(x, z))`) as number[]
  // POND (slice 2): carve a bowl 6 m deep, paint water at the old ground's height over r=18: a lake at that level, dry outside
  const rimY = await p.evaluate(`window.__terrain.heightAt(${Q.x}, ${Q.z})`) as number
  await p.evaluate(`window.__terrain.stroke('lower', ${Q.x}, ${Q.z}, 14, 1, 6)`)
  await p.evaluate(`window.__terrain.water(${Q.x}, ${Q.z}, 18, ${rimY.toFixed(1)})`)
  const lv = await p.evaluate(`window.__terrain.levelAt(${Q.x}, ${Q.z})`) as number | null
  const floorY = await p.evaluate(`window.__terrain.heightAt(${Q.x}, ${Q.z})`) as number
  ok(lv !== null && Math.abs(lv - +rimY.toFixed(1)) < 0.01 && lv - floorY > 4, `the pond: level ${lv} m over a bowl floor ${floorY.toFixed(1)} m`)
  await sleep(500); await p.screenshot({ path: `${out}/editor.png` })
  const saved = await p.evaluate('window.__terrain.save()')
  const dirtyLeft = await p.evaluate('window.__terrain.dirty()') as string[]
  ok(saved === true && dirtyLeft.length === 0, `save: ${saved}, nothing left unsaved`)
  const after = (await fetchEditsFile()).tiles ?? {}
  ok(Object.keys(after[TILE] ?? {}).length > 50, `the world file holds the tile's edits (${Object.keys(after[TILE] ?? {}).length} vertices)`)
  const afterW = ((await fetchEditsFile()) as { water?: Record<string, Record<string, number>> }).water ?? {}
  ok(Object.keys(afterW[TILE] ?? {}).length > 40, `...and its water (${Object.keys(afterW[TILE] ?? {}).length} cells)`)

  // ── C. the game walks on it ──
  const g = await owner.newPage(); await g.setViewport({ width: 800, height: 500 })
  g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await g.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await g.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(3000)
  await g.waitForFunction(() => typeof (window as any).__ather?.ground === 'function' && typeof (window as any).__ather?.tp === 'function', { timeout: 60000, polling: 250 })
  const wx = T.tx * 1000, wz = T.ty * 1000
  await g.evaluate(`window.__ather.tp(${wx + P.x}, ${wz + P.z}, 0, 400)`)
  await g.waitForFunction(`Number.isFinite(window.__ather.ground(${wx + R.x}, ${wz + R.z})) && window.__ather.ground(${wx + R.x}, ${wz + R.z}) > -1e3`, { timeout: 180000, polling: 500 })
  await sleep(1500)
  const ridgeG = await g.evaluate(`${JSON.stringify(ridgePts)}.map(([x, z]) => window.__ather.ground(${wx} + x, ${wz} + z))`) as number[]
  const padG = await g.evaluate(`${JSON.stringify(padPts)}.map(([x, z]) => window.__ather.ground(${wx} + x, ${wz} + z))`) as number[]
  const dR = Math.max(...ridgeG.map((v, i) => Math.abs(v - ridgeE[i]))), dP = Math.max(...padG.map((v, i) => Math.abs(v - padE[i])))
  ok(dR < 0.05, `the game's ground on the ridge = the editor's (worst ${dR.toFixed(3)} m over ${ridgePts.length} points)`)
  ok(dP < 0.05, `the game's ground on the pad = the editor's (worst ${dP.toFixed(3)} m)`)
  ok(Math.max(...padG) - Math.min(...padG) < 0.3, `the pad is flat in the game (spread ${(Math.max(...padG) - Math.min(...padG)).toFixed(2)} m)`)
  // the ridge's flank: steepest 1 m rise on the south side, read on the game's ground
  const flank = await g.evaluate(`(() => { let m = 0; for (let s = 2; s < 12; s += 0.5) { const a = window.__ather.ground(${wx + R.x}, ${wz + R.z} + s), b = window.__ather.ground(${wx + R.x}, ${wz + R.z} + s + 1); m = Math.max(m, Math.abs(a - b)) } return m })()`) as number
  ok(flank > MAX_WALK_GRADIENT, `the ridge's flank is steeper than the walker climbs (${flank.toFixed(2)} > ${MAX_WALK_GRADIENT}): it blocks`)
  // the pond in the game: drop the keeper into its middle; it SWIMS (the walker's water boxes), at the painted level
  await g.mouse.click(400, 250); await sleep(800)   // past the click-to-play card: the walker only ticks in play
  await g.evaluate(`window.__ather.tp(${wx + Q.x}, ${wz + Q.z}, 0, ${(lv ?? 0) + 1})`)
  let sw = { swimming: false, py: NaN }
  for (let t = 0; t < 20 && !sw.swimming; t++) { await sleep(500); sw = await g.evaluate('window.__ather.state()') as typeof sw }
  ok(!!sw.swimming, `the keeper swims in the pond (swimming ${sw.swimming}, feet ${sw.py?.toFixed?.(2)} m vs level ${lv} over floor ${floorY.toFixed(1)})`)
  await g.evaluate(`window.__ather.tp(${wx + Q.x}, ${wz + Q.z + 26}, 0, undefined)`); await sleep(1500)
  await g.evaluate('window.__ather.look(0, -0.45)'); await sleep(2500)
  await g.screenshot({ path: `${out}/game-pond.png` })
  await g.evaluate(`window.__ather.tp(${wx + R.x}, ${wz + R.z + 14}, Math.PI, undefined)`); await sleep(2500)
  await g.screenshot({ path: `${out}/game-ridge.png` })
} finally {
  // ── D. put the world back ──
  const p = await owner.newPage()
  try {
    await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    // ⚠ /owner 307s to the ABSOLUTE https://ather.games/room: stand on the target origin again, or a relative POST goes to prod
    await p.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    const res = await p.evaluate(async (o: Record<string, Record<string, number>>, w: Record<string, Record<string, number>>) => {
      return [(await fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tiles: o, water: w }) })).status]
    }, orig, origW)
    const nowF = await fetchEditsFile() as { tiles?: Record<string, Record<string, number>>; water?: Record<string, Record<string, number>> }, now = nowF.tiles ?? {}, nowW = nowF.water ?? {}
    ok(res.every(s => s === 200) && ring.every(n => JSON.stringify(now[n] ?? {}) === JSON.stringify(orig[n]) && JSON.stringify(nowW[n] ?? {}) === JSON.stringify(origW[n])), `restored the ${ring.length} ring tiles to their edits before the check (POST ${res.join(',')})`)
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} — fix world/wilds-edits.json by hand`) }
  await br.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`shots: ${out}`)
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
