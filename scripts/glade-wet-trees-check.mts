// ── M160: NO TREE IN THE GLADE'S WATER (prod) ──
//   on the published layer: every generated tree DRAWN (the crowns' own matrices) stands dry, every dry one is drawn, the rest are not;
//   a real held W passes where a removed tree stood; the shore shots (the camera of docs/looks/m153-2026-11-25/filler/shore-*.jpg); draw calls
//   with OWNER_KEY: Fly draws the draft's painted water and the same trees (READ ONLY: every POST to save-builder is refused in the page)
//   npx tsx scripts/glade-wet-trees-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GLADE_FRAME } from '../src/app/shimmer/open/ather/glade-cluster'
import { parseGladeLayer, gladePonds, gladeLayerGround } from '../src/app/shimmer/open/ather/glade-layer'
import { GLADE_CELL, GLADE_SIZE, GLADE_TILE_CENTER } from '../src/app/shimmer/world/glade-builder'
import { poolOver } from '../src/app/shimmer/open/ather/moonwell-water'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/glade-wet-trees'), KEY = process.env.OWNER_KEY ?? ''
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// the check's own reading of wet: a drawn painted sheet (or the pool's) over the walked ground at the trunk's centre
const layer = parseGladeLayer(await (await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' })).json()), G = gladeLayerGround(layer.edits)
const h = GLADE_SIZE / 2, tops = new Map(gladePonds(layer).map(c => [`${c.i},${c.j}`, c.y - 0.05]))
const under = (x: number, z: number) => { const t = tops.get(`${Math.floor((x - GLADE_TILE_CENTER.x + h) / GLADE_CELL)},${Math.floor((z - GLADE_TILE_CENTER.z + h) / GLADE_CELL)}`), g = G(x, z); return (t !== undefined && g < t) || poolOver(x, z, g) }
const foot = (x: number, z: number) => [[0, 0], [0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]].some(([a, b]) => under(x + a, z + b))
const all = GLADE_FRAME.meadow!.trees, dry = all.filter(t => !foot(t.x, t.z)), gone = all.filter(t => under(t.x, t.z))
console.log(`  layer: ${tops.size} water cells, ${all.length} trees, ${gone.length} with the trunk in water, ${dry.length} clear of it`)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errs: string[] = []
async function game(ph: boolean): Promise<Page> {
  const g = await (await br.createBrowserContext()).newPage(); g.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await g.setViewport(ph ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 760 }); await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => { const w = window as any; w.__dc = 0; w.__dcMax = 0
    for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const P = WebGL2RenderingContext.prototype as any, q = P[f]; P[f] = function (...a: any[]) { w.__dc++; return q.apply(this, a) } }
    const tick = () => { w.__dcMax = Math.max(w.__dcMax, w.__dc); w.__dc = 0; requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
  await g.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await g.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await g.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && !(await g.evaluate(() => (window as any).__ather?.zone?.() === 'glade')); i++) { await g.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  await sleep(10000); if (ph) { await g.touchscreen.tap(195, 500); await sleep(1000) } return g
}
try {
  for (const ph of [false, true]) {
    const g = await game(ph)
    await g.evaluate(() => (window as any).__ather.tp(-104, 167.5, Math.PI)); await sleep(5000); await g.evaluate(() => { (window as any).__dcMax = 0 }); await sleep(5000)
    const dc = await g.evaluate(() => (window as any).__dcMax), drawn = await g.evaluate(() => (window as any).__moonwell?.trees?.() ?? null) as number[][] | null
    await g.evaluate(() => { for (const e of [...document.querySelectorAll('div')].filter(d => /Click to (play|resume)|Tap to play|your plot and the Wilds/.test(d.textContent ?? '') && d.clientHeight < 400)) e.style.display = 'none' })
    await g.screenshot({ path: `${out}/shore-${ph ? 'phone' : 'desk'}.jpg`, type: 'jpeg', quality: 85 })
    const has = (t: { x: number; z: number }) => drawn!.some(d => Math.hypot(d[0] - t.x, d[1] - t.z) < 0.01), w = ph ? '390x844' : 'desk'
    ok(!!drawn && !drawn.some(d => foot(d[0], d[1])), `${w}: no drawn tree stands in water (${drawn?.length} drawn)`)
    ok(!!drawn && dry.every(has) && drawn.length === dry.length, `${w}: every dry tree still stands (${dry.length})`); console.log(`  draw calls at the shore, ${w}: ${dc}`)
    if (ph) {
      const t = gone.filter(t => G(t.x, t.z) > -2.2).sort((a, b) => Math.hypot(a.x + 104, a.z - 174) - Math.hypot(b.x + 104, b.z - 174))[0] ?? gone[0]
      await g.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), t.x, t.z + 2.5); await sleep(2500); await g.keyboard.down('KeyW'); let z = 1e9, x = 0
      for (let i = 0; i < 40; i++) { await sleep(1500); const s = await g.evaluate(() => (window as any).__ather.state()); z = s.pz; x = s.px; if (z < t.z - 1) break }
      await g.keyboard.up('KeyW'); ok(z < t.z - 1 && Math.abs(x - t.x) < 0.3, `a real W walks through where a removed tree stood (${t.x}, ${t.z}: to ${x.toFixed(2)}, ${z.toFixed(2)})`)
    }
    await g.close()
  }
  if (KEY) {
    const o = await (await br.createBrowserContext()).newPage(); await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f'); let posts = 0
    await o.setRequestInterception(true); o.on('request', r => { if (r.method() === 'POST' && r.url().includes('save-builder')) { posts++; r.abort() } else r.continue() })
    await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await o.goto(`${url}/shimmer/dev?mode=terrain&map=glade`, { waitUntil: 'load', timeout: 240000 }); await o.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
    await o.click('[data-testid="view-fly"]'); await o.waitForFunction('typeof window.__builderFly?.drawnAt === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 })
    await o.evaluate(() => (window as any).__builderFly.setCam({ x: -104, y: 6, z: 160, yaw: Math.PI, pitch: -0.3, top: false })); await sleep(6000)
    const draft = await o.evaluate(async () => (await (await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' })).json()).draft)
    const f = await o.evaluate(() => (window as any).__builderFly.draft?.()) as { water: number; trees: number } | undefined
    const { gladeFrame } = await import('../src/app/shimmer/open/ather/glade-layer'), want = parseGladeLayer(draft)
    ok(f?.water === gladePonds(want).length && f?.trees === gladeFrame(want).meadow!.trees.length, `Fly draws the draft's water and trees (${JSON.stringify(f)})`)
    await o.screenshot({ path: `${out}/fly-shore.jpg`, type: 'jpeg', quality: 85 }); console.log(`  posts to save-builder refused in the page: ${posts}`)
  }
  ok(!errs.length, `0 page errors ${errs.slice(0, 2).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
