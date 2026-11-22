// M95 load-screen images: in-engine screenshots (no art) of existing scenes, webp ~1600 px wide, into public/shimmer/load/.
// Run against a lane dev server:  npx tsx scripts/load-shots.mts [--url http://localhost:3204] [--out public/shimmer/load]
// Ather shots reuse ather-paths-shot.mts's boot (born rune, KHR_parallel_shader_compile hidden so the ground draws on SwiftShader).
// Post-crop (by hand, sharp extract): top 165 px (minimap) off; Wilds shots also lose the bottom (first-person gloves). The HUD has no off switch, so the bottom 14% is left to the plate and shots are taken from elevated angles; look at them.
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { GLADE_GREEN } from '../src/app/shimmer/open/ather/moonwell'
import { clusterFrame } from '../src/app/shimmer/open/ather/cluster'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3204'), out = flag('--out', 'public/shimmer/load'), raw = '/tmp/load-shots-raw'
mkdirSync(out, { recursive: true }); mkdirSync(raw, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const W = 1600, H = 900, errs: string[] = [], shots: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.evaluateOnNewDocument(() => { for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) { const g = C.prototype.getExtension; C.prototype.getExtension = function (this: WebGLRenderingContext, n: string) { return n === 'KHR_parallel_shader_compile' ? null : g.call(this, n) } } })
const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => { const t = d.textContent ?? ''; return t.includes('Click to play') || (t.includes('THE DARTER') && t.includes('Press any key')) }); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
// no HUD flag exists: hide every DOM node that is not the canvas (or holds it); Escape opens Options, which freezes the
// first-person hands (ather/page.tsx frozen) so the gloves are not in the shot
const bare = () => p.evaluate(() => { if (document.getElementById('bare')) return; const st = document.createElement('style'); st.id = 'bare'; st.textContent = 'body *:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}'; document.head.appendChild(st) })
async function save(name: string) {
  await bare(); await sleep(700); await hideCard(); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.screenshot({ path: `${raw}/${name}.png` })
  let q = 78, buf = Buffer.alloc(0)
  for (; q >= 40; q -= 8) { buf = await sharp(`${raw}/${name}.png`).resize(1600).webp({ quality: q }).toBuffer(); if (buf.length < 250_000) break }
  await sharp(buf).toFile(`${out}/${name}.webp`); shots.push(`${name} q${q} ${(buf.length / 1024) | 0}KB`)
}
// Ather: stand `back` m from (tx,tz) toward (fx,fz), `up` m over the ground, pitch down at it
async function shoot(name: string, tx: number, tz: number, fx: number, fz: number, back: number, up: number, pitchOverride?: number) {
  const l = Math.hypot(tx - fx, tz - fz) || 1, ux = (tx - fx) / l, uz = (tz - fz) / l
  const x = tx - ux * back, z = tz - uz * back, yaw = Math.atan2(-ux, -uz), pitch = pitchOverride ?? -Math.atan2(up, back)
  const place = () => p.evaluate((a: number, b: number, c: number, d: number, u: number) => { const g = (window as any).__ather; g.combat?.().hollows && (g.combat().hollows.length = 0); g.tp(a, b, c, g.ground(a, b) + u); g.look(c, d) }, x, z, yaw, pitch, up)
  await p.waitForFunction(() => !!(window as any).__ather?.tp, { timeout: 240000 }); await place(); await sleep(4000)
  await p.waitForFunction(() => { const g = (window as any).__groundPending; return !g || g() === 0 }, { timeout: 180000, polling: 500 }).catch(() => errs.push(`${name}: ground still building`))
  await sleep(1500); await p.keyboard.press('Escape'); await hideCard(); await p.waitForFunction(() => !!(window as any).__ather?.tp, { timeout: 120000 }); await place(); await save(name)
}
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000)
{ const m = clusterFrame(null, []).middle!; await shoot('ather-green', m.x, m.z, m.x + 20, m.z - 20, 22, 16) }
await p.goto(`${url}/shimmer/open/ather?hour=17&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(6000)
await shoot('wilds-seam', -500, 290, -470, 300, 14, 12)
await shoot('glade', GLADE_GREEN.x, GLADE_GREEN.z + GLADE_GREEN.r + 4, GLADE_GREEN.x + 10, GLADE_GREEN.z + GLADE_GREEN.r + 24, 20, 16)
await shoot('wilds-sky', GLADE_GREEN.x, GLADE_GREEN.z, GLADE_GREEN.x + 30, GLADE_GREEN.z + 30, 24, 10, 0.18)
// Nyx continent streets
await p.goto(`${url}/shimmer/open/continent?hour=15`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.stance, { timeout: 240000 }); await sleep(4000); await p.keyboard.press('Escape')
for (const [n, x, z, yaw] of [['nyx-street-a', 244, 31, 0]] as const) {
  await p.evaluate((a, b, c) => (window as any).__drive.footTp(a, b, c), x, z, yaw); await sleep(5000); await save(n)
}
console.log(JSON.stringify({ shots, errs })); await br.close(); process.exit(0)
