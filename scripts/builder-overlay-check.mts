// ── WORLD BUILDER: THE POI + ROADS OVERLAY (BETA M105, world lane, 11-23; Alex: "a toggle to see an overlay of where all the POIs
// and roads will be so i can toggle it on and see if it matches up and then untoggle to clear the clutter") ─────────────────────
// READ-ONLY: no stroke, no Save, no Publish (the drafts and live layers are compared before / after and must not move).
//   For each map (Wilds, Glade, Nyx continent), owner opens /shimmer/dev?mode=builder&map=<m>, opens the tile holding a spot-check
//   POI, then:
//     1. overlay OFF at start: no overlay in the tile view or the overview
//     2. the O key turns it on: the tile view draws markers + road lines; the spot-check POI's marker sits on screen where the
//        SOURCE DATA puts it (read here independently: network-s1.json, moonwell.ts, continent.json), within 3 px
//     3. the overview draws every POI + road of the map; the spot-check POI is there at the source's coords
//     4. Fly: road lines + pins + labels draped on the ground; the spot-check label sits at the source's x/z, on the ground there
//     5. the O key again: nothing drawn in tile view, overview or Fly
//   ALWAYS: 0 page errors; drafts + live layers of all three maps unchanged.
// SETUP: OWNER_KEY from .env or env (run on the BOX; take the browser lock).
//   npx tsx scripts/builder-overlay-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { MOONWELL } from '../src/app/shimmer/open/ather/moonwell'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-overlay-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

// the spot-check POIs, from the SOURCE data (not from the page)
const net = await op.evaluate(async () => (await fetch('/open/wilds/network-s1.json')).json()) as { settlements: { name: string; x: number; z: number }[]; fair: { x: number; z: number } | null }
const cont = await op.evaluate(async () => (await fetch('/open/continent.json')).json()) as { places: { id: string; name: string | null; x: number; z: number }[] }
const s0 = net.settlements[0], ver = cont.places.find(p => p.id === 'veradyn')!
const SPOTS: Record<typeof MAPS[number], { name: string; x: number; z: number; tile: (names: string[]) => string }[]> = {
  wilds: [
    { name: s0.name, x: s0.x, z: s0.z, tile: () => tileNameW(s0.x, s0.z) },
    ...(net.fair ? [{ name: 'The Thistledown Fair', x: net.fair.x, z: net.fair.z, tile: () => tileNameW(net.fair!.x, net.fair!.z) }] : []),
  ],
  glade: [{ name: 'Moonwell', x: MOONWELL.x, z: MOONWELL.z, tile: () => 'glade' }],
  nyx: [{ name: 'Veradyn', x: ver.x, z: ver.z, tile: () => `nyx_${Math.round(ver.x / 1000)}_${Math.round(ver.z / 1000)}` }],
}
function tileNameW(x: number, z: number) { const tx = Math.round(x / 1000), ty = Math.round(z / 1000); return tx === 0 && ty === 0 ? 'first-wilds' : `w${tx}_${ty}` }

const drawnCounts = (p: Page) => p.evaluate(() => {
  const q = (s: string) => document.querySelector(`[data-testid="${s}"]`)
  const t = q('ov-tile'), o = q('ov-overview'), f = (window as any).__builderFly?.overlay?.() ?? null
  return { tile: t ? { pois: t.querySelectorAll('[data-poi]').length, roads: t.querySelectorAll('[data-road]').length } : null,
    ov: o ? { pois: o.querySelectorAll('[data-poi]').length, roads: o.querySelectorAll('[data-road]').length } : null,
    fly: f ? { roads: f.roads, pins: f.pins, labels: f.labels.length } : null }
}) as Promise<{ tile: { pois: number; roads: number } | null; ov: { pois: number; roads: number } | null; fly: { roads: number; pins: number; labels: number } | null }>

