// Ground-look A/B shots (2026-11-15, world): the same two views of the cluster preview in each look (flat / toon /
// tiles), plus any shader or page error. npx tsx scripts/look-shot.mts <outdir>
import puppeteer from 'puppeteer-core'
const out = process.argv[2]
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = []
for (const look of ['flat', 'toon', 'tiles']) {
  const p = await b.newPage(); await p.setViewport({ width: 1100, height: 680 })
  p.on('console', m => { const t = m.text(); if (/error|shader|program/i.test(t)) errs.push(`${look}: ${t.slice(0, 200)}`) })
  p.on('pageerror', e => errs.push(`${look} pageerror: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('ather.look') })
  await p.goto(`https://ather.games/shimmer/open/ather?hour=15&cluster=preview&look=${look}`, { waitUntil: 'load', timeout: 120000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2500)
  // the desktop intro card stands while the pointer is unlocked, and headless cannot lock it: hide it for the shot
  // ⚠ only the INNERMOST match: the page root also 'contains' the text, and hiding it blacks out the canvas (11-15)
  await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); const inner = hits.filter(d => !hits.some(o => o !== d && d.contains(o))); for (const d of inner) (d as HTMLElement).style.visibility = 'hidden' })
  for (const [name, x, z, yaw] of [['valley', -150, 150, Math.PI * 0.75], ['ridge', -160, 40, Math.PI / 2], ['close', -138, 132, Math.PI * 0.6]] as const) {
    await p.evaluate((x, z, y) => (window as any).__ather.tp(x, z, y), x, z, yaw); await sleep(3000)
    for (let k = 0; k < 2; k++) { try { await p.screenshot({ path: `${out}/look-${look}-${name}.png` }); break } catch (e) { errs.push(`${look} ${name}: screenshot ${k ? 'failed' : 'retry'}`) } }
  }
  await p.close()
}
console.log(errs.length ? errs.join('\n') : 'no shader/page errors')
await b.close()
