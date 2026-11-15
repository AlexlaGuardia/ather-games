// Ground-cover preview shots (2026-11-15, world): the same views of the cluster preview with each ?cover= (none /
// tufts / meadow / lush), tiles + toon ground. npx tsx scripts/cover-shot.mts <outdir> [cover,...]
// Software GL: ~2 min a view. ⚠ The intro card is hidden by its INNERMOST div only (the page root also contains the text).
import puppeteer from 'puppeteer-core'
const out = process.argv[2], covers = (process.argv[3] ?? 'none,tufts,meadow,lush').split(',')
const VIEWS: [string, number, number, number][] = [['valley', -186, 168, Math.PI / 2], ['plot', -112, 116, Math.PI * 0.75]]
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = []
for (const cover of covers) {
  const p = await b.newPage(); await p.setViewport({ width: 1100, height: 680 })
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' || /shader|program/i.test(t)) errs.push(`${cover}: ${t.slice(0, 200)}`) })
  p.on('pageerror', e => errs.push(`${cover} pageerror: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`https://ather.games/shimmer/open/ather?hour=15&cluster=preview&cover=${cover}`, { waitUntil: 'load', timeout: 120000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2500)
  await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  for (const [name, x, z, yaw] of VIEWS) {
    await p.evaluate((x, z, y) => (window as any).__ather.tp(x, z, y), x, z, yaw); await sleep(3500)
    for (let k = 0; k < 2; k++) { try { await p.screenshot({ path: `${out}/cover-${cover}-${name}.png` }); break } catch { errs.push(`${cover} ${name}: screenshot ${k ? 'failed' : 'retry'}`) } }
  }
  await p.close()
}
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close()
