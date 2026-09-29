/**
 * ledge-flow.mts — LIVING ARCHITECTURE on the live site (2026-09-29): cast it on the firing range through the real
 * dispatcher, read back the ledge + stair it raised, then put the keeper on it and see the walker STAND there.
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/ledge-flow.mts
 */
import puppeteer from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'https://ather.games'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const WHO = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('needs OWNER_KEY (set -a; . .env; set +a)'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l); console.log(`${c ? '✓' : '✗'} ${l}`) }
type Cell = { x: number; z: number; height: number; stand?: { base: number; top: number } }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
const errors: string[] = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.setCookie({ name: 'ather_session', value: mintSession(WHO.id, WHO.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
  await page.evaluateOnNewDocument((id: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
    localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
  }, WHO.id)
  await page.goto(`${ORIGIN}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.goto(`${ORIGIN}/shimmer/play3d`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  for (let t = 0; t < 60; t++) { if (await page.evaluate(() => typeof (window as any).__conj === 'function')) break; await sleep(500) }
  ok(await page.evaluate(() => typeof (window as any).__conj === 'function'), 'the owner hooks are on the page')
  await page.evaluate(() => (window as any).__goZone('firing-range'))
  await sleep(7000)
  ok(await page.evaluate(() => (window as any).__cast('living-architecture')), 'Living Architecture casts')
  await sleep(1200)
  const cells: Cell[] = await page.evaluate(() => (window as any).__conj())
  const walk = cells.filter(c => c.stand)
  const tops = walk.map(c => c.stand!.top - c.stand!.base).sort()
  ok(walk.length >= 14 && tops.filter(t => t === 3).length >= 8 && tops.filter(t => t === 2).length === 3 && tops.filter(t => t === 1).length === 3,
    `★ it raised a ledge + a two-step stair (${walk.length} cells, rises ${[...new Set(tops)].join('/')})`)
  const step1 = walk.find(c => c.stand!.top - c.stand!.base === 1)!
  const top = walk.find(c => c.stand!.top - c.stand!.base === 3)!
  // on the ledge, at its top: the walker stays up there (with no surface it would fall to the ground)
  await page.evaluate((c: Cell) => (window as any).__at(c.x, c.stand!.top, c.z), top)
  await sleep(1500)
  const onTop = await page.evaluate(() => (window as any).__at())
  ok(Math.abs(onTop.y - top.stand!.top) < 0.3, `★ the keeper STANDS on the ledge (y ${onTop.y.toFixed(2)}, top ${top.stand!.top})`)
  await page.screenshot({ path: process.env.SHOT ?? '/tmp/ledge-top.png' })
  // at the stair's foot, from the ground: the one-tier step-up puts them on the first step
  await page.evaluate((c: Cell) => (window as any).__at(c.x, c.stand!.base, c.z), step1)
  await sleep(1500)
  const onStep = await page.evaluate(() => (window as any).__at())
  ok(Math.abs(onStep.y - step1.stand!.top) < 0.3, `★ from the ground the first step is one tier up and it takes them (y ${onStep.y.toFixed(2)})`)
} finally {
  await browser.close()
}
ok(errors.length === 0, `no page errors (${errors.length})`)
for (const e of errors.slice(0, 6)) console.log('  ' + e)
console.log(`ledge-flow: ${pass} passed, ${fails.length} failed`)
process.exit(fails.length ? 1 : 0)
