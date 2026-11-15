// ── Check for the Passage gun shop + test lane (2026-11-15, play lane) ──────────────────────────────────────────
// Stands a walker in the shop, takes each rack's gun, fires down the lane, and checks that rounds fly, plates take
// hits and the hotbar shows the gun. Screenshots to --out.   npx tsx scripts/gun-check.mts [--url] [--out dir]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__drive && !!(window as any).__range, { timeout: 180000 })
await sleep(3000); await p.keyboard.press('KeyW'); await sleep(2000)
const shop = await p.evaluate(() => (window as any).__range.shop())
// stand on the shop side of the firing line, 1.5 m back, looking down the lane
const yaw = Math.atan2(-shop.down.x, -shop.down.z), sx = shop.line.x - shop.down.x * 1.5, sz = shop.line.z - shop.down.z * 1.5
const res: Record<string, unknown> = {}
// look down the lane from mid-way and back at the shop from the line
for (const [n, m, back] of [["lane-mid", 12, false], ["shop-from-line", 1, true]] as const) {
  const x = shop.line.x + shop.down.x * m, z = shop.line.z + shop.down.z * m
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.04), x, z, back ? yaw + Math.PI : yaw); await sleep(3500)
  await p.screenshot({ path: `${out}/gun-look-${n}.png` })
}
for (const [i, slate] of ['SIDEARM', 'SHORTBARREL', 'LONGBARREL', 'BREACHER', 'REACHER'].entries()) {
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.02), sx, sz, yaw)
  await sleep(1500)
  await p.evaluate(s => (window as any).__range.take(s), slate)
  const before = await p.evaluate(() => (window as any).__range.state())
  await p.evaluate(() => (window as any).__range.fire(true))
  // poll: swiftshader runs slow, never trust a fixed frame count
  let mid: any = null
  for (let k = 0; k < 40; k++) { await sleep(150); mid = await p.evaluate(() => (window as any).__range.state()); if (mid.rounds > 0) break }
  await sleep(120)
  await p.screenshot({ path: `${out}/gun-${i + 1}-${slate.toLowerCase()}.png` })
  await sleep(slate === 'SHORTBARREL' ? 1500 : 300)
  await p.evaluate(() => (window as any).__range.fire(false))
  await sleep(3500)
  const after = await p.evaluate(() => (window as any).__range.state())
  const hot = await p.evaluate(() => [...document.querySelectorAll('[data-hud="hotbar"] img')].map(i => (i as HTMLImageElement).src.split('/').pop()))
  const msgs = await p.evaluate(() => [...document.querySelectorAll('[data-hud="messages"] > div')].map(d => d.textContent))
  res[slate] = { held: after.held, ammoUsed: before.ammo - after.ammo, flew: mid.rounds, hits: after.hits.reduce((a: number, h: number) => a + h, 0) - before.hits.reduce((a: number, h: number) => a + h, 0), hotbar: hot, msgs: msgs.slice(-2) }
}
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
await b.close()
