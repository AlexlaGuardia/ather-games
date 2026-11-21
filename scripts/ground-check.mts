// ── M58 (1) GROUND FLICKER, MEASURED (2026-11-21, play / Jin play b7763e94) ─────────────────────────────────────────
// Alex 11-21: overlapping ground shapes flicker, Ather + Nyx. Z-fighting is invisible to a still camera (the coin-flip is
// stable) and loud the moment the camera MOVES: so at each hot spot the camera stands off, aims at the overlap, and creeps
// sideways 2 cm a frame. A 2 cm step at 10+ m moves clean pixels by well under one pixel; a fighting pixel flips colour.
// flip = share of the ground window (centre 50% x rows 40-90%) whose colour jumps > 20 between consecutive creep frames,
// counting only pixels that are NOT grass in either frame (grass texture shimmers under any camera move and is not an
// overlay; the first run measured exactly that and read as a result: 11-21 lesson). 20, not 48: a path's edge strip and its
// centre differ by ~31 a channel, so a fight between them hid under 48. `still` = the same diff, 1 s apart, not moving.
// Hot spots: Ather = two worn-path merges (4 paths at (-1489, 272), 3 at (509, -688): edge strip over centre strip) + the
// Glade path where it meets the green; Nyx = roundabout j22 (kerb + island over the ring), town squares j16 + j4 (pad over
// road), each seen from out along one of its own arms.
//   npx tsx scripts/ground-check.mts [--url https://ather.games] [--ground legacy|layers] [--max 0.004] [--out dir]
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'fs'
import { GLADE_GREEN } from '../src/app/shimmer/open/ather/moonwell'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), ground = flag('--ground', 'layers'), MAX = Number(flag('--max', '0.004'))
const out = flag('--out', `/tmp/ground-${ground}`)
mkdirSync(out, { recursive: true })
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')).tiles as { name: string; tx: number; ty: number }[]
const W = 1100, H = 680, STEPS = 8, STEP = 0.02
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const hideCard = (p: any) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Press any key|CLICK TO RESUME/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const grab = async (p: any) => { await hideCard(p); const png = await p.screenshot({ type: 'png' }); return sharp(png).removeAlpha().raw().toBuffer() }
const grass = (r: number, g: number, b: number) => g > r + 12 && g > b + 12
const diff = (a: Buffer, b: Buffer) => {
  let n = 0, hit = 0
  for (let y = Math.floor(H * 0.4); y < Math.floor(H * 0.9); y++) for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.75); x++) {
    const i = (y * W + x) * 3; n++
    if (grass(a[i], a[i + 1], a[i + 2]) || grass(b[i], b[i + 1], b[i + 2])) continue
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 20) hit++
  }
  return hit / n
}
type Spot = { name: string; x: number; z: number; tx: number; tz: number; d: number }
/** stand `d` m back from the target along the line from (x,z), aim at it, creep sideways */
async function measure(p: any, s: Spot, place: (x: number, z: number, yaw: number, pitch: number) => Promise<void>) {
  const l = Math.hypot(s.tx - s.x, s.tz - s.z) || 1, ux = (s.tx - s.x) / l, uz = (s.tz - s.z) / l
  const sx = s.tx - ux * s.d, sz = s.tz - uz * s.d, yaw = Math.atan2(-ux, -uz), px = -uz, pz = ux
  const pitch = -Math.atan2(1.7, s.d)   // eye ~1.7 m: the target lands mid-window
  const at = (x: number, z: number) => place(x, z, yaw, pitch)
  await at(sx, sz); await sleep(4000)
  const a = await grab(p); await sleep(1000); const b = await grab(p)
  const still = diff(a, b)
  await p.screenshot({ path: `${out}/${s.name}.png` })
  let prev = b, flips = 0
  for (let k = 1; k <= STEPS; k++) { await at(sx + px * STEP * k, sz + pz * STEP * k); await sleep(350); const f = await grab(p); flips += diff(prev, f); prev = f }
  return { name: s.name, still: +still.toFixed(5), flip: +(flips / STEPS).toFixed(5) }
}
const res: { name: string; still: number; flip: number }[] = []
// ── Ather ──
{
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  p.on('pageerror', e => errs.push(`ather: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg&ground=${ground}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
  const place = async (x: number, z: number, yaw: number, pitch: number) => { await p.evaluate((a: number, b: number, c: number, d: number) => { const g = (window as any).__ather; g.combat?.().hollows && (g.combat().hollows.length = 0); g.tp(a, b, c); g.look(c, d) }, x, z, yaw, pitch) }
  // the Glade first (the page starts at Greg's waymark), then travel to each path merge by waymark (network-shot's way)
  res.push(await measure(p, { name: 'ather-glade-path', x: GLADE_GREEN.x + 5, z: GLADE_GREEN.z + GLADE_GREEN.r + 8, tx: GLADE_GREEN.x, tz: GLADE_GREEN.z + GLADE_GREEN.r, d: 8 }, place))
  for (const [name, x, z] of [['ather-merge-4', -1489, 272], ['ather-merge-3', 509, -688]] as const) {
    const t = tiles.find(t => t.tx === Math.floor((x + 500) / 1000) && t.ty === Math.floor((z + 500) / 1000))
    if (!t) { errs.push(`no tile for ${name}`); continue }
    await p.evaluate((w: any) => (window as any).__ather.travel({ kind: 'waymark', w }), { id: 'gc', tile: t.name, x: x + 10 - t.tx * 1000, y: 0, z: z + 10 - t.ty * 1000, biome: 2, made: 0 })
    await sleep(9000)
    res.push(await measure(p, { name, x: x + 10, z: z + 10, tx: x, tz: z, d: 10 }, place))
  }
  await p.close()
}
// ── Nyx ──
{
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  p.on('pageerror', e => errs.push(`nyx: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/continent?hour=14&ground=${ground}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.footTp, { timeout: 240000 }); await sleep(4000)
  const js = await p.evaluate(async () => (await (await fetch('/open/continent.json')).json()).network.junctions as { id: string; x: number; z: number; r: number; arms: { ang: number }[] }[])
  const place = async (x: number, z: number, yaw: number, pitch: number) => { await p.evaluate((a: number, b: number, c: number, d: number) => (window as any).__drive.footTp(a, b, c, d), x, z, yaw, pitch) }
  for (const id of ['j22', 'j16', 'j4']) {
    const j = js.find(q => q.id === id); if (!j) { errs.push(`no junction ${id}`); continue }
    const a = j.arms[0]?.ang ?? 0, out = j.r + 6   // out along its first arm, on the road, looking at the pad's edge
    res.push(await measure(p, { name: `nyx-${id}`, x: j.x + Math.cos(a) * out, z: j.z + Math.sin(a) * out, tx: j.x + Math.cos(a) * j.r * 0.5, tz: j.z + Math.sin(a) * j.r * 0.5, d: 12 }, place))
  }
  await p.close()
}
console.log(JSON.stringify({ url, ground, res, errs }))
const bad = res.filter(r => r.flip > MAX)
const pass = res.length === 6 && !bad.length && !errs.length
console.log(pass ? `PASS: ground=${ground}, every hot spot flips <= ${MAX} while the camera creeps` : `FAIL (ground=${ground}): ${bad.map(r => `${r.name} ${r.flip}`).join(', ') || errs.join('; ') || `only ${res.length}/6 spots`}`)
await br.close(); process.exit(pass ? 0 : 1)
