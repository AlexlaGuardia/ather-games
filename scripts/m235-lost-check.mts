// BETA M235 s2: NEGLECT HAS TEETH. On prod, non-owner, a seeded test keeper only.
// npx tsx scripts/m235-lost-check.mts [--url ...] [--out ...] [--desk]   (390x844 by default; --desk = 1280x800)
//   A a cleared zone C beside an uncovered infected zone I (seeded 10 game days back): the threat warning comes (C), the fold
//     map pulses C ([data-threat]), Morel pings
//   B answered: I cleared inside the window -> the threat is gone (calm)
//   C not answered: seeded again, 2.2 game days skipped -> C is LOST: the map reads it lost ([data-area-state=lost]), the world's
//     ground at C's centre dropped (carved void), the black-light pillar is up in the
//     Wilds and still up from the garden; a reload keeps C lost
//   0 page errors
import { pickWilds } from './lib/glade-gate.mts'   // M172: E at the Glade's gate opens the fold map; the Wilds is a stop on it
import { mkdirSync, readFileSync } from 'node:fs'
import { SETTLEMENT } from '../src/app/shimmer/open/ather/first-settlement'
import { fuseZones } from '../src/app/shimmer/open/ather/zones'
import { SUB } from '../src/app/shimmer/open/ather/nodes'
import { dismissStartCard } from './lib/start-card.mts'
import { GAME_DAY_MS as D } from '../src/app/shimmer/open/ather/nodes'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', 'docs/looks/m235-s2-2026-11-27'), DESK = process.argv.includes('--desk')
mkdirSync(out, { recursive: true })
const card = async (p: any) => { try { await dismissStartCard(p, 5000) } catch { /* see above */ } }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: any[] }[] }).tiles
const F = fuseZones(tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * 1000, z: n.z + t.ty * 1000, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j }))))
const Z = (sectionId: string) => F.zoneOf.get(sectionId)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
type Store = Record<string, string>
async function page(seed?: Store) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(DESK ? { width: 1280, height: 800, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (seed) await p.evaluateOnNewDocument((s: Record<string, string>) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, seed)
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args) as Promise<any>
  const SM = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => { const s = (window as any).__spreadMap?.(); return s ? (typeof s[f] === 'function' ? s[f](...args) : s[f]) : null }, fn, a) as Promise<any>
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? JSON.parse(localStorage.getItem(k) ?? 'null') : null }, suffix) as Promise<any>
  const load = async () => { await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.wm, { timeout: 240000 }); await sleep(3000); await card(p) }
  const toWilds = async () => { if ((await A('zone')) !== 'wilds') { await poll(async () => { if ((await A('zone')) === 'wilds') return true; await A('travel', { kind: 'waymark', w: GREG_WAYMARK }); await sleep(4000); return (await A('zone')) === 'wilds' }, 120000) } ; return poll(async () => !!(await SM('seen'))?.length, 60000) }
  return { p, A, SM, store, load, toWilds }
}
const seeded = (): Store => ({
  'ather:shimmer:birthRune': 'star', 'ather.garden.v1': JSON.stringify({ owned: [...STARTING_SQUARES], grey: 50, pages: 10, layout: LAYOUT }),
  'open.tutorial.v1': JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none' }),
})
const fw0 = [...tiles.find(t => t.name === 'first-wilds')!.nodes].sort((a: any, b: any) => Math.hypot(a.x - SETTLEMENT.x, a.z - SETTLEMENT.z) - Math.hypot(b.x - SETTLEMENT.x, b.z - SETTLEMENT.z))[0]
const has = (id: string) => F.members.has(id)
const nbs = (id: string) => { const [i, j] = id.slice(1).split(',').map(Number); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => `z${i + a},${j + b}`).filter(has) }
const fwIds = new Set(tiles.find(t => t.name === 'first-wilds')!.nodes.map((n: any) => Z(n.id)))
const centre = (id: string) => { const ids = F.members.get(id)!, ns = tiles.flatMap(t => t.nodes.map((n: any) => ({ id: n.id, x: n.x + t.tx * 1000, z: n.z + t.ty * 1000 }))).filter(n => ids.includes(n.id)); return { x: ns.reduce((s, n) => s + n.x, 0) / ns.length, z: ns.reduce((s, n) => s + n.z, 0) / ns.length } }
try {
  const { p, A, SM, load, toWilds } = await page(seeded())
  await load(); await toWilds(); await sleep(4000)
  const here = await SM('here'), zSet = Z(fw0.id)
  // C: a first-wilds zone beside the keeper's, never the settlement's; I: C's neighbour, neither the keeper's nor the settlement's
  let C = '', I = ''
  for (const c of [...fwIds].sort()) { if (c === here || c === zSet) continue; const i = nbs(c).find(k => k !== here && k !== zSet && fwIds.has(k)); if (i && nbs(c).includes(here)) { C = c; I = i; break } }
  if (!C) for (const c of [...fwIds].sort()) { if (c === here || c === zSet) continue; const i = nbs(c).find(k => k !== here && k !== zSet); if (i) { C = c; I = i; break } }
  const cc = centre(C); console.log(`  keeper in ${here}; C ${C} (${cc.x.toFixed(0)}, ${cc.z.toFixed(0)}), I ${I}`)
  // ── A · the warning ──
  ok(await SM('seedNeglect', C, I, 10), 'A. seeded: C cleared, I uncovered + infected, 10 game days back')
  const th = await SM('neglectTick')
  ok(th?.id === C && th?.by === I, `A. the threat warning: ${JSON.stringify(th)}`)
  ok(await poll(() => p.evaluate(() => /pressing on/i.test(document.body.innerText)), 8000), 'A. Morel pings the warning (placeholder line)')
  await A('open', 'gate'); await sleep(2500)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel] [data-threat="1"]')), 8000), 'A. the fold map pulses the threatened zone')
  await p.screenshot({ path: `${out}/a-threat-map.png` }); await p.keyboard.press('Escape'); await sleep(800)
  // ── B · answered ──
  ok((await A('wmClear', I)) === true, 'B. I cleared (its champion down)'); await sleep(800)
  ok((await SM('neglectTick')) === null && (await SM('neglect'))?.calm, 'B. answered: no threat, calm set')
  // ── C · not answered ──
  const h0 = await SM('height', cc.x, cc.z)
  ok(await SM('seedNeglect', C, I, 10), 'C. seeded again')
  ok((await SM('neglectTick'))?.id === C, 'C. threatened again')
  await A('skipDays', 2.2); await sleep(1500)
  const ng = await SM('neglect')
  ok(!!ng?.lost?.[C] && ng.lost[C].season === ng.season, `C. not answered: ${C} LOST for season ${ng?.season} (${JSON.stringify(ng?.lost)})`)
  ok((await SM('state', C)) === 'lost' && !(await SM('clean')).includes(C), 'C. the map reads it lost, out of the ledger')
  ok(await poll(async () => { const h = await SM('height', cc.x, cc.z); return h0 !== null && h !== null && Number.isFinite(h) && h < h0 - 20 }, 60000), `C. the world's ground at C's centre is gone (${h0?.toFixed?.(1)} -> ${(await SM('height', cc.x, cc.z))?.toFixed?.(1)})`)
  ok((await SM('lostDepth', cc.x, cc.z)) > 10, 'C. C reads as void (lost depth)')
  ok(await poll(() => p.evaluate(() => !!(window as any).__blackLight?.on), 10000), `C. the black light is up in the Wilds (${JSON.stringify(await p.evaluate(() => (window as any).__blackLight))})`)
  await sleep(6500); await p.screenshot({ path: `${out}/c-wilds-pillar.png` })
  await A('open', 'gate'); await sleep(2500)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel] [data-area-state="lost"]')), 8000), 'C. the fold map draws C as void')
  await p.screenshot({ path: `${out}/c-lost-map.png` }); await p.keyboard.press('Escape'); await sleep(800)
  await A('travel', { kind: 'home' }); await poll(async () => (await A('zone')) === 'plot', 60000); await sleep(4000)
  const bl = await p.evaluate(() => (window as any).__blackLight)
  ok(!!bl?.on && bl.home === true, `C. from the garden the black light stands on the horizon (${JSON.stringify(bl)})`)
  await p.screenshot({ path: `${out}/c-garden-pillar.png` })
  await load(); await sleep(3000)
  const ng2 = await p.evaluate((suf: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(suf)); return k ? JSON.parse(localStorage.getItem(k)!) : null }, MAP)
  ok(!!ng2?.lost?.[C], 'C. a reload keeps it lost')
  ok(await poll(() => p.evaluate(() => !!(window as any).__blackLight?.on), 15000), 'C. ...and the black light still stands after the reload')
  await p.screenshot({ path: `${out}/c-reload.png` })
  await p.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0)
