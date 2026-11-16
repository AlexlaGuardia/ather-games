// Shots of the companions preview (/shimmer/open/preview/companions): npx tsx scripts/crystal-shot.mts <outdir> [query…]  (URL=)
import puppeteer from 'puppeteer-core'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const out = process.argv[2], kinds = process.argv.slice(3)
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 700 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
const shots: [string, string][] = kinds.length ? kinds.flatMap(k => [[k.replace(/[=&]/g, "_"), k]] as [string, string][]) : [['walk', ''], ['still', 'still=1'], ['night', 'hour=22'], ['dig-close', 'id=gemdigger&still=1'], ['mite-close', 'id=glowmite&hour=22']]
for (const [name, qs] of shots) {
  await p.goto(`${process.env.URL ?? 'http://localhost:3202'}/shimmer/open/preview/companions?${qs}`, { waitUntil: 'load', timeout: 240000 }); await wait(9000)
  await p.screenshot({ path: `${out}/companion-${name}.png` }); console.log('shot', name)
}
if (errs.length) console.log(errs.slice(0, 4).join('\n')); await b.close()
