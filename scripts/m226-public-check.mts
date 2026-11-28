// BETA M226: THE OK'd LOOKS ARE EVERY KEEPER'S. A NON-OWNER fresh profile (seeded, every non-GET stubbed; nothing saved anywhere), hour 14.
//  A bases: four Spirit Beds, bloomed rabbit / turtle / frog / firefly. Each draws her rigged model (Lepara, Shellmere, Croakling, Luminara),
//    not the gold orb: four rigged bodies, one of each species, their rigged glbs 200, the BASE_PREVIEW heights (= GROWN); Luminara hovers.
//  B forms: beds with pot.element set: owl mana/storm/earth/water (the Athowl line redo), hummingbird the same (the Hovari line redo),
//    axolotl mana (Aurlotl, glyph panels) = each draws her FORM glb; plus fox mana (Vulnara, not OK'd) = she keeps her base (vulnyx-rigged).
//  C (M202, Alex OK 11-27): turtle + frog beds with pot.element = each draws her FORM glb (the Shellmere line: Mesamere / Aurmere /
//    Voltmere / Tidemere; the Croakling line pass 2: Croakrill / Croakara / Croakore / Croakarc), not her base or an orb.
//  D (M202, Alex YAY 11-28): rabbit beds with pot.element = each draws her FORM glb (the Lepara line: Lepaura / Leparc / Lepore / Lepnix),
//    not her base Lepara or an orb; each stands on the ground.
//  0 page errors. 390x844 (default) or --desktop 900x600.   npx tsx scripts/m226-public-check.mts [--desktop] [--only ABCD] [--shots dir] [--url ..]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { BASE_PREVIEW } from '../src/app/shimmer/open/ather/spirit-base-preview'
import { formLook, type SpiritElement } from '../src/app/shimmer/open/ather/spirit-models'
import type { Species } from '../src/app/shimmer/spirits/spirit'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), desk = process.argv.includes('--desktop'), tag = desk ? 'desktop' : '390', only = flag('--only', 'ABCD')
if (shots) mkdirSync(shots, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const at0 = Date.now() - 20 * 86400000
type Bed = { sp: Species; el?: SpiritElement }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function open(B: Bed[]) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport(desk ? { width: 900, height: 600 } : { width: 390, height: 844, isMobile: true, hasTouch: true })
  const got: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('response', r => { if (/open\/spirits\//.test(r.url())) got.push(`${r.url().split('/').pop()!.split('?')[0]} ${r.status()}`) })
  const pots = Object.fromEntries(B.map((b, k) => [`p${k}`, { seed: `mana_seed_${b.sp}`, at: at0 + k, v: 2, tends: [], bloomed: true, ...(b.el ? { element: b.el } : {}) }]))
  const pieces = B.map((_, k) => ({ id: `p${k}`, item: 'spirit_planter', x: -134 + (k % 4) * 2.6, z: 100 + Math.floor(k / 4) * 2.6, q: 0, placedAt: 1 }))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m226')) return; sessionStorage.setItem('m226', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces })); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
  }, { pieces, pots, tut: TUT })
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(3000)
  await dismissStartCard(p).catch(e => console.log('   (start card: ' + String(e).slice(0, 120) + ')'))
  const owner = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner).catch(() => null))
  ok(owner === false, `${tag}: a NON-owner profile (/api/owner says ${owner})`)
  await p.evaluate(() => (window as any).__ather.tp(-130, 108, 0))
  return { p, got }
}
const shot = async (p: Page, n: string) => { if (shots) await p.screenshot({ path: `${shots}/${tag}-${n}.png` }).catch(() => {}) }
const gl = (p: Page, n: number) => p.waitForFunction((k: number) => (window as any).__spiritModel?.rigs?.size === k, { timeout: 120000 }, n).then(() => true).catch(() => false)
const rigs = (p: Page) => p.evaluate(() => [...((window as any).__spiritModel?.rigs?.values() ?? [])].map((r: any) => ({ id: r.id, sp: r.sp, h: r.h, alt: r.alt })))

