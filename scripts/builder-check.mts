// ── WORLD BUILDER STORE, PLAYED (BETA M83 p1 s1a, world lane, 11-22) ──────────────────────────────────────────────────────
// The owner edits a DRAFT of the Wilds; players see nothing until PUBLISH; every publish is a version; ROLL BACK to any version.
//   A. non-owner: 403 on the editor page, on GET /shimmer/save-builder (the draft is private) and on POST publish
//   B. owner: open a tile, raise a HILL; AUTOSAVE fires on its own (no save call, <= 75 s); the live layer is UNCHANGED (prod shows
//      nothing until Publish); RELOAD the editor: the draft restores the hill
//   C. PUBLISH: a new version, live; a FRESH keeper (anonymous context, new save) stands on the hill (game ground = editor, 5 cm)
//   D. ROLL BACK to the version live before the check: live layer back byte-for-byte on the ring tiles, the fresh keeper's ground
//      is back, the editor's draft is back; the history GREW (nothing deleted)
//   E. ALWAYS (finally): roll back if the check published, and put the owner's own draft back exactly as it was
//   0 page errors. The half-land rule (version -> live -> index, live written atomically) is proven in world/builder.test.ts.
// Versions this check publishes carry the note 'check: builder-check' (the editor's history hides them; they stay in the files).
// ★ AFTER A RUN: the prod tree holds new files under world/builder/wilds/ (+ wilds-edits.json if it was absent), class 'data', so
//   coord build REFUSES until they are committed (M94). Commit them by pathspec (they are the honest history), or, on a fresh map,
//   move them out to return to exactly the pre-check state (11-22 first run did that, then re-ran on a clean map).
// SETUP (stated): OWNER_KEY from .env or env, so it runs on the BOX (the edesk has no OWNER_KEY): take the browser lock first.
// Tile default w-4_-2 (far west, nothing staged there; terrain-editor-check's tile).
//   npx tsx scripts/builder-check.mts [--url https://ather.games] [--tile w-4_-2] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), TILE = flag('--tile', 'w-4_-2'), out = flag('--out', '/tmp/builder-check')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY (env or .env)'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')).tiles as { name: string; tx: number; ty: number }[]
const T = tiles.find(t => t.name === TILE)!; if (!T) { console.log(`no tile ${TILE}`); process.exit(2) }
const ring = tiles.filter(t => Math.abs(t.tx - T.tx) <= 1 && Math.abs(t.ty - T.ty) <= 1).map(t => t.name)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
type Maps = Record<string, Record<string, number>>
type LayerJ = { tiles?: Maps; water?: Maps; falls?: Maps }
interface Snap { draft: LayerJ; draftAt: number | null; index: { live: number | null; versions: { v: number; note: string; from?: number }[] }; state: string }

const live = async (): Promise<LayerJ> => {   // what every keeper loads (public)
  for (let i = 0; ; i++) { const r = await fetch(`${url}/shimmer/open/wilds-edits`, { cache: 'no-store' }); if (r.ok) return r.json(); if (i >= 5) throw new Error(`wilds-edits GET ${r.status}`); await sleep(3000) }
}
const ringOf = (l: LayerJ) => JSON.stringify(ring.map(n => [l.tiles?.[n] ?? {}, l.water?.[n] ?? {}, l.falls?.[n] ?? {}]))
const liveBefore = await live()

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const owner = await br.createBrowserContext()
const op = await owner.newPage()
await op.evaluateOnNewDocument('window.__name = (f) => f')
await op.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
// ⚠ /owner 307s to the ABSOLUTE https://ather.games/room: stand on the target origin again, or a relative fetch goes to prod
await op.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
const bget = () => op.evaluate(async () => { const r = await fetch('/shimmer/save-builder?map=wilds', { cache: 'no-store' }); return r.ok ? r.json() : null }) as Promise<Snap | null>
const bpost = (body: Record<string, unknown>) => op.evaluate(async (b: Record<string, unknown>) => { const r = await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'wilds', ...b }) }); return r.ok ? r.json() : null }, body) as Promise<Snap | null>
const start = await bget()
ok(!!start, `owner: GET save-builder answers (draft ${start?.draftAt ? 'saved ' + new Date(start.draftAt).toISOString() : 'not saved yet'}, ${start?.index.versions.length ?? '?'} versions, live v${start?.index.live ?? '-'})`)
if (!start) { await br.close(); console.log('FAIL (no builder)'); process.exit(1) }
const liveV0 = start.index.live          // null = nothing published yet: the first publish records the pre-builder layer as v1
let published = false

