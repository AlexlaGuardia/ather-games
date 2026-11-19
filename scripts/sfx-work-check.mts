// ── M36 SFX: TOOL HITS + PICKUPS, PLAYED (world d5a9e927, 11-19; hub's hooks in ather/page.tsx, 3c53d709) ─────────────
// A fresh keeper in the Wilds, STOWED, real E on a goldwood till the node finishes, then real E on a raw crystal till it
// finishes. Reads window.__sfx.played() (counts per yay id, shared/sfx.ts):
//   tree:    hit-axe-tree rises once per chip but the last (only asserted when the node has >1 chip), hit-prune-tree +1, pickup-item rises
//   crystal: hit-pick-crystal likewise, hit-prospect-crystal +1, pickup-item rises
//   0 page errors
// NOT here: pickup-grey-matter (a combat pickup = a Hollow kill + walk over the drop; minutes of frames on a 1-2 fps box).
// Hooks: __sfx (read), __ather.tp / look (MOVEMENT + aim only), __ather.aim / crystal / chan / stance (read). The work
// itself is a REAL E keypress, never __ather.prune / mine.
// ⚠ Headless draws a frame only when asked: the channel rides frames, so the waits force them with screenshots.
//   npx tsx scripts/sfx-work-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// ── pick the nodes off first-wilds (tile 0,0: tile coords = world coords), with the page's own parser ──
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const T = idx.tiles.find((t: { name: string }) => t.name === 'first-wilds')
if (T.tx !== 0 || T.ty !== 0) { console.log('first-wilds is not at tile 0,0: the coords below assume it'); process.exit(1) }
const zm = new Map<string, Zone>(T.nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const meta = JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows')
// a goldwood (Forestry 1) with a clear line on its east side (forestry-check's rule): stand 5 m east, yaw π/2 looks west
// both nodes ≥ 60 m from Greg's waymark (-300, 300), so E never goes to talking to Greg instead of working
const offGreg = (x: number, z: number) => Math.hypot(x + 300, z - 300) > 60
const tree = W.trees.find(t => t.kind === 'goldwood' && offGreg(t.x, t.z) && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)
// a raw crystal (level 1) with clear dry ground 5 m off it (prospect-check's rule)
let cry: { id: string; x: number; y: number; z: number; s: number; sx: number; sy: number; sz: number } | null = null
for (const c of W.crystals) {
  if (cry || c.kind !== 'raw' || !offGreg(c.x, c.z)) continue
  for (let a = 0; a < 8 && !cry; a++) {
    const sx = c.x + Math.cos(a * Math.PI / 4) * 5, sz = c.z + Math.sin(a * Math.PI / 4) * 5, sy = W.heightAt(sx, sz)
    if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1.2) continue
    if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2.5) || W.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
    cry = { id: c.id, x: c.x, y: c.y, z: c.z, s: c.s, sx, sy, sz }
  }
}
if (!tree || !cry) { console.log(`no node to work: tree=${tree?.id} crystal=${cry?.id}`); console.log('FAIL'); process.exit(1) }
console.log(`nodes: goldwood ${tree.id} · raw crystal ${cry.id}`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); for (const k of ['open.pruned.v1', 'open.mined.v1', 'open.skills.v1', 'open.inv.v1']) localStorage.removeItem(k) })
  const A = (expr: string) => p.evaluate(`(window.__ather && (${expr}))`) as Promise<any>
  const P = () => p.evaluate(() => (window as any).__sfx?.played?.() ?? {}) as Promise<Record<string, number>>
  const n = async (id: string) => (await P())[id] ?? 0
  const frame = async () => { try { await p.screenshot({ path: `${out}/_sfxwork.png` }) } catch { /* slow frame */ } }
  const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await frame(); await sleep(150) } return false }

  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__sfx), 240000), 'in the Wilds, __sfx probe up')
  await sleep(4000); await p.mouse.click(550, 340); await sleep(800)   // a real gesture (the audio context wants one)
  await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  ok(await poll(async () => (await A('window.__ather.stance()?.kind')) === 'stowed', 8000), 'hands stowed (a new keeper starts stowed)')

  // work one node with real E till its channel ends; returns the chip count and the deltas
  const work = async (label: string, aimed: () => Promise<boolean>, hit: string, last: string) => {
    ok(await poll(aimed, 20000), `${label}: under the crosshair`)
    const h0 = await n(hit), l0 = await n(last), i0 = await n('pickup-item')
    await p.keyboard.press('KeyE')
    let of = 0
    await poll(async () => { const c = await A('window.__ather.chan()'); if (c) of = c.of; return !!c }, 10000)
    ok(of > 0, `${label}: real E started the channel (${of} chips)`)
    // the channel ends on its last chip; at 1-2 fps a chip is many frames, so allow minutes
    ok(await poll(async () => !(await A('window.__ather.chan()')), 600000), `${label}: the channel finished`)
    await poll(async () => (await n(last)) > l0, 8000)
    const dh = (await n(hit)) - h0, dl = (await n(last)) - l0, di = (await n('pickup-item')) - i0
    if (of > 1) ok(dh >= of - 1, `${label}: ${hit} played per chip but the last (+${dh}, want ≥${of - 1})`)
    else console.log(`· ${label}: a 1-chip node, ${hit} not expected (+${dh})`)
    ok(dl === 1, `${label}: ${last} played once on the last chip (+${dl})`)
    ok(di >= 1, `${label}: pickup-item played as chips dropped (+${di})`)
  }

  // ── tree: 5 m east of the goldwood, looking west ──
  await p.evaluate((x: number, z: number) => { const a = (window as any).__ather; a.tp(x, z, Math.PI / 2); a.look?.(Math.PI / 2, -0.12) }, tree.x + 5, tree.z)
  await work('goldwood', async () => (await A('window.__ather.aim()')) === tree.id, 'hit-axe-tree', 'hit-prune-tree')

  // ── crystal: stand on the clear spot, face it ──
  const dx = cry.x - cry.sx, dz = cry.z - cry.sz, yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(cry.sy + 1.6 - (cry.y + 0.55 * cry.s), Math.hypot(dx, dz))
  await p.evaluate((a: { x: number; z: number; yaw: number; pitch: number }) => { const A = (window as any).__ather; A.tp(a.x, a.z, a.yaw); A.look(a.yaw, a.pitch) }, { x: cry.sx, z: cry.sz, yaw, pitch })
  await sleep(2000); await p.evaluate((a: { yaw: number; pitch: number }) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch })
  await work('raw crystal', async () => (await A('window.__ather.crystal()?.id')) === cry!.id, 'hit-pick-crystal', 'hit-prospect-crystal')

  console.log('played:', JSON.stringify(await P()))
  console.log('· pickup-grey-matter: not driven here (needs a Hollow kill); hooked at page.tsx onCombat pickup')
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
