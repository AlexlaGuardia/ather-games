// ── BETA M21 check (2026-11-18, sprites): FEEL THE LEVELS — the XP bar under the compass + level-up confetti ─────────
// Desktop: a keeper seeded at Forestry 1 with (need - 2*20 - 1) XP prunes a lone goldwood through the click's own path
// (__ather.prune): the bar fades in reading FORESTRY, Lv 1, fill above the seed's. A second goldwood crosses the level:
// the bar reads Lv 2 + LEVEL UP and one confetti burst pops. Then the bar fades back out on its own.
// Phone (touch) at 390x844 and 360x780: the bar's box clears the compass and the minimap and stays on screen.
// The bar's state is read IN the page (waitForFunction polling on mutation), never by a sleep: this box runs 1-2 fps.
//   npx tsx scripts/xp-bar-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { type Zone } from '../src/app/shimmer/open/ather/forestry'
import { xpForSkillLevel } from '../src/app/shimmer/engine/skills'
import { NODE_DEFS } from '../src/app/shimmer/world/resources'
// hearth-hud.tsx pulls next/font (not loadable under tsx): its MINIMAP_BOX_PHONE, mirrored. Keep in step with hearth-hud.tsx.
const MINIMAP_BOX_PHONE = { top: 10, right: 10, size: 96 }
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows')
// two lone goldwoods with a clear line on their east side (forestry-check's rule)
const lone = W.trees.filter(t => t.kind === 'goldwood' && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)
const [g1, g2] = lone
const XP = NODE_DEFS.goldwood.xp, NEED = xpForSkillLevel(1), SEED = NEED - 2 * XP + 1   // prune 1 lands at NEED-XP+1 (< NEED), prune 2 crosses
const res: Record<string, unknown> = { g1: g1?.id, g2: g2?.id, need: NEED, seed: SEED }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors: string[] = []
const open = async (vw: number, vh: number, touch: boolean, seed: number): Promise<Page> => {
  const p = await br.newPage(); await p.setViewport({ width: vw, height: vh, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 })
  p.on('pageerror', e => errors.push(`${vw}: ${String(e).slice(0, 160)}`))
  await p.evaluateOnNewDocument((s: number) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.inv.v1')
    localStorage.setItem('open.skills.v1', JSON.stringify([{ id: 'forestry', level: 1, xp: s }]))
  }, seed)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!document.querySelector('[data-hud=xp-bar]'), { timeout: 120000, polling: 1000 })
  return p
}
const RECTS = `(() => {
      const rect = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom } }
      return { bar: rect('[data-hud=xp-bar] > div:nth-child(2)') ?? rect('[data-hud=xp-bar]'), compass: rect('[data-hud=compass]') }
    })()`
const hit = (a: any, c: any) => !!a && !!c && a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t
type Bar = { shown: string; skill: string; level: string; fill: number; levelup: string; name: string; lv: string; pops: number }
const bar = (p: Page) => p.evaluate(() => {
  const e = document.querySelector('[data-hud=xp-bar]') as HTMLElement | null
  if (!e) return null
  const host = e.firstElementChild as HTMLElement
  return { shown: e.dataset.shown!, skill: e.dataset.skill!, level: e.dataset.level!, fill: +e.dataset.fill!, levelup: e.dataset.levelup!,
    name: e.querySelector('[data-xp=name]')?.textContent ?? '', lv: e.querySelector('[data-xp=level]')?.textContent ?? '', pops: +(host?.dataset.pops ?? 0) }
})
/** Resolves with the bar's state the moment `cond` holds, read in the page so a slow frame cannot miss a 2.6 s window. */
const barWhen = (p: Page, cond: string, timeout = 180000) => p.waitForFunction((c: string) => {
  const e = document.querySelector('[data-hud=xp-bar]') as HTMLElement | null
  if (!e) return false
  const host = e.firstElementChild as HTMLElement, d = e.dataset
  const s = { shown: d.shown, skill: d.skill, level: d.level, fill: +d.fill!, levelup: d.levelup, pops: +(host?.dataset.pops ?? 0), lv: e.querySelector('[data-xp=level]')?.textContent ?? '', name: e.querySelector('[data-xp=name]')?.textContent ?? '' }
  return new Function('s', `return (${c})`)(s) ? s : false
}, { timeout, polling: 'mutation' }, cond).then(h => h.jsonValue() as Promise<Bar>)
const frame = async (p: Page, name = '_frame') => { try { await p.screenshot({ path: `${out}/${name}.png` }) } catch { /* slow frame */ } }
const pruneAt = async (p: Page, t: { x: number; z: number; id: string }) => {
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + 6, t.z)
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.aim())) !== t.id; i++) { await frame(p); await sleep(500) }
  res[`aim_${t.id}`] = await p.evaluate(() => (window as any).__ather.aim())
  if (res[`aim_${t.id}`] !== t.id) throw new Error(`never aimed ${t.id}`)
  await p.evaluate(() => (window as any).__ather.prune())
}

