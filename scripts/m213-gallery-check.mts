// BETA M213 s1: THE SPIRIT GALLERY on prod, desktop 1440x900 (SwiftShader), OWNER (the /shimmer/dev gate). Fresh context, every
// non-GET stubbed. /shimmer/dev?mode=spirits:
//  1 the mode loads; the dial lists all 50 rows in grimoire order (spirit-gallery.ts GALLERY: base 10, then the 40 forms by discovery)
//  2 the dial turns: ArrowDown = the next row, a wheel notch on the dial = the next again
//  3 a base (Vulnyx) and built forms (Vulnara, Cragbear, Aurlotl) mount their REAL game model: that glb mounted by spirit-model.tsx's
//    SpiritModel (window.__spiritModel urls), rigged, a skinned body
//  4 a clip button changes the pose: LIE = the lie clip at full weight, and her drawn height drops vs idle
//  5 an unbuilt form (Mesamere) shows her locked art + NOT BUILT, no model mounted     6 0 page errors
//   OWNER_KEY=... npx tsx scripts/m213-gallery-check.mts [--shots dir] [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
import { SPIRIT_RIGS, formLook } from '../src/app/shimmer/open/ather/spirit-models'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1440, height: 900 })
p.on('pageerror', e => errs.push(String(e).slice(0, 240)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await p.evaluateOnNewDocument(() => { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true })

const sel = () => p.evaluate(() => Number(document.querySelector('[data-gallery-row][data-selected="1"]')?.getAttribute('data-gallery-row') ?? 0))
async function goto(n: number) {
  await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${n}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-spirit-gallery]', { timeout: 120000 }); await sleep(600)
}
/** wait for the gallery's rigged body, then her drawn height (skinned body verts, top minus lowest) over 20 frames */
const probe = (url: string) => p.evaluate(async (u: string) => {
  const W = window as any, raf = () => new Promise(r => requestAnimationFrame(r))
  for (let k = 0; k < 900; k++) { const g = W.__spiritModel?.rigs?.get('gallery'); if (g && W.__spiritModel?.urls?.[u]) break; await new Promise(r => setTimeout(r, 100)) }
  const r = W.__spiritModel?.rigs?.get('gallery'); if (!r) return null
  for (let f = 0; f < 30; f++) await raf()
  let hi = 0
  for (let f = 0; f < 20; f++) { await raf(); const b = r.body, ps = b.meshes.body.geometry.getAttribute('position'), V = b.bones[0].position.clone(); let lo = 1e9, top = -1e9
    for (let i = 0; i < ps.count; i += 3) { b.at('body', i, V); lo = Math.min(lo, V.y); top = Math.max(top, V.y) } hi += top - lo }
  const st = r.body.state()
  return { sp: r.sp, urls: { ...W.__spiritModel.urls }, skinned: !!r.body.meshes.body?.isSkinnedMesh, h: hi / 20, clip: st.clip, w: st.w, mode: r.mode }
}, url)
const shot = async (name: string) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png` }) }

// 1 the dial
await goto(1)
const rows = await p.evaluate(() => [...document.querySelectorAll('[data-gallery-row]')].map(e => `${e.getAttribute('data-gallery-row')}:${e.getAttribute('data-gallery-name')}`))
const want = GALLERY.map(r => `${r.num}:${r.name}`)
ok(rows.length === 50, `1 the dial lists 50 rows (${rows.length})`)
ok(JSON.stringify(rows) === JSON.stringify(want), `1 in grimoire order: ${rows.slice(0, 3).join(', ')} ... ${rows.slice(9, 12).join(', ')} ... ${rows.at(-1)}`)
ok(await sel() === 1, '1 #001 selected on open')
// 2 the dial turns
await p.keyboard.press('ArrowDown'); await sleep(300)
ok(await sel() === 2, `2 ArrowDown turns to #002 (${await sel()})`)
const box = (await (await p.$('[data-gallery-dial]'))!.boundingBox())!
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.wheel({ deltaY: 100 }); await sleep(400)
ok(await sel() === 3, `2 a wheel notch turns to #003 (${await sel()})`)
await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await sleep(300)
ok(await sel() === 1, `2 back up to #001 (${await sel()})`)

// 3 + 4 built spirits mount their real model; a clip changes the pose
const BUILT: { name: string; url: string }[] = [
  { name: 'Vulnyx', url: SPIRIT_RIGS.fox!.url },
  { name: 'Vulnara', url: formLook('fox', 'mana')!.url },
  { name: 'Cragbear', url: formLook('water-bear', 'earth')!.url },
  { name: 'Aurlotl', url: formLook('axolotl', 'mana')!.url },
]
for (const b of BUILT) {
  const row = GALLERY.find(r => r.name === b.name)!
  await goto(row.num)
  ok(await sel() === row.num, `3 ${b.name}: #${row.num} selected by ?spirit=`)
  const m = await probe(b.url)
  ok(!!m && m.urls[b.url] === 1 && Object.keys(m.urls).length === 1 && m.sp === row.sp && m.skinned, `3 ${b.name}: her real model mounted (${b.url}; urls ${JSON.stringify(m?.urls)}, ${m?.sp}, skinned ${m?.skinned})`)
  ok(await p.evaluate(() => document.querySelector('[data-gallery-state]')?.getAttribute('data-gallery-state')) === 'model', `3 ${b.name}: the stage is the model, not the art`)
  await shot(`${String(row.num).padStart(3, '0')}-${b.name.toLowerCase()}-idle`)
  if (b.name === 'Vulnyx' || b.name === 'Cragbear') {
    const h0 = m?.h ?? 0
    await p.click('[data-gallery-clip="lie"]'); await sleep(1500)
    const s = await probe(b.url)
    ok(!!s && s.clip === "lie" && s.w.lie > 0.95 && s.mode === "lie", `4 ${b.name}: LIE plays the lie clip (clip ${s?.clip}, w.lie ${s?.w.lie.toFixed(2)})`)
    ok(!!s && s.h < h0 * 0.95, `4 ${b.name}: the pose changed: ${h0.toFixed(3)} -> ${s?.h.toFixed(3)} (drawn height)`)
    await shot(`${String(row.num).padStart(3, '0')}-${b.name.toLowerCase()}-lie`)
    await p.click('[data-gallery-clip="walk"]'); await sleep(1200)
    const w = await probe(b.url)
    ok(!!w && w.clip === 'walk' && w.w.walk > 0.95, `4 ${b.name}: WALK plays the walk clip (clip ${w?.clip}, w.walk ${w?.w.walk.toFixed(2)})`)
  }
}

// 5 an unbuilt form shows her art
{ const row = GALLERY.find(r => r.name === 'Mesamere')!
  await goto(row.num); await sleep(800)
  const a = await p.evaluate(() => { const img = document.querySelector('[data-gallery-art]') as HTMLImageElement | null
    return { state: document.querySelector('[data-gallery-state]')?.getAttribute('data-gallery-state'), art: !!img && img.complete && img.naturalWidth > 0, src: img?.getAttribute('src'),
      unbuilt: document.querySelector('[data-gallery-unbuilt]')?.textContent, rig: !!(window as any).__spiritModel?.rigs?.get('gallery'), urls: Object.keys((window as any).__spiritModel?.urls ?? {}).length } })
  ok(a.state === 'art' && a.art && a.src === row.icon, `5 Mesamere: her locked art shows (${a.src}, loaded ${a.art})`)
  ok(/not built/i.test(a.unbuilt ?? '') && !a.rig && a.urls === 0, `5 Mesamere: NOT BUILT, no model mounted (${a.unbuilt}; rig ${a.rig}, urls ${a.urls})`)
  await shot(`${String(row.num).padStart(3, '0')}-mesamere-art`) }

ok(errs.length === 0, `6 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `M213 GALLERY: ${fails} FAIL` : 'M213 GALLERY: ALL PASS')
process.exit(fails ? 1 : 0)
