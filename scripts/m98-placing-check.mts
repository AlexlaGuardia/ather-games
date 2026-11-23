// ── BETA M98 s1, PLAYED: snap sizes + turn steps for furniture (world aa0cbd5d, 2026-11-23) ─────────────────────────
// Hold a Goldwood Bench from the hotbar; G cycles the snap (0.25 m default -> Free), T cycles the turn step (90 -> 45); the
// Turn button turns 45 deg; E sets it OFF the quarter-metre grid at q 0.5. Reload: both prefs persist. Then snap 1 m: the
// second bench lands on whole metres. SETUP (stated): 2 benches in the hotbar, empty works. Hooks: movement + reading only.
//   npx tsx scripts/m98-placing-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m98-placing')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m98')) return; sessionStorage.setItem('m98', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.removeItem('open.build.prefs.v1')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'goldwood_bench', n: 2 }; slots[1] = { id: 'waymark', n: 12 }
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
// 1. hold the bench: chips show the defaults
await tp(-130.1, 102.53, Math.PI)
await p.keyboard.press('Digit1'); await sleep(900)
res.placing = await p.evaluate(() => document.querySelector<HTMLElement>('[data-placing]')?.dataset.placing ?? null)
res.defaults = [await chip('snap', 'snap'), await chip('step', 'step')]
// 2. G -> Free, T -> 45; Turn button once -> q 0.5
await p.keyboard.press('g'); await sleep(300); await p.keyboard.press('t'); await sleep(300)
res.cycled = [await chip('snap', 'snap'), await chip('step', 'step')]
await click('[data-act="turn"]'); await sleep(400); await shot('m98-1-ghost45')
await p.keyboard.press('e'); await sleep(1000)
const a = (await pieces())[0]; res.first = a
res.offGrid = !!a && (Math.abs(a.x * 4 - Math.round(a.x * 4)) > 1e-6 || Math.abs(a.z * 4 - Math.round(a.z * 4)) > 1e-6)
await tp(-128.5, 105.5, Math.PI / 5); await shot('m98-2-set45')
// 3. reload: the prefs persist
await boot()
await tp(-125.3, 102.3, Math.PI)
await p.keyboard.press('Digit1'); await sleep(900)
res.persisted = [await chip('snap', 'snap'), await chip('step', 'step')]
// 4. G -> 1 m (Free -> 1), set straight: whole metres
await p.keyboard.press('g'); await sleep(300)
res.snap1 = await chip('snap', 'snap')
await p.keyboard.press('e'); await sleep(1000)
const b = (await pieces()).find(x => x !== undefined && (x.x !== a?.x || x.z !== a?.z)); res.second = b
res.errs = errs
console.log(JSON.stringify(res))
const eq = (v: unknown, w: unknown[]) => JSON.stringify(v) === JSON.stringify(w)
const pass = res.placing === 'piece' && eq(res.defaults, ['0.25', '90']) && eq(res.cycled, ['0', '45']) && a?.q === 0.5 && res.offGrid === true
  && eq(res.persisted, ['0', '45']) && res.snap1 === '1' && !!b && Number.isInteger(b.x) && Number.isInteger(b.z) && b.q === 0 && (await pieces()).length === 2 && errs.length === 0
console.log(pass ? 'PASS: chips default 0.25 m / 90; G -> Free, T -> 45; a 45-deg bench set off-grid; prefs survive reload; 1 m snap lands on whole metres' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
