// The map knows which world it is in. Run with OWNER_KEY set.
//
// ★ A PAGE TEST BECAUSE THE BUG WAS A PICTURE. Nothing threw, nothing logged: pressing M inside the
// fold drew the WILDS — a starfield with the keeper's plot coordinates plotted against continent
// bounds, which is a plausible-looking dot in the wrong country. The only way to catch that class is
// to open the thing and read what it says.
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1280,900'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('ather:epoch', '2'))
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(16000)

  const cmd = async (line: string, close = true) => {
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(900)
    if (close) { await page.keyboard.press('Escape'); await sleep(500) }
  }
  const caption = () => page.evaluate(() => {
    const t = document.body.innerText
    return t.split('\n').find(l => /M or click to close/.test(l)) ?? ''
  })
  /** The fraction of the expanded map that is NOT the void — a fold is mostly ground, the unwalked
   *  Wilds is almost entirely cloud/deep. Reads the canvas rather than trusting the caption. */
  const litFraction = () => page.evaluate(() => {
    // ⚠ BY `data-map`, NOT "the biggest canvas" — that is the world's WebGL surface, whose 2D
    // context is null, and the assert then fails as -1 while the map is drawing perfectly.
    const cv = document.querySelector('canvas[data-map="base"]') as HTMLCanvasElement | null
    if (!cv) return -1
    const ctx = cv.getContext('2d')
    if (!ctx) return -1
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data
    let lit = 0, n = 0
    for (let i = 0; i < d.length; i += 4 * 37) { n++; if (d[i] + d[i + 1] + d[i + 2] > 120) lit++ }
    return lit / Math.max(1, n)
  })
  await cmd('/help')

  // ── 1. the WILDS map is still the Wilds map ─────────────────────────────────────────────────
  await page.keyboard.press('KeyM'); await sleep(2500)
  const wilds = await caption()
  ok(/% walked/.test(wilds), `out in the country the map counts what you have walked — ${JSON.stringify(wilds)}`)
  ok(!/your fold/.test(wilds), 'and does not claim to be a fold')
  await page.keyboard.press('KeyM'); await sleep(900)

  // ── 2. ★★ INSIDE THE FOLD IT IS THE FOLD ────────────────────────────────────────────────────
  await cmd('/space plot')
  await sleep(12000)
  await page.keyboard.press('KeyM'); await sleep(2800)
  const fold = await caption()
  ok(/your fold/.test(fold), `★ inside the garden the map is the garden — ${JSON.stringify(fold)}`)
  ok(/threshold/.test(fold), 'and it names the door, which is what the map is opened for')
  ok(!/% walked/.test(fold), 'the fog counter is gone — a fold is not fogged, it is yours')
  const lit = await litFraction()
  ok(lit > 0.25, `★ and it is drawing an ISLAND, not a starfield (${(lit * 100).toFixed(0)}% of the plate is ground)`)
  await page.keyboard.press('KeyM'); await sleep(900)

  // ── 3. ★ AND WALKING IN THE FOLD DOES NOT OPEN THE WILDS ────────────────────────────────────
  // The recorder ran in both worlds, pushing plot coordinates through the continent's transform, so
  // an evening in the garden quietly marked country near the world origin as walked — on disk.
  const before = await page.evaluate(() => localStorage.getItem('voxel3d:seen:voxel')?.length ?? 0)
  await page.keyboard.down('KeyW'); await sleep(6000); await page.keyboard.up('KeyW')
  await sleep(3000)
  await cmd('/space wilds')
  await sleep(6000)
  await page.keyboard.press('KeyM'); await sleep(2500)
  const back = await caption()
  ok(/% walked/.test(back), `crossing back gives the Wilds map again — ${JSON.stringify(back)}`)
  const pct = Number(/([\d.]+)% walked/.exec(back)?.[1] ?? '-1')
  ok(pct >= 0 && pct < 5, `★ and the walk inside the fold did not open the country (${pct}% walked)`)
  void before

  console.log(fails ? `\nmap-check: ${fails} FAILED` : '\nmap-check: CLEAN')
} finally {
  await browser.close()
}
process.exit(fails ? 1 : 0)
