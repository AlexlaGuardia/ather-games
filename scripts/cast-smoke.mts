/**
 * cast-smoke.mts — every move-jobs cast, live, in the firing range (2026-09-29, move-jobs pass 2).
 * Casts each move through the page's real dispatcher (`__cast`, owner-only) and fails on ANY page error. A frame-loop
 * crash in a new cast path is invisible to tsc and to the unit oracles; this is the check that sees it. It also
 * prints what each cast left on the range's foes (`__foes`), which is a reading, not an assert: aim decides what lands.
 *
 *   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/cast-smoke.mts [move-id ...]
 */
import puppeteer from 'puppeteer-core'
import { mintSession } from '../src/lib/accounts/session'

const ORIGIN = process.env.SMOKE_ORIGIN ?? 'https://ather.games'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const WHO = { id: 'u_156700d4312d118944', name: 'dummy_fern' }
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('needs OWNER_KEY (set -a; . .env; set +a)'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// pass 2's moves first, then pass 1's, so a regression in either shows
const MOVES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'gale-cutter', 'riptide', 'tidal-arms', 'forked-bolt', 'drowning-grasp', 'wind-shear', 'pyroclast',
  'pressure-lance', 'keenshard', 'chain-lightning', 'emberglass', 'flashpoint',
  'hush', 'monsoon-veil', 'heat-mirage', 'waymark', 'stormbank', 'flame-barrage', 'exhale',
  'pillar-tomb', 'cyclone-cage', 'monolith', 'monolith',
  'enlighten', 'shackle', 'flash-freeze', 'firewall', 'firestorm', 'grindstone', 'bolt-snipe', 'ice-dart', 'quickform', 'updraft',
]

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
const errors: string[] = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e instanceof Error ? e.message : String(e)}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|WebSocket/i.test(m.text())) errors.push(`console: ${m.text()}`) })
  await page.setCookie({ name: 'ather_session', value: mintSession(WHO.id, WHO.name), domain: new URL(ORIGIN).hostname, path: '/', httpOnly: true })
  await page.evaluateOnNewDocument((id: string) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem(`u:${id}:ather:shimmer:birthRune`, 'barrier')
    localStorage.setItem(`u:${id}:ather:shimmer:runes`, JSON.stringify(['barrier']))
  }, WHO.id)
  await page.goto(`${ORIGIN}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.goto(`${ORIGIN}/shimmer/play3d`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  for (let t = 0; t < 60; t++) { if (await page.evaluate(() => typeof (window as any).__cast === 'function')) break; await sleep(500) }
  if (!(await page.evaluate(() => typeof (window as any).__cast === 'function'))) throw new Error('__cast never appeared (not owner, or the page did not mount)')
  await page.evaluate(() => (window as any).__goZone('firing-range'))
  await sleep(7000)
  let refused = 0
  for (const id of MOVES) {
    const before = errors.length
    const ran = await page.evaluate((m: string) => (window as any).__cast(m), id)
    await sleep(1400)
    const foes = await page.evaluate(() => (window as any).__foes())
    const worn = [...new Set(Object.values(foes as Record<string, string[]>).flat())].join(',') || '-'
    if (!ran) refused++
    console.log(`${errors.length > before ? '✗' : ran ? '✓' : '·'} ${id.padEnd(16)} foes wear: ${worn}`)
  }
  await sleep(2500)   // let lingering clouds, cages and shoves run a few more ticks
  console.log(`\n${MOVES.length} casts, ${refused} refused (not built), ${errors.length} page errors`)
} finally {
  await browser.close()
}
for (const e of errors.slice(0, 12)) console.log('  ' + e)
process.exit(errors.length ? 1 : 0)
