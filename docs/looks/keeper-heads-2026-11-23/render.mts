// node_modules/.bin/tsx docs/looks/keeper-heads-2026-11-23/render.mts <out.png>   (run under the box browser lock)
import puppeteer from 'puppeteer-core'
import { execSync } from 'node:child_process'
const dir = 'docs/looks/keeper-heads-2026-11-23', out = process.argv[2]
const js = execSync(`node_modules/.bin/esbuild ${dir}/entry.ts --bundle --format=iife --alias:three=${process.cwd()}/node_modules/three --log-level=error`, { maxBuffer: 1 << 26 }).toString()
const ROWS: [string, string][] = [['T', 'TODAY (live head, per-model size, Round eyes)'], ['A', 'A  Soft almond'], ['B', 'B  Keen'], ['C', 'C  Calm'], ['D', 'D  Strong']]
const cv = (id: string) => `<canvas id="${id}"></canvas>`
const row = ([k, lab]: [string, string]) => `<div class=row><div class=lab>${lab}</div>
${['m', 'f'].map(s => ['front', 'tq'].map(v => `<div class=c><i>${s === 'm' ? 'male' : 'female'} ${v === 'tq' ? '3/4' : 'front'}</i>${cv(`${k}-${s}-${v}`)}</div>`).join('')).join('')}
<div class="c g"><i>game distance, 5 m, 1:1 phone px</i><div class=crop>${cv(`${k}-game`)}</div></div></div>`
const html = `<html><body style="margin:0;background:#1a120a;font:14px sans-serif;color:#efe0bc">
<style>.row{display:flex;align-items:stretch;margin:4px 0}.lab{width:150px;padding:8px;font-weight:bold;font-size:16px}.c{position:relative;margin:0 3px}.c i{position:absolute;top:3px;left:6px;font-size:11px;color:#5a4630;z-index:2}.g i{color:#123}.crop{width:260px;height:260px;overflow:hidden}.crop canvas{margin:-300px 0 0 -65px}h2{margin:6px 10px}.six{display:flex;flex-direction:column;margin-left:150px}</style>
<h2>M116 keeper heads, take 2: one head size, adult faces (PROTO)</h2>
${ROWS.map(row).join('')}
<div class=six><i>six models, small/medium/large x broad/curved. Top: today's per-model heads. Bottom: the universal head (headW 0.78, headH 0.76) with face A.</i>${cv('six-today')}${cv('six-uni')}</div>
<script>${js}</script></body></html>`
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.setViewport({ width: 1520, height: 1980 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.setContent(html); await p.waitForFunction('window.__done', { timeout: 180000 }).catch(() => errs.push('timeout'))
console.log('errors', errs.slice(0, 5))
await p.screenshot({ path: out, fullPage: true }); await b.close()
