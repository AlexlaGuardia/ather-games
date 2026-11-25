// ── M157: THE MOONWELL POND, WHAT YOU SEE IS WHAT YOU STAND ON (prod, 390x844; world lane 11-25) ──
//   A. in the Glade on the live layer: drawn ground (ray down on the live meshes) = walked ground within 3 cm over the pond + shore; the
//      keeper stood at nine spots has its feet on the drawn ground; the water sheet is level; shots from the bank and the middle
//   B. (owner) the builder on the Glade, READ ONLY (no stroke, no save): Fly's drawn ground = the editor's own ground over the same
//      grid, and = the game's ground for the same draft layer; the Moonwell's water is drawn; a shot of Fly and the tile view
//   npx tsx scripts/moonwell-pond-check.mts [--url https://ather.games] [--out dir] [--game-only]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { MOONWELL } from '../src/app/shimmer/open/ather/moonwell'
import { gladeLayerGround, parseGladeLayer } from '../src/app/shimmer/open/ather/glade-layer'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/moonwell-pond-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const GRID: [number, number][] = []; for (let x = -146; x <= -96; x += 1.7) for (let z = 80; z <= 141; z += 1.7) GRID.push([x, z])
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  const p = await (await br.createBrowserContext()).newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await p.evaluate(() => (window as any).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  ok(await p.evaluate(() => (window as any).__ather?.zone?.() === 'glade'), 'A. arrived in the Glade')
  await sleep(6000); await p.touchscreen.tap(195, 500); await sleep(1000)
  const layer = parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json()), G = gladeLayerGround(layer.edits)
  const live = await p.evaluate((g: [number, number][]) => { const M = (window as any).__moonwell; return g.map(([x, z]) => [M.drawnAt?.(x, z) ?? null, M.walkAt?.(x, z) ?? null]) }, GRID) as [number | null, number | null][]
  let w = 0, at = '', wp = 0; live.forEach(([d, k], n) => { const e = d === null || k === null ? 99 : Math.abs(d - k); if (e > w) { w = e; at = `${GRID[n].map(v => v.toFixed(1))} drawn ${d} walked ${k}` }; wp = Math.max(wp, k === null ? 99 : Math.abs(k - G(...GRID[n]))) })
  ok(w < 0.03, `A. drawn = walked over ${GRID.length} points of the pond + shore (worst ${w.toFixed(4)} m ${at})`)
  ok(wp < 0.01, `A. the page walks the PUBLISHED layer (worst ${wp.toFixed(4)} m off it)`)
  const sh = await p.evaluate(() => { const M = (window as any).__moonwell; const s = (M.sheet?.() ?? []) as number[]; return { y: M.poolY, flat: s.length > 100 && s.every((v, k) => k % 3 !== 1 || Math.abs(v - M.poolY) < 1e-4) } })
  const inPond = GRID.map(([x, z], n) => ({ x, z, d: live[n][0] ?? 0 })).filter(q => Math.hypot((q.x - MOONWELL.x) / MOONWELL.rx, (q.z - MOONWELL.z) / MOONWELL.rz) < 1)
  ok(sh.flat, `A. the water sheet is level at ${sh.y}`)
  console.log(`  ground in the pond ${Math.min(...inPond.map(q => q.d)).toFixed(2)}..${Math.max(...inPond.map(q => q.d)).toFixed(2)}, under water ${(100 * inPond.filter(q => q.d < sh.y).length / inPond.length).toFixed(0)} % (a report, not an assert: the layer is the owner's)`)
  let foot = 0
  for (const [dx, dz] of [[0, 0], [10, 0], [-10, 0], [0, 12], [0, -12], [18, 0], [-18, 0], [22, 0], [14, 14]]) {
    const x = MOONWELL.x + dx, z = MOONWELL.z + dz
    await p.evaluate((a: number, b: number) => (window as any).__ather.tp(a, b, -Math.PI / 2), x, z); await sleep(2500)
    const r = await p.evaluate(() => { const s = (window as any).__ather.state(); return [s.py, (window as any).__moonwell.drawnAt?.(s.px, s.pz) ?? null] }) as [number, number | null]
    foot = Math.max(foot, r[1] === null ? 99 : Math.abs(r[0] - r[1]))
    if (!dx && !dz) await p.screenshot({ path: `${out}/middle.png` }).catch(() => {})
  }
  ok(foot < 0.06, `A. the keeper's feet are on the drawn ground at nine spots (worst ${foot.toFixed(3)} m)`)
  await p.evaluate((a: number, b: number) => (window as any).__ather.tp(a, b, Math.PI / 2), MOONWELL.x + MOONWELL.rx + 6, MOONWELL.z); await sleep(3000)
  await p.screenshot({ path: `${out}/bank.png` }).catch(() => {}); await p.close()
  if (!process.argv.includes('--game-only')) {
    const KEY = process.env.OWNER_KEY; if (!KEY) { ok(false, 'B. no OWNER_KEY'); throw new Error('no key') }
    const o = await (await br.createBrowserContext()).newPage(); o.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
    await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
    await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await o.goto(`${url}/shimmer/dev?mode=terrain&map=glade`, { waitUntil: 'load', timeout: 240000 })
    await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
    await o.screenshot({ path: `${out}/tile.png` }).catch(() => {})
    const draft = await o.evaluate(async () => (await (await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' })).json()).draft)
    const D = gladeLayerGround(parseGladeLayer(draft).edits)
    await o.click('[data-testid="view-fly"]')
    await o.waitForFunction('typeof window.__builderFly?.drawnAt === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 }); await sleep(4000)
    const fly = await o.evaluate((g: [number, number][]) => { const T = (window as any).__terrain, c = T.origin(); return g.map(([x, z]) => [(window as any).__builderFly.drawnAt(x, z), T.heightAt(x - c.x, z - c.z)]) }, GRID) as [number | null, number][]
    let f1 = 0, f2 = 0; fly.forEach(([d, h], n) => { f1 = Math.max(f1, d === null ? 99 : Math.abs(d - h)); f2 = Math.max(f2, Math.abs(h - D(...GRID[n]))) })
    ok(f1 < 0.03, `B. Fly draws the editor's ground over the pond (worst ${f1.toFixed(4)} m)`)
    ok(f2 < 0.03, `B. the editor's ground = what the game walks on the same draft (worst ${f2.toFixed(4)} m)`)
    ok((await o.evaluate('window.__builderFly.pool()')) === 1, "B. Fly draws the Moonwell's water")
    const sc = await o.evaluate('window.__builderFly.scene()') as { tiles: number; sea: number; other: string[] }
    ok(sc.tiles === 1 && sc.sea === 0 && !sc.other.length, `B. nothing else in Fly (${JSON.stringify(sc)})`)
    await o.screenshot({ path: `${out}/fly.png` }).catch(() => {})
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
