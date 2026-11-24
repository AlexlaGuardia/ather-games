// BETA M71 s2: WAYMARK PRICING, on prod, 390x844. npx tsx scripts/m71-waymark-price-check.mts [--url ...] [--out ...]
// Magii 43fef80 #6: a NEW bag starts with 3 free waymarks; Greg sells more at 500 grey matter (garden-fold.ts WAYMARK_PRICE),
// only to a folded keeper; under the price refuses with the shortfall; spends exactly the price. Old keepers keep every waymark.
//   C (a fresh FOLDED keeper, no bag, no garden save): 3 in the bag; 600 granted; Greg 'Buy a waymark' -> 4, grey 100 (exactly
//     500); again at 100 -> refused, the shortfall line, still 4 / 100; reload keeps 4 / 100.
//   D (old saves): a saved bag holding 9 loads with 9; a garden save with no bag gets the old 12.
//   E (UNFOLDED): Greg offers no buy.   0 page errors.
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { FOLD_TEXT, WAYMARK_PRICE } from '../src/app/shimmer/open/ather/garden-fold'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
import { newInv } from '../src/app/shimmer/open/shared/inventory'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m71s2')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const TUT = (folded: boolean | undefined) => ({ v: 1, live: true, ...(folded === undefined ? {} : { folded }), greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none' })
type Seed = { tut: object; garden?: object; inv?: object }
async function page(seed: Seed) {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: Seed) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    if (s.garden) localStorage.setItem('ather.garden.v1', JSON.stringify(s.garden))
    if (s.inv) localStorage.setItem('open.inv.v1', JSON.stringify(s.inv))
  }, seed)
  const go = async () => { await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.wmBag, { timeout: 240000 }); await sleep(5000) }
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return (b.firstElementChild?.textContent ?? '').slice(sc.length) }) as Promise<string | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pick = (label: string) => p.evaluate((l: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)); b?.click(); return !!b }, label)
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? JSON.parse(localStorage.getItem(k) ?? 'null') : null }, suffix) as Promise<any>
  const greg = async () => { await A('open', 'greg'); await poll(async () => !!(await bubble()) || !!(await opts()).length, 8000); await poll(async () => !!(await bubble()), 6000); await sleep(400); return { line: (await bubble()) ?? '', opts: await opts() } }
  const closeTalk = async () => { await p.keyboard.press('Escape'); await sleep(500); if (await p.$('[data-talk-choices]')) { await pick(ANSWERS.bye); await sleep(500) } }
  const zoneIs = (z: string, ms = 30000) => poll(async () => (await A('zone')) === z, ms)
  return { p, A, bubble, opts, pick, store, greg, closeTalk, zoneIs, go }
}

try {
  // ── C · a fresh folded keeper ──
  {
    const { p, A, bubble, pick, store, greg, closeTalk, go, zoneIs } = await page({ tut: TUT(true) })
    await go()
    await A('travel', { kind: 'glade' }); ok(await zoneIs('glade', 60000), 'C. at Greg in the Glade (his bubble is drawn there)'); await sleep(4000)
    ok((await A('wmBag')) === 3, `C. a new bag holds 3 waymarks (${await A('wmBag')})`)
    await A('grant', 600); await sleep(600)
    const g0 = (await store('ather.garden.v1'))?.grey
    let g = await greg()
    ok(g.opts.includes(FOLD_TEXT.buyAsk), `C. Greg offers '${FOLD_TEXT.buyAsk}' (${g.opts.join(' / ')})`)
    await pick(FOLD_TEXT.buyAsk)
    ok(await poll(async () => (await bubble()) === FOLD_TEXT.buyDone, 8000), `C. the buy goes through ('${await bubble()}')`)
    let gd = await store('ather.garden.v1')
    ok((await A('wmBag')) === 4 && g0 === 600 && gd?.grey === g0 - WAYMARK_PRICE, `C. 3 -> ${await A('wmBag')} waymarks, grey ${g0} -> ${gd?.grey} (exactly ${WAYMARK_PRICE})`)
    await p.screenshot({ path: `${out}/c-bought.png` })
    await pick(FOLD_TEXT.buyAsk)
    ok(await poll(async () => (await bubble()) === FOLD_TEXT.buyShort(100), 8000), `C. at 100 refused with the shortfall ('${await bubble()}')`)
    gd = await store('ather.garden.v1')
    ok((await A('wmBag')) === 4 && gd?.grey === 100, `C. refused: nothing spent (${await A('wmBag')} waymarks, ${gd?.grey} grey)`)
    await p.screenshot({ path: `${out}/c-short.png` })
    await closeTalk()
    await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.wmBag, { timeout: 240000 }); await sleep(4000)
    ok((await A('wmBag')) === 4 && (await store('ather.garden.v1'))?.grey === 100, 'C. reload: 4 waymarks, 100 grey')
    await p.close()
  }
  // ── D · old saves keep their waymarks ──
  {
    const bag = { ...newInv(9), gifts: ['bait1'] }
    const { p, A, go } = await page({ tut: TUT(undefined), garden: { owned: [...STARTING_SQUARES], grey: 50, pages: 10, layout: LAYOUT }, inv: bag })
    await go()
    ok((await A('wmBag')) === 9, `D. an old saved bag with 9 loads with ${await A('wmBag')}`)
    await p.close()
  }
  {
    const { p, A, go } = await page({ tut: TUT(undefined), garden: { owned: [...STARTING_SQUARES], grey: 50, pages: 10, layout: LAYOUT } })
    await go()
    ok((await A('wmBag')) === 12, `D. an old keeper (garden save) whose bag was never saved gets the old 12 (${await A('wmBag')})`)
    await p.close()
  }
  // ── E · unfolded: no buy ──
  {
    const { A, greg, go, p } = await page({ tut: { ...TUT(false), m70: 'none' } })
    await go()
    const g = await greg()
    ok(!g.opts.includes(FOLD_TEXT.buyAsk) && g.opts.length > 0, `E. an unfolded keeper: no buy (${g.opts.join(' / ')})`)
    ok((await A('wmBag')) === 3, 'E. and a new bag of 3')
    await p.close()
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS')
process.exit(fails ? 1 : 0)
