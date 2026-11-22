// M95 proof: the LoadScreen at 390x844, caught on the continent's own `!R` wait. npx tsx scripts/load-screen-proof.mts [url] [out.png]
import puppeteer from 'puppeteer-core'
const url = process.argv[2] ?? 'http://localhost:3204', out = process.argv[3] ?? 'docs/handoff/m95-load-screen-390.png'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${url}/shimmer/open/continent?hour=15`, { waitUntil: 'domcontentloaded', timeout: 240000 })
await p.waitForSelector('[data-load-screen]', { timeout: 120000 }); await new Promise(r => setTimeout(r, 150))
await p.screenshot({ path: out }); console.log('shot', out); await br.close()
