// ── WORLD BUILDER: THE GLADE AS A MAP (BETA M83 s2a, world lane, 11-22) ──────────────────────────────────────────────────────
// The Glade has no tiles; the builder lays one virtual 1 km grid over its ground function (world/glade-builder.ts). This proves the
// builder works on it end to end, and that the Wilds is untouched by anything done on the Glade.
//   A. non-owner: 403 on GET save-builder?map=glade; the public layer GET /shimmer/open/glade-edits answers 200
//   B. owner opens ?mode=terrain&map=glade: the map is the Glade; Greg's garden is ground, the void between islands is NaN; a stroke
//      out in the void edits nothing; a raise on Greg's garden makes a hill; Fly draws the Glade (terrain, NO sea plane, nothing else)
//   C. Save: the live Glade layer is UNCHANGED (players see nothing until Publish); RELOAD restores the hill from the draft
//   D. PUBLISH: a version, and the public glade-edits now carries the hill's vertices; ROLL BACK: live back byte-for-byte, history grew
//   D2 (s2b). while the hill is LIVE: a FRESH keeper (no owner key) enters the Glade, warps onto Greg's garden and stands on the hill:
//      the walker's ground there = gladeZoneGround + the published delta (= the editor's hill - its base), the keeper's feet on it
//   E. the map buttons switch to the Wilds (its own draft) and the Wilds' draft + live layer never changed
//   F. ALWAYS (finally): roll back if published, put the Glade's draft back. 0 page errors.
// (Autosave + the half-land order are proven by builder-check / builder.test.ts.)
// ★ AFTER A RUN on a map with no history: new files under world/builder/glade/ + world/glade-edits.json, class 'data': coord build
//   refuses until they are committed or moved out (M94). The check prints them.
// SETUP: OWNER_KEY from .env or env (run on the BOX; take the browser lock).
//   npx tsx scripts/builder-glade-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { gladeZoneGround } from '../src/app/shimmer/open/ather/glade-cluster'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-glade-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
type Maps = Record<string, Record<string, number>>
type LayerJ = { tiles?: Maps; water?: Maps; falls?: Maps }
interface Snap { draft: LayerJ; draftAt: number | null; live: LayerJ; index: { live: number | null; versions: { v: number; note: string; from?: number }[] }; state: string }
const canon = (l: LayerJ) => JSON.stringify(['tiles', 'water', 'falls'].map(p => { const m = (l as Record<string, Maps>)[p] ?? {}; return Object.keys(m).sort().map(t => [t, Object.keys(m[t]).sort().map(k => [k, m[t][k]])]) }))
const GREG = { x: -100, z: 110 }, VOID = { x: 280, z: -280 }

