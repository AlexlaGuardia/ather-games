// ── M58 (2) ATHER PATHS, ELEVATED BEFORE/AFTER (2026-11-21, Jin world) ──────────────────────────────────────────────
// For Alex's look before ?roads=ribbon flips: the same four Ather spots from ~14 m up, once as drawn today and once with
// ribbons. The walker is first person with no free camera, so a shot = tp WITH a y above the ground, aim, wait two frames,
// screenshot (the fall in that time is centimetres), re-tp before every shot.
//   spots: glade (the green, its path, the waymark) · seam (path 1 across the first-wilds/west tile seam at x = -500) ·
//          junction (settlement s1-2, four paths in) · green (the cluster square: four garden paths meet at the centre gate)
//   npx tsx scripts/ather-paths-shot.mts [--url https://ather.games] [--roads legacy|ribbon] [--out dir]
import puppeteer from 'puppeteer-core'
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
  await place(); await sleep(3500)   // let near pieces build at this spot
  await hideCard(p); await place()
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.screenshot({ path: `${out}/${name}.png` }); shots.push(name)
}
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
// the cluster Green first: the page opens at home
await p.goto(`${url}/shimmer/open/ather?hour=13&roads=${roads}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000)
{ const m = clusterFrame(null, []).middle!; await shoot(p, 'green', m.x, m.z, m.x + 20, m.z - 20, 22, 16) }
// the Wilds: Greg's waymark is the Glade
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg&roads=${roads}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(6000)
await shoot(p, 'glade', GLADE_GREEN.x, GLADE_GREEN.z + GLADE_GREEN.r + 4, GLADE_GREEN.x + 10, GLADE_GREEN.z + GLADE_GREEN.r + 24, 20, 16)
await shoot(p, 'seam', -500, 290, -470, 300, 14, 12)
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
console.log(JSON.stringify({ url, roads, out, shots, errs }))
console.log(shots.length === 4 && !errs.length ? `PASS: 4 shots (roads=${roads}) in ${out}` : `FAIL: ${shots.length}/4 shots, ${errs.join('; ')}`)
await br.close(); process.exit(shots.length === 4 && !errs.length ? 0 : 1)
