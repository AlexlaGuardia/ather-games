// ── WORLD BUILDER (creative mode): BUILDING ZONES + TAGS (BETA M84 s1 + M114, world lane, 11-23) ──────────────────────────────
// Alex 11-23: "remove and place building zones after preparing the landscape.. (first it's cropped and then a pop asks if it's a
// home and if so who's with a dropdown or a shop.. or a supplier.. or other for buildings that should be locked and empty inside".
// Owner, desktop 1280x900, on the GLADE DRAFT (one tile, fast). Opens through the new alias ?mode=creative.
//   1. the Zone tool (key 9): a REAL mouse drag on the tile canvas marks a zone; the ground inside is flat at the height under the
//      first click (5 samples), a point 30 m away is untouched
//   2. the tag popup opens on its own with the 4 tags; Home -> the dropdown lists Gregory (existing folk), pick him -> 'Home: Gregory'
//   3. Save; the O overlay shows the zone marker 'Home: Gregory' in the tile view and the overview
//   4. RELOAD: the zone, its tag and the flat ground come back from the draft
//   5. a click inside the zone re-opens the popup; Delete -> every sampled height is back to what it was before the zone
//   ALWAYS (finally): the Glade draft is put back exactly as it was, the live Glade layer never moves; 0 page errors.
// SETUP: OWNER_KEY from .env or env (run on the BOX inside `coord.sh browser run`).
//   npx tsx scripts/builder-zone-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync } from 'node:fs'
import { GLADE_SIZE } from '../src/app/shimmer/world/glade-builder'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
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
await op.goto(`${url}/shimmer/open/glade-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
type Snap = { draft: Record<string, unknown>; live: Record<string, unknown>; index: { live: number | null; versions: unknown[] } }
const bget = () => op.evaluate(async () => { for (let i = 0; i < 6; i++) { const r = await fetch('/shimmer/save-builder?map=glade', { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) } return null }) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', ...b }) }); return r.ok ? r.json() : null }, body) as Promise<Snap | null>
const start = await bget()
ok(!!start, 'owner: the Glade builder draft answers')
if (!start) { await br.close(); process.exit(1) }
const startDraft = JSON.stringify(start.draft), liveStart = JSON.stringify({ live: start.live, v: start.index.live, n: start.index.versions.length })

async function openEditor(): Promise<Page> {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  p.on('dialog', d => d.accept())
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const r = await p.goto(`${url}/shimmer/dev?mode=creative&map=glade`, { waitUntil: 'load', timeout: 240000 })
  ok(r?.status() === 200, `?mode=creative answers ${r?.status()}`)
  await p.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
  return p
}
// tile-local zone in Greg's garden (world -100, 110 -> local 112, -102): a 24 m square
const A = { x: 100, z: -114 }, Bc = { x: 124, z: -90 }, C = { x: 112, z: -102 }, FAR = { x: 112, z: -60 }
const SAMPLES = [C, { x: 102, z: -112 }, { x: 122, z: -112 }, { x: 102, z: -92 }, { x: 122, z: -92 }]
const H = (p: Page, q: { x: number; z: number }) => p.evaluate(`window.__terrain.heightAt(${q.x}, ${q.z})`) as Promise<number>
const toPx = async (p: Page, q: { x: number; z: number }) => {
  const rc = await p.$eval('[data-testid="terrain-canvas"]', el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height } })
  return { x: rc.l + (q.x + GLADE_SIZE / 2) / GLADE_SIZE * rc.w, y: rc.t + (q.z + GLADE_SIZE / 2) / GLADE_SIZE * rc.h }
}
const zonesOf = (p: Page) => p.evaluate('window.__terrain.zones()') as Promise<{ id: string; h: number; tag: { kind: string; name?: string } | null; n: number }[]>
const ovNames = (p: Page, tid: string) => p.evaluate((t: string) => [...document.querySelectorAll(`[data-testid="${t}"] [data-poi="zone"]`)].map(e => e.getAttribute('data-name')), tid) as Promise<string[]>

try {
  let p = await openEditor()
  ok((await zonesOf(p)).length === 0, 'the Glade draft has no zone yet')
  const before = await Promise.all([...SAMPLES, FAR].map(q => H(p, q)))
  ok(before.every(Number.isFinite), `the zone spot is ground (${before.map(h => h.toFixed(2)).join(' ')})`)
  const h0 = Math.round((await H(p, A)) * 10) / 10
  await p.keyboard.press('9')
  ok(await p.evaluate('window.__terrain.brush') === 'zone', 'key 9 picks the Zone tool')

  // 1. a real drag
  const pa = await toPx(p, A), pb = await toPx(p, Bc)
  await p.mouse.move(pa.x, pa.y); await p.mouse.down()
  for (let i = 1; i <= 8; i++) { await p.mouse.move(pa.x + (pb.x - pa.x) * i / 8, pa.y + (pb.y - pa.y) * i / 8); await sleep(40) }
  await p.mouse.up(); await sleep(400)
  const z1 = await zonesOf(p)
  ok(z1.length === 1 && Math.abs(z1[0].h - h0) < 0.11 && z1[0].n > 20, `the drag made one zone at ${z1[0]?.h} m (first click ${h0}), ${z1[0]?.n} vertices`)
  const flat = await Promise.all(SAMPLES.map(q => H(p, q)))
  ok(flat.every(h => Math.abs(h - z1[0].h) < 0.06), `inside is flat at the first click's height (${flat.map(h => h.toFixed(2)).join(' ')})`)
  ok(Math.abs((await H(p, FAR)) - before[SAMPLES.length]) < 1e-6, '30 m out the ground is untouched')

  // 2. the popup
  const kinds = await p.$$eval('[data-testid="zone-popup"] [data-testid^="zone-kind-"]', els => els.map(e => e.getAttribute('data-testid')))
  ok(kinds.join() === 'zone-kind-home,zone-kind-shop,zone-kind-supplier,zone-kind-other', `the popup opened by itself with 4 tags (${kinds.join(' ')})`)
  await p.click('[data-testid="zone-kind-home"]'); await sleep(200)
  const opts = await p.$$eval('[data-testid="zone-choice"] option', els => els.map(e => (e as HTMLOptionElement).textContent))
  ok(opts.includes('Gregory') && opts.includes('Hazel'), `Home lists the Glade's folk (${opts.slice(1).join(', ')})`)
  await p.select('[data-testid="zone-choice"]', 'greg'); await sleep(200)
  ok(await p.$eval('[data-testid="zone-label"]', e => e.textContent) === 'Home: Gregory', 'tag: Home: Gregory')
  await p.click('[data-testid="zone-done"]'); await sleep(200)
  ok(!(await p.$('[data-testid="zone-popup"]')), 'Done closes the popup')

  // 3. save + overlay
  ok(await p.evaluate('window.__terrain.save()') === true, 'Save writes the draft')
  const sv = await bget()
  ok(JSON.stringify(sv?.live) === JSON.stringify(start.live), 'the live Glade layer is unchanged (draft only)')
  await p.keyboard.press('o'); await sleep(500)
  ok((await ovNames(p, 'ov-tile')).includes('Home: Gregory'), 'overlay (tile view): the zone marker reads Home: Gregory')
  ok((await ovNames(p, 'ov-overview')).includes('Home: Gregory'), 'overlay (overview): the zone marker is there too')

  // 4. reload
  await p.close(); p = await openEditor()
  const z2 = await zonesOf(p)
  ok(z2.length === 1 && z2[0].tag?.kind === 'home' && z2[0].tag?.name === 'Gregory', `RELOAD: the zone + its tag came back (${JSON.stringify(z2[0]?.tag)})`)
  const flat2 = await Promise.all(SAMPLES.map(q => H(p, q)))
  ok(flat2.every((h, i) => Math.abs(h - flat[i]) < 0.01), 'RELOAD: the ground inside is still flat')
  await p.keyboard.press('o'); await sleep(500)
  ok((await ovNames(p, 'ov-tile')).includes('Home: Gregory'), 'RELOAD: the overlay still shows it')
  await p.keyboard.press('o')

  // 5. select + delete
  await p.keyboard.press('9')
  const pc = await toPx(p, C); await p.mouse.click(pc.x, pc.y); await sleep(300)
  ok(await p.$eval('[data-testid="zone-label"]', e => e.textContent).catch(() => null) === 'Home: Gregory', 'a click inside the zone re-opens its popup (tag editable)')
  await p.click('[data-testid="zone-delete"]'); await sleep(300)
  const back = await Promise.all([...SAMPLES, FAR].map(q => H(p, q)))
  ok((await zonesOf(p)).length === 0 && back.every((h, i) => Math.abs(h - before[i]) < 0.01), `Delete: zone gone, ground restored (${back.map(h => h.toFixed(2)).join(' ')})`)
  await p.evaluate('window.__terrain.save()')
  await p.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  await bpost({ action: 'draft', layer: start.draft })
  const end = await bget()
  ok(!!end && JSON.stringify(end.draft) === startDraft, 'the Glade draft is back exactly as it was')
  ok(!!end && JSON.stringify({ live: end.live, v: end.index.live, n: end.index.versions.length }) === liveStart, 'the live Glade layer + versions never moved')
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
  await br.close()
  console.log(fails ? `\n${fails} FAILED` : '\nPASS')
  process.exit(fails ? 1 : 0)
}
