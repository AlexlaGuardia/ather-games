// BETA M139: GARDEN SQUARES 60 / 120 / 200, on prod, NON-owner, 390x844. npx tsx scripts/m139-prices-check.mts [--url ...]
// Fresh profile, every non-GET stubbed, a folded keeper with 10 grimoire pages. Greg's ground board (the real buttons):
//  1 every square for sale reads 60.  2 59 grey: the press buys nothing and takes nothing.  3 exactly 60: one square, 0 grey left, the
//  board then refuses the next; a reload keeps both.  4 an owned garden (12 squares bought at the old price) loads unchanged.  5 0 page errors.
import puppeteer, { type Page } from 'puppeteer-core'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { GRID, STARTING_SQUARES, canBuy, sqId } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 30000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const TUT = { v: 1, live: true, folded: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
async function page(owned: string[], grey: number) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 }); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m139')) return; sessionStorage.setItem('m139', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut)); localStorage.setItem('ather.garden.v1', JSON.stringify(s.g)) }, { tut: TUT, g: { owned, grey, pages: 10, layout: LAYOUT } })
  const go = async () => { await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.open, { timeout: 240000 }); await sleep(5000) }
  const g = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.garden.v1')!)) as Promise<{ owned: string[]; grey: number }>
  const board = async () => {
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await poll(() => p.evaluate(() => (window as any).__ather.zone() === 'glade'), 60000); await sleep(4000)
    await p.evaluate(() => (window as any).__ather.open('greg'))
    return poll(async () => { await p.evaluate((l: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)); b?.click() }, ANSWERS.ground); await sleep(300); return !!(await p.$('[data-panel="greg"]')) }, 20000) }
  const cells = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="greg"] button[title]')].filter(b => /^(Yours|Buy for|Fill |It has to touch|It costs)/.test(b.title)).map(b => ({ t: b.textContent ?? '', title: b.title })))
  const press = (k: number) => p.evaluate((k: number) => { const b = [...document.querySelectorAll<HTMLElement>('[data-panel="greg"] button[title]')].filter(b => /^(Yours|Buy for|Fill |It has to touch|It costs)/.test(b.title))[k]; b?.click() }, k)
  return { p, go, g, board, cells, press }
}
try {
  const START = new Set(STARTING_SQUARES); let k0 = -1
  for (let k = 0; k < GRID * GRID && k0 < 0; k++) if (canBuy(START, k % GRID, Math.floor(k / GRID), 10, 1e9).ok) k0 = k
  const id = sqId(k0 % GRID, Math.floor(k0 / GRID))
  { const s = await page([...STARTING_SQUARES], 59); await s.go(); ok(await s.board(), "Greg's ground board opens")
    const c = await s.cells(), nums = c.map(x => x.t).filter(t => /^\d+$/.test(t)); ok(c.length === GRID * GRID && nums.length > 0 && nums.every(t => t === '60'), `1. ${nums.length} squares for sale, every one reads 60 (${[...new Set(nums)]})`)
    await s.press(k0); await sleep(1500); const g = await s.g(); ok(g.grey === 59 && !g.owned.includes(id) && g.owned.length === STARTING_SQUARES.length, `2. 59 grey: refused, nothing taken (${c[k0].title}; grey ${g.grey}, ${g.owned.length} squares)`)
    try { await s.p.screenshot({ path: flag('--out', '/tmp') + '/m139-board.png' }) } catch { /* slow */ } await s.p.close() }
  { const s = await page([...STARTING_SQUARES], 60); await s.go(); await s.board(); const c = await s.cells(); await s.press(k0); await sleep(1500)
    let g = await s.g(); ok(c[k0].title === 'Buy for 60 grey matter' && g.grey === 0 && g.owned.includes(id) && g.owned.length === STARTING_SQUARES.length + 1, `3. exactly 60: ${id} bought, ${g.grey} grey left, ${g.owned.length} squares`)
    const d = await s.cells(); ok(!d.some(x => x.title.startsWith('Buy for')), '3. then nothing is affordable')
    await s.go(); g = await s.g(); ok(g.grey === 0 && g.owned.includes(id), '3. a reload keeps it'); await s.p.close() }
  { const own = [...STARTING_SQUARES]; const S = new Set(own); for (let n = 0; n < 12; n++) for (let k = 0; k < GRID * GRID; k++) { const i = k % GRID, j = Math.floor(k / GRID); if (!S.has(sqId(i, j)) && canBuy(S, i, j, 10, 1e9).ok) { S.add(sqId(i, j)); break } }
    const had = [...S]; const s = await page(had, 7); await s.go(); await sleep(2000); const g = await s.g()
    ok(had.length === STARTING_SQUARES.length + 12 && g.owned.length === had.length && had.every(x => g.owned.includes(x)) && g.grey === 7, `4. an owned garden is unchanged (${g.owned.length} squares, ${g.grey} grey)`); await s.p.close() }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `5. 0 page errors ${errs.slice(0, 3).join(' | ')}`)
await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
