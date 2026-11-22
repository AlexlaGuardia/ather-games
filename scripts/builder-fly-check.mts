// ── WORLD BUILDER FLY VIEW, PLAYED (BETA M83 p1 s1b, world lane, 11-22) ──────────────────────────────────────────────────────────
// Alex 11-22: "fly around and build for hours.. zoom in and out without any nodes". The owner opens the terrain editor, clicks Fly (3D):
//   A. the scene holds ONLY terrain: 9 tile meshes (the tile + its ring), the sea plane, the brush ring; nothing else (no nodes/props)
//   B. WASD flies: holding W moves the camera; Space climbs
//   C. T goes top-down (pitch ~ -90 deg), T again comes back
//   D. a LEFT-DRAG on the 3D ground sculpts the SAME draft the 2D view edits (dirty, height up under the cursor)
//   E. ALWAYS (finally): the owner's draft is put back exactly as it was (nothing is published by this check)
//   0 page errors.
// SETUP: OWNER_KEY from .env or env = runs on the BOX (take the browser lock: tools/coord.sh browser up). Tile default w-4_-2.
//   npx tsx scripts/builder-fly-check.mts [--url https://ather.games] [--tile w-4_-2] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), TILE = flag('--tile', 'w-4_-2'), out = flag('--out', '/tmp/builder-fly-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
interface Cam { x: number; y: number; z: number; yaw: number; pitch: number }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })   // /owner 307s to the absolute prod origin
const bget = () => op.evaluate(async () => { const r = await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store' }); return r.ok ? r.json() : null }) as Promise<{ draft: unknown } | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'wilds', ...b }) }); return r.ok ? r.json() : null }, body)
const start = await bget()
ok(!!start, 'owner: GET save-builder answers')
if (!start) { await br.close(); console.log('FAIL (no builder)'); process.exit(1) }

try {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/dev?mode=terrain`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('select', { timeout: 120000 })
  await p.waitForFunction('window.__terrain?.ready === true', { timeout: 240000, polling: 500 })
  await p.select('select', TILE)
  await p.waitForFunction(`window.__terrain?.ready === true && window.__terrain?.tile === ${JSON.stringify(TILE)}`, { timeout: 240000, polling: 500 })
  const vis = await p.evaluate(() => document.visibilityState)
  ok(vis === 'visible', `the tab is visible (${vis}): the frame loop can run`)

  // ── A. only terrain ──
  await p.click('[data-testid="view-fly"]')
  await p.waitForFunction('typeof window.__builderFly?.scene === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 })
  await sleep(2000)
  const sc = await p.evaluate('window.__builderFly.scene()') as { tiles: number; sea: number; ring: number; other: string[] }
  ok(sc.tiles === 9 && sc.sea === 1 && sc.ring === 1 && sc.other.length === 0, `ONLY terrain: ${JSON.stringify(sc)} (want 9 tiles, 1 sea, 1 ring, no other)`)
  await p.screenshot({ path: `${out}/fly-start.png` })

  // ── B. fly ──
  const cam = () => p.evaluate('window.__builderFly.cam()') as Promise<Cam>
  const hold = async (code: string, ms: number) => { await p.keyboard.down(code as never); await sleep(ms); await p.keyboard.up(code as never); await sleep(200) }
  await p.mouse.move(640, 500)
  const c0 = await cam()
  await hold('KeyW', 1200)
  const c1 = await cam()
  const moved = Math.hypot(c1.x - c0.x, c1.z - c0.z)
  ok(moved > 5, `W flies: the camera moved ${moved.toFixed(1)} m on the ground plane`)
  await hold('Space', 800)
  const c2 = await cam()
  ok(c2.y > c1.y + 1, `Space climbs: y ${c1.y.toFixed(1)} -> ${c2.y.toFixed(1)}`)

  // ── C. top-down ──
  await hold('KeyT', 50)
  const c3 = await cam()
  ok(c3.pitch < -1.4 && (c3 as any).top === true, `T: top-down (pitch ${c3.pitch.toFixed(2)} rad)`)
  await p.screenshot({ path: `${out}/fly-top.png` })

  // ── D. sculpt in 3D ──
  const box = await p.$eval('[data-testid="builder-fly"]', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  const before = (await p.evaluate('window.__terrain.dirty()') as string[]).length
  await p.mouse.move(box.x, box.y); await sleep(500)
  await p.mouse.down({ button: 'left' }); await sleep(1500)
  await p.mouse.move(box.x + 6, box.y + 6, { steps: 4 }); await sleep(800)
  await p.mouse.up({ button: 'left' }); await sleep(800)
  const dirty = await p.evaluate('window.__terrain.dirty()') as string[]
  ok(dirty.length > before, `a left-drag on the 3D ground sculpts the draft (dirty ${before} -> ${dirty.length}: ${dirty.slice(0, 3).join(',')})`)
  await p.screenshot({ path: `${out}/fly-sculpted.png` })
  await hold('KeyT', 50)
  const c4 = await cam()
  ok(c4.pitch > -1.4 && (c4 as any).top === false, `T again: back to the fly view (pitch ${c4.pitch.toFixed(2)} rad)`)
  await p.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    await sleep(1000)
    const r = await bpost({ action: 'draft', layer: start.draft })
    const now = await bget()
    ok(!!r && !!now && JSON.stringify(now.draft) === JSON.stringify(start.draft), "the owner's draft is back exactly as it was")
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)}`) }
  await br.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`shots: ${out}`)
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
