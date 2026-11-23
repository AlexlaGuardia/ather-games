// -- CREATIVE MODE: BUILD ON A ZONE (BETA M84 s2, world lane, 11-23) --
// Alex 11-23: "remove and place building zones after preparing the landscape and then build out each house and building".
// Owner, desktop 1280x900, GLADE DRAFT. Make a zone (real drag), tag it, press Build: set a WALL (goldwood panel), a FLOOR (wide
// goldwood slab) and FURNITURE (a bench on the slab) with real clicks on the plan, free (no bag). Select/Turn/Move a part, set +
// Delete a fourth. Save -> the draft holds the 3 parts on the zone. RELOAD -> they come back. Delete the zone -> its build leaves
// the draft too. ALWAYS: the Glade draft is put back exactly, live never moves; 0 page errors.
//   npx tsx scripts/builder-zone-build-check.mts [--url https://ather.games]
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


type ZB = { id: string; build: { id: string; item: string; x: number; z: number; q: number }[] }
const zb = (p: Page) => p.evaluate('window.__terrain.zones()') as Promise<ZB[]>
const W = 24, PAD = 1
const planPx = async (p: Page, lx: number, lz: number) => {
  const b = await p.$eval('[data-testid="zb-plan"]', el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height } })
  return { x: b.l + (lx + PAD) / (W + 2 * PAD) * b.w, y: b.t + (lz + PAD) / (W + 2 * PAD) * b.h }
}
const clickPlan = async (p: Page, lx: number, lz: number) => { const q = await planPx(p, lx, lz); await p.mouse.move(q.x - 3, q.y - 3); await p.mouse.move(q.x, q.y); await sleep(80); await p.mouse.click(q.x, q.y); await sleep(250) }
const count = (p: Page) => p.$eval('[data-testid="zone-build"]', e => Number(e.getAttribute('data-parts')))
const why = (p: Page) => p.$eval('[data-testid="zb-why"]', e => e.textContent ?? '')
const draftZones = async () => ((await bget())?.draft as { zones?: ZB[] } | undefined)?.zones ?? []

try {
  let p = await openEditor()
  ok((await zb(p)).length === 0, 'the Glade draft has no zone yet')
  await p.keyboard.press('9')
  const pa = await toPx(p, A), pb = await toPx(p, Bc)
  await p.mouse.move(pa.x, pa.y); await p.mouse.down()
  for (let i = 1; i <= 8; i++) { await p.mouse.move(pa.x + (pb.x - pa.x) * i / 8, pa.y + (pb.y - pa.y) * i / 8); await sleep(40) }
  await p.mouse.up(); await sleep(400)
  ok((await zb(p)).length === 1, 'a real drag made a zone')
  await p.click('[data-testid="zone-kind-other"]'); await sleep(150)
  ok(!!(await p.$('[data-testid="zone-build-open"]')), 'the zone popup has a Build button')
  await p.click('[data-testid="zone-build-open"]'); await sleep(300)
  ok(!!(await p.$('[data-testid="zone-build"]')) && !(await p.$('[data-testid="zone-popup"]')), 'Build opens the zone build (popup closed)')
  const parts = await p.$$eval('[data-testid^="zb-part-"]', els => els.map(e => e.getAttribute('data-testid')!.slice(8)))
  ok(parts.includes('goldwood_panel') && parts.includes('goldwood_slab_wide') && parts.includes('goldwood_bench') && !parts.includes('planning_table'), `player parts offered (${parts.length}: walls, floors, furniture; no table)`)

  // a wall, a floor, a bench ON the floor
  await p.click('[data-testid="zb-part-goldwood_panel"]'); await clickPlan(p, 4, 2)
  ok(await count(p) === 1, 'click sets a wall panel (free)')
  await p.click('[data-testid="zb-part-goldwood_slab_wide"]'); await clickPlan(p, 10, 10)
  ok(await count(p) === 2, 'click sets a wide floor slab')
  await p.click('[data-testid="zb-part-goldwood_bench"]'); await clickPlan(p, 10, 10)
  ok(await count(p) === 3, 'a bench stands on the slab')
  await clickPlan(p, 10, 10.05)
  const w1 = await why(p)
  ok(await count(p) === 3 && /stands there/.test(w1), `a second bench on the first refuses with the player's reason (${w1})`)
  // a 4th part, selected then deleted; turn + move the wall
  await p.click('[data-testid="zb-part-stone_slab"]'); await clickPlan(p, 18, 18)
  ok(await count(p) === 4, 'a 4th part (stone slab) set')
  await p.keyboard.press('Escape'); await sleep(150)
  await clickPlan(p, 18, 18)
  ok(/selected/.test(await why(p)), 'with nothing in hand a click selects a part')
  await p.keyboard.press('Delete'); await sleep(200)
  ok(await count(p) === 3, 'Del deletes the selected part')
  await clickPlan(p, 4, 2); await p.click('[data-testid="zb-turn"]'); await sleep(200)
  const turned = (await zb(p))[0].build.find(x => x.item === 'goldwood_panel')
  ok(!!turned && turned.q === 1, `Turn turns the selected wall a quarter (q ${turned?.q})`)
  await p.click('[data-testid="zb-move"]'); await clickPlan(p, 5, 3)
  const moved = (await zb(p))[0].build.find(x => x.item === 'goldwood_panel')
  ok(!!moved && moved.x === 5 && moved.z === 3 && moved.q === 1, `Move carries it to the next click (${moved?.x}, ${moved?.z})`)
  await p.click('[data-testid="zb-done"]'); await sleep(200)
  ok(!(await p.$('[data-testid="zone-build"]')), 'Done closes the build')
  ok((await p.$$('[data-zone-part]')).length === 3, 'the tile view draws the 3 parts in the zone')
  ok(await p.evaluate('window.__terrain.save()') === true, 'Save writes the draft')
  const d1 = await draftZones()
  const items = (d1[0]?.build ?? []).map(x => x.item).sort().join()
  ok(d1.length === 1 && items === 'goldwood_bench,goldwood_panel,goldwood_slab_wide', `the draft holds the zone with its 3 parts (${items})`)

  // reload
  await p.close(); p = await openEditor()
  const z2 = await zb(p)
  ok(z2.length === 1 && JSON.stringify(z2[0].build) === JSON.stringify(d1[0].build), 'RELOAD: the zone came back with its 3 parts (same ids, places, turns)')
  await p.keyboard.press('9')
  const pc = await toPx(p, C); await p.mouse.click(pc.x, pc.y); await sleep(300)
  ok(await p.$eval('[data-testid="zone-build-open"]', e => e.textContent).catch(() => null) === 'Build (3)', 'RELOAD: its popup reads Build (3)')
  await p.click('[data-testid="zone-build-open"]'); await sleep(300)
  ok(await count(p) === 3 && (await p.$$('[data-testid="zb-plan"] [data-part]')).length === 3, 'RELOAD: the build plan shows the 3 parts')
  await p.keyboard.press('Escape'); await sleep(200)
  await p.mouse.click(pc.x, pc.y); await sleep(300)
  await p.click('[data-testid="zone-delete"]'); await sleep(300)
  ok((await zb(p)).length === 0, 'Delete zone: the zone is gone')
  await p.evaluate('window.__terrain.save()')
  ok((await draftZones()).length === 0, 'Delete zone: its build left the draft with it')
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
