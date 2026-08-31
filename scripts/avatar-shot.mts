// ── Photograph the stream avatar at pinned moments, as a contact sheet ─────────────────────────
// Run: npx tsx scripts/avatar-shot.mts [out.png] [--port 3204] [--obs]
//
// ⚠ IT WAITS ON `window.__avatarDrawn`, NOT ON A TIMEOUT. The page loads two PNGs and a JSON
// before the compositor can run at all, so a fixed wait photographs an empty canvas whenever the
// box is busy — and an empty canvas is indistinguishable from a rig that draws nothing.
//
// ⚠ AND IT PINS THE CLOCK VIA `?frame=`. The avatar breathes and blinks, so an unpinned shot
// samples a random instant and no two runs are comparable. These four moments are chosen to span
// the states that can actually break: shut, mid-syllable, wide open, and mid-blink.
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const flag = (n: string, d: string) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] }
const out = args.find(a => a.endsWith('.png')) ?? 'avatar-shot.png'
const port = flag('--port', '3204')
const obs = args.includes('--obs')

// synthetic(t): syllable period 145ms, blink at (t % 4300)/4300 > 0.965
const MOMENTS: [string, number][] = [
  ['shut',       4060],   // between syllables
  ['mid',        1180],
  ['wide',        228],   // near a syllable peak
  ['blink',      4200],   // inside the blink window
]

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 520, height: 560, deviceScaleFactor: 1 })

const shots: Buffer[] = []
for (const [name, t] of MOMENTS) {
  const url = `http://localhost:${port}/vtuber?frame=${t}${obs ? '&obs=1' : ''}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  // A drawn frame, or a loud failure. Never a picture of whatever happened to be there.
  // ⚠⚠ 3 FRAMES IS NOT A SETTLED POSE, AND THE FIRST VERSION OF THIS TOOL USED 3. The rig runs
  // every channel through an asymmetric smoother, so a pinned clock still needs ~10 frames to
  // converge on its target — and the shots taken at 3 showed a BLINK frame with the eyes still
  // open and a mouth short of its real opening. Nothing looked broken; the pictures were simply
  // of a moment between two poses. Same family as every under-settled screenshot in PATTERNS:
  // the instrument was early, and being early reads as the feature being wrong.
  await page.waitForFunction(
    () => (window as unknown as { __avatarDrawn?: number }).__avatarDrawn! > 40,
    { timeout: 15000 },
  ).catch(() => { throw new Error(`${name}: the compositor never ran — check the layer PNGs exist`) })
  const el = await page.$('canvas')
  if (!el) throw new Error(`${name}: no canvas on the page`)
  shots.push(Buffer.from(await el.screenshot({ omitBackground: obs })))
  console.log(`  shot ${name} @ t=${t}ms`)
}
await browser.close()

// Stitch with sharp-free arithmetic: write the frames and let the caller montage them.
const { writeFileSync } = await import('node:fs')
MOMENTS.forEach(([name], i) => writeFileSync(out.replace('.png', `-${name}.png`), shots[i]))
console.log(`✅ wrote ${MOMENTS.length} frames as ${out.replace('.png', '-<moment>.png')}`)
