// BETA M75 s2: WAYMARK DARK / RELIGHT, on prod, 390x844. npx tsx scripts/m75-dark-check.mts [--url ...] [--out ...]
// Canon (Magii RULED-AFK athernyx d3bf5e9; shimmer-folds-settlements.md:32 "a waymark exists only on kept ground"): a waymark
// whose ground goes grey again goes DARK (no travel), RELIGHTS when the ground is cleared again; it stays planted (no refund,
// no re-buy) and the fold map shows it unlit, not removed.
//   plant on cleared ground (wmClearHere, CHECK-ONLY) -> garden -> waymark travels; the node goes grey (wmGrey, CHECK-ONLY:
//   the spread ledger loses that node's clean mark, exactly what a well-up does) -> travel refused with the reason, keeper stays
//   home; the fold map lists it unlit; reload keeps it planted + dark, bag unchanged; the node is cleared (wmClear) -> travel ok;
//   reload keeps it lit; 0 page errors.
import { DARK_WHY, PLANT_HINT, UNLIT_LABEL } from '../src/app/shimmer/open/ather/waymarks'
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m75-dark')
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

const DARK = { test: (t: string) => t.includes(DARK_WHY) }
try {
  const { p, A, bagWaymarks, zoneIs, load, toWilds } = await page((layout, owned) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('ather.garden.v1', JSON.stringify({ owned, grey: 50, pages: 10, layout }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none' }))
  })
  const text = () => p.evaluate(() => document.body.innerText) as Promise<string>
  const litOf = async (id: string) => ((await A('wmLit')) as { id: string; lit: boolean }[]).find(k => k.id === id)?.lit
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await load()
  ok(await toWilds(), 'into the Wilds')
  // stand on infected ground away from Greg's stone, outside any settlement, then answer its grey
  const cands = ((await A('wmNodes')) as { id: string; x: number; z: number; infected: boolean; d: number }[]).filter(n => n.infected && n.d > 100)
  let here: any = null
  for (const n of cands.slice(0, 8)) {
    await A('wmGoto', n.x, n.z); await sleep(4500)
    here = await A('wmGround')
    if (here?.ground === 'infected' && here.grounded && !here.settlement) break
    here = null
  }
  ok(!!here, 'stood on infected ground')
  const node = await A('wmClearHere'); await sleep(1500)
  const r = await A('wmPlant')
  const w = (await A('wm'))[0]
  ok(r?.ok === true && !!w && w.node === node, `planted on cleared ground (node ${node})`)
  ok((await litOf(w.id)) === true, 'cleared ground: the waymark is lit')
  const bag = await bagWaymarks()
  await sleep(2500); await A('travel', { kind: 'home' }); ok(await zoneIs('plot', 30000), 'home')
  await sleep(3000); await A('travel', { kind: 'waymark', w }); ok(await zoneIs('wilds', 60000), 'lit: garden -> waymark travels')
  await sleep(3000); await A('travel', { kind: 'home' }); ok(await zoneIs('plot', 30000), 'home again')
  await sleep(2000)
  // the ground goes grey again
  ok((await A('wmGrey', node)) === true, `the node goes grey again (${node})`)
  await sleep(800)
  ok((await litOf(w.id)) === false, 'grey ground: the waymark is DARK')
  await A('travel', { kind: 'waymark', w })
  const said = await poll(async () => DARK.test(await text()), 4000)
  await sleep(3000)
  ok((await A('zone')) === 'plot', `dark: travel refused, still home (zone ${await A('zone')})`)
  ok(said, 'dark: the refusal says why')
  ok((await A('wm')).length === 1 && (await bagWaymarks()) === bag, 'dark: still planted, nothing refunded or spent')
  await A('open', 'gate'); await sleep(1500)
  const stop = await p.evaluate((id: string) => { const b = document.querySelector(`[data-waymark-stop="${id}"]`) as HTMLElement | null; return b ? { lit: b.dataset.lit, t: b.innerText } : null }, w.id)
  ok(!!stop && stop.lit === '0' && stop.t.includes(UNLIT_LABEL), `fold map: listed, unlit (${JSON.stringify(stop)})`)
  ok((await text()).includes(PLANT_HINT), `fold map: '${PLANT_HINT}'`)
  await p.screenshot({ path: `${out}/dark-foldmap.png` })
  await p.keyboard.press('Escape'); await sleep(800)
  // reload keeps it planted + dark
  await p.reload({ waitUntil: 'load', timeout: 240000 }); await load()
  ok((await A('wm')).length === 1 && (await litOf(w.id)) === false && (await bagWaymarks()) === bag, 'reload: still planted, still dark, bag unchanged')
  await A('travel', { kind: 'waymark', w }); await sleep(3000)
  ok((await A('zone')) === 'plot', 'reload: dark still refuses')
  // cleared again: relights
  ok((await A('wmClear', node)) === true, 'the node is cleared again')
  await sleep(800)
  ok((await litOf(w.id)) === true, 'cleared again: RELIT')
  await A('travel', { kind: 'waymark', w }); ok(await zoneIs('wilds', 60000), 'relit: garden -> waymark travels')
  await sleep(3000); await A('travel', { kind: 'home' }); await zoneIs('plot', 30000)
  await p.reload({ waitUntil: 'load', timeout: 240000 }); await load()
  ok((await A('wm')).length === 1 && (await litOf(w.id)) === true && (await bagWaymarks()) === bag, 'reload: still lit, one waymark, bag unchanged')
  await p.close()
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS')
process.exit(fails ? 1 : 0)
