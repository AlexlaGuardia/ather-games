// ── WORLD BUILDER FLY: MOUSE-LOOK + STRENGTH (BETA M83, world lane, 11-23; Alex: "lock the camera to the cursor" and "if I want to
// change the terrain dramatically it takes a bit long") ──────────────────────────────────────────────────────────────────────────
// Owner opens ?mode=builder&map=nyx, switches to Fly:
//   1. a REAL click on the view locks the pointer (document.pointerLockElement = the canvas), and the click sculpts nothing
//   2. real mouse movement while locked turns the camera (yaw / pitch move)
//   3. the strength hotkeys (- / =) step the value the HUD shows, down to the min and up to the max
//   4. left held while locked raises the terrain at the SCREEN CENTRE (the crosshair's point), not somewhere else; a stroke at the
//      max raises far more than the same stroke at the min
//   5. Esc frees the pointer
//   ALWAYS (finally): every stroke undone, the Nyx draft put back if it moved (as builder-nyx-check does); drafts + live of all three
//   maps unchanged; 0 page errors. Nothing is published.
// SETUP: OWNER_KEY from .env or env (run on the BOX; take the browser lock on its own line first).
//   npx tsx scripts/builder-fly-lock-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-fly-lock-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
type Maps = Record<string, Record<string, number>>
type LayerJ = { tiles?: Maps; water?: Maps; falls?: Maps }
const canon = (l: LayerJ) => JSON.stringify(['tiles', 'water', 'falls'].map(p => { const m = (l as Record<string, Maps>)[p] ?? {}; return Object.keys(m).sort().map(t => [t, Object.keys(m[t]).sort().map(k => [k, m[t][k]])]) }))

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/nyx-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const MAPS = ['wilds', 'glade', 'nyx'] as const
const bget = (m: string) => op.evaluate(async (mm: string) => {
  for (let i = 0; i < 6; i++) { const r = await fetch(`/shimmer/save-builder?map=${mm}`, { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) }
  return null }, m) as Promise<{ draft: LayerJ; index: { live: number | null; versions: unknown[] } } | null>
const sig = async () => { const o: Record<string, string> = {}; for (const m of MAPS) { const b = await bget(m); o[m] = b ? `${canon(b.draft)}|v${b.index.live}|${b.index.versions.length}` : 'null' } return o }
const start = await bget('nyx'), before = await sig()
ok(!!start && MAPS.every(m => before[m] !== 'null'), 'owner: the builder answers for wilds, glade, nyx')

const p = await owner.newPage(); await p.setViewport({ width: 1400, height: 1000 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
try {
  const r = await p.goto(`${url}/shimmer/dev?mode=builder&map=nyx`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "nyx"', { timeout: 240000, polling: 500 })
  await p.click('[data-testid="view-fly"]')
  await p.waitForFunction('!!window.__builderFly?.cam() && !!window.__builderFly?.centre', { timeout: 120000, polling: 300 })
  ok(r?.status() === 200 && await p.evaluate('window.__terrain.lockLook === true') as boolean, `the editor answers ${r?.status()}; Fly opens with mouse-look on`)
  await p.evaluate('window.__builderFly.setCam({ pitch: -1.1, yaw: 0 })'); await sleep(1200)
  const box = (await (await p.$('[data-testid="fly-frame"] canvas'))!.boundingBox())!
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await p.mouse.move(cx, cy)

  // ── 1. click locks, sculpts nothing ──
  await p.mouse.click(cx, cy)
  await p.waitForFunction('window.__builderFly.locked() === true', { timeout: 10000, polling: 100 }).catch(() => {})
  const locked = await p.evaluate('window.__builderFly.locked()') as boolean
  ok(locked && await p.$('[data-testid="fly-crosshair"]') !== null, `a click on the view locks the pointer (${locked}) and shows the crosshair`)
  ok((await p.evaluate('window.__terrain.dirty()') as string[]).length === 0, 'the locking click sculpted nothing')

  // ── 2. mouse turns the camera ──
  const c0 = await p.evaluate('window.__builderFly.cam()') as { yaw: number; pitch: number }
  for (let i = 1; i <= 10; i++) await p.mouse.move(cx + i * 20, cy + i * 4)
  await sleep(300)
  const c1 = await p.evaluate('window.__builderFly.cam()') as { yaw: number; pitch: number }
  ok(Math.abs(c1.yaw - c0.yaw) > 0.2 && c1.pitch !== c0.pitch, `mouse movement turns the camera (yaw ${c0.yaw.toFixed(3)} -> ${c1.yaw.toFixed(3)}, pitch ${c0.pitch.toFixed(3)} -> ${c1.pitch.toFixed(3)})`)
  await p.evaluate('window.__builderFly.setCam({ pitch: -1.1, yaw: 0 })'); await sleep(800)

  // ── 3 + 4. strength hotkeys, crosshair strokes ──
  const hud = () => p.$eval('[data-testid="fly-hud"]', e => e.textContent ?? '')
  const C = await p.evaluate('window.__builderFly.centre()') as { x: number; z: number } | null
  ok(!!C, `the crosshair hits terrain (${C?.x.toFixed(1)}, ${C?.z.toFixed(1)})`)
  const o = await p.evaluate('window.__terrain.origin()') as { x: number; z: number }
  const hAt = (x: number, z: number) => p.evaluate(`window.__terrain.heightAt(${x - o.x}, ${z - o.z})`) as Promise<number>
  const FAR = { x: C!.x + 150, z: C!.z + 150 }
  const stroke = async (ms: number) => {
    const h0 = await hAt(C!.x, C!.z), f0 = await hAt(FAR.x, FAR.z)
    await p.mouse.down(); await sleep(ms); await p.mouse.up(); await sleep(400)
    const h1 = await hAt(C!.x, C!.z), f1 = await hAt(FAR.x, FAR.z)
    await p.evaluate('window.__terrain.undo()'); await sleep(300)
    const h2 = await hAt(C!.x, C!.z)
    return { rise: h1 - h0, far: f1 - f0, undone: Math.abs(h2 - h0) < 1e-3 }
  }
  for (let i = 0; i < 14; i++) await p.keyboard.press('Minus')
  await sleep(200)
  const sMin = await p.evaluate('window.__terrain.strength') as number, hudMin = await hud()
  const a = await stroke(600)
  for (let i = 0; i < 14; i++) await p.keyboard.press('Equal')
  await sleep(200)
  const sMax = await p.evaluate('window.__terrain.strength') as number, hudMax = await hud()
  ok(sMin === 0.1 && sMax === 3 && hudMin.includes('strength 0.10') && hudMax.includes('strength 3.00'), `- / = step the strength the HUD shows (${sMin} "${hudMin.slice(0, 40)}" -> ${sMax} "${hudMax.slice(0, 40)}")`)
  const b = await stroke(600)
  ok(a.rise > 0 && Math.abs(a.far) < 1e-6 && b.rise > 0 && Math.abs(b.far) < 1e-6, `left held raises the ground AT the crosshair (min +${a.rise.toFixed(3)} m, max +${b.rise.toFixed(2)} m) and not 210 m away (${a.far}, ${b.far})`)
  // the ladder spans 30x (0.1 -> 3 m/tick); 10x leaves room for tick jitter, 5 m in 0.6 s is a dramatic change
  ok(b.rise > 10 * a.rise && b.rise >= 5, `a stroke at the max raises far more than at the min (+${b.rise.toFixed(2)} m vs +${a.rise.toFixed(3)} m in 0.6 s)`)
  ok(a.undone && b.undone, 'both strokes undone')
  await p.screenshot({ path: `${out}/fly-locked.png` })

  // ── 5. Esc frees ──
  await p.keyboard.press('Escape'); await sleep(500)
  const freed = !(await p.evaluate('window.__builderFly.locked()') as boolean)
  ok(freed, `Esc frees the pointer (${freed})`)
  if (!freed) await p.evaluate('document.exitPointerLock()')
} finally {
  // never leave a stroke behind: the undone strokes still mark tiles dirty, so the editor may autosave the (equal) layer
  try { await p.close({ runBeforeUnload: false }) } catch { /* */ }
  const now = await bget('nyx')
  if (start && now && canon(now.draft) !== canon(start.draft)) {
    const r = await op.evaluate(async (l: LayerJ) => (await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'nyx', action: 'draft', layer: { v: 1, tiles: l.tiles ?? {}, water: l.water ?? {}, falls: l.falls ?? {} } }) })).ok, start.draft)
    console.log(`  (the Nyx draft had moved: put back ${r ? 'OK' : 'FAILED'})`)
  }
  const after = await sig()
  ok(MAPS.every(m => after[m] === before[m]), `drafts + live layers of all three maps unchanged (${MAPS.map(m => `${m} ${after[m] === before[m] ? 'same' : 'MOVED'}`).join(', ')})`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
  await br.close()
  console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
}
