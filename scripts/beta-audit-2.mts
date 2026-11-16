// ── BETA AUDIT, pass 2: the stranger's first minutes after birth (2026-11-16, play lane) ─────────────────────────
// Fresh profile on a phone. Taps Play, taps BE BORN, then does what a stranger does: reads the screen, drags the
// left thumb, taps every HUD button (pack, map, options, friends, journal), and walks forward for a while.
// Writes a screenshot per beat + audit2.json (beats, on-screen text, errors, position deltas).
//   npx tsx scripts/beta-audit-2.mts [--url https://ather.games] [--out /tmp/beta2]
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/beta2')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.createBrowserContext()
const p = await ctx.newPage()
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const log: { t: number; kind: string; msg: string }[] = []
const t0 = Date.now(); const T = () => Math.round((Date.now() - t0) / 100) / 10
p.on('pageerror', e => log.push({ t: T(), kind: 'pageerror', msg: String(e).slice(0, 300) }))
p.on('console', m => { if (m.type() === 'error') log.push({ t: T(), kind: 'console.error', msg: m.text().slice(0, 300) }) })
p.on('response', r => { if (r.status() >= 400) log.push({ t: T(), kind: `http${r.status()}`, msg: r.url().slice(0, 200) }) })
const beats: Record<string, unknown>[] = []
const st = () => p.evaluate(() => { const s = (window as any).__ather?.state?.(); return s ? { x: Math.round(s.px * 10) / 10, z: Math.round(s.pz * 10) / 10, yaw: Math.round(s.yaw * 100) / 100 } : null }).catch(() => null)
const beat = async (name: string, extra: Record<string, unknown> = {}) => {
  await p.screenshot({ path: `${out}/${String(beats.length).padStart(2, '0')}-${name}.png` }).catch(() => {})
  const panels = await p.evaluate(() => [...document.querySelectorAll('[data-panel]')].map(e => e.getAttribute('data-panel'))).catch(() => [])
  const text = await p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 900)).catch(() => '?')
  beats.push({ t: T(), name, panels, pos: await st(), text, ...extra })
  console.log(`[${T()}s] ${name} panels=${JSON.stringify(panels)} pos=${JSON.stringify(await st())} ${JSON.stringify(extra)}`)
}
// tap the smallest VISIBLE element whose own text matches (a button, not its container)
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.touchscreen.tap(box.x, box.y); return true
}
const drag = async (x0: number, y0: number, dx: number, dy: number, ms: number) => {
  await p.touchscreen.touchStart(x0, y0)
  const n = Math.max(4, Math.round(ms / 100))
  for (let i = 1; i <= n; i++) { await p.touchscreen.touchMove(x0 + dx * Math.min(1, i / 4), y0 + dy * Math.min(1, i / 4)); await sleep(100) }
  await p.touchscreen.touchEnd()
}

await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }).catch(() => {})
await sleep(4000); await beat('birth-gate')
await beat('tap-born', { tapped: await tapText(/^BE BORN/) })
for (let i = 1; i <= 4; i++) { await sleep(3000); await beat(`after-born-${i * 3}s`) }
// the left thumb, forward for 4 s
const before = await st()
await drag(90, 700, 0, -70, 4000); await sleep(500)
await beat('thumb-forward', { from: before })
await drag(90, 700, 70, 0, 2500); await sleep(500)
await beat('thumb-right')
// look: drag on the right half
await drag(300, 500, -80, 0, 1200); await beat('look-drag')
for (const [name, re] of [['pack', /PACK$/], ['map', /MAP$/], ['options', /OPTIONS$/], ['friends', /FRIENDS$/], ['journal', /JOURNAL$/]] as const) {
  const tapped = await tapText(re); await sleep(2500); await beat(`hud-${name}`, { tapped })
  // a phone has no Escape: does a close/× exist?
  const closeTapped = await tapText(/^(×|✕|close|back|done)$/); await sleep(800)
  if (closeTapped) await beat(`hud-${name}-closed`, { closeTapped })
}
// a long walk forward: does a stranger reach anything?
for (let i = 1; i <= 3; i++) { await drag(90, 700, 0, -70, 8000); await beat(`walk-${i}`) }
writeFileSync(`${out}/audit2.json`, JSON.stringify({ url, beats, log }, null, 1))
console.log('errors:', JSON.stringify(log.slice(0, 15), null, 1))
await b.close()
