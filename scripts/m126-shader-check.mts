// ── BETA M126 s4: TWO SPECIES, TWO COMPILED PROGRAMS (unrigged spirit models), NON-OWNER 390x844 ─────────────────────────
// SETUP: a Vulnyx and a Manalotl bloomed on two planters, a non-owner (so both are the unrigged models). The page's GL is
// hooked (read only): every LINKED program whose vertex source carries the spirit bend (uTilt), and the one used per draw.
//  1. both models mounted  2. the Manalotl's bend and the Vulnyx's bend are both compiled  3. both are DRAWN with
//  4. 0 page errors. Without a per-species customProgramCacheKey three shares one program: only one bend exists.
//   npx tsx scripts/m126-shader-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { SPIRIT_MODELS } from '../src/app/shimmer/open/ather/spirit-models'
const i0 = process.argv.indexOf('--url'), url = i0 > 0 ? process.argv[i0 + 1] : 'https://ather.games'
const P = { x: -130, z: 102.5 }, at = Date.now() - BLOOM_MS - 60000
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
// the line each species' bend starts with (spirit-model.tsx: `float tp = <sign> * position.<along>; float tw = smoothstep(<from>`)
const sig = (sp: 'fox' | 'axolotl') => { const s = SPIRIT_MODELS[sp]!.sway; return `float tp = ${s.sign.toFixed(4)} * position.${s.along}; float tw = smoothstep(${s.from.toFixed(4)}` }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument(`(() => {
    const G = WebGL2RenderingContext.prototype, src = new WeakMap(), vs = new WeakMap(), S = window.__spiritGL = { linked: [], drawn: {} }, cur = new WeakMap()
    const h = (n, f) => { const o = G[n]; G[n] = function (...a) { f.call(this, ...a); return o.apply(this, a) } }
    h('shaderSource', (s, t) => src.set(s, t)); h('attachShader', (pr, s) => { const t = src.get(s); if (t && t.includes('uTilt')) vs.set(pr, t) })
    h('linkProgram', pr => { if (vs.has(pr)) S.linked.push(vs.get(pr)) }); h('useProgram', function (pr) { cur.set(this, pr) })
    const d = function () { const pr = cur.get(this), t = pr && vs.get(pr); if (t) { const m = /float tp = [^;]*; float tw = smoothstep\\([^,]*/.exec(t); const k = m ? m[0] : '?'; S.drawn[k] = (S.drawn[k] || 0) + 1 } }
    h('drawElements', d); h('drawArrays', d) })()`)
  await p.evaluateOnNewDocument((pieces: unknown[], at: number) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at }], pots: { a: { seed: 'mana_seed_fox', at, bloomed: true }, b: { seed: 'mana_seed_axolotl', at, bloomed: true } }, met: [] }))
  }, [{ id: 'a', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }, { id: 'b', item: 'spirit_planter', x: P.x - 2.6, z: P.z, q: 0, placedAt: 1 }], at)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 7, 0), P.x - 1.3, P.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => (window as any).__spiritModel?.mounted === 2)) break }
  await sleep(8000)
  const sp = await p.evaluate(() => (window as any).__spiritModel?.species); ok(sp?.fox === 1 && sp?.axolotl === 1, `1. both unrigged models mounted (${JSON.stringify(sp)})`)
  const S = await p.evaluate(() => (window as any).__spiritGL) as { linked: string[]; drawn: Record<string, number> }
  for (const s of ['fox', 'axolotl'] as const) {
    ok(S.linked.some(t => t.includes(sig(s))), `2. ${s}: a program with its own bend is compiled (${S.linked.length} spirit programs)`)
    ok((S.drawn[sig(s)] ?? 0) > 0, `3. ${s}: drawn with its own bend (${JSON.stringify(S.drawn)})`)
  }
  ok(errs.length === 0, `4. 0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
