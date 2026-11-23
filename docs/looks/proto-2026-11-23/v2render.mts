// node --experimental-strip-types? no: run with node_modules/.bin/tsx docs/looks/proto-2026-11-23/v2render.mts <out.png> [yawF]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const dir = 'docs/looks/proto-2026-11-23', out = process.argv[2], yaw = process.argv[3] ?? '-0.22'
const js = execSync(`node_modules/.bin/esbuild ${dir}/v2entry.ts --bundle --format=iife --alias:three=${process.cwd()}/node_modules/three --log-level=error`, { maxBuffer: 1 << 26 }).toString()
const ref = 'data:image/png;base64,' + readFileSync('public/grimoire/vulnyx.png').toString('base64')
const cell = (lab: string, inner: string) => `<div class=c><b>${lab}</b>${inner}</div>`
const html = `<html><body style="margin:0;background:#120c06;font:13px sans-serif;color:#e8d8b0">
<style>.r{display:flex}.c{width:520px;height:540px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#20160b}.c b{position:absolute;top:4px;left:8px;z-index:2}canvas,img{display:block}</style>
<div class=r>${cell('concept (public/grimoire/vulnyx.png)', `<img src="${ref}" width=520 height=520>`)}${cell('v2 model, concept angle', '<canvas id=front></canvas>')}${cell('v2 model, 3/4', '<canvas id=tq></canvas>')}</div>
<div class=r>${cell('concept face', `<img src="${ref}" style="position:absolute;width:1100px;height:1100px;left:-158px;top:-158px">`)}${cell('v2 face', '<canvas id=face></canvas>')}${cell('game distance, 1:1 phone px (390 wide; keeper 1.70 m, cam back 6.6 up 2.4 fov 64)', '<div style="width:390px;height:520px;overflow:hidden"><canvas id=game style="margin-top:-250px"></canvas></div>')}</div>
<script>window.__yawF=${Number(yaw)}</script><script>${js}</script></body></html>`
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.setViewport({ width: 1560, height: 1080 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.setContent(html); await p.waitForFunction('window.__done', { timeout: 120000 }).catch(() => {})
console.log('tris', await p.evaluate('window.__tris'), 'errors', errs.slice(0, 5))
await p.screenshot({ path: out }); await b.close()
