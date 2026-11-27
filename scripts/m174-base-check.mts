// BETA M174: the built base forms, OWNER PREVIEW, on prod (desktop 1440x900 SwiftShader; the gallery is desktop-first). Fresh context, every
// non-GET stubbed. Owner: /shimmer/dev?mode=spirits&spirit=N for each BASE_PREVIEW species mounts her rigged glb (window.__spiritModel),
// skinned, every game clip plays at full weight, 0 page errors. Non-owner: the same page does not serve the gallery (the /shimmer/dev gate),
// and the players' registries (SPIRIT_MODELS / SPIRIT_RIGS) still have no model for her = today's gold orb in every player's garden.
//   OWNER_KEY=... npx tsx scripts/m174-base-check.mts [--shots dir] [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
import { SPIRIT_MODELS, SPIRIT_RIGS } from '../src/app/shimmer/open/ather/spirit-models'
import { BASE_PREVIEW } from '../src/app/shimmer/open/ather/spirit-base-preview'
import { RIG_CLIPS } from '../src/app/shimmer/open/ather/spirit-rig'
import type { Species } from '../src/app/shimmer/spirits/spirit'
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

for (const [sp, L] of Object.entries(BASE_PREVIEW) as [Species, NonNullable<(typeof BASE_PREVIEW)[Species]>][]) {
  const row = GALLERY.find(r => r.sp === sp && !r.el)!
  ok(!SPIRIT_MODELS[sp] && !SPIRIT_RIGS[sp], `${row.name}: players' registries list no model (players keep the orb)`)
  await goto(row.num); const s = await probe(L.url)
  ok(!!s && s.sp === sp && !!s.urls[L.url] && s.skinned, `#${row.num} ${row.name}: owner gallery mounts ${L.url}, skinned (${JSON.stringify(s && { sp: s.sp, skinned: s.skinned, h: +s.h.toFixed(3) })})`)
  await shot(`${row.name}-idle`)
  for (const c of RIG_CLIPS) {
    await p.click(`[data-gallery-clip="${c}"]`); await sleep(1500); const q = await probe(L.url)
    ok(!!q && q.clip === c && q.w[c] > 0.95, `#${row.num} ${row.name}: ${c} plays (clip ${q?.clip}, w ${q?.w[c]?.toFixed(2)}, drawn h ${q?.h.toFixed(3)})`)
    if (c === 'lie') await shot(`${row.name}-lie`)
  }
}
ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
// non-owner: a fresh context with no owner cookie does not get the gallery
const p2 = await (await br.createBrowserContext()).newPage(); await p2.setViewport({ width: 390, height: 844 })
const res = await p2.goto(`${url}/shimmer/dev?mode=spirits&spirit=8`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => null); await sleep(3000)
const has = await p2.evaluate(() => !!document.querySelector('[data-spirit-gallery]')).catch(() => false)
ok(!has, `non-owner: no gallery at /shimmer/dev (status ${res?.status()}, url ${p2.url().replace(url, '')})`)
await br.close()
console.log(fails ? `FAILED ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
