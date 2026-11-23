// ── BETA M98 s2, PLAYED: the ANCHOR (world aa0cbd5d, 2026-11-23) ──────────────────────────────────────────────────────
// Hold a Goldwood Bench (1.6 x 0.5); Free + 45 deg, one turn, set it: it becomes the anchor and a Clear anchor chip shows.
// G to 1 m and set again from the same spot: the second bench lands touching the first along ITS 45-deg axis, in line (whole
// metres out from touching). Clear anchor, turn back square: the third bench lands on whole world metres.
// SETUP (stated): 3 benches in the hotbar, empty works, prefs cleared. Hooks: movement + reading only.
//   npx tsx scripts/m98-anchor-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m98-anchor')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m98a')) return; sessionStorage.setItem('m98a', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.removeItem('open.build.prefs.v1')
  const slots: unknown[] = Array(32).fill(null)
  slots[0] = { id: 'goldwood_bench', n: 3 }; slots[1] = { id: 'waymark', n: 12 }
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
// 1. hold the bench, Free + 45, one turn, set: the first bench is the ANCHOR (q 0.5), the Clear anchor chip shows
await tp(-130.1, 102.53, Math.PI)
await p.keyboard.press('Digit1'); await sleep(900)
await p.keyboard.press('g'); await sleep(300)   // 0.25 -> Free
await p.keyboard.press('t'); await sleep(300)
res.mode = [await chip('snap', 'snap'), await chip('step', 'step')]
await click('[data-act="turn"]'); await sleep(400)
res.noAnchorChipBefore = !(await p.$('[data-act="anchor-clear"]'))
await sleep(2000); await p.keyboard.press('e'); await sleep(1000)
const a = (await pieces())[0]; res.anchor = a
res.anchorChip = !!(await p.$('[data-act="anchor-clear"]'))
await shot('m98s2-1-anchor')
// 2. G -> 1 m, set again from the same spot: it lands TOUCHING the anchor along its own 45-deg axis, in line
await p.keyboard.press('g'); await sleep(300)
res.snap1 = await chip('snap', 'snap')
await sleep(2500); await shot('m98s2-2-ghost')
await p.keyboard.press('e'); await sleep(1000)
const b = (await pieces()).find(x => x.x !== a?.x || x.z !== a?.z); res.second = b
const c = Math.SQRT1_2, loc = (x: number, z: number) => [(x - a.x) * c + (z - a.z) * c, -(x - a.x) * c + (z - a.z) * c]
const near = (u: number, v: number) => Math.abs(u - v) < 1e-3
const onStep = (v: number) => near(v, Math.round(v))
let flush = false
if (a && b) { const [lx, lz] = loc(b.x, b.z); res.local = [lx, lz]
  flush = b.q === 0.5 && ((near(Math.abs(lx) - 1.6, Math.round(Math.abs(lx) - 1.6)) && Math.abs(lx) >= 1.6 - 1e-3 && onStep(lz))
    || (Math.abs(lz) >= 0.5 - 1e-3 && onStep(Math.abs(lz) - 0.5) && onStep(lx))) }
res.flush = flush
await tp(-128.5, 105.5, Math.PI / 5); await shot('m98s2-3-pair')
// 3. Clear anchor: chip goes; the next bench (1 m, turned back square) lands on whole WORLD metres
await tp(-125.3, 102.3, Math.PI)
await p.keyboard.press('Digit1'); await sleep(900)
await click('[data-act="anchor-clear"]'); await sleep(600)
res.chipGone = !(await p.$('[data-act="anchor-clear"]'))
await p.keyboard.press('t'); await sleep(300); await p.keyboard.press('t'); await sleep(300); await p.keyboard.press('t'); await sleep(300)   // 45 -> 30 -> 15 -> 90
res.step90 = await chip('step', 'step')
await click('[data-act="turn"]'); await sleep(400); await click('[data-act="turn"]'); await sleep(400); await click('[data-act="turn"]'); await sleep(400)   // q 0.5 -> 1.5 -> 2.5 -> 3.5
await sleep(2500); await p.keyboard.press('e'); await sleep(1000)
const all = await pieces(), d3 = all.find(x => x !== undefined && (x.x !== a?.x || x.z !== a?.z) && (x.x !== b?.x || x.z !== b?.z)); res.third = d3
res.errs = errs
console.log(JSON.stringify(res))
const eq = (v: unknown, w: unknown[]) => JSON.stringify(v) === JSON.stringify(w)
const pass = eq(res.mode, ['0', '45']) && res.noAnchorChipBefore === true && a?.q === 0.5 && res.anchorChip === true && res.snap1 === '1' && flush
  && res.chipGone === true && res.step90 === '90' && !!d3 && Number.isInteger(d3.x) && Number.isInteger(d3.z) && all.length === 3 && errs.length === 0
console.log(pass ? 'PASS: a freehand 45-deg bench anchors (chip shows); at 1 m the next bench lands touching it along its own axis, in line; Clear anchor drops it and the third bench is back on world metres' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
