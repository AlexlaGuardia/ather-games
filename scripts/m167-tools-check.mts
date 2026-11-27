// M167 prod check: the worn pruner + worn spike look as Alex locked them (athernyx a8b1db5).
// Mounts each tool in the live voxel3d hand (pins the focus with __hands.look, as a worked block raises it) and asserts the
// rig the page built carries the NEW models (window.__hands.looks == the tree's createHands().looks: name + part count),
// that the dial glyphs on the HUD are the new pruner / spike glyphs, and 0 page errors. Screenshots each tool in hand at
// 1280x900 and 390x844 into SHOTS (default docs/looks/m167-2026-11-27).
// Run: OWNER_KEY=... npx tsx scripts/m167-tools-check.mts   (WORLD_URL to aim elsewhere)
import puppeteer from 'puppeteer-core'
import { createHands } from '../src/app/shimmer/voxel3d/hands'

const PAGE = process.env.WORLD_URL ?? 'https://ather.games/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SHOTS = process.env.SHOTS ?? 'docs/looks/m167-2026-11-27'
const SETTLE = Number(process.env.SETTLE ?? 14)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const want = createHands().sig.looks ?? {}
console.log('tree looks:', JSON.stringify({ forestry: want.forestry, prospecting: want.prospecting }))
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set'); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
try {
  for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['390', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]] as const) {
    console.log(`── ${label}`)
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e)))
    await page.setViewport(vp)
    await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
    await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 90_000 })
    await sleep(SETTLE * 1000)
    await page.waitForFunction(() => !!(window as unknown as { __hands?: unknown }).__hands, { timeout: 60_000 }).catch(() => {})
    const looks = await page.evaluate(() => (window as unknown as { __hands?: { looks?: Record<string, string> } }).__hands?.looks ?? null)
    ok(!!looks && looks.forestry === want.forestry, `live rig mounts the worn pruner: ${looks?.forestry} (tree ${want.forestry})`)
    ok(!!looks && looks.prospecting === want.prospecting, `live rig mounts the worn spike: ${looks?.prospecting} (tree ${want.prospecting})`)
    const glyphs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-tool-glyph]')).map(e => e.getAttribute('data-tool-glyph')))
    ok(glyphs.includes('m167-pruner') && glyphs.includes('m167-spike'), `HUD dial glyphs are the new pruner + spike: ${JSON.stringify([...new Set(glyphs)])}`)
    for (const fam of ['forestry', 'prospecting'] as const) {
      await page.evaluate((f: string) => { (window as unknown as { __hands: { look?: string | null } }).__hands.look = f }, fam)
      await sleep(2500)
      const fam2 = await page.evaluate(() => (window as unknown as { __hands: { family: string | null } }).__hands.family)
      ok(fam2 === fam, `${fam} focus held in hand`)
      await page.screenshot({ path: `${SHOTS}/${fam === 'forestry' ? 'pruner' : 'spike'}-hand-${label}.png` })
    }
    await page.evaluate(() => { (window as unknown as { __hands: { look?: string | null } }).__hands.look = null })
    ok(errors.length === 0, `0 page errors (${errors.length}${errors.length ? ': ' + errors[0].slice(0, 160) : ''})`)
    await page.close()
  }
} finally { await browser.close() }
console.log(fails ? `M167 CHECK: ${fails} FAIL` : 'M167 CHECK: ALL PASS')
process.exit(fails ? 1 : 0)
