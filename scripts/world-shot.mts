// Screenshot the running voxel world, headless.
//
// Run: npx tsx scripts/world-shot.mts [out.png] [seconds-to-settle]
//
// ★ WHY THIS IS AWKWARD AND WORTH IT: unlike the icon sheet, the 3D world cannot be rendered from
// pure code — it needs a GL context, a canvas, a streaming loop and a HUD. So this drives the real
// page in the real renderer, which is the only way to see what actually ships.
//
// ── the three things that make it work on a headless server ────────────────────────────────────
// 1. SWIFTSHADER. This box has no GPU. Chrome refuses WebGL without one unless software GL is
//    explicitly allowed, and the page dies at "generating…" forever with no error.
// 2. THE BIRTH GATE. voxel3d mounts a rune ritual before the world exists, so a cold profile
//    screenshots the ritual, not the garden. The keys are seeded before the page's first script
//    runs — `addInitScript`'s whole purpose — including the EPOCH, or `resetIfStale` wipes the
//    seed we just wrote and hands us the ritual anyway.
// 3. TIME. Terrain streams in over several seconds and a screenshot taken on `load` is a blue void.
//
// ⚠ Uses the SYSTEM chromium, not a downloaded one: `/` sits near the disk-watcher's prune
// threshold and Playwright's bundled browser is ~400MB.

import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'world.png'
const SETTLE = Number(process.argv[3] ?? 12)
const URL = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    // Software GL. Without BOTH of these Chrome reports a context and then refuses to draw.
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,760',
  ],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })

  // Seed BEFORE any page script: born, with the epoch already current.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'ember')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['ember']))
  })

  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60_000 })
  // The world streams; there is no "ready" event to wait on, so give it wall-clock and say so.
  await new Promise(r => setTimeout(r, SETTLE * 1000))

  await page.screenshot({ path: OUT })
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return c ? { w: c.width, h: c.height } : null
  })
  console.log(`shot → ${OUT}  ·  canvas ${canvas ? `${canvas.w}×${canvas.h}` : 'NONE (no renderer mounted)'}`)
  if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 6).join('\n  ')}`)
} finally {
  await browser.close()   // never leave a chrome behind on an 8GB box
}
