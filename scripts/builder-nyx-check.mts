// ── WORLD BUILDER: THE NYX CONTINENT AS A MAP (BETA M83 s3, world lane, 11-23) ────────────────────────────────────────────────────
// The continent is one exported region; the builder cuts it into virtual 1 km tiles on the Wilds' grid (world/nyx-builder.ts) and
// the game adds the published layer to the region's heights on load (open/continent/nyx-layer.ts). End to end:
//   A. non-owner: 403 on GET save-builder?map=nyx; the public layer GET /shimmer/open/nyx-edits answers 200
//   B. owner opens ?mode=terrain&map=nyx: a continent tile opens; a raise on dry land makes a hill; Fly draws the 3x3 ring of
//      terrain tiles + the sea plane and nothing else (no nodes)
//   C. Save: the live Nyx layer is UNCHANGED (players see nothing until Publish); RELOAD restores the hill from the draft
//   C2. while only the draft has the hill: a FRESH keeper on the continent stands on the BARE ground there (prod shows nothing)
//   D. PUBLISH: a version, and the public nyx-edits carries the hill; D2: a fresh keeper's continent applies it (the terrain there =
//      the editor's hill, feet on it); ROLL BACK: live back byte-for-byte, history grew
//   E. the map buttons switch to the Glade; F. ALWAYS (finally): roll back if published, put the Nyx draft back; the Wilds' and the
//      Glade's drafts + live layers never changed. 0 page errors.
// ★ AFTER the first run on prod: new files under world/builder/nyx/ + world/nyx-edits.json (class 'data'): commit them (M94).
// SETUP: OWNER_KEY from .env or env (run on the BOX or the edesk; take the browser lock).
//   npx tsx scripts/builder-nyx-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Browser } from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/builder-nyx-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
type Maps = Record<string, Record<string, number>>
type LayerJ = { tiles?: Maps; water?: Maps; falls?: Maps }
interface Snap { draft: LayerJ; draftAt: number | null; live: LayerJ; index: { live: number | null; versions: { v: number; note: string; from?: number }[] }; state: string }
const canon = (l: LayerJ) => JSON.stringify(['tiles', 'water', 'falls'].map(p => { const m = (l as Record<string, Maps>)[p] ?? {}; return Object.keys(m).sort().map(t => [t, Object.keys(m[t]).sort().map(k => [k, m[t][k]])]) }))
const nVerts = (l: LayerJ) => Object.values(l.tiles ?? {}).reduce((a, m) => a + Object.keys(m).length, 0)