async function openEditor() {
  const p = await owner.newPage(); await p.setViewport({ width: 1280, height: 900 })
  p.on('pageerror', e => errs.push('editor: ' + String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const r = await p.goto(`${url}/shimmer/dev?mode=terrain`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('select', { timeout: 120000 })
  await p.waitForFunction('window.__terrain?.ready === true', { timeout: 240000, polling: 500 })
  await p.select('select', TILE)
  await p.waitForFunction(`window.__terrain?.ready === true && window.__terrain?.tile === ${JSON.stringify(TILE)}`, { timeout: 240000, polling: 500 })
  return { p, status: r?.status() }
}
async function keeperGround(x: number, z: number): Promise<number> {   // a FRESH keeper: new anonymous context, new save
  const ctx = await br.createBrowserContext(), g = await ctx.newPage(); await g.setViewport({ width: 800, height: 500 })
  g.on('pageerror', e => errs.push('game: ' + String(e).slice(0, 200)))
  await g.evaluateOnNewDocument('window.__name = (f) => f')
  await g.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await g.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await g.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(3000)
  await g.waitForFunction(() => typeof (window as any).__ather?.ground === 'function' && typeof (window as any).__ather?.tp === 'function', { timeout: 60000, polling: 250 })
  const wx = T.tx * 1000 + x, wz = T.ty * 1000 + z
  await g.evaluate(`window.__ather.tp(${wx}, ${wz + 20}, 0, 400)`)
  await g.waitForFunction(`Number.isFinite(window.__ather.ground(${wx}, ${wz})) && window.__ather.ground(${wx}, ${wz}) > -1e3`, { timeout: 180000, polling: 500 })
  await sleep(1500)
  const h = await g.evaluate(`window.__ather.ground(${wx}, ${wz})`) as number
  await ctx.close(); return h
}

try {
  // ── A. the gate ──
  const anon = await br.createBrowserContext(), ap = await anon.newPage()
  const r1 = await ap.goto(`${url}/shimmer/dev?mode=terrain`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  ok(r1?.status() === 403, `non-owner: the editor page answers ${r1?.status()} (want 403)`)
  await ap.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const [g1, p1] = await ap.evaluate(async () => [
    (await fetch('/shimmer/save-builder?map=wilds')).status,
    (await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'wilds', action: 'publish', note: 'anon' }) })).status])
  ok(g1 === 403 && p1 === 403, `non-owner: GET draft ${g1}, POST publish ${p1} (want 403, 403)`)
  await anon.close()

  // ── B. sculpt, autosave, live untouched, reload restores ──
  const E1 = await openEditor(); let p = E1.p
  ok(E1.status === 200, `owner: the editor page answers ${E1.status}`)
  const spot = await p.evaluate(`(() => { const t = window.__terrain
    for (let r = 0; r < 420; r += 20) for (let a = 0; a < 12; a++) {
      const x = 4 * Math.round(Math.cos(a / 12 * Math.PI * 2) * r / 4), z = 4 * Math.round(Math.sin(a / 12 * Math.PI * 2) * r / 4)
      const h = t.heightAt(x, z); if (!(h > 3)) continue
      const g = Math.abs(t.heightAt(x + 8, z) - t.heightAt(x - 8, z)) / 16 + Math.abs(t.heightAt(x, z + 8) - t.heightAt(x, z - 8)) / 16
      if (g < 0.25) return { x, z, h }
    }
    return null })()`) as { x: number; z: number; h: number } | null
  ok(!!spot, `a dry, gentle spot on ${TILE}: ${JSON.stringify(spot)}`)
  if (!spot) throw new Error('no spot')
  await p.evaluate(`window.__terrain.stroke('raise', ${spot.x}, ${spot.z}, 14, 1, 8)`)
  const hill = await p.evaluate(`window.__terrain.heightAt(${spot.x}, ${spot.z})`) as number
  ok(hill - spot.h > 6, `a hill: ${spot.h.toFixed(1)} -> ${hill.toFixed(1)} m`)
  const sa0 = await p.evaluate('window.__terrain.savedAt()') as number | null
  const t0 = Date.now()
  await p.waitForFunction(`window.__terrain.dirty().length === 0 && window.__terrain.savedAt() !== ${JSON.stringify(sa0)}`, { timeout: 80000, polling: 1000 }).catch(() => {})
  const dirtyLeft = await p.evaluate('window.__terrain.dirty()') as string[]
  ok(dirtyLeft.length === 0, `AUTOSAVE fired on its own after ${((Date.now() - t0) / 1000).toFixed(0)} s (no save call; unsaved left: ${dirtyLeft.length})`)
  const agoTxt = await p.$eval('[data-testid="saved-ago"]', e => e.textContent ?? '')
  ok(/saved \d+ s ago/.test(agoTxt) && /unpublished changes/.test(agoTxt), `the label: "${agoTxt.trim()}"`)
  ok(ringOf(await live()) === ringOf(liveBefore), 'the LIVE layer is unchanged: players see nothing until Publish')
  await p.close()
  const E2 = await openEditor(); p = E2.p
  const hill2 = await p.evaluate(`window.__terrain.heightAt(${spot.x}, ${spot.z})`) as number
  ok(Math.abs(hill2 - hill) < 0.05, `RELOAD: the draft restores the hill (${hill2.toFixed(2)} vs ${hill.toFixed(2)} m)`)
  await p.screenshot({ path: `${out}/editor-draft.png` })

  // ── C. publish: a version, live, a fresh keeper stands on it ──
  const pubOk = await p.evaluate(`window.__terrain.publish('check: builder-check')`)
  published = pubOk === true
  const afterPub = await bget()
  const vPub = afterPub?.index.live ?? null
  ok(published && vPub !== null && vPub > (liveV0 ?? 0), `PUBLISH: ok ${pubOk}, live v${liveV0 ?? '-'} -> v${vPub}${liveV0 === null ? ' (v1 = the pre-builder layer)' : ''}`)
  const liveAfter = await live()
  ok(Object.keys(liveAfter.tiles?.[TILE] ?? {}).length > Object.keys(liveBefore.tiles?.[TILE] ?? {}).length, `the live layer now holds the hill (${Object.keys(liveAfter.tiles?.[TILE] ?? {}).length} vertices on ${TILE})`)
  const gPub = await keeperGround(spot.x, spot.z)
  ok(Math.abs(gPub - hill) < 0.05, `a FRESH keeper stands on the hill: ground ${gPub.toFixed(2)} vs editor ${hill.toFixed(2)} m`)

  // ── D. roll back ──
  const back = liveV0 ?? 1
  const rbOk = await p.evaluate(`window.__terrain.rollback(${back})`)
  const afterRb = await bget()
  ok(rbOk === true && afterRb?.index.live === (vPub ?? 0) + 1 && afterRb?.index.versions.at(-1)?.from === back, `ROLL BACK to v${back}: ok ${rbOk}, now v${afterRb?.index.live} (from v${afterRb?.index.versions.at(-1)?.from})`)
  published = !(rbOk === true)
  ok(ringOf(await live()) === ringOf(liveBefore), `the live layer is back, byte-for-byte on the ${ring.length} ring tiles`)
  ok((afterRb?.index.versions.length ?? 0) > (afterPub?.index.versions.length ?? 0), `the history GREW (${afterPub?.index.versions.length} -> ${afterRb?.index.versions.length}): nothing deleted`)
  const hEd = await p.evaluate(`window.__terrain.heightAt(${spot.x}, ${spot.z})`) as number
  ok(Math.abs(hEd - spot.h) < 0.05, `the editor's draft is back too (${hEd.toFixed(2)} vs ${spot.h.toFixed(2)} m)`)
  const gRb = await keeperGround(spot.x, spot.z)
  ok(Math.abs(gRb - spot.h) < 0.05, `a fresh keeper: the hill is gone (ground ${gRb.toFixed(2)} vs ${spot.h.toFixed(2)} m)`)
  await p.screenshot({ path: `${out}/editor-rolled-back.png` })
  await p.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally {
  // ── E. put the world and the owner's draft back ──
  try {
    if (published) { const r = await bpost({ action: 'rollback', v: liveV0 ?? 1 }); ok(!!r, `cleanup: rolled the check's publish back to v${liveV0 ?? 1}`) }
    const r = await bpost({ action: 'draft', layer: start.draft })
    const now = await bget()
    ok(!!r && !!now && JSON.stringify(now.draft) === JSON.stringify(start.draft), "the owner's draft is back exactly as it was")
    ok(ringOf(await live()) === ringOf(liveBefore), 'the live layer is as before the check')
  } catch (e) { ok(false, `RESTORE FAILED: ${String(e)} - roll back from the editor's history by hand`) }
  await br.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(`shots: ${out}`)
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
