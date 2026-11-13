// ── Screenshot the Darter on its test track, mid-manoeuvre ─────────────────────────────────────────
// Run: npx tsx scripts/drive-shot.mts <out.png> [--port 3204] [--tp "x,z,yaw,speed"] [--input '{"throttle":1}']
//                                    [--drive 1500] [--until 'st.airborne && st.airT > 0.3'] [--cam chase|hood] [--hour 13]
//
// Places the car with the page's `__drive.tp`, holds a scripted input for --drive ms, then shoots. Software
// GL (SwiftShader) like world-shot.mts, so frame RATES from this box mean nothing, and a "drive 1500ms"
// covers less sim time than 1.5 s when frames are slow (the sim caps a frame's catch-up at 0.1 s).
// Prints the car's state at the shutter so a picture can be checked against the numbers.

import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const flag = (n: string, d: string) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] }
const out = args.find(a => a.endsWith('.png')) ?? 'drive-shot.png'
const port = flag('--port', '3204')
const tp = flag('--tp', '')
const input = flag('--input', '')
const driveMs = Number(flag('--drive', '0'))
const cam = flag('--cam', 'chase')

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: Number(flag('--width', '1280')), height: Number(flag('--height', '760')) })
  const hour = flag('--hour', '')
  const res = await page.goto(`http://localhost:${port}/shimmer/open/drive${hour ? `?hour=${hour}` : ''}`, { waitUntil: 'load', timeout: 120000 })
  if (!res || res.status() !== 200) { console.error(`✗ answered ${res?.status()}`); process.exit(1) }
  await page.waitForFunction('!!window.__drive', { timeout: 60000 })
  await page.keyboard.press('ShiftLeft')   // dismiss the start card (any key)
  await page.evaluate((tp: string, cam: string) => {
    const d = (window as unknown as { __drive: { tp: (...a: number[]) => void; cam: (m: string) => void } }).__drive
    if (tp) d.tp(...tp.split(',').map(Number))
    d.cam(cam)
  }, tp, cam)
  await new Promise(r => setTimeout(r, 1500))
  if (input) await page.evaluate((i: string) => (window as unknown as { __drive: { input: (v: unknown) => void } }).__drive.input(JSON.parse(i)), input)
  await new Promise(r => setTimeout(r, Math.max(300, driveMs)))
  // --until 'st.airborne && st.airT > 0.3': hold the input until the car's state says so (frame timing on
  // software GL is too uneven to catch a jump by a fixed delay). Gives up after 20 s and shoots anyway.
  const until = flag('--until', '')
  if (until) {
    await page.waitForFunction(`(() => { const st = window.__drive.state(); return ${until} })()`, { timeout: 20000, polling: 16 })
      .catch(() => console.error(`⚠ --until never held: ${until}`))
  }
  const st = await page.evaluate(() => (window as unknown as { __drive: { state: () => Record<string, number | boolean> } }).__drive.state())
  await page.screenshot({ path: out })
  const n = (v: unknown) => typeof v === 'number' ? v.toFixed(2) : String(v)
  console.log(`shot → ${out}  ·  x ${n(st.x)} y ${n(st.y)} z ${n(st.z)} · fwd ${n(st.fwd)} lat ${n(st.lat)} · slip ${n((st.slip as number) * 57.3)}° · air ${n(st.airborne)}`)
} finally {
  await browser.close()
}
