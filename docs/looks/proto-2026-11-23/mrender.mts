// node_modules/.bin/tsx docs/looks/proto-2026-11-23/mrender.mts <glb> <out.png> [cfg-json]   (take `tools/coord.sh browser up` first)
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
const dir = 'docs/looks/proto-2026-11-23', [glb, out, cfgArg] = process.argv.slice(2)
const cfg = { emissive: '#ff9fb2', emI: 0.18, glow: '#ffe0e6', frillEm: '#ff6f9c', frillI: 1.0, pulse: 1, ...(cfgArg ? JSON.parse(cfgArg) : {}) }
const js = execSync(`node_modules/.bin/esbuild ${dir}/mentry.ts --bundle --format=iife --alias:three=${process.cwd()}/node_modules/three --log-level=error`, { maxBuffer: 1 << 26 }).toString()
const ref = 'data:image/png;base64,' + readFileSync('public/grimoire/manalotl.png').toString('base64')
const cell = (lab: string, inner: string) => `<div class=c><b>${lab}</b>${inner}</div>`
const html = `<html><body style="margin:0;background:#120c06;font:13px sans-serif;color:#f0dcd0">
<style>.r{display:flex}.c{width:520px;height:540px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#1d1a17}.c b{position:absolute;top:4px;left:8px;z-index:2}canvas,img{display:block}</style>
<div class=r>${cell('concept (public/grimoire/manalotl.png)', `<img src="${ref}" width=520 height=520>`)}${cell('game-ready, front', '<canvas id=front></canvas>')}${cell('3/4', '<canvas id=tq></canvas>')}</div>
<div class=r>${cell('side', '<canvas id=side></canvas>')}${cell('close face', '<canvas id=face></canvas>')}${cell('concept face', `<img src="${ref}" style="position:absolute;width:1000px;height:1000px;left:-170px;top:-150px">`)}</div>
<script>window.__glb=${JSON.stringify(readFileSync(glb).toString('base64'))};window.__cfg=${JSON.stringify(cfg)}</script><script>${js}</script></body></html>`
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.setViewport({ width: 1560, height: 1080 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.setContent(html); await p.waitForFunction('window.__done', { timeout: 120000 }).catch(() => {})
console.log('tris', await p.evaluate('window.__tris'), 'errors', errs.slice(0, 5))
await p.screenshot({ path: out }); await b.close()
