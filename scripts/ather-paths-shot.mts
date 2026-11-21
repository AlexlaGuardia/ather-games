// ── M58 (2) ATHER PATHS, ELEVATED BEFORE/AFTER (2026-11-21, Jin world) ──────────────────────────────────────────────
// For Alex's look before ?roads=ribbon flips: the same four Ather spots from ~14 m up, once as drawn today and once with
// ribbons. The walker is first person with no free camera, so a shot = tp WITH a y above the ground, aim, wait two frames,
// screenshot (the fall in that time is centimetres), re-tp before every shot.
//   spots: glade (the green, its path, the waymark) · seam (path 1 across the first-wilds/west tile seam at x = -500) ·
//          junction (settlement s1-2, four paths in) · green (the cluster square: four garden paths meet at the centre gate)
//   npx tsx scripts/ather-paths-shot.mts [--url https://ather.games] [--roads legacy|ribbon] [--out dir] [--parallel] [--flicker]
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'fs'
import { GLADE_GREEN } from '../src/app/shimmer/open/ather/moonwell'
import { clusterFrame } from '../src/app/shimmer/open/ather/cluster'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), roads = flag('--roads', 'legacy'), out = flag('--out', `/tmp/ather-paths-${roads}`)
mkdirSync(out, { recursive: true })
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')).tiles as { name: string; tx: number; ty: number }[]
const W = 1100, H = 680
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = [], shots: string[] = []
const hideCard = (p: any) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => { const t = d.textContent ?? ''; return t.includes('Click to play') || (t.includes('THE DARTER') && t.includes('Press any key')) }); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
/** stand `back` m from (tx, tz) on the side toward (fx, fz), `up` m over the ground, looking down at it */
async function shoot(p: any, name: string, tx: number, tz: number, fx: number, fz: number, back = 16, up = 14) {
  const l = Math.hypot(tx - fx, tz - fz) || 1, ux = (tx - fx) / l, uz = (tz - fz) / l
  const x = tx - ux * back, z = tz - uz * back, yaw = Math.atan2(-ux, -uz), pitch = -Math.atan2(up, back)
  const place = () => p.evaluate((a: number, b: number, c: number, d: number, u: number) => { const g = (window as any).__ather; g.combat?.().hollows && (g.combat().hollows.length = 0); g.tp(a, b, c, g.ground(a, b) + u); g.look(c, d) }, x, z, yaw, pitch, up)
  // the Wilds ground builds nearest-first under a 4 ms/frame budget (M44); on SwiftShader 3.5 s left most of it unbuilt and
  // the shot showed the page background where ground should be (and a depthWrite-off overlay with nothing behind it ghosts)
  // ★ wait for the ground near the keeper to be BUILT (window.__groundPending, wilds-scene.tsx), not a fixed time: one piece a
  // SwiftShader frame, so 20 s was sometimes enough and sometimes left the Glade bare (11-21). The plot/cluster has no Wilds
  // ground, so the probe is absent there and the wait is the settle alone.
  await place(); await sleep(Number(flag('--settle', '4000')))
  await p.waitForFunction(() => { const g = (window as any).__groundPending; return !g || g() === 0 }, { timeout: 180000, polling: 500 }).catch(() => errs.push(`${name}: ground still building after 180 s`))
  await sleep(1500)
  await hideCard(p); await place()
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.screenshot({ path: `${out}/${name}.png` }); shots.push(name)
  if (process.argv.includes('--flicker')) {
    // M58 flicker: the same fixed camera 1 s later; z-fighting overlays shimmer between frames, a settled ground does not.
    // Changed = any channel moved > 24. Living things (folk, the beam, water) move too: read the diff image, not only the number.
    await sleep(1000); await place()
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    await p.screenshot({ path: `${out}/${name}-b.png` })
    const [A, B] = await Promise.all([`${out}/${name}.png`, `${out}/${name}-b.png`].map(f => sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true })))
    const { width: w, height: h } = A.info, d = Buffer.alloc(w * h * 3); let changed = 0
    for (let i = 0; i < w * h; i++) {
      const m = Math.max(Math.abs(A.data[i * 3] - B.data[i * 3]), Math.abs(A.data[i * 3 + 1] - B.data[i * 3 + 1]), Math.abs(A.data[i * 3 + 2] - B.data[i * 3 + 2]))
      if (m > 24) { changed++; d[i * 3] = 255 } else { const g = (A.data[i * 3] + A.data[i * 3 + 1] + A.data[i * 3 + 2]) / 9; d[i * 3] = d[i * 3 + 1] = d[i * 3 + 2] = g }
    }
    await sharp(d, { raw: { width: w, height: h, channels: 3 } }).png().toFile(`${out}/${name}-diff.png`)
    flicker[name] = +(changed / (w * h) * 100).toFixed(3)
  }
}
const flicker: Record<string, number> = {}
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
// ★ WHY THE ATHER GROUND WAS MISSING IN EVERY HEADLESS SHOT (11-21, sprites): on SwiftShader, with KHR_parallel_shader_compile
// exposed, the ground's own program (ground-look.tsx: the tiles / toon onBeforeCompile variant, nobody else shares it) draws
// NOTHING, so the page background shows where the ground is and a depthWrite-off overlay ghosts over it. Measured at the Glade:
// ?look=flat draws, ?look=toon and ?look=tiles do not; tiles with the extension hidden draws, pixel tiles and all. A real GPU
// (Alex plays tiles since 11-15) draws it. Hiding the extension makes three link synchronously. --parallel keeps it exposed.
if (!process.argv.includes('--parallel')) await p.evaluateOnNewDocument(() => { for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) { const g = C.prototype.getExtension; C.prototype.getExtension = function (this: WebGLRenderingContext, n: string) { return n === 'KHR_parallel_shader_compile' ? null : g.call(this, n) } } })
// the cluster Green first: the page opens at home
await p.goto(`${url}/shimmer/open/ather?hour=13&roads=${roads}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000)
{ const m = clusterFrame(null, []).middle!; await shoot(p, 'green', m.x, m.z, m.x + 20, m.z - 20, 22, 16) }
// the Wilds: Greg's waymark is the Glade
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg&roads=${roads}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(6000)
// the seam first: the first Wilds shot after load came out with the tile's ground still unbuilt in every run (first-tile parse)
await shoot(p, 'seam', -500, 290, -470, 300, 14, 12)
await shoot(p, 'glade', GLADE_GREEN.x, GLADE_GREEN.z + GLADE_GREEN.r + 4, GLADE_GREEN.x + 10, GLADE_GREEN.z + GLADE_GREEN.r + 24, 20, 16)
{ // s1-2 (four paths in): travel by waymark beside it, then look from out along the open side
  const n = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')), s = n.settlements.find((q: { id: string }) => q.id === 's1-2')
  const t = tiles.find(t => t.tx === Math.floor((s.x + 500) / 1000) && t.ty === Math.floor((s.z + 500) / 1000))
  if (!t) errs.push('no tile for s1-2')
  else {
    await p.evaluate((w: any) => (window as any).__ather.travel({ kind: 'waymark', w }), { id: 'aps', tile: t.name, x: s.x + 40 - t.tx * 1000, y: 0, z: s.z + 40 - t.ty * 1000, biome: 2, made: 0 })
    await sleep(10000)
    await shoot(p, 'junction', s.x, s.z, s.x + 40, s.z + 40, 34, 26)
  }
}
console.log(JSON.stringify({ url, roads, out, shots, errs, ...(Object.keys(flicker).length ? { flickerPct: flicker } : {}) }))
console.log(shots.length === 4 && !errs.length ? `PASS: 4 shots (roads=${roads}) in ${out}` : `FAIL: ${shots.length}/4 shots, ${errs.join('; ')}`)
await br.close(); process.exit(shots.length === 4 && !errs.length ? 0 : 1)
