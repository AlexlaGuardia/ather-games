// ── M42: MELEE (2026-11-20, play / Jin d73a6734) ─────────────────────────────────────────────────────────────────────
// Alex 11-20: "a melee button like right clicking while weapons stowed so the player has a way to break placed items with like
// 3 hits to move them". Plays, desktop: a Ruin Column stands ahead; DRAW the gun (R) and right-click x3 = the sights, nothing
// breaks; STOW (hold R) and right-click: hit 1, hit 2 (it still stands), hit 3 pops it back into the bag. PHONE (390x844,
// touch): a 'hit' button shows only while aiming at a placed thing; three taps pop it. 0 page errors.
// SETUP (stated): the bag holds a repeater; the works hold one Ruin Column at (-130, 100); keeper set facing it by tp. Hooks:
// tp + reading (__melee.target/hits) only; every swing is the real right-click / the real button tap.
//   npx tsx scripts/melee-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/melee-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const COL = { id: 'col-1', item: 'ruin_column', x: -130, z: 100, q: 0, placedAt: 1 }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
async function open(touch: boolean): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(touch ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument((col: unknown) => {
    if (sessionStorage.getItem('mel')) return; sessionStorage.setItem('mel', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [col] })); localStorage.removeItem('open.bank.v1')
  }, COL)
  await p.goto(`${url}/shimmer/open/ather?hour=14&home=1`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function' && !!(window as any).__melee, { timeout: 180000 }); await sleep(2500)
  return p
}
const pollUntil = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(250) } return false }
for (const touch of [false, true]) {
  const p = await open(touch), leg = touch ? 'phone' : 'desktop'
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const cols = async () => ((await read('open.works.v1'))?.pieces ?? []).filter((x: { item: string }) => x.item === 'ruin_column').length as number
  const inBag = async () => ((await read('open.inv.v1'))?.slots ?? []).reduce((t: number, s: { id: string; n: number } | null) => t + (s?.id === 'ruin_column' ? s.n : 0), 0) as number
  const target = () => p.evaluate(() => (window as any).__melee.target()?.id ?? null)
  const hits = () => p.evaluate(() => (window as any).__melee.hits()?.n ?? 0)
  await p.evaluate(() => (window as any).__ather.tp(-130, 101.8, 0)); await sleep(2500)
  ok(await pollUntil(async () => (await target()) === 'col-1', 10000), `${leg}: facing the column, a swing would land on it (${await target()})`)
  if (!touch) {
    await p.mouse.click(550, 340); await sleep(800)   // the start card: the click locks the pointer
    const locked = await p.evaluate(() => !!document.pointerLockElement); ok(locked, 'desktop: pointer locked')
    const rclick = async () => { await p.mouse.down({ button: 'right' }); await sleep(80); await p.mouse.up({ button: 'right' }); await sleep(600) }
    // armed: the sights, never a swing
    await p.keyboard.press('KeyR'); await sleep(900)
    const armed = await p.evaluate(() => (window as any).__ather.stance?.().kind); ok(armed === 'weapon', `R draws the gun (${armed})`)
    for (let i = 0; i < 3; i++) await rclick()
    ok((await cols()) === 1 && (await hits()) === 0, `armed: right-click x3 is the sights, the column stands, no hits (${await hits()})`)
    await p.keyboard.down('KeyR'); await sleep(700); await p.keyboard.up('KeyR'); await sleep(900)   // hold R = stow
    ok((await p.evaluate(() => (window as any).__ather.stance?.().kind)) === 'stowed', 'hold R stows')
    await rclick(); ok((await hits()) === 1 && (await cols()) === 1, `stowed: hit 1 lands, it still stands (${await hits()})`)
    await rclick(); ok((await hits()) === 2 && (await cols()) === 1, `hit 2 (${await hits()})`)
    await rclick()
    ok(await pollUntil(async () => (await cols()) === 0, 4000), 'hit 3: the column is gone from the plot')
    ok((await inBag()) === 1, `   ... and back in the bag, whole (${await inBag()})`)
    try { await p.screenshot({ path: `${out}/melee-desktop-done.png` }) } catch { /* slow frame */ }   // after the hits: a slow SwiftShader frame here would outlast the 4 s count reset
  } else {
    const btn = () => p.evaluate(() => !!document.querySelector('[data-touch="hit"]'))
    ok(await pollUntil(btn, 6000), 'phone: a hit button shows while aiming at it')
    const tap = async () => { const b = await p.evaluate(() => { const e = document.querySelector('[data-touch="hit"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }); if (b) await p.touchscreen.tap(b.x, b.y); await sleep(650) }
    await tap(); await tap()
    ok((await cols()) === 1 && (await hits()) === 2, `phone: two taps, two hits, it stands (${await hits()})`)
    await tap()
    ok(await pollUntil(async () => (await cols()) === 0, 4000) && (await inBag()) === 1, `phone: the third tap pops it into the bag (${await inBag()})`)
    ok(await pollUntil(async () => !(await btn()), 4000), 'phone: nothing left to hit, the button goes')
    try { await p.screenshot({ path: `${out}/melee-phone.png` }) } catch { /* slow frame */ }
  }
  await p.close()
}
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `melee-check: ${fails} FAIL` : 'melee-check: PASS')
process.exit(fails ? 1 : 0)
