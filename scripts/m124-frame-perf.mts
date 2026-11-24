// ── BETA M124 s2 MEASURE (report only, no assert on speed): frame time at 390x844 with 8 featured spirits + 3 following + a
// Mana'mal in view, versus 1 featured. Same 8 beds, same camera, same hour in both scenes; only the spirits differ. Non-owner.
// Reads rAF deltas over --secs, after a warm-up, A then B then A then B in fresh contexts. Prints the WebGL renderer: a software renderer's number is
// not a phone's. --gl swiftshader (default) | d3d12 (WSL: mesa d3d12 over /dev/dxg, run with GALLIUM_DRIVER=d3d12).
//   npx tsx scripts/m124-frame-perf.mts [--url https://ather.games] [--gl d3d12] [--secs 20] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m124-perf'), gl = flag('--gl', 'swiftshader'), secs = Number(flag('--secs', '20'))
mkdirSync(out, { recursive: true })
// Only the Vulnyx (fox) and the Manalotl (axolotl) have 3D models; every other species draws a cheap orb, so this uses those two.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const BEDS = Array.from({ length: 8 }, (_, k) => ({ id: `p${k}`, item: 'spirit_planter', x: -138.8 + (k % 2) * 2.6, z: 98 + Math.floor(k / 2) * 2.6, q: 0, placedAt: 1 }))
const SP = ['fox', 'axolotl', 'fox', 'axolotl', 'fox', 'axolotl', 'fox', 'axolotl'], at0 = Date.now() - 20 * 86400000
const pot = (sp: string, k: number) => ({ seed: `mana_seed_${sp}`, at: at0 + k, v: 2, tends: [], bloomed: true })
const ONE = { p0: pot('fox', 0) }
const MANY = { ...Object.fromEntries(SP.map((s, k) => [`p${k}`, pot(s, k)])), 'p0#2': pot('axolotl', 20), 'p1#2': pot('fox', 21), 'p2#2': pot('axolotl', 22) }
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const glArgs = gl === 'd3d12' ? ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const errs: string[] = []
async function run(name: string, many: boolean, party = false) {
  const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', ...glArgs] })
  try {
    const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument((s: { pieces: unknown; pots: unknown; tut: unknown; follow: string[]; party: string[]; many: boolean }) => {
      localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
      localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces })); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
      localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
      localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(s.follow))
      localStorage.setItem('ather.spiritParty.v1', JSON.stringify(s.party))
      localStorage.setItem('open.companion.v1', JSON.stringify(s.many ? { active: 'gemdigger', met: ['gemdigger'], sentHome: false } : { active: null, met: [], sentHome: true }))
    }, { pieces: BEDS, pots: many ? MANY : ONE, tut: TUT, follow: many && !party ? ['p0#2', 'p1#2', 'p2#2'] : [], party: party ? ['p0#2', 'p1#2', 'p2#2'] : [], many })
    await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(6000)
    await p.touchscreen.tap(195, 644); await sleep(600)
    const tp = () => p.evaluate(() => (window as any).__ather.tp(-137.5, 115, 0))
    for (let k = 0; k < 24; k++) { await tp(); await sleep(500) }
    const r = await p.evaluate((ms: number) => new Promise<any>(res => {
      const c = document.createElement('canvas').getContext('webgl2')!, e = c.getExtension('WEBGL_debug_renderer_info')
      const d: number[] = []; let last = performance.now(); const end = last + ms
      const iv = setInterval(() => (window as any).__ather.tp(-137.5, 115, 0), 3000)   // same spot: keeps idle mode off
      const f = (t: number) => { const n = performance.now(); d.push(n - last); last = n; void t; if (n < end) requestAnimationFrame(f); else { clearInterval(iv); d.sort((a, b) => a - b); res({ renderer: e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', n: d.length, mean: d.reduce((a, b) => a + b, 0) / d.length, p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], vis: document.visibilityState, species: (window as any).__spiritModel?.species ?? {}, form: ((window as any).__formation?.members ?? []).map((m: any) => m.kind) }) } }
      requestAnimationFrame(f)
    }), secs * 1000)
    console.log(`${name}: mean ${r.mean.toFixed(1)} ms, p50 ${r.p50.toFixed(1)}, p95 ${r.p95.toFixed(1)} (${r.n} frames, ${r.vis}) drawn ${JSON.stringify(r.species)} followers ${r.form.join()} | ${r.renderer}`)
    try { await p.screenshot({ path: `${out}/${name}-${gl}.png` }) } catch { /* slow frame */ }
  } catch (e) { errs.push(`${name} threw ${String(e).slice(0, 200)}`) } finally { await br.close() }
}
for (const r of [1, 2]) { await run(`1-featured-run${r}`, false); await run(`8-featured-3-follow-manamal-run${r}`, true) }
// the follow formation walks BEHIND the first-person keeper (off screen): so also all 11 around the beds (8 featured + 3 party, not following)
await run('8-featured-3-party-in-view', true, true)
console.log(`errors: ${errs.length} ${errs.join(' | ')}`)
process.exit(errs.length ? 1 : 0)
