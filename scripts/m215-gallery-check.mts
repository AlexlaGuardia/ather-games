// BETA M215 + the two M213 gallery bugs, OWNER (/shimmer/dev gate), 1440x900 (SwiftShader). /shimmer/dev?mode=spirits:
//  1 CLICKING a dial row selects it (M213 bug 1: the dial's pointer capture ate the row's click)
//  2 a quick run of switches (10 spirits, glow pills, clips) leaves ONE WebGL context made and live (M213 bug 2: a canvas + context
//    per spirit, the old one lost only 500 ms after unmount, stacked up on Alex's desktop GPU until the tab died), and 0 page errors
//  3 Voltbear (M215): every clip mounts, her body hangs off the ground (idle / walk / run high, sit / lie low, never on it)
//  4 Tidebear (M215): every clip mounts, her lowest point stays on the ground (never floats), walk = the walk clip
//   OWNER_KEY=... npx tsx scripts/m215-gallery-check.mts [--shots dir] [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1440, height: 900 })
p.on('pageerror', e => errs.push(String(e).slice(0, 240)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await p.evaluateOnNewDocument(() => { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
  // count every WebGL context the page makes, and keep them to ask which are still live
  const W = window as any; W.__gl = []; const g = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: string, o?: unknown) { const c = (g as any).call(this, t, o); if (c && /webgl/.test(t) && !W.__gl.includes(c)) W.__gl.push(c); return c } as any })
const num = (name: string) => GALLERY.find(r => r.name.toLowerCase() === name)!.num
const sel = () => p.evaluate(() => Number(document.querySelector('[data-gallery-row][data-selected="1"]')?.getAttribute('data-gallery-row') ?? 0))
const gl = () => p.evaluate(() => { const L = (window as any).__gl as WebGLRenderingContext[]; return { made: L.length, live: L.filter(c => !c.isContextLost()).length, canvases: document.querySelectorAll('[data-spirit-gallery] canvas').length } })
async function goto(n: number) {
  await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${n}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-spirit-gallery]', { timeout: 120000 }); await sleep(800)
}
/** the gallery's body once her glb is up: her lowest and highest skinned body point (m, over 20 frames), the clip at full weight */
const probe = (u: string) => p.evaluate(async (u: string) => {
  const W = window as any, raf = () => new Promise(r => requestAnimationFrame(r))
  for (let k = 0; k < 900; k++) { const g = W.__spiritModel?.rigs?.get('gallery'); if (g && W.__spiritModel?.urls?.[u] && g.body.meshes.body.geometry.getAttribute('position').count) break; await new Promise(r => setTimeout(r, 100)) }
  const r = W.__spiritModel?.rigs?.get('gallery'); if (!r) return null
  for (let f = 0; f < 50; f++) await raf()
  let lo = 1e9, hi = -1e9, lo2 = -1e9
  for (let f = 0; f < 20; f++) { await raf(); const b = r.body, ps = b.meshes.body.geometry.getAttribute('position'), V = b.bones[0].position.clone(); let l = 1e9
    for (let i = 0; i < ps.count; i += 2) { b.at('body', i, V); l = Math.min(l, V.y); hi = Math.max(hi, V.y) } lo = Math.min(lo, l); lo2 = Math.max(lo2, l) }
  const st = r.body.state(); return { lo, lo2, hi, clip: st.clip, w: st.w, url: Object.keys(W.__spiritModel.urls).filter(k => W.__spiritModel.urls[k]) }
}, u)
const shot = async (n: string) => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }) }

// 1 a click on a dial row selects it
await goto(1)
const tgt = await p.evaluate(() => { const r = document.querySelector('[data-gallery-row="3"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
await p.mouse.click(tgt.x, tgt.y); await sleep(500)
ok(await sel() === 3, `1 click on row 3 selects it (selected ${await sel()})`)
const tgt2 = await p.evaluate(() => { const r = document.querySelector('[data-gallery-row="1"]')!.getBoundingClientRect(); return { x: r.left + 120, y: r.top + r.height / 2 } })
await p.mouse.click(tgt2.x, tgt2.y); await sleep(500)
ok(await sel() === 1, `1 click back up on row 1 selects it (selected ${await sel()})`)

// 2 ten quick switches (each with a glow pill and a clip), then settle: one context made, one live
const g0 = await gl()
for (let k = 0; k < 10; k++) {
  await p.keyboard.press('ArrowDown'); await sleep(120)
  await p.evaluate((k: number) => { (document.querySelector(`[data-gallery-glow="${['earth', 'storm', 'water', 'mana', 'none'][k % 5]}"]`) as HTMLElement | null)?.click() }, k); await sleep(80)
  await p.evaluate((k: number) => { (document.querySelector(`[data-gallery-clip="${['walk', 'run', 'sit', 'lie', 'idle'][k % 5]}"]`) as HTMLElement | null)?.click() }, k); await sleep(100)
}
await sleep(2500); const g1 = await gl()
ok(g1.made === 1 && g1.live === 1 && g1.canvases === 1, `2 after 10 quick switches: ${g1.made} WebGL context(s) made, ${g1.live} live, ${g1.canvases} canvas (before: ${g0.made} made)`)

// 3 Voltbear hovers: every clip, her lowest point off the ground
const clipAll = async (name: string) => {
  await goto(num(name)); const out: Record<string, Awaited<ReturnType<typeof probe>>> = {}
  for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) { await p.click(`[data-gallery-clip="${c}"]`); await sleep(1200); out[c] = await probe(`/open/spirits/${name}-rigged.glb`); await shot(`${name}-${c}`) }
  return out
}
const v = await clipAll('voltbear')
for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) { const r = v[c]; const floor = c === 'lie' ? 0.004 : c === 'sit' ? 0.015 : 0.035
  ok(!!r && r.url.includes('/open/spirits/voltbear-rigged.glb') && (r.w as any)[c] > 0.99 && r.lo > floor, `3 voltbear ${c}: plays (w ${r ? (r.w as any)[c]?.toFixed(2) : '-'}), hangs ${r ? (r.lo * 100).toFixed(1) : '-'} cm off the ground (> ${floor * 100})`) }
// 4 Tidebear slides: every clip, her lowest point ON the ground
const t = await clipAll('tidebear')
for (const c of ['idle', 'walk', 'run', 'sit', 'lie']) { const r = t[c]
  ok(!!r && r.url.includes('/open/spirits/tidebear-rigged.glb') && (r.w as any)[c] > 0.99 && Math.abs(r.lo) < 0.01 && r.lo2 < 0.01, `4 tidebear ${c}: plays (w ${r ? (r.w as any)[c]?.toFixed(2) : '-'}), on the ground (lowest ${r ? (r.lo * 100).toFixed(2) : '-'}..${r ? (r.lo2 * 100).toFixed(2) : '-'} cm)`) }
ok(errs.length === 0, `5 page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
