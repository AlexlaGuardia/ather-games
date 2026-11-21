// ── M57 THE ALCHEMY SET, STANDING (2026-11-21, play / Jin play b7763e94) ───────────────────────────────────────────
// One look at the four ruled stations placed side by side on open plot ground (Crusher Table, Cauldron Nook, Still, Alchemy
// Desk, in chain order), plus the Desk's panel with its recipe roads. SETUP (stated): the four pieces seeded in open.works.v1.
// Fails only on a page error or a missing panel.   npx tsx scripts/alchemy-pieces-shot.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/alchemy-pieces')
mkdirSync(out, { recursive: true })
const PIECES = ['alc_mortar', 'alc_mixer', 'alc_still', 'alc_desk'].map((item, k) => ({ id: `alc-shot-${k}`, item, x: -134 + k * 2.6, z: 100, q: 0, placedAt: 1 }))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((pieces: unknown[]) => {
  if (sessionStorage.getItem('aps')) return; sessionStorage.setItem('aps', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
}, PIECES)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => (d.textContent ?? '').includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), x, z, yaw); await sleep(2500) }
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(3000)
const mid = -134 + 1.5 * 2.6
await tp(mid, 106.5, 0); await p.evaluate(() => (window as any).__ather.look(0, -0.28)); await sleep(1500); await hideCard()
await p.screenshot({ path: `${out}/alchemy-set.png` })
// the Desk's panel: E at it lists every recipe's road
await tp(PIECES[3].x, PIECES[3].z + 1.4, 0); await aimAt(p, PIECES[3].x, PIECES[3].z, 0.5); await p.keyboard.press('e'); await sleep(1000); await hideCard()
const recipes = await p.evaluate(() => [...document.querySelectorAll('[data-alc-recipe]')].map(e => e.textContent))
await p.screenshot({ path: `${out}/alchemy-desk-panel.png` })
console.log(JSON.stringify({ recipes, errs }))
const pass = recipes.length === 3 && !errs.length
console.log(pass ? `PASS: four stations standing, the Desk lists ${recipes.length} recipe roads (${out})` : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
