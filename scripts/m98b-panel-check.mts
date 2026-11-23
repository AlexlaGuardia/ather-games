// ── BETA M98b b2, PLAYED: free-build WALL PANELS (world aa0cbd5d, 2026-11-23) ─────────────────────────────────────────
// Hold a Wide Goldwood Wall Panel (2 m): Free + 45 deg, one turn, set: it anchors. G to 1 m, set again: the second panel lands
// flush in line along its 45-deg axis (a run). Walk the keeper straight at the first panel: it stops at the panel. Stand the
// keeper just off the panel, inside the square its one axis box would cover: it is free there (the chain, not a fat box).
// SETUP (stated): 2 wide panels in the hotbar, empty works, prefs cleared. Hooks: movement + reading only.
//   npx tsx scripts/m98b-panel-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m98b-panel')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m98p')) return; sessionStorage.setItem('m98p', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.removeItem('open.build.prefs.v1')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'goldwood_panel_wide', n: 2 }; slots[1] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] }))
})
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const pieces = async () => ((await read('open.works.v1'))?.pieces ?? []) as { item: string; x: number; z: number; q: number }[]
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(1500); await shot('_f') }
const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
const chip = (a: string, k: string) => p.evaluate((a, k) => document.querySelector<HTMLElement>(`[data-act="${a}"]`)?.dataset[k] ?? null, a, k)
const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500) }
const res: Record<string, unknown> = { url }
await boot()
const X = -130.1, Z = 102.53
await tp(X, Z, Math.PI)
const st = async () => (await p.evaluate(() => { const s = (window as any).__ather.state(); return [s.px, s.pz] })) as [number, number]
// 1. panel, Free + 45, one turn, set: anchor
await p.keyboard.press('Digit1'); await sleep(900)
await p.keyboard.press('g'); await sleep(300); await p.keyboard.press('t'); await sleep(300)
res.mode = [await chip('snap', 'snap'), await chip('step', 'step')]
await click('[data-act="turn"]'); await sleep(2000)
await p.keyboard.press('e'); await sleep(1000)
const A = (await pieces())[0]; res.A = A
// 2. G -> 1 m, set: the run's next panel, flush in line
await p.keyboard.press('g'); await sleep(2500)
await p.keyboard.press('e'); await sleep(1000)
const B = (await pieces()).find(x => x.x !== A?.x || x.z !== A?.z); res.B = B
const c = Math.SQRT1_2, near = (u: number, v: number, e = 1e-3) => Math.abs(u - v) < e
const loc = (x: number, z: number) => [(x - A.x) * c + (z - A.z) * c, -(x - A.x) * c + (z - A.z) * c]
const wld = (l: number, m: number) => [A.x + l * c - m * c, A.z + l * c + m * c]
let run = false
if (A && B) { const [lx, lz] = loc(B.x, B.z); res.Blocal = [lx, lz]; run = B.q === 0.5 && near(Math.abs(lx), 2) && near(lz, 0) }
res.run = run
await p.keyboard.press('Digit1'); await sleep(600)   // stow
await tp(X + 4, Z + 5, Math.PI / 5); await shot('m98b-p1-run')
// 3. walk straight at panel A from 1.5 m off its face (local z -1.5 -> +): stopped short of the face
let blocked = false
if (A) { const [sx, sz] = wld(0.3, -1.5); await tp(sx, sz, 3 * Math.PI / 4)
  await p.keyboard.down('KeyW'); await sleep(2500); await p.keyboard.up('KeyW'); await sleep(500)
  const [px, pz] = await st(), [lx, lz] = loc(px, pz); res.walkEnd = [lx, lz]; blocked = lz < -0.1 && lz > -1.4 }
res.blocked = blocked
// 4. just off the panel, inside its axis box: the keeper is not shoved
let free = false
if (A) { const [fx, fz] = wld(0, 0.6); await tp(fx, fz, 0); await sleep(800); const [px, pz] = await st(); res.offPanelMoved = +Math.hypot(px - fx, pz - fz).toFixed(3); free = (res.offPanelMoved as number) < 0.1 }
res.free = free
res.errs = errs
console.log(JSON.stringify(res))
const eq = (v: unknown, w: unknown[]) => JSON.stringify(v) === JSON.stringify(w)
const pass = eq(res.mode, ['0', '45']) && A?.q === 0.5 && run && blocked && free && (await pieces()).length === 2 && errs.length === 0
console.log(pass ? 'PASS: a 45-deg wide panel anchors; the next lands flush in line (a run); walking at it stops at its face; off the panel inside its axis box the keeper stands free' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
