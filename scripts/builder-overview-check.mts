// ── WORLD BUILDER: THE WHOLE-MAP OVERVIEW (BETA M83, world lane, 11-23; Alex: "a reference image under the map I'm editing so I
// can see the whole thing with the slice I'm viewing highlighted") ─────────────────────────────────────────────────────────────
// READ-ONLY: no stroke, no Save, no Publish (the drafts and live layers are compared before / after and must not move).
//   For each map (Wilds, Glade, Nyx continent), owner opens /shimmer/dev?mode=builder&map=<m>:
//     1. the overview renders: every tile drawn (Wilds: once its raw heights arrive), and the open tile's box holds real pixels
//     2. the open tile is lit (the highlight's box = that tile)
//   Wilds + Nyx (tiled): 3. a REAL mouse click on another tile in the overview opens it in the editor (__terrain.tile + ready),
//     and the highlight moves to it
//   ALWAYS: 0 page errors; drafts + live layers of all three maps unchanged.
// SETUP: OWNER_KEY from .env or env (run on the BOX; take the browser lock).
//   npx tsx scripts/builder-overview-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-overview-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
type Box = { x: number; y: number; w: number; h: number }
interface Ov { tiles: number; cols: number; rows: number; current: string; lit: Box | null }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/nyx-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const MAPS = ['wilds', 'glade', 'nyx'] as const
const snapAll = () => op.evaluate(async (ms: string[]) => {
  const o: Record<string, string> = {}
  for (const m of ms) {
    let r: Response | null = null
    for (let i = 0; i < 6; i++) { r = await fetch(`/shimmer/save-builder?map=${m}`, { cache: 'no-store' }); if (r.ok) break; await new Promise(z => setTimeout(z, 1500)) }
    const j = r && r.ok ? await r.json() : null
    o[m] = j ? JSON.stringify({ draft: j.draft, draftAt: j.draftAt, live: j.index.live, n: j.index.versions.length }) : 'null'
  }
  return o }, [...MAPS]) as Promise<Record<string, string>>
const before = await snapAll()
ok(MAPS.every(m => before[m] !== 'null'), 'owner: the builder answers for wilds, glade, nyx')

try {
  for (const m of MAPS) {
    const p = await owner.newPage(); await p.setViewport({ width: 1400, height: 1000 })
    p.on('pageerror', e => errs.push(`${m}: ` + String(e).slice(0, 200)))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    const r = await p.goto(`${url}/shimmer/dev?mode=builder&map=${m}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(`window.__terrain?.ready === true && window.__terrain?.map === "${m}" && !!window.__overview`, { timeout: 240000, polling: 500 })
    // every tile drawn (the Wilds fetch their raw heights in the background)
    await p.waitForFunction('window.__overview.drawn() === window.__overview.tiles', { timeout: 120000, polling: 500 }).catch(() => {})
    await sleep(800)
    const ov = await p.evaluate('({ ...window.__overview, drawn: window.__overview.drawn() })') as Ov & { drawn: number }
    const tile0 = await p.evaluate('window.__terrain.tile') as string
    const rgb0 = await p.evaluate(`window.__overview.rgb(${JSON.stringify(tile0)})`) as number[] | null
    ok(r?.status() === 200 && ov.tiles > 0 && ov.drawn === ov.tiles, `${m}: overview renders: ${ov.drawn}/${ov.tiles} tiles drawn on a ${ov.cols}x${ov.rows} grid (editor ${r?.status()})`)
    ok(!!rgb0 && rgb0.some(v => v > 30) && !(rgb0[0] === rgb0[1] && rgb0[1] === rgb0[2]), `${m}: the open tile's box holds drawn ground (mean rgb ${rgb0?.map(v => v.toFixed(0)).join(',')})`)
    // the highlight = the open tile; measure the drawn rect on screen against the tile's centre
    const litOk = async (name: string) => p.evaluate((n: string) => {
      const o = (window as any).__overview, el = document.querySelector('[data-testid="overview-lit"]') as SVGRectElement | null
      const c = o.centre(n); if (!el || !c) return { ok: false, why: el ? 'no centre' : 'no lit rect' }
      const b = el.getBoundingClientRect()
      return { ok: o.current === n && c.x > b.left && c.x < b.right && c.y > b.top && c.y < b.bottom, why: `current ${o.current}, rect ${b.left.toFixed(0)},${b.top.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}, centre ${c.x.toFixed(0)},${c.y.toFixed(0)}` }
    }, name) as Promise<{ ok: boolean; why: string }>
    const l0 = await litOk(tile0)
    ok(l0.ok, `${m}: the open tile ${tile0} is lit (${l0.why})`)
    await p.screenshot({ path: `${out}/${m}-0.png`, fullPage: true })
    if (m !== 'glade') {
      // a land tile two or more tiles away (a real move), clicked with the real mouse
      const names = await p.evaluate('window.__overview.names()') as string[]
      const xy = (n: string) => { const q = /(-?\d+)_(-?\d+)$/.exec(n); return q ? [+q[1], +q[2]] : [0, 0] }
      const [ax, ay] = xy(tile0), target = names.filter(n => n !== tile0 && Math.max(Math.abs(xy(n)[0] - ax), Math.abs(xy(n)[1] - ay)) >= 2)[0] ?? names.find(n => n !== tile0)!
      const c = await p.evaluate(`window.__overview.centre(${JSON.stringify(target)})`) as { x: number; y: number }
      await p.evaluate((y: number) => window.scrollTo(0, Math.max(0, window.scrollY + y - 500)), c.y)
      const c2 = await p.evaluate(`window.__overview.centre(${JSON.stringify(target)})`) as { x: number; y: number }
      await p.mouse.move(c2.x, c2.y); await sleep(200); await p.mouse.click(c2.x, c2.y)
      await p.waitForFunction(`window.__terrain?.tile === ${JSON.stringify(target)} && window.__terrain?.ready === true`, { timeout: 120000, polling: 300 }).catch(() => {})
      await sleep(800)
      const t1 = await p.evaluate('window.__terrain.tile') as string
      ok(t1 === target, `${m}: clicking ${target} in the overview opens it in the editor (editor tile ${tile0} -> ${t1})`)
      const sel = await p.evaluate(() => (document.querySelector('select') as HTMLSelectElement | null)?.value)
      ok(sel === target, `${m}: the tile dropdown follows (${sel})`)
      const l1 = await litOk(target), lOld = await litOk(tile0)
      ok(l1.ok && !lOld.ok, `${m}: the highlight moved to ${target} (${l1.why}) and left ${tile0}`)
      await p.screenshot({ path: `${out}/${m}-1.png`, fullPage: true })
    }
    await p.close()
  }
} finally {
  const after = await snapAll()
  ok(MAPS.every(m => after[m] === before[m]), `drafts + live layers of all three maps unchanged (${MAPS.map(m => `${m} ${after[m] === before[m] ? 'same' : 'MOVED'}`).join(', ')})`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
  await br.close()
  console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
}