let pass = false
try {
  // ── desktop: a gain, then a level-up ─────────────────────────────────────────────────────────────────────────────
  const p = await open(1100, 680, false, SEED)
  // travel until the page SAYS it is in the Wilds (prod under load took >9 s; a fixed sleep left the keeper on the plot)
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
    await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {})
  }
  if ((await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds') throw new Error('never reached the Wilds')
  await sleep(4000)
  res.before = await bar(p)
  const gain = barWhen(p, "s.shown === '1' && s.skill === 'forestry'")
  await pruneAt(p, g1)
  res.gain = await gain; await frame(p, 'xp-1-gain')
  { const d = await p.evaluate(RECTS) as any; res.desk = { ...d, overCompass: hit(d.bar, d.compass) } }
  const up = barWhen(p, "s.levelup === '1' && s.level === '2'")
  await pruneAt(p, g2)
  res.up = await up; await frame(p, 'xp-2-levelup')
  res.bits = await p.evaluate(() => document.querySelectorAll('[data-confetti-bit]').length)
  res.faded = await barWhen(p, "s.shown === '0'", 60000).then(() => true, () => false)
  await p.close()
  // ── phones: the bar clears the compass + minimap ────────────────────────────────────────────────────────────────
  const boxes: Record<string, unknown> = {}
  for (const [vw, vh] of [[390, 844], [360, 780]] as const) {
    const q = await open(vw, vh, true, 0); await sleep(3000); await frame(q, `xp-phone-${vw}`)
    // a string, not a function: tsx wraps inner arrows in __name(), which does not exist in the page
    const r = await q.evaluate(RECTS) as { bar: { l: number; t: number; r: number; b: number } | null; compass: { l: number; t: number; r: number; b: number } | null }
    const m = MINIMAP_BOX_PHONE, map = { l: vw - m.right - m.size, t: m.top, r: vw - m.right, b: m.top + m.size }
    boxes[vw] = { ...r, map, overCompass: hit(r.bar, r.compass), overMap: hit(r.bar, map), onScreen: !!r.bar && r.bar.l >= 0 && r.bar.r <= vw }
    await q.close()
  }
  res.phones = boxes
  const g = res.gain as Bar, u = res.up as Bar, ph = Object.values(boxes) as { overCompass: boolean; overMap: boolean; onScreen: boolean; bar: unknown; compass: unknown }[]
  const seedFill = SEED / NEED
  pass = (res.before as Bar | null)?.shown === '0'
    && g.skill === 'forestry' && /forestry/i.test(g.name) && g.level === '1' && g.fill > seedFill && g.levelup === '0'
    && u.level === '2' && /LEVEL UP/.test(u.lv) && u.pops >= 1 && u.fill < g.fill
    && res.faded === true && (res.desk as { overCompass: boolean }).overCompass === false
    && ph.every(x => !!x.bar && !!x.compass && !x.overCompass && !x.overMap && x.onScreen)
    && errors.length === 0
} catch (e) { res.error = String(e).slice(0, 300) }
res.errors = errors
console.log(JSON.stringify(res, null, 1))
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
