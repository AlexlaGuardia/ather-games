// M225 scout: what the keeper body bench shows on prod (desk 1440x900 + phone 390x844). Read-only, owner.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const url = 'https://ather.games', KEY = process.env.OWNER_KEY, DIR = process.argv[2] ?? 'docs/looks/m225-2026-11-27'
mkdirSync(DIR, { recursive: true })
const br = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'phone']] as const) {
  const p = await br.newPage(); await p.setViewport({ width: w, height: h })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'load', timeout: 120000 })
  await p.goto(`${url}/shimmer/dev/keeper-body`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-pick="face-0"], [data-pick="head-0"]', { timeout: 240000 }); await new Promise(r => setTimeout(r, 3000))
  const info = await p.evaluate(() => { const c = document.querySelector('canvas')!.getBoundingClientRect(); return { canvas: [c.x, c.y, c.width, c.height], dials: document.querySelectorAll('[data-dial]').length, head: document.querySelector('[data-picker="head"] [data-on="1"]')?.textContent, face: !!document.querySelector('[data-picker="face"]') } })
  console.log(tag, JSON.stringify(info))
  await p.screenshot({ path: `${DIR}/before-${tag}.png` })
  await p.close()
}
await br.close()
