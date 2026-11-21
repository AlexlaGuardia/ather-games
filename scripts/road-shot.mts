// ── M58 (2) ROAD RIBBONS, SEEN (2026-11-21, play / Jin play b7763e94) ──────────────────────────────────────────────
// BEFORE/AFTER shots of the same views for Alex: run once with --roads legacy (today's drawer) and once with --roads ribbon.
// Headless CAN judge shape (unlike flicker): gaps, notches and overlaps at joins are in the picture. Spots: tee j7, roundabout
// j22, town square j4 (Ashfeld), and one Ashfeld street, each from an ELEVATED pinned camera (~50 deg down). No pass/fail: the
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
const js = await p.evaluate(async () => (await (await fetch('/open/continent.json')).json()).network.junctions as { id: string; x: number; z: number; r: number; y: number; arms: { ang: number }[] }[])
const shots: string[] = []
// ELEVATED (hub 11-21: the first set's foot-level views showed grass and walls): walk there so the ground loads, then pin
// the camera with the page's own shot hook (__drive.shot), `up` m above the target and `out` m back, ~50 deg down.
const view = async (name: string, x: number, z: number, y: number, ang: number, up = 32, out = 27) => {
  await p.evaluate((a: number, b: number) => (window as any).__drive.footTp(a + 2, b + 2, 0, -0.3), x, z); await sleep(3000)
  const gy = Number.isFinite(y) ? y : await p.evaluate(() => (window as any).__drive.foot().y as number) - 0.05
  await p.evaluate((q: number[]) => (window as any).__drive.shot(q), [x + Math.cos(ang) * out, gy + up, z + Math.sin(ang) * out, x, gy, z]); await sleep(2500)
  await hideCard(); const f = `${out_}/${name}.png`; await p.screenshot({ path: f }); shots.push(f)
  await p.evaluate(() => (window as any).__drive.shot(null))
}
const out_ = out
for (const id of ['j7', 'j22', 'j4']) {
  const j = js.find(q => q.id === id); if (!j) { errs.push(`no junction ${id}`); continue }
  const a = j.arms.length > 1 ? Math.atan2(Math.sin(j.arms[0].ang) + Math.sin(j.arms[1].ang), Math.cos(j.arms[0].ang) + Math.cos(j.arms[1].ang)) : j.arms[0].ang + 0.6
  await view(id, j.x, j.z, j.y, a + Math.PI / 4)
}
// one Ashfeld street with its kerbs: the town just off its square (j4), closer in
{ const j = js.find(q => q.id === 'j4'); if (j) { const a = j.arms[0].ang + Math.PI; await view('ashfeld-street', j.x + Math.cos(a) * 30, j.z + Math.sin(a) * 30, j.y, a + 1.2, 16, 12) } }   // 30 m into town from the square, at the square's height (a ground read off the square hit the river)
console.log(JSON.stringify({ url, roads, shots, errs }))
console.log(errs.length ? `FAIL: ${errs.join('; ')}` : `PASS: ${shots.length} shots (roads=${roads}) in ${out}`)
await br.close(); process.exit(errs.length ? 1 : 0)