const pub = async (): Promise<LayerJ> => { const r = await fetch(`${url}/shimmer/open/nyx-edits`, { cache: 'no-store' }); if (!r.ok) throw new Error(`nyx-edits ${r.status}`); return r.json() }
const br: Browser = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await op.goto(`${url}/shimmer/open/nyx-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const bget = (map: string) => op.evaluate(async (m: string) => {
  for (let i = 0; i < 6; i++) { const r = await fetch(`/shimmer/save-builder?map=${m}`, { cache: 'no-store' }); if (r.ok) return r.json(); await new Promise(z => setTimeout(z, 1500)) }
  return null }, map) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'nyx', ...b }) }); return r.ok ? r.json() : null }, body) as Promise<Snap | null>
const start = await bget('nyx'), wildsStart = await bget('wilds'), gladeStart = await bget('glade')
ok(!!start && !!wildsStart && !!gladeStart, `owner: GET save-builder answers for nyx (${start?.index.versions.length ?? '?'} versions, live v${start?.index.live ?? '-'}), wilds and glade`)
if (!start || !wildsStart || !gladeStart) { await br.close(); console.log('FAIL (no builder)'); process.exit(1) }
const liveBefore = await pub(), liveV0 = start.index.live
let published = false

async function openEditor() {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const r = await p.goto(`${url}/shimmer/dev?mode=terrain&map=nyx`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction('window.__terrain?.ready === true && window.__terrain?.map === "nyx"', { timeout: 240000, polling: 500 })
  return { p, status: r?.status() }
}
// a fresh keeper on the continent (no owner key): the terrain height there + where its feet land after a footTp
async function keeperAt(x: number, z: number, shot: string): Promise<{ layer: number; ground: number; feet: number }> {
  const kc = await br.createBrowserContext(), kp = await kc.newPage(); await kp.setViewport({ width: 1100, height: 760 })
  kp.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await kp.evaluateOnNewDocument('window.__name = (f) => f')
  await kp.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await kp.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await kp.waitForFunction(() => !!(window as any).__drive?.ground, { timeout: 240000 }); await sleep(2000)
  await kp.keyboard.press('KeyE'); await sleep(1500)
  await kp.evaluate((a: number, b: number) => (window as any).__drive.footTp(a, b, 0, -0.3), x, z); await sleep(3000)
  const r = await kp.evaluate((a: number, b: number) => ({ layer: (window as any).__nyxLayer as number, ground: (window as any).__drive.ground(a, b) as number, feet: (window as any).__drive.foot()?.py as number }), x, z)
  await kp.screenshot({ path: `${out}/${shot}.png` })
  await kc.close()
  return r
}

try {
  // ── A ──
  const anon = await br.createBrowserContext(), ap = await anon.newPage()
  await ap.goto(`${url}/shimmer/open/nyx-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const [g1, p1] = await ap.evaluate(async () => [(await fetch('/shimmer/save-builder?map=nyx')).status, (await fetch('/shimmer/open/nyx-edits')).status])
  ok(g1 === 403 && p1 === 200, `non-owner: GET nyx draft ${g1} (want 403), public nyx-edits ${p1} (want 200)`)
  await anon.close()

  // ── B ──
  const E1 = await openEditor(); let p = E1.p
  ok(E1.status === 200, `owner: the editor answers ${E1.status} on map=nyx`)
  const tile = await p.evaluate('window.__terrain.tile') as string, O = await p.evaluate('window.__terrain.origin()') as { x: number; z: number }
  ok(/^nyx_-?\d+_-?\d+$/.test(tile) && !!O, `a continent tile opens: ${tile} centred (${O?.x}, ${O?.z})`)
  // dry land on a vertex, with dry land 30 m round it (not the sea, not past the region)
  const spot = await p.evaluate(() => {
    const T = (window as any).__terrain
    for (let r = 0; r <= 440; r += 20) for (let a = -r; a <= r; a += 20) for (const [x, z] of [[a, -r], [a, r], [-r, a], [r, a]]) {
      const hs = [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30]].map(([dx, dz]) => T.heightAt(x + dx, z + dz))
      if (hs.every((h: number) => Number.isFinite(h) && h > 1.5)) return { x, z }
    }
    return null
  }) as { x: number; z: number } | null
  ok(!!spot, `dry land found on the tile at local (${spot?.x}, ${spot?.z})`)
  if (!spot) throw new Error('no land')
  const W = { x: O.x + spot.x, z: O.z + spot.z }
  const h0 = await p.evaluate(`window.__terrain.heightAt(${spot.x}, ${spot.z})`) as number
  await p.evaluate(`window.__terrain.stroke('raise', ${spot.x}, ${spot.z}, 14, 1, 8)`)
  const hill = await p.evaluate(`window.__terrain.heightAt(${spot.x}, ${spot.z})`) as number
  ok(hill - h0 > 6, `a hill at world (${W.x}, ${W.z}): ${h0.toFixed(1)} -> ${hill.toFixed(1)} m`)
  await p.screenshot({ path: `${out}/nyx-map.png` })
  await p.click('[data-testid="view-fly"]')
  await p.waitForFunction('typeof window.__builderFly?.scene === "function" && window.__builderFly.scene().tiles > 0', { timeout: 120000, polling: 500 })
  await sleep(4000)
  const sc = await p.evaluate('window.__builderFly.scene()') as { tiles: number; sea: number; ring: number; other: string[] }
  ok(sc.tiles >= 1 && sc.tiles <= 9 && sc.sea === 1 && sc.other.length === 0, `Fly draws the continent: ${JSON.stringify(sc)} (want 1-9 terrain tiles, the sea, nothing else)`)
  await p.screenshot({ path: `${out}/nyx-fly.png` })

  // ── C ──
  ok(await p.evaluate('window.__terrain.save()') === true, 'Save: the draft is written')
  ok(canon(await pub()) === canon(liveBefore), 'the LIVE Nyx layer is unchanged: players see nothing until Publish')
  await p.close()
  const E2 = await openEditor(); p = E2.p
  const tile2 = await p.evaluate('window.__terrain.tile') as string
  const hill2 = await p.evaluate(`window.__terrain.heightAt(${spot.x}, ${spot.z})`) as number
  ok(tile2 === tile && Math.abs(hill2 - hill) < 0.05, `RELOAD: the draft restores the hill (${hill2.toFixed(2)} vs ${hill.toFixed(2)} m on ${tile2})`)

  // ── C2: prod shows nothing until Publish ──
  {
    const k = await keeperAt(W.x, W.z, 'game-before-publish')
    ok(Math.abs(k.ground - h0) < 0.3, `before Publish a fresh keeper's continent is BARE there: ${k.ground?.toFixed?.(2)} m (base ${h0.toFixed(2)}, draft hill ${hill.toFixed(2)})`)
  }

  // ── D ──
  const pubOk = await p.evaluate(`window.__terrain.publish('check: builder-nyx-check')`); published = pubOk === true
  const afterPub = await bget('nyx'), livePub = await pub()
  ok(published && (afterPub?.index.live ?? 0) > (liveV0 ?? 0), `PUBLISH: ok ${pubOk}, live v${liveV0 ?? '-'} -> v${afterPub?.index.live}`)
  ok(nVerts(livePub) > nVerts(liveBefore) && !!livePub.tiles?.[tile], `the public nyx-edits now carries the hill (${nVerts(liveBefore)} -> ${nVerts(livePub)} vertices, tile ${tile})`)
  {
    const k = await keeperAt(W.x, W.z, 'game-on-hill')
    ok(k.layer > 0, `D2: the fresh keeper's continent applied the layer (${k.layer} vertices moved)`)
    ok(Math.abs(k.ground - hill) < 0.3, `D2: the continent's terrain there = the editor's hill: ${k.ground?.toFixed?.(2)} m (hill ${hill.toFixed(2)}, base ${h0.toFixed(2)})`)
    ok(Number.isFinite(k.feet) && Math.abs(k.feet - k.ground) < 0.5, `D2: the keeper stands ON the hill (feet ${k.feet?.toFixed?.(2)} m)`)
  }
  const back = liveV0 ?? 1
  const rbOk = await p.evaluate(`window.__terrain.rollback(${back})`)
  const afterRb = await bget('nyx')
  ok(rbOk === true && afterRb?.index.versions.at(-1)?.from === back, `ROLL BACK to v${back}: ok ${rbOk}, now v${afterRb?.index.live}`)
  published = !(rbOk === true)
  ok(canon(await pub()) === canon(liveBefore), 'the live Nyx layer is back, byte-for-byte')
  ok((afterRb?.index.versions.length ?? 0) > (afterPub?.index.versions.length ?? 0), `the history GREW (${afterPub?.index.versions.length} -> ${afterRb?.index.versions.length})`)

  // ── E ──
  await p.click('[data-testid="map-glade"]')
  await p.waitForFunction('window.__terrain?.map === "glade" && window.__terrain?.ready === true', { timeout: 240000, polling: 500 })
  ok(new URL(p.url()).searchParams.get('map') === 'glade', 'the Glade button switches the editor away from the continent (url says map=glade)')
  await p.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  try {
    if (published) { const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 }); ok(!!r, `cleanup: rolled the check's publish back to v${liveV0 ?? 1}`) }
    const r = await bpost({ action: 'draft', layer: start.draft })
    const now = await bget('nyx'), w = await bget('wilds'), g = await bget('glade')
    ok(!!r && !!now && canon(now.draft) === canon(start.draft), "the Nyx draft is back exactly as it was")
    ok(!!w && canon(w.draft) === canon(wildsStart.draft) && canon(w.live) === canon(wildsStart.live), "the Wilds' draft and live layer never changed")
    ok(!!g && canon(g.draft) === canon(gladeStart.draft) && canon(g.live) === canon(gladeStart.live), "the Glade's draft and live layer never changed")
    ok(canon(await pub()) === canon(liveBefore), 'the live Nyx layer is as before the check')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
  await br.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`shots: ${out}`)
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
