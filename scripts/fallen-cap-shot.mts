// Shots of the Fallen Cap preview (/shimmer/open/preview/fallen-cap): npx tsx scripts/fallen-cap-shot.mts <outdir>  (URL= to point elsewhere)
import puppeteer from 'puppeteer-core'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.setViewport({ width: 1100, height: 750 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
for (const [name, qs] of (process.env.ONLY ? [['eye', 'hour=12&az=20&eye=1'], ['back', 'hour=12&az=200&eye=1']] : [['day', 'hour=12&az=25'], ['back', 'hour=12&az=200'], ['night', 'hour=22&az=25'], ['low', 'hour=12&az=60&far=1'], ['eye', 'hour=12&az=20&eye=1'], ['eyenight', 'hour=22&az=-20&eye=1']])) {
  await p.goto(`${process.env.URL ?? "http://localhost:3202"}/shimmer/open/preview/fallen-cap?${qs}`, { waitUntil: 'load', timeout: 240000 }); await wait(9000)
  await p.screenshot({ path: `${process.argv[2]}/cap-${name}.png` }); console.log('shot', name)
}
console.log(errs.slice(0, 5).join('\n')); await b.close()