const pub = async (): Promise<LayerJ> => { const r = await fetch(`${url}/shimmer/open/glade-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`glade-edits ${r.status}`); return r.json() }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/glade-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })   // back on the target origin
// retried: on a DEVWIN every version file written under src/ makes Next recompile the route, and the next GET can 404 (seen 11-22);
// prod does not hot-reload, so there one try answers
const bget = (map: string) => op.evaluate(async (m: string) => {
  for (let i = 0; i < 6; i++) { const r = await fetch(`/shimmer/save-builder?map=${m}`, { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) }
  return null }, map) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'glade', ...b }) }); return r.ok ? r.json() : null }, body) as Promise<Snap | null>
const start = await bget('glade'), wildsStart = await bget('wilds')
ok(!!start && !!wildsStart, `owner: GET save-builder answers for glade (${start?.index.versions.length ?? '?'} versions, live v${start?.index.live ?? '-'}) and wilds`)
if (!start || !wildsStart) { await br.close(); console.log('FAIL (no builder)'); process.exit(1) }
const liveBefore = await pub(), liveV0 = start.index.live
let published = false

async function openEditor() {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const r = await p.goto(`${url}/shimmer/dev?mode=terrain&map=glade`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "glade"', { timeout: 240000, polling: 500 })
  return { p, status: r?.status() }
}
// the hook speaks TILE-LOCAL coords; the Glade's tile centre is (-212, 212)
const L = (w: { x: number; z: number }) => ({ x: w.x + 212, z: w.z - 212 })

try {
  // ── A ──
  const anon = await br.createBrowserContext(), ap = await anon.newPage()
  await ap.goto(`${url}/shimmer/open/glade-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const [g1, p1] = await ap.evaluate(async () => [(await fetch('/shimmer/save-builder?map=glade')).status, (await fetch('/shimmer/open/glade-edits')).status])
  ok(g1 === 403 && p1 === 200, `non-owner: GET glade draft ${g1} (want 403), public glade-edits ${p1} (want 200)`)
  await anon.close()

  // ── B ──
  const E1 = await openEditor(); let p = E1.p
  ok(E1.status === 200, `owner: the editor answers ${E1.status} on map=glade`)
  const g = L(GREG), v = L(VOID)
  const h0 = await p.evaluate(`window.__terrain.heightAt(${g.x}, ${g.z})`) as number, hv = await p.evaluate(`window.__terrain.heightAt(${v.x}, ${v.z})`) as number
  ok(Number.isFinite(h0) && Number.isNaN(hv), `Greg's garden is ground (${h0?.toFixed?.(2)} m), the void is not (${hv})`)
  await p.evaluate(`window.__terrain.stroke('raise', ${v.x}, ${v.z}, 20, 1, 4)`)
  ok((await p.evaluate('window.__terrain.dirty()') as string[]).length === 0, 'a stroke in the void edits nothing')
  await p.evaluate(`window.__terrain.stroke('raise', ${g.x}, ${g.z}, 14, 1, 8)`)
  const hill = await p.evaluate(`window.__terrain.heightAt(${g.x}, ${g.z})`) as number
  ok(hill - h0 > 6, `a hill on Greg's garden: ${h0.toFixed(1)} -> ${hill.toFixed(1)} m`)
  await p.screenshot({ path: `${out}/glade-map.png` })
  await p.click('[data-testid="view-fly"]')
  await p.waitForFunction('typeof window.__builderFly?.scene === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 })
  await new Promise(r => setTimeout(r, 4000))
  const sc = await p.evaluate('window.__builderFly.scene()') as { tiles: number; sea: number; ring: number; other: string[] }
  ok(sc.tiles === 1 && sc.sea === 0 && sc.other.length === 0, `Fly draws the Glade: ${JSON.stringify(sc)} (want 1 terrain mesh, no sea, nothing else)`)
  await p.screenshot({ path: `${out}/glade-fly.png` })

  // ── C ──
  ok(await p.evaluate('window.__terrain.save()') === true, 'Save: the draft is written')
  ok(canon(await pub()) === canon(liveBefore), 'the LIVE Glade layer is unchanged: players see nothing until Publish')
  await p.close()
  const E2 = await openEditor(); p = E2.p
  const hill2 = await p.evaluate(`window.__terrain.heightAt(${g.x}, ${g.z})`) as number
  ok(Math.abs(hill2 - hill) < 0.05, `RELOAD: the draft restores the hill (${hill2.toFixed(2)} vs ${hill.toFixed(2)} m)`)

  // ── D ──
  const pubOk = await p.evaluate(`window.__terrain.publish('check: builder-glade-check')`); published = pubOk === true
  const afterPub = await bget('glade'), livePub = await pub()
  ok(published && (afterPub?.index.live ?? 0) > (liveV0 ?? 0), `PUBLISH: ok ${pubOk}, live v${liveV0 ?? '-'} -> v${afterPub?.index.live}`)
  const nPub = Object.keys(livePub.tiles?.glade ?? {}).length, nBefore = Object.keys(liveBefore.tiles?.glade ?? {}).length
  ok(nPub > nBefore, `the public glade-edits now carries the hill (${nBefore} -> ${nPub} vertices)`)

  // ── D2 (s2b): the GAME stands a fresh keeper on the published hill ──
  {
    const kc = await br.createBrowserContext(), kp = await kc.newPage(); await kp.setViewport({ width: 1100, height: 760 })
    kp.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
    await kp.evaluateOnNewDocument('window.__name = (f) => f')
    await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
    const A = (fn: string, ...a: unknown[]) => kp.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
    await kp.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await kp.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await new Promise(r => setTimeout(r, 2000))
    if ((await A('zone')) !== 'glade') await A('travel', { kind: 'glade' })
    for (let i = 0; i < 60 && (await A('zone')) !== 'glade'; i++) await new Promise(r => setTimeout(r, 1000))
    ok((await A('zone')) === 'glade', `fresh keeper: in the Glade (zone ${await A('zone')})`)
    await new Promise(r => setTimeout(r, 3000))   // the layer fetch lands
    await A('gladeAt', GREG.x, GREG.z, 0); await new Promise(r => setTimeout(r, 2500))
    const base = gladeZoneGround(GREG.x, GREG.z), want = hill - h0
    const gy = await A('ground', GREG.x, GREG.z) as number, st = await A('state') as { x: number; y: number; z: number }
    ok(Number.isFinite(gy) && Math.abs((gy - base) - want) < 0.6, `the game's ground on Greg's garden: ${base.toFixed(2)} -> ${gy?.toFixed?.(2)} m (+${(gy - base).toFixed(2)}, the editor's hill +${want.toFixed(2)})`)
    ok(Math.hypot(st.x - GREG.x, st.z - GREG.z) < 1.5 && Math.abs(st.y - gy) < 0.3, `the keeper stands ON the hill (feet ${st.y.toFixed(2)} m at ${st.x.toFixed(1)}, ${st.z.toFixed(1)})`)
    await A('look', Math.PI, -0.25); await new Promise(r => setTimeout(r, 1500))
    await kp.screenshot({ path: `${out}/game-on-hill.png` })
    await kc.close()
  }
  const back = liveV0 ?? 1
  const rbOk = await p.evaluate(`window.__terrain.rollback(${back})`)
  const afterRb = await bget('glade')
  ok(rbOk === true && afterRb?.index.versions.at(-1)?.from === back, `ROLL BACK to v${back}: ok ${rbOk}, now v${afterRb?.index.live}`)
  published = !(rbOk === true)
  ok(canon(await pub()) === canon(liveBefore), 'the live Glade layer is back, byte-for-byte')
  ok((afterRb?.index.versions.length ?? 0) > (afterPub?.index.versions.length ?? 0), `the history GREW (${afterPub?.index.versions.length} -> ${afterRb?.index.versions.length})`)

  // ── E ──
  await p.click('[data-testid="map-wilds"]')
  await p.waitForFunction('window.__terrain?.map === "wilds" && window.__terrain?.ready === true', { timeout: 240000, polling: 500 })
  ok(new URL(p.url()).searchParams.get('map') === 'wilds', 'the Wilds button switches the editor to the Wilds (url says map=wilds)')
  await p.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    if (published) { const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 }); ok(!!r, `cleanup: rolled the check's publish back to v${liveV0 ?? 1}`) }
    const r = await bpost({ action: 'draft', layer: start.draft })
    const now = await bget('glade'), w = await bget('wilds')
    ok(!!r && !!now && canon(now.draft) === canon(start.draft), "the Glade's draft is back exactly as it was")
    ok(!!w && canon(w.draft) === canon(wildsStart.draft) && canon(w.live) === canon(wildsStart.live), "the Wilds' draft and live layer never changed")
    ok(canon(await pub()) === canon(liveBefore), 'the live Glade layer is as before the check')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
  await br.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`shots: ${out}`)
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