/** each rig's lowest sampled skinned body vertex over the ground she stands on, sampled `n` times 200 ms apart (M173's instrument:
 *  a hoverer's hover lives in her glb's clips, so r.alt, the FLIER altitude, stays 0 for her) */
const offs = (p: Page, n = 25) => p.evaluate(async (N: number) => { const W = window as any, out: Record<string, { sp: string; off: number[] }> = {}
  for (let k = 0; k < N; k++) { for (const r of W.__spiritModel?.rigs?.values() ?? []) { const b = r.body, n = b.meshes.body.geometry.getAttribute('position').count, V = b.bones[0].position.clone(); let lo = 1e9
    b.root.updateWorldMatrix(true, true); for (let i = 0; i < n; i += 5) { b.at('body', i, V); if (V.y < lo) lo = V.y }
    ;(out[r.id] ??= { sp: r.sp, off: [] }).off.push(lo - r.y) } await new Promise(z => setTimeout(z, 200)) }
  return Object.values(out) }, n)
try {
  // ── A: the four bases
  if (only.includes('A')) { const A: Bed[] = (['rabbit', 'turtle', 'frog', 'firefly'] as Species[]).map(sp => ({ sp }))
    const { p, got } = await open(A)
    ok(await gl(p, 4), `A ${tag}: four rigged bodies (no gold orb)`); await sleep(5000)
    const R = await rigs(p)
    for (const b of A) { const L = BASE_PREVIEW[b.sp]!, r = R.find(x => x.sp === b.sp)
      ok(!!r && Math.abs(r.h - L.h) < 1e-6 && got.includes(`${L.url.split('/').pop()} 200`), `A ${tag}: ${b.sp} draws ${L.name} (${L.url.split('/').pop()} ${got.includes(`${L.url.split('/').pop()} 200`) ? '200' : 'NOT LOADED'}, h ${r?.h.toFixed(4)} = ${L.h.toFixed(4)})`) }
    // Luminara hovers (her idle hangs 0.90..1.30 m up): her lowest body vertex stays well off the ground; the three walkers stand on it
    const O = await offs(p), lum = O.find(o => o.sp === 'firefly')?.off ?? []
    ok(lum.length > 10 && lum.every(a => a > 0.6), `A ${tag}: Luminara hovers (lowest body point ${Math.min(...lum).toFixed(2)} .. ${Math.max(...lum).toFixed(2)} m over the ground, ${lum.length} samples)`)
    for (const o of O.filter(o => o.sp !== 'firefly')) ok(o.off.every(a => a > -0.03 && a < 0.3), `A ${tag}: ${o.sp} stands on the ground (lowest ${Math.min(...o.off).toFixed(3)} .. ${Math.max(...o.off).toFixed(3)} m)`)
    ok(!got.some(x => / [45]\d\d$/.test(x)), `A ${tag}: every spirit glb 200 (${[...new Set(got)].join(', ')})`)
    await shot(p, 'a-bases'); await p.close() }
  // ── B: the OK'd forms public, a not-OK'd form still the owner's
  if (only.includes('B')) { const EL: SpiritElement[] = ['mana', 'storm', 'earth', 'water']
    const B: Bed[] = [...EL.map(el => ({ sp: 'owl' as Species, el })), ...EL.map(el => ({ sp: 'hummingbird' as Species, el })), { sp: 'axolotl', el: 'mana' }, { sp: 'fox', el: 'mana' }]
    const { p, got } = await open(B)
    ok(await gl(p, B.length), `B ${tag}: ${B.length} rigged bodies`); await sleep(6000)
    const urls: Record<string, number> = await p.evaluate(() => ({ ...((window as any).__spiritModel?.urls ?? {}) }))
    const R = await rigs(p)
    for (const b of B.slice(0, 9)) { const f = formLook(b.sp, b.el)!; const file = f.url.split('/').pop()!
      ok(!!urls[f.url] && got.includes(`${file} 200`) && R.some(r => r.sp === b.sp && Math.abs(r.h - f.h) < 1e-6), `B ${tag}: ${b.sp}/${b.el} draws ${f.name} (${file} mounted ${urls[f.url] ?? 0}, h ${f.h.toFixed(4)})`) }
    const vul = formLook('fox', 'mana')!
    ok(!urls[vul.url] && !got.some(x => x.startsWith(vul.url.split('/').pop()!)) && !!urls['/open/spirits/vulnyx-rigged.glb'], `B ${tag}: fox/mana (Vulnara, not OK'd) keeps her base for a player (vulnyx-rigged ${urls['/open/spirits/vulnyx-rigged.glb'] ?? 0}, vulnara ${urls[vul.url] ?? 0})`)
    const hov = (await offs(p)).filter(o => o.sp === 'hummingbird')
    ok(hov.length === 4 && hov.every(o => o.off.every(a => a > 0.6)), `B ${tag}: the four Hovari forms hover (lowest body points ${hov.map(o => Math.min(...o.off).toFixed(2)).join(', ')} m)`)
    await shot(p, 'b-forms'); await p.close() }
  // ── C: M202, the Shellmere + Croakling lines public (every form glb mounted + 200, her form's height; no base glb, no orb)
  if (only.includes('C')) { const EL: SpiritElement[] = ['mana', 'storm', 'earth', 'water']
    const C: Bed[] = (['turtle', 'frog'] as Species[]).flatMap(sp => EL.map(el => ({ sp, el })))
    const { p, got } = await open(C)
    ok(await gl(p, C.length), `C ${tag}: ${C.length} rigged bodies (no gold orb)`); await sleep(6000)
    const urls: Record<string, number> = await p.evaluate(() => ({ ...((window as any).__spiritModel?.urls ?? {}) }))
    const R = await rigs(p)
    for (const b of C) { const f = formLook(b.sp, b.el)!; const file = f.url.split('/').pop()!
      ok(!!urls[f.url] && got.includes(`${file} 200`) && R.some(r => r.sp === b.sp && Math.abs(r.h - f.h) < 1e-6), `C ${tag}: ${b.sp}/${b.el} draws ${f.name} (${file} mounted ${urls[f.url] ?? 0}, h ${f.h.toFixed(4)})`) }
    for (const sp of ['turtle', 'frog'] as Species[]) { const L = BASE_PREVIEW[sp]!
      ok(!urls[L.url], `C ${tag}: no ${sp} bed falls back to her base ${L.name} (${L.url.split('/').pop()} mounted ${urls[L.url] ?? 0})`) }
    await shot(p, 'c-m202-forms'); await p.close() }
  // ── D: M202, the Lepara line public (every form glb mounted + 200, her form's height, on the ground; no base glb, no orb)
  if (only.includes('D')) { const D: Bed[] = (['mana', 'storm', 'earth', 'water'] as SpiritElement[]).map(el => ({ sp: 'rabbit' as Species, el }))
    const { p, got } = await open(D)
    ok(await gl(p, D.length), `D ${tag}: ${D.length} rigged bodies (no gold orb)`); await sleep(6000)
    const urls: Record<string, number> = await p.evaluate(() => ({ ...((window as any).__spiritModel?.urls ?? {}) }))
    const R = await rigs(p)
    for (const b of D) { const f = formLook(b.sp, b.el)!; const file = f.url.split('/').pop()!
      ok(!!urls[f.url] && got.includes(`${file} 200`) && R.filter(r => r.sp === 'rabbit' && Math.abs(r.h - f.h) < 1e-6).length === 1, `D ${tag}: rabbit/${b.el} draws ${f.name} (${file} mounted ${urls[f.url] ?? 0}, h ${f.h.toFixed(4)})`) }
    const L = BASE_PREVIEW.rabbit!
    ok(!urls[L.url], `D ${tag}: no rabbit bed falls back to her base ${L.name} (${L.url.split('/').pop()} mounted ${urls[L.url] ?? 0})`)
    for (const o of await offs(p)) ok(o.off.every(a => a > -0.03 && a < 0.3), `D ${tag}: a Lepara form stands on the ground (lowest ${Math.min(...o.off).toFixed(3)} .. ${Math.max(...o.off).toFixed(3)} m)`)
    await shot(p, 'd-lepara-forms'); await p.close() }
  ok(errs.length === 0, `${tag}: 0 page errors (${errs.slice(0, 3).join(' | ')})`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `FAILED ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
