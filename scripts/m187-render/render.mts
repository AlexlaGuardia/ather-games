// M187: renders the Dewbear run flipbook. Serve a dir holding this index.html + a `three` link to node_modules/three +
// dewbear-rigged.glb (python3 -m http.server PORT), then: npx tsx scripts/m187-render/render.mts PORT OUTDIR -1
// -> 12 PNG frames (256 px, facing right); they were cropped to their union box, scaled to 120 px tall and laid side by
// side into public/open/load/dewbear-run.webp (PIL, webp q86).
import puppeteer from 'puppeteer-core'
import { writeFileSync, mkdirSync } from 'fs'
const [port, outDir, side] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); p.on('pageerror', e => console.log('ERR', String(e))); p.on('console', m => console.log('console', m.text()))
await p.goto(`http://127.0.0.1:${port}/index.html?n=12&side=${side ?? '-1'}`)
await p.waitForFunction('window.__frames', { timeout: 60000 })
const { frames, info } = await p.evaluate(() => ({ frames: (window as any).__frames as string[], info: (window as any).__info }))
console.log(JSON.stringify(info))
frames.forEach((d, i) => writeFileSync(`${outDir}/f${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')))
await br.close()
