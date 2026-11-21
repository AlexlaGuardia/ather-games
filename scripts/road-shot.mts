// ── M58 (2) ROAD RIBBONS, SEEN (2026-11-21, play / Jin play b7763e94) ──────────────────────────────────────────────
// BEFORE/AFTER shots of the same views for Alex: run once with --roads legacy (today's drawer) and once with --roads ribbon.
// Headless CAN judge shape (unlike flicker): gaps, notches and overlaps at joins are in the picture. Spots: tee j7, roundabout
// j22, town square j4 (Ashfeld), and Ashfeld's lanes. Each from out along an arm, near (steep) and wide. No pass/fail: the
// shots ARE the proof; it fails only on a page error or a missing junction.
//   npx tsx scripts/road-shot.mts [--url https://ather.games] [--roads legacy|ribbon] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), roads = flag('--roads', 'ribbon'), out = flag('--out', `/tmp/roads-${roads}`)
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${url}/shimmer/open/continent?hour=14&roads=${roads}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.footTp, { timeout: 240000 }); await sleep(4000)
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => { const t = d.textContent ?? ''; return /the darter/i.test(t) && /press any key/i.test(t) /* the title is CSS-uppercased: match the text, not the look */ }); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const js = await p.evaluate(async () => (await (await fetch('/open/continent.json')).json()).network.junctions as { id: string; x: number; z: number; r: number; arms: { ang: number }[] }[])
const shots: string[] = []
const view = async (name: string, x: number, z: number, tx: number, tz: number, pitch: number) => {
  const yaw = Math.atan2(-(tx - x), -(tz - z))
  await p.evaluate((a: number, b: number, c: number, d: number) => (window as any).__drive.footTp(a, b, c, d), x, z, yaw, pitch); await sleep(3500)
  await hideCard(); const f = `${out}/${name}.png`; await p.screenshot({ path: f }); shots.push(f)
}
for (const id of ['j7', 'j22', 'j4']) {
  const j = js.find(q => q.id === id); if (!j) { errs.push(`no junction ${id}`); continue }
  // between two arms (so the camera sees where they meet), near and steep, then wide
  const a = j.arms.length > 1 ? (j.arms[0].ang + j.arms[1].ang) / 2 : j.arms[0].ang + 0.6
  for (const [tag, d, pitch] of [['near', j.r + 4, -0.75], ['wide', j.r + 22, -0.32]] as const)
    await view(`${id}-${tag}`, j.x + Math.cos(a) * d, j.z + Math.sin(a) * d, j.x, j.z, pitch)
}
// Ashfeld's lanes: from the square's edge looking into the town
await view('ashfeld-lanes', 241 + 30, -2100 + 30, 241, -2100, -0.4)
console.log(JSON.stringify({ url, roads, shots, errs }))
console.log(errs.length ? `FAIL: ${errs.join('; ')}` : `PASS: ${shots.length} shots (roads=${roads}) in ${out}`)
await br.close(); process.exit(errs.length ? 1 : 0)
