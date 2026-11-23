// ── BETA M98b b1, PLAYED: free-build FLOOR SLABS (world aa0cbd5d, 2026-11-23) ──────────────────────────────────────────
// Hold a Wide Goldwood Floor Slab (2 x 2): Free + 45 deg, one turn, set: it anchors. G to 1 m, set again: the second slab lands
// flush beside it along its 45-deg axis. Hold a Goldwood Bench: its ghost over the first slab stays ON it (edges in line),
// set: the bench stands on the slab. Stand the keeper on the second slab: feet ride its 0.12 m top.
// SETUP (stated): 2 wide slabs + 1 bench in the hotbar, empty works, prefs cleared. Hooks: movement + reading only.
//   npx tsx scripts/m98b-slab-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m98b-slab')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m98b')) return; sessionStorage.setItem('m98b', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.removeItem('open.build.prefs.v1')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'goldwood_slab_wide', n: 2 }; slots[2] = { id: 'goldwood_bench', n: 1 }; slots[1] = { id: 'waymark', n: 12 }
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
const feet = async () => (await p.evaluate(() => (window as any).__ather.state().py)) as number
res.groundFeet = await feet()
// 1. slab, Free + 45, one turn, set: anchor
await p.keyboard.press('Digit1'); await sleep(900)
res.placing = await p.evaluate(() => document.querySelector<HTMLElement>('[data-placing]')?.dataset.placing ?? null)
await p.keyboard.press('g'); await sleep(300); await p.keyboard.press('t'); await sleep(300)
res.mode = [await chip('snap', 'snap'), await chip('step', 'step')]
await click('[data-act="turn"]'); await sleep(2000)
await p.keyboard.press('e'); await sleep(1000)
const A = (await pieces())[0]; res.A = A
res.anchorChip = !!(await p.$('[data-act="anchor-clear"]'))
// 2. G -> 1 m, set: the second slab flush beside, along its axis
await p.keyboard.press('g'); await sleep(2500); await shot('m98b-1-ghost2')
await p.keyboard.press('e'); await sleep(1000)
const B = (await pieces()).find(x => x.item === 'goldwood_slab_wide' && (x.x !== A?.x || x.z !== A?.z)); res.B = B
const c = Math.SQRT1_2, near = (u: number, v: number, e = 1e-3) => Math.abs(u - v) < e
const loc = (x: number, z: number) => [(x - A.x) * c + (z - A.z) * c, -(x - A.x) * c + (z - A.z) * c]
let flush = false
if (A && B) { const [lx, lz] = loc(B.x, B.z); res.Blocal = [lx, lz]; flush = B.q === 0.5 && ((near(Math.abs(lx), 2) && near(lz, 0)) || (near(Math.abs(lz), 2) && near(lx, 0))) }
res.flush = flush
// 3. the bench: its ghost over slab A stays on it; set
await p.keyboard.press('Digit3'); await sleep(2500); await shot('m98b-2-benchghost')
await p.keyboard.press('e'); await sleep(1000)
const bench = (await pieces()).find(x => x.item === 'goldwood_bench'); res.bench = bench
let onA = false
if (A && bench) { const [lx, lz] = loc(bench.x, bench.z); res.benchLocal = [lx, lz]; onA = Math.abs(lx) <= 1 + 1e-3 && Math.abs(lz) <= 1 + 1e-3 }
res.benchOnA = onA
await tp(X + 3, Z + 5, Math.PI / 5); await shot('m98b-3-slabs')
// 4. stand on slab B: feet ride its top
if (B) { await tp(B.x, B.z, 0); res.slabFeet = await feet() }
res.lift = typeof res.slabFeet === 'number' ? +((res.slabFeet as number) - (res.groundFeet as number)).toFixed(3) : null
res.errs = errs
console.log(JSON.stringify(res))
const eq = (v: unknown, w: unknown[]) => JSON.stringify(v) === JSON.stringify(w)
const lift = res.lift as number | null
const pass = res.placing === 'piece' && eq(res.mode, ['0', '45']) && A?.q === 0.5 && res.anchorChip === true && flush && onA
  && lift !== null && lift > 0.08 && lift < 0.2 && (await pieces()).length === 3 && errs.length === 0
console.log(pass ? 'PASS: a 45-deg wide slab anchors; the second lands flush beside it along its axis; a bench stands on the first; the keeper stands on the second (feet +' + lift + ' m)' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