try {
  for (const m of MAPS) {
    const spots = SPOTS[m]
    for (const [si, sp] of spots.entries()) {
      const p = await owner.newPage(); await p.setViewport({ width: 1400, height: 1100 })
      p.on('pageerror', e => errs.push(`${m}: ` + String(e).slice(0, 200)))
      await p.evaluateOnNewDocument('window.__name = (f) => f')
      const r = await p.goto(`${url}/shimmer/dev?mode=builder&map=${m}`, { waitUntil: 'load', timeout: 240000 })
      await p.waitForFunction(`window.__terrain?.ready === true && window.__terrain?.map === "${m}" && !!window.__overview`, { timeout: 240000, polling: 500 })
      const tile = sp.tile([])
      if (m !== 'glade') {
        await p.select('select', tile)
        await p.waitForFunction(`window.__terrain?.tile === ${JSON.stringify(tile)} && window.__terrain?.ready === true`, { timeout: 120000, polling: 300 })
      }
      await sleep(600)
      // 1. off at start
      const c0 = await drawnCounts(p)
      if (si === 0) ok(r?.status() === 200 && !c0.tile && !c0.ov, `${m}: overlay off at start: nothing drawn (tile ${!!c0.tile}, overview ${!!c0.ov})`)
      // 2. O turns it on (the hotkey; focus off any input)
      await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await p.keyboard.press('KeyO')
      await p.waitForFunction('!!document.querySelector(\'[data-testid="ov-tile"]\')', { timeout: 30000, polling: 200 }).catch(() => {})
      if (m === 'nyx') await p.waitForFunction('window.__terrain?.overlay?.doors === true', { timeout: 120000, polling: 500 }).catch(() => {})
      await sleep(500)
      const c1 = await drawnCounts(p)
      const data = await p.evaluate('(() => { const d = window.__terrain.overlay.data(); return { pois: d.pois.length, roads: d.roads.length, kinds: [...new Set(d.pois.map(q => q.kind))] } })()') as { pois: number; roads: number; kinds: string[] }
      ok(!!c1.tile && c1.tile.pois > 0, `${m} ${tile}: O on: tile view draws ${c1.tile?.pois} markers + ${c1.tile?.roads} road lines`)
      // the spot POI's marker on screen vs where the source puts it on the tile canvas
      const pos = await p.evaluate((s: { name: string; x: number; z: number }) => {
        const T = (window as any).__terrain, o = T.origin(), cv = document.querySelector('[data-testid="terrain-canvas"]') as HTMLCanvasElement
        const g = [...document.querySelectorAll('[data-testid="ov-tile"] [data-poi]')].find(e => e.getAttribute('data-name') === s.name)
        if (!g || !o) return null
        const c = g.querySelector('circle')!.getBoundingClientRect(), rc = cv.getBoundingClientRect(), size = rc.width
        // the tile canvas spans 1000 m (Wilds / Nyx / the Glade's virtual tile alike) centred on origin()
        const want = { x: rc.left + ((s.x - (o.x - 500)) / 1000) * size, y: rc.top + ((s.z - (o.z - 500)) / 1000) * rc.height }
        return { got: { x: c.left + c.width / 2, y: c.top + c.height / 2 }, want, dx: +g.getAttribute('data-x')!, dz: +g.getAttribute('data-z')! }
      }, sp) as { got: { x: number; y: number }; want: { x: number; y: number }; dx: number; dz: number } | null
      const off = pos ? Math.hypot(pos.got.x - pos.want.x, pos.got.y - pos.want.y) : Infinity
      ok(!!pos && pos.dx === sp.x && pos.dz === sp.z && off < 3, `${m}: "${sp.name}" marker at the source's (${sp.x}, ${sp.z}): data (${pos?.dx}, ${pos?.dz}), on screen ${off.toFixed(1)} px from where the source puts it`)
      // 3. overview: every POI + road of the map
      const ovHas = await p.evaluate((s: { name: string; x: number; z: number }) => [...document.querySelectorAll('[data-testid="ov-overview"] [data-poi]')].some(e => e.getAttribute('data-name') === s.name && +e.getAttribute('data-x')! === s.x && +e.getAttribute('data-z')! === s.z), sp)
      ok(!!c1.ov && c1.ov.pois === data.pois && c1.ov.roads === data.roads && ovHas, `${m}: overview draws all ${c1.ov?.pois}/${data.pois} POIs (${data.kinds.join(', ')}) + ${c1.ov?.roads}/${data.roads} roads; "${sp.name}" at the source's spot`)
      await p.screenshot({ path: `${out}/${m}-${si}-on.png`, fullPage: true })
      // 4. Fly
      if (si === 0) {
        await p.click('[data-testid="view-fly"]')
        await p.waitForFunction('!!window.__builderFly?.overlay', { timeout: 120000, polling: 300 })
        await p.waitForFunction('window.__builderFly.overlay().labels.length > 0', { timeout: 60000, polling: 300 }).catch(() => {})
        await sleep(1500)
        const fl = await p.evaluate('window.__builderFly.overlay()') as { roads: number; pins: number; labels: { name: string; x: number; z: number; y: number }[] }
        const lab = fl.labels.find(l => l.name === sp.name)
        const gy = lab ? await p.evaluate((x: number, z: number) => { const T = (window as any).__terrain, o = T.origin(); return T.heightAt(x - o.x, z - o.z) }, lab.x, lab.z) as number : NaN
        ok(fl.labels.length > 0 && fl.pins === fl.labels.length && (fl.roads > 0 || c1.tile!.roads === 0), `${m}: Fly draws ${fl.roads} road lines + ${fl.pins} pins + ${fl.labels.length} labels draped on the ring`)
        ok(!!lab && lab.x === sp.x && lab.z === sp.z && Math.abs(lab.y - gy) < 0.01, `${m}: Fly label "${sp.name}" at the source's (${sp.x}, ${sp.z}), on the ground (${lab?.y.toFixed(2)} m vs ground ${gy.toFixed(2)} m)`)
        await p.evaluate(() => (window as any).__builderFly.top()); await sleep(1200)
        await p.screenshot({ path: `${out}/${m}-fly-on.png` })
      }
      // 5. O again: nothing anywhere
      await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await p.keyboard.press('KeyO'); await sleep(800)
      const c2 = await drawnCounts(p)
      const flyOff = !c2.fly || (c2.fly.roads === 0 && c2.fly.pins === 0 && c2.fly.labels === 0)
      ok(!c2.tile && !c2.ov && flyOff, `${m}: O off: nothing drawn (tile ${!!c2.tile}, overview ${!!c2.ov}, fly ${c2.fly ? `${c2.fly.roads}/${c2.fly.pins}/${c2.fly.labels}` : 'closed'})`)
      if (si === 0) await p.screenshot({ path: `${out}/${m}-off.png` })
      await p.close()
    }
  }
} finally {
  const after = await snapAll()
  ok(MAPS.every(m => after[m] === before[m]), `drafts + live layers of all three maps unchanged (${MAPS.map(m => `${m} ${after[m] === before[m] ? 'same' : 'MOVED'}`).join(', ')})`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
  await br.close()
  console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
}
