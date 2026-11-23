// node_modules/.bin/tsx docs/looks/keeper-heads-2026-11-23/render2.mts <out.png>   (run under the box browser lock)
import puppeteer from 'puppeteer-core'
import { execSync } from 'node:child_process'
const dir = 'docs/looks/keeper-heads-2026-11-23', out = process.argv[2]
const js = execSync(`node_modules/.bin/esbuild ${dir}/entry2.ts --bundle --format=iife --alias:three=${process.cwd()}/node_modules/three --log-level=error`, { maxBuffer: 1 << 26 }).toString()
const MOUTHS = [['M1', '1 Neutral line'], ['M2', '2 Slight smile'], ['M3', '3 Soft full lips'], ['M4', '4 Smirk'], ['M5', '5 Closed calm']]
const TORSOS = [['T0', 'TODAY Curved', 'widest at the bottom, round belly: reads young'], ['T1', 'T1 Defined waist', 'new lathe: hips = shoulders, waist in, tapers to the legs; torso length 0.88 to 1.0'],
  ['T2', 'T2 Tall slim', 'new lathe: shoulders wider than hips; torso length 1.08, width 0.92'], ['T3', 'T3 Shaped (mesh)', 'T1 + a side profile: chest forward, hips back, flat belly']]
const cv = (id: string) => `<canvas id="${id}"></canvas>`
const gcrop = (id: string, cls: string) => `<div class="c g ${cls}"><div class=crop>${cv(id)}</div></div>`
const mrow = ([k, lab]: string[]) => `<div class=row><div class=lab>${lab}</div>${['A', 'D'].map(f => ['m', 'f'].map(s => `<div class=c><i>${f} ${s === 'm' ? 'male' : 'female'}</i>${cv(`m-${k}-${f}-${s}`)}</div>`).join('')).join('')}${gcrop(`m-${k}-game`, 'mg')}</div>`
const trow = ([k, lab, note]: string[]) => `<div class=row><div class=lab>${lab}<small>${note}</small></div>${['front', 'side', 'tq'].map(v => `<div class=c><i>${v === 'tq' ? '3/4' : v}</i>${cv(`t-${k}-${v}`)}</div>`).join('')}${gcrop(`t-${k}-game`, 'tg')}</div>`
const html = `<html><body style="margin:0;background:#1a120a;font:14px sans-serif;color:#efe0bc">
<style>.row{display:flex;align-items:stretch;margin:4px 0}.lab{width:170px;padding:8px;font-weight:bold;font-size:16px}.lab small{display:block;font-weight:normal;font-size:12px;margin-top:6px;color:#c8b48c}.c{position:relative;margin:0 3px}.c i{position:absolute;top:3px;left:6px;font-size:11px;color:#5a4630;z-index:2}.crop{overflow:hidden}.mg .crop{width:390px;height:200px}.mg canvas{margin:-250px 0 0 0}.tg .crop{width:260px;height:330px}.tg canvas{margin:-280px 0 0 -65px}h2{margin:10px}p{margin:0 10px 6px;color:#c8b48c}</style>
<h2>M116b MOUTH options (PROTO): faces A Soft + D Strong, close and at game distance (3 m, 1:1 phone px)</h2>
<p>Columns: A male, A female, D male, D female, then the four at 3 m. Lip tint = the skin pulled toward a muted rose.</p>
${MOUTHS.map(mrow).join('')}
<h2>M116b FEMALE TORSO options (PROTO): medium Curved, universal head + face A</h2>
<p>Columns: front, side, 3/4, then game distance (5 m) next to the medium Broad male. Floating limbs unchanged. Bun hair here so the side profile shows (game-distance column keeps Long hair); hands hidden in the side view.</p>
${TORSOS.map(trow).join('')}
<script>${js}</script></body></html>`
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1800 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.setContent(html); await p.waitForFunction('window.__done', { timeout: 240000 }).catch(() => errs.push('timeout'))
console.log('errors', errs.slice(0, 5))
await p.screenshot({ path: out, fullPage: true }); await b.close()
