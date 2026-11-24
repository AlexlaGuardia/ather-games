// BETA M75: PLAYER-PLACED WAYMARKS, on prod, 390x844. npx tsx scripts/m75-waymark-check.mts [--url ...] [--out ...]
// Canon: a waymark exists only once the place is KEPT, so 'anywhere in the Wilds' (Alex 11-22) = anywhere on kept ground (a
// settlement, or ground the keeper cleared), and each links back to the garden (none before Greg folds one, M71 s1).
//   A (a folded garden, pre-M71 save shape): into the Wilds; on INFECTED ground the plant refuses with the reason and spends
//     nothing; the node's grey is cleared (wmClearHere, CHECK-ONLY like grant); on that CLEARED ground the plant binds (bag -1,
//     ledger +1 with its node); garden -> waymark -> garden through the same travel the fold map's stops call; reload keeps it;
//     lift removes it (bag +1); reload keeps it gone.
//   B (a keeper Greg has NOT folded a garden for): in the Wilds the plant refuses, saying why.
//   0 page errors throughout.
import { PLANT_WHY } from '../src/app/shimmer/open/ather/waymarks'
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m75')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }

async function page(seed: (layout: number, squares: string[]) => void) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(seed, LAYOUT, [...STARTING_SQUARES])
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args) as Promise<any>
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? JSON.parse(localStorage.getItem(k) ?? 'null') : null }, suffix) as Promise<any>
  const bagWaymarks = () => A('wmBag') as Promise<number>
  const zoneIs = (z: string, ms = 30000) => poll(async () => (await A('zone')) === z, ms)
  const load = async () => { await p.waitForFunction(() => !!(window as any).__ather?.wm, { timeout: 240000 }); await sleep(4000) }
  const toWilds = async () => { await A('travel', { kind: 'waymark', w: GREG_WAYMARK }); const z = await zoneIs('wilds', 60000); await poll(async () => ((await A('wmNodes')) ?? []).length > 0, 60000); await sleep(4000); return z }
  return { p, A, store, bagWaymarks, zoneIs, load, toWilds }
}

try {
  // ── A · a folded garden ──
  {
    const { p, A, store, bagWaymarks, zoneIs, load, toWilds } = await page((layout, owned) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('ather.garden.v1', JSON.stringify({ owned, grey: 50, pages: 10, layout }))
      localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none' }))
    })
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await load()
    ok((await A('zone')) === 'plot', `A. a folded keeper starts in the garden (zone ${await A('zone')})`)
    ok(await toWilds(), 'A. into the Wilds')
    const bag0 = await bagWaymarks()
    ok(bag0 > 0, `A. waymarks in the bag (${bag0})`)
    // find INFECTED ground away from Greg's stone, standing, not in a settlement
    const cands = ((await A('wmNodes')) as { id: string; x: number; z: number; infected: boolean; d: number }[]).filter(n => n.infected && n.d > 100)
    let here: any = null
    for (const n of cands.slice(0, 8)) {
      await A('wmGoto', n.x, n.z); await sleep(4500)
      here = await A('wmGround')
      if (here?.ground === 'infected' && here.grounded && !here.settlement) break
      here = null
    }
    ok(!!here, `A. stood on infected ground (${here ? `${Math.round(here.x)},${Math.round(here.z)}` : 'none found'})`)
    const r1 = await A('wmPlant')
    ok(r1?.ok === false && r1.why === PLANT_WHY.grey, `A. infected ground refuses, with the reason ('${r1?.why}')`)
    ok((await A('wm')).length === 0 && (await bagWaymarks()) === bag0, 'A. refused: nothing planted, nothing spent')
    await p.screenshot({ path: `${out}/a-refused.png` })
    const cleared = await A('wmClearHere'); await sleep(1500)
    const g2 = await A('wmGround')
    ok(!!cleared && g2?.ground === 'cleared', `A. the node's grey answered: the ground reads cleared (${g2?.ground})`)
    const r2 = await A('wmPlant')
    const list = await A('wm')
    ok(r2?.ok === true && list.length === 1 && list[0].node === cleared, `A. cleared ground takes the waymark (${JSON.stringify(r2)}, node ${list[0]?.node})`)
    ok((await bagWaymarks()) === bag0 - 1, 'A. planting spent one from the bag')
    const saved = await store('ather.waymarks.v1')
    ok(Array.isArray(saved) && saved.length === 1 && saved[0].id === list[0].id, 'A. the ledger is saved')
    await p.screenshot({ path: `${out}/a-planted.png` })
    const w = list[0]
    // garden -> waymark -> garden (the fold map's stops call this same travel)
    await sleep(3000); await A('travel', { kind: 'home' })
    ok(await zoneIs('plot', 30000), `A. home to the garden (zone ${await A('zone')})`)
    await sleep(4000); await A('travel', { kind: 'waymark', w })
    ok(await zoneIs('wilds', 60000), 'A. garden -> the waymark: in the Wilds')
    await sleep(4000)
    const at = await A('wmGround')
    ok(!!at && Math.hypot(at.x - g2.x, at.z - g2.z) < 8, `A. set down at the waymark (${at && Math.round(Math.hypot(at.x - g2.x, at.z - g2.z))} m from where it was bound)`)
    await A('travel', { kind: 'home' })
    ok(await zoneIs('plot', 30000), 'A. waymark -> garden')
    // reload persists
    await p.reload({ waitUntil: 'load', timeout: 240000 }); await load()
    const after = await A('wm')
    ok(after.length === 1 && after[0].id === w.id && after[0].node === w.node, 'A. reload: the waymark is still bound')
    // remove
    const bag1 = await bagWaymarks()
    await A('wmLift', w.id); await sleep(800)
    ok((await A('wm')).length === 0 && (await bagWaymarks()) === bag1 + 1, 'A. lift removes it, back in the bag')
    await p.reload({ waitUntil: 'load', timeout: 240000 }); await load()
    ok((await A('wm')).length === 0, 'A. reload: still lifted')
    await p.close()
  }
  // ── B · not folded yet ──
  {
    const { p, A, load, toWilds } = await page(() => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, folded: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none' }))
    })
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await load()
    ok(await toWilds(), `B. an unfolded keeper in the Wilds (zone ${await A('zone')})`)
    const n = ((await A('wmNodes')) as { x: number; z: number; d: number }[]).find(k => k.d > 100)
    if (n) { await A('wmGoto', n.x, n.z); await sleep(4500) }
    const r = await A('wmPlant')
    ok(r?.ok === false && r.why === PLANT_WHY.unfolded, `B. no garden to lead home to: refused ('${r?.why}')`)
    ok((await A('wm')).length === 0, 'B. nothing planted')
    await p.screenshot({ path: `${out}/b-prefold.png` })
    await p.close()
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS')
process.exit(fails ? 1 : 0)
