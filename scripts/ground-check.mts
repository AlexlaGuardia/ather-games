// ── M58 (1) GROUND FLICKER, MEASURED (2026-11-21, play / Jin play b7763e94) ─────────────────────────────────────────
// Alex 11-21: overlapping ground shapes flicker, Ather + Nyx. Z-fighting is invisible to a still camera (the coin-flip is
// stable) and loud the moment the camera MOVES: so at each hot spot the camera stands off, aims at the overlap, and creeps
// sideways 2 cm a frame. A 2 cm step at 10+ m moves clean pixels by well under one pixel; a fighting pixel flips colour.
// flip = share of pixels in the ground window (centre 50% x rows 55-90%) whose colour jumps > 48 between consecutive creep
// frames, averaged over the creep. `still` = the same diff for two frames 1 s apart without moving (animation noise floor).
// Hot spots: Ather = the Greg waymark path hub (15 worn paths start there: edge strip over centre strip), the same hub from
// 40 m (fighting grows with distance), the Glade path where it meets the green; Nyx = roundabout j22, town squares j16 + j4
// (pad over road, kerb + island over pad, town lanes under roads).
//   npx tsx scripts/ground-check.mts [--url https://ather.games] [--ground legacy|layers] [--max 0.004] [--out dir]
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { GLADE_GREEN } from '../src/app/shimmer/open/ather/moonwell'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), ground = flag('--ground', 'layers'), MAX = Number(flag('--max', '0.004'))
const out = flag('--out', `/tmp/ground-${ground}`)
mkdirSync(out, { recursive: true })
const W = 1100, H = 680, STEPS = 8, STEP = 0.02
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const hideCard = (p: any) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const grab = async (p: any) => { await hideCard(p); const png = await p.screenshot({ type: 'png' }); return sharp(png).removeAlpha().raw().toBuffer() }
const diff = (a: Buffer, b: Buffer) => {
  let n = 0, hit = 0
  for (let y = Math.floor(H * 0.55); y < Math.floor(H * 0.9); y++) for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.75); x++) {
    const i = (y * W + x) * 3; n++
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 48) hit++
  }
  return hit / n
}
type Spot = { name: string; x: number; z: number; tx: number; tz: number; d: number }
/** stand `d` m back from the target along the line from (x,z), aim at it, creep sideways */
async function measure(p: any, s: Spot, place: (x: number, z: number, yaw: number) => Promise<void>) {
  const l = Math.hypot(s.tx - s.x, s.tz - s.z) || 1, ux = (s.tx - s.x) / l, uz = (s.tz - s.z) / l
  const sx = s.tx - ux * s.d, sz = s.tz - uz * s.d, yaw = Math.atan2(-ux, -uz), px = -uz, pz = ux
  await place(sx, sz, yaw); await sleep(4000)
  const a = await grab(p); await sleep(1000); const b = await grab(p)
  const still = diff(a, b)
  await p.screenshot({ path: `${out}/${s.name}.png` })
  let prev = b, flips = 0
  for (let k = 1; k <= STEPS; k++) { await place(sx + px * STEP * k, sz + pz * STEP * k, yaw); await sleep(350); const f = await grab(p); flips += diff(prev, f); prev = f }
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
  const place = async (x: number, z: number, yaw: number) => { await p.evaluate((a: number, b: number, c: number) => { const g = (window as any).__ather; g.tp(a, b, c); g.look(c, -0.32) }, x, z, yaw) }
  for (const s of [
    { name: 'ather-greg-hub', x: -300, z: 330, tx: -298, tz: 318, d: 12 },
    { name: 'ather-greg-hub-far', x: -300, z: 370, tx: -296, tz: 330, d: 40 },
    { name: 'ather-glade-path', x: GLADE_GREEN.x + 6, z: GLADE_GREEN.z + GLADE_GREEN.r + 8, tx: GLADE_GREEN.x, tz: GLADE_GREEN.z + GLADE_GREEN.r, d: 9 },
  ] as Spot[]) res.push(await measure(p, s, place))
  await p.close()
}
// ── Nyx ──
{
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  p.on('pageerror', e => errs.push(`nyx: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/continent?hour=14&ground=${ground}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.footTp, { timeout: 240000 }); await sleep(4000)
  const js = await p.evaluate(async () => (await (await fetch('/open/continent.json')).json()).network.junctions as { id: string; x: number; z: number; r: number }[])
  const place = async (x: number, z: number, yaw: number) => { await p.evaluate((a: number, b: number, c: number) => (window as any).__drive.footTp(a, b, c, -0.32), x, z, yaw) }
  for (const id of ['j22', 'j16', 'j4']) {
    const j = js.find(q => q.id === id); if (!j) { errs.push(`no junction ${id}`); continue }
    res.push(await measure(p, { name: `nyx-${id}`, x: j.x + j.r + 10, z: j.z + j.r + 10, tx: j.x + j.r * 0.7, tz: j.z + j.r * 0.7, d: 14 }, place))
  }
  await p.close()
}
console.log(JSON.stringify({ url, ground, res, errs }))
const bad = res.filter(r => r.flip > MAX)
const pass = res.length === 6 && !bad.length && !errs.length
console.log(pass ? `PASS: ground=${ground}, every hot spot flips <= ${MAX} while the camera creeps` : `FAIL (ground=${ground}): ${bad.map(r => `${r.name} ${r.flip}`).join(', ') || errs.join('; ') || `only ${res.length}/6 spots`}`)
await br.close(); process.exit(pass ? 0 : 1)
