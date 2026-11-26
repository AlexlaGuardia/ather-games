// BETA M173 s1: ATHOWL + NOCTYX IN GAME, every keeper (non-owner), a SEEDED fresh profile (every non-GET stubbed; nothing saved anywhere).
//  SETUP: four Spirit Beds, bloomed owl (p0), bat (p1), fox (p2), axolotl (p3), hour 14. Run at 390x844 and (--desktop) 900x600 (software GL draws 1280x800 at ~1 fps; --perf keeps it).
//  1 garden: four rigged bodies, one skeleton each, the four rigged glbs 200, canon sizes (owl 0.50, bat 0.45; fox 0.70, axolotl as before).
//  2 they roam: up to 3 min the owl and the bat each fly (run clip, up off the ground) and stand (idle / sit, 0 over the ground); the fox and
//    the axolotl are never off it; no body's lowest sampled vertex under the ground by 3 cm.
//  3 three follow (owl, bat, fox): behind a keeper walking 4.2 m/s the owl and the bat fly, stood by they are down within 8 s.
//  4 E on the owl, then the bat: her talk, Open = the panel's live avatar (a canvas with pixels, her own species).
//  5 the Wilds: the three are rigged there, in the formation, in the fight brain; a real fight: a Hollow a spirit's slot answers, height read.
//  6 0 page errors.   --panel: 3 + 4 only. --perf: 8 bodies (2 of each), frame times, 3 runs (run before and after a deploy).   --shots dir.
//  --s2 (M173 s2): SIX beds, + Dewbear (p4, water-bear) + Hovari (p5, hummingbird): 1 six rigged bodies; 2 they roam: the Dewbear never off
//    the ground and her feet on it, the Hovari never under 0.7 m (hovers), both move, the owl and the bat still fly and stand; 3 the Dewbear, the
//    Hovari and the fox follow a walking keeper (Hovari up, Dewbear's capped = sliding frames stated); 4 E on each: her panel avatar; 5 the Wilds:
//    the three rigged, a HIT each from the Dewbear and the Hovari.  --s2 --perf: 8 bodies of the 6 kinds.
//   npx tsx scripts/m173-fliers-check.mts [--desktop] [--perf] [--s2] [--shots dir] [--url ..]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), desk = process.argv.includes('--desktop'), perf = process.argv.includes('--perf'), tag = desk ? 'desktop' : '390'
if (shots) mkdirSync(shots, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const S2 = process.argv.includes('--s2'), at0 = Date.now() - 20 * 86400000, KIND = S2 ? ['owl', 'bat', 'fox', 'axolotl', 'water-bear', 'hummingbird'] : ['owl', 'bat', 'fox', 'axolotl']
const pots = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, k) => [`p${k}`, { seed: `mana_seed_${KIND[k % KIND.length]}`, at: at0 + k, v: 2, tends: [], bloomed: true }]))
const beds = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `p${k}`, item: 'spirit_planter', x: -134 + (k % 4) * 2.6, z: 100 + Math.floor(k / 4) * 2.6, q: 0, placedAt: 1 }))
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function open(n: number, with_: string[]) {
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport(desk ? (perf ? { width: 1280, height: 800 } : { width: 900, height: 600 }) : { width: 390, height: 844, isMobile: true, hasTouch: true })
  const got: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('response', r => { if (/open\/spirits\//.test(r.url())) got.push(`${r.url().split('/').pop()!.split('?')[0]} ${r.status()}`) })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
    if (sessionStorage.getItem('m173')) return; sessionStorage.setItem('m173', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces })); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(s.w)); localStorage.setItem('ather.spiritParty.v1', JSON.stringify(s.w))
  }, { pieces: beds(n), pots: pots(n), tut: TUT, w: with_ })
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(4000)
  if (desk) await p.mouse.click(450, 450); else await p.touchscreen.tap(195, 644); await sleep(500)
  return { p, got }
}
const hide = (p: Page) => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(d => !h.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (p: Page, n: string) => { if (!shots) return; await hide(p); await p.screenshot({ path: `${shots}/${tag}-${n}.png` }).catch(() => {}) }
/** every drawn frame: her clip, how far her lowest sampled body vertex is off the ground she stands on (r.y carries her height) */
const sampler = (p: Page) => p.evaluate(() => { const W = window as any, D: any = W.__m173 = { r: {} }
  const tick = () => { for (const r of W.__spiritModel?.rigs?.values() ?? []) { const b = r.body, st = b.state(), geo = b.meshes.body.geometry, n = geo.getAttribute('position').count, V = b.bones[0].position.clone(); let lo = 1e9
    b.root.updateWorldMatrix(true, true); for (let i = 0; i < n; i += 5) { b.at('body', i, V); if (V.y < lo) lo = V.y }
    (D.r[r.id] ??= []).push({ t: performance.now(), sp: r.sp, clip: st.clip, w: st.w, mode: r.mode, v: r.v, alt: r.alt, off: lo - r.y, capped: st.capped }) }
    requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
const rows = (p: Page) => p.evaluate(() => (window as any).__m173.r) as Promise<Record<string, any[]>>
const gl = (p: Page, n: number) => p.waitForFunction((k: number) => (window as any).__spiritModel?.rigs?.size === k, { timeout: 60000 }, n).then(() => true).catch(() => false)
try {
  if (process.argv.includes('--perf')) {
    for (let r = 1; r <= 3; r++) { const { p } = await open(8, []); await p.evaluate(() => (window as any).__ather.tp(-130, 112, 0)); await sleep(15000)
      const m = await p.evaluate((ms: number) => new Promise<any>(res => { const d: number[] = [], M = (window as any).__spiritModel; let last = performance.now(); const end = last + ms, iv = setInterval(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F13', code: 'F13' })); (window as any).__ather.tp(-130, 112, 0) }, 3000)
        const f = () => { const n = performance.now(); d.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else { clearInterval(iv); d.sort((a, b) => a - b); const mean = d.reduce((a, b) => a + b) / d.length; res({ n: d.length, mean, sd: Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length), p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], mounted: M.mounted, rigs: M.rigs.size }) } }; requestAnimationFrame(f) }), 30000)
      console.log(`   perf ${tag}${S2 ? ' s2' : ''} run ${r}: mean ${m.mean.toFixed(1)} ms (sd ${m.sd.toFixed(1)}), p50 ${m.p50.toFixed(1)}, p95 ${m.p95.toFixed(1)} (${m.n} frames, ${m.mounted} bodies of 8)`); await p.close() }
    await br.close(); process.exit(0)
  }
  if (S2) {
    const { p, got } = await open(6, []); await p.evaluate(() => (window as any).__ather.tp(-130, 108, 0))
    ok(await gl(p, 6), '1. six rigged bodies, the Dewbear and the Hovari among them, no orb'); await sleep(4000)
    const s = await p.evaluate(() => { const M = (window as any).__spiritModel; return { sp: M.species, h: Object.fromEntries([...M.rigs.values()].map((r: any) => [r.sp, r.h])), sk: [...M.rigs.values()].map((r: any) => new Set(Object.values(r.body.meshes).map((x: any) => x.skeleton.uuid)).size), mounted: M.mounted } })
    ok(s.mounted === 6 && s.sk.every((x: number) => x === 1) && KIND.every(k => s.sp[k] === 1), `1. one of each, one skeleton each ${JSON.stringify(s.sp)}`)
    ok(Math.abs(s.h['water-bear'] - 0.5) < 1e-6 && Math.abs(s.h.hummingbird - 0.219) < 1e-6 && Math.abs(s.h.owl * 1.005 - 0.5) < 1e-6 && Math.abs(s.h.bat * 0.999 - 0.45) < 1e-6 && Math.abs(s.h.fox * 1.003 - 0.7) < 1e-6 && Math.abs(s.h.axolotl * 2.145 - 0.9) < 1e-6, `1. canon sizes, the four as before ${JSON.stringify(s.h)}`)
    ok(['athowl', 'noctyx', 'vulnyx', 'manalotl', 'dewbear', 'hovari'].every(n => got.includes(`${n}-rigged.glb 200`)) && !got.some(x => /^\w+\.glb/.test(x)), `1. the rigged glbs only (${[...new Set(got)].join(', ')})`)
    await shot(p, 's2-garden'); await sampler(p); const T0 = Date.now(); let done = false
    const has = (b: any[] = []) => b.some(r => r.clip === 'run' && r.alt > 0.1) && b.some(r => r.w.idle > 0.99 || r.w.sit > 0.99), moves = (b: any[] = []) => b.filter(r => r.v > 0.3).length > 20
    while (Date.now() - T0 < 240000 && !done) { await sleep(5000); await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F13', code: 'F13' }))); const r = await rows(p); done = has(r.p0) && has(r.p1) && moves(r.p4) && moves(r.p5) }
    await sleep(5000); const R = await rows(p)
    for (const [id, sp] of [['p0', 'owl'], ['p1', 'bat']] as const) ok(has(R[id]), `2. the ${sp} still flies and stands`)
    { const b = R.p4, dn = b.filter(r => r.w.idle > 0.99 || r.w.sit > 0.99), mv = b.filter(r => r.v > 0.3)
      ok(moves(b) && b.every(r => r.alt === 0 && r.off > -0.03) && dn.every(r => Math.abs(r.off) < 0.02), `2. the Dewbear walks the ground: ${mv.length} moving frames, off ${Math.min(...b.map(r => r.off)).toFixed(3)} .. ${Math.max(...dn.map(r => r.off)).toFixed(3)} m standing, ${b.filter(r => r.capped).length} of ${mv.length} moving frames capped (= foot slide)`) }
    { const b = R.p5; ok(moves(b) && b.every(r => r.off > 0.7), `2. the Hovari hovers: lowest ${Math.min(...b.map(r => r.off)).toFixed(3)} .. ${Math.max(...b.map(r => r.off)).toFixed(3)} m over the ground, ${b.filter(r => r.v > 0.3).length} moving frames, clips ${[...new Set(b.map(r => r.clip))]}`) }
    for (const id of ['p2', 'p3']) ok(R[id].every(r => r.alt === 0), `2. ${R[id][0].sp} never off the ground`)
    const low = Object.values(R).flat().reduce((a, r) => (r.off < a.off ? r : a)); ok(low.off > -0.03, `2. nothing under the ground: ${low.sp} ${low.clip} ${(low.off * 1000).toFixed(0)} mm`)
    await p.close()
    { const { p } = await open(6, ['p4', 'p5', 'p2']); await p.evaluate(() => (window as any).__ather.tp(-131, 112, 0)); ok(await gl(p, 6), '3. six drawn, three follow'); await sleep(6000); await sampler(p)
      await p.evaluate(`new Promise(res => { let t0 = performance.now(), last = t0, s = 0; const A = window.__ather, L = 24; (function f() { const n = performance.now(), dt = Math.min(0.2, (n - last) / 1000); last = n; s += 4.2 * dt; const k = s % (2 * L), out = k < L, y = out ? -Math.PI / 2 : Math.PI / 2; A.tp(-144 + (out ? k : 2 * L - k), 113, y); A.look(y, 0.2); if (n - t0 < 40000) requestAnimationFrame(f); else res(0) })() })`)
      await shot(p, 's2-follow'); const R1 = await rows(p)
      { const m = R1.p4.filter(r => r.mode === 'follow' && r.v > 0.3); ok(m.length > 10 && m.every(r => r.alt === 0 && r.off > -0.04), `3. the Dewbear follows on her feet (${m.length} moving frames, up to ${Math.max(...m.map(r => r.v)).toFixed(1)} m/s, ${m.filter(r => r.capped).length} capped = slide, off ${Math.min(...m.map(r => r.off)).toFixed(3)} m)`) }
      { const m = R1.p5.filter(r => r.mode === 'follow' && r.v > 0.3); ok(m.length > 10 && R1.p5.every(r => r.off > 0.7), `3. the Hovari follows hovering (${m.length} moving frames, up to ${Math.max(...m.map(r => r.v)).toFixed(1)} m/s, ${Math.min(...R1.p5.map(r => r.off)).toFixed(3)} .. ${Math.max(...R1.p5.map(r => r.off)).toFixed(3)} m up)`) }
      await sleep(8000)
      for (const sp of ['water-bear', 'hummingbird']) { let up = false
        for (let k = 0; k < 8 && !up; k++) { const m = await p.evaluate((q: string) => { const t = (window as any).__spiritModel.trots[q], s = (window as any).__ather.state(); return { x: t.x, y: t.y, z: t.z, kx: s.px ?? s.x, kz: s.pz ?? s.z } }, sp)
          const d = Math.hypot(m.x - m.kx, m.z - m.kz); if (d > 2.4) { await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), m.x + (m.kx - m.x) / d * 1.5, m.z + (m.kz - m.z) / d * 1.5); await sleep(1500) }
          const m2 = await p.evaluate((q: string) => { const t = (window as any).__spiritModel.trots[q]; return { x: t.x, z: t.z } }, sp); await aimAt(p, m2.x, m2.z, sp === 'hummingbird' ? 1.0 : 0.28); await p.keyboard.press('e'); await sleep(1500)
          const talk = await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => /Open/.test(e.textContent ?? '')); b?.click(); return !!b }); await sleep(2500)
          up = talk && await p.evaluate((q: string) => !!document.querySelector(`[data-spirit-avatar="${q}"] canvas`), sp); if (!up) { await p.keyboard.press('Escape'); await sleep(800) } }
        ok(up, `4. E on the ${sp}: the panel's live avatar is her`); await sleep(3000); await shot(p, `s2-panel-${sp}`)
        if (up && shots) await (await p.$(`[data-spirit-avatar="${sp}"]`))?.screenshot({ path: `${shots}/${tag}-s2-avatar-${sp}.png` }).catch(() => {})
        await p.keyboard.press('Escape'); await sleep(1200) }
      await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
      await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds' && !!(window as any).__ather.combat, { timeout: 120000 }); ok(await gl(p, 3), '5. the Wilds: the three are rigged'); await sleep(5000)
      ok(await p.evaluate(() => { const F = (window as any).__formation, S = (window as any).__spiritFight?.(); return ['p4', 'p5', 'p2'].every(i => F?.members.some((m: any) => m.id === i)) && S?.spirits.length === 3 }), '5. in the formation and in the fight brain')
      await p.evaluate(() => { (window as any).__m173.r = {}; const W = window as any, A = W.__ather, D = W.__f = { fight: true, on: 0, mine: new Set<number>() }; let shotAt = 0
        setInterval(() => { const C = A.combat(), e = A.camAim(); if (!D.fight) { D.mine.clear(); C.hollows.length = 0; C.spits.length = 0; C.packs = {}; return }
          C.keeper.hp = C.keeper.maxHp; for (const id of D.mine) if (!C.hollows.some((h: any) => h.id === id)) D.mine.delete(id)
          C.hollows = C.hollows.filter((h: any) => D.mine.has(h.id))
          if (D.mine.size < 3) { const n = C.hollows.length; A.spawn(D.mine.size * 2 - 2, -9, 'shambler'); if (C.hollows.length > n) { const h = C.hollows.at(-1); h.state = 'chase'; D.mine.add(h.id) } }
          const t = C.hollows.find((h: any) => h.hp > 0); if (t && performance.now() - shotAt > 900) { shotAt = performance.now(); const dx = t.x - e.cx, dz = t.z - e.cz, d = Math.hypot(dx, dz) || 1; C.rounds.push({ x: t.x - dx / d * 0.5, y: t.y + 0.9, z: t.z - dz / d * 0.5, vx: dx / d * 12, vy: 0, vz: dz / d * 12, life: 0.4, dmg: 5, crit: 5 }) }
          if (W.__spiritFight().on) D.on++ }, 60) })
      const t1 = Date.now(); let f: any = {}; const by = new Set<string>()
      while (Date.now() - t1 < 300000 && !(by.has('p4') && by.has('p5'))) {
        for (let k = 0; k < 10; k++) { await sleep(2500); f = await p.evaluate(() => { const S = (window as any).__spiritFight(); return { on: (window as any).__f.on, fights: S.seen.fights, hit: S.seen.hit, by: [...new Set(S.log.filter((e: any) => e.kind === 'hit').map((e: any) => e.id))], hovY: S.spirits.find((x: any) => x.id === 'p5')?.y } }); for (const x of f.by) by.add(x) }
        await p.evaluate(() => { (window as any).__f.fight = false }); await sleep(8000); await p.evaluate(() => { (window as any).__f.fight = true }) }
      await shot(p, 's2-fight'); const R3 = await rows(p)
      ok(f.on > 10 && by.has('p4') && by.has('p5'), `5. fights, the Dewbear and the Hovari each landed a HIT (${[...by]}): ${JSON.stringify(f)}`)
      ok(!!R3.p5?.length && R3.p5.every(r => r.off > 0.6), `5. the Hovari hovers in it (${R3.p5?.length} frames, ${Math.min(...(R3.p5 ?? []).map(r => r.off)).toFixed(2)} m lowest)`)
      ok(!!R3.p4?.length && R3.p4.every(r => r.alt === 0 && r.off > -0.06), `5. the Dewbear on her feet in it (${R3.p4?.length} frames)`)
      await p.close() }
    await br.close(); ok(errs.length === 0, `6. 0 page errors ${errs.join(' | ')}`); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
  }
  if (!process.argv.includes('--panel')) { const { p, got } = await open(4, []); await p.evaluate(() => (window as any).__ather.tp(-130, 108, 0))
    ok(await gl(p, 4), '1. four rigged bodies, owl and bat among them, no orb'); await sleep(4000)
    const s = await p.evaluate(() => { const M = (window as any).__spiritModel; return { sp: M.species, h: Object.fromEntries([...M.rigs.values()].map((r: any) => [r.sp, r.h])), sk: [...M.rigs.values()].map((r: any) => new Set(Object.values(r.body.meshes).map((x: any) => x.skeleton.uuid)).size), mounted: M.mounted } })
    ok(s.mounted === 4 && s.sk.length === 4 && s.sk.every((x: number) => x === 1) && KIND.every(k => s.sp[k] === 1), `1. one of each, one skeleton each ${JSON.stringify(s.sp)}`)
    ok(Math.abs(s.h.owl * 1.005 - 0.5) < 1e-6 && Math.abs(s.h.bat * 0.999 - 0.45) < 1e-6 && Math.abs(s.h.fox * 1.003 - 0.7) < 1e-6 && Math.abs(s.h.axolotl * 2.145 - 0.9) < 1e-6, `1. canon sizes, the fox and the axolotl as before ${JSON.stringify(s.h)}`)
    ok(['athowl', 'noctyx', 'vulnyx', 'manalotl'].every(n => got.includes(`${n}-rigged.glb 200`)) && !got.some(x => /^\w+\.glb/.test(x)), `1. the rigged glbs only (${[...new Set(got)].join(', ')})`)
    await sampler(p); const T0 = Date.now(); let done = false
    const has = (b: any[] = []) => b.some(r => r.clip === 'run' && r.alt > 0.1) && b.some(r => r.w.idle > 0.99 || r.w.sit > 0.99)
    while (Date.now() - T0 < 240000 && !done) { await sleep(5000); await p.evaluate(() => { const A = (window as any).__ather; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F13', code: 'F13' })); void A }); const r = await rows(p); done = has(r.p0) && has(r.p1) }
    await sleep(10000); const R = await rows(p)
    for (const [id, sp] of [['p0', 'owl'], ['p1', 'bat']] as const) { const b = R[id], fly = b.filter(r => r.clip === 'run' && r.alt > 0.1), dn = b.filter(r => r.w.idle > 0.99 || r.w.sit > 0.99)
      ok(has(b), `2. the ${sp} flies and stands (${fly.length} flying frames, up to ${Math.max(0, ...fly.map(r => r.alt)).toFixed(2)} m; ${dn.length} standing)`)
      // r.y carries alt for neither: off = lowest vertex over the ground (the perch included in r.y)
      ok(dn.every(r => Math.abs(r.off) < 0.02 && r.alt < 0.05), `2. the ${sp} standing: ${Math.min(...dn.map(r => r.off)).toFixed(3)} .. ${Math.max(...dn.map(r => r.off)).toFixed(3)} m off the ground`)
      ok(fly.every(r => r.off > 0.1), `2. the ${sp} flying: hover ${Math.min(...fly.map(r => r.off)).toFixed(2)} .. ${Math.max(...fly.map(r => r.off)).toFixed(2)} m under her`) }
    for (const id of ['p2', 'p3']) ok(R[id].every(r => r.alt === 0), `2. ${R[id][0].sp} never off the ground`)
    const low = Object.values(R).flat().reduce((a, r) => (r.off < a.off ? r : a)); ok(low.off > -0.03, `2. nothing under the ground: ${low.sp} ${low.clip} ${(low.off * 1000).toFixed(0)} mm`)
    for (const sp of ['owl', 'bat']) { const m = await p.evaluate((k: string) => { const t = (window as any).__spiritModel.trots[k]; return { x: t.x, z: t.z } }, sp); await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x + 0.9, z + 1.3, 0), m.x, m.z); await sleep(700); const m2 = await p.evaluate((k: string) => { const t = (window as any).__spiritModel.trots[k]; return { x: t.x, z: t.z } }, sp); await aimAt(p, m2.x, m2.z, 0.3); await shot(p, `garden-${sp}`) }
    await p.close() }
  { const { p } = await open(4, ['p0', 'p1', 'p2']); await p.evaluate(() => (window as any).__ather.tp(-131, 112, 0)); ok(await gl(p, 4), '3. four drawn, three follow'); await sleep(6000); await sampler(p)
    await p.evaluate(`new Promise(res => { let t0 = performance.now(), last = t0, s = 0; const A = window.__ather, L = 24; (function f() { const n = performance.now(), dt = Math.min(0.2, (n - last) / 1000); last = n; s += 4.2 * dt; const k = s % (2 * L), out = k < L, y = out ? -Math.PI / 2 : Math.PI / 2; A.tp(-144 + (out ? k : 2 * L - k), 113, y); A.look(y, 0.2); if (n - t0 < 40000) requestAnimationFrame(f); else res(0) })() })`)
    await shot(p, 'follow')
    const R1 = await rows(p); for (const [id, sp] of [['p0', 'owl'], ['p1', 'bat']] as const) { const m = R1[id].filter(r => r.mode === 'follow' && r.v > 1.2), up = m.filter(r => r.clip === 'run' && r.alt > 0.1); ok(m.length > 10 && up.length > m.length * 0.7 && m.every(r => r.clip !== 'walk' || r.v < 2), `3. the ${sp} flies behind a walking keeper (${up.length} of ${m.length} frames up, ${Math.max(...m.map(r => r.alt)).toFixed(2)} m)`) }
    await sleep(8000); await p.evaluate(() => { (window as any).__m173.r = {} }); await sleep(3000); const R2 = await rows(p)
    for (const [id, sp] of [['p0', 'owl'], ['p1', 'bat'], ['p2', 'fox']] as const) ok(R2[id].every(r => r.alt < 0.05 && r.clip !== 'run'), `3. stood by the ${sp} is down (${[...new Set(R2[id].map(r => r.clip))]}, ${Math.max(...R2[id].map(r => r.alt)).toFixed(3)} m)`)
    for (const sp of ['owl', 'bat']) { let up = false
      for (let k = 0; k < 8 && !up; k++) { const m = await p.evaluate((q: string) => { const t = (window as any).__spiritModel.trots[q], s = (window as any).__ather.state(); return { x: t.x, y: t.y, z: t.z, kx: s.px ?? s.x, kz: s.pz ?? s.z } }, sp)
        const d = Math.hypot(m.x - m.kx, m.z - m.kz); if (d > 2.4) { await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), m.x + (m.kx - m.x) / d * 1.5, m.z + (m.kz - m.z) / d * 1.5); await sleep(1500) }
        const m2 = await p.evaluate((q: string) => { const t = (window as any).__spiritModel.trots[q]; return { x: t.x, z: t.z } }, sp); await aimAt(p, m2.x, m2.z, 0.28); await p.keyboard.press('e'); await sleep(1500)
        const talk = await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => /Open/.test(e.textContent ?? '')); b?.click(); return !!b }); await sleep(2500)
        up = talk && await p.evaluate((q: string) => !!document.querySelector(`[data-spirit-avatar="${q}"] canvas`), sp); if (!up) { await p.keyboard.press('Escape'); await sleep(800) } }
      ok(up, `4. E on the ${sp}: the panel's live avatar is her`); await sleep(3000); await shot(p, `panel-${sp}`); await p.keyboard.press('Escape'); await sleep(1200) }
    if (process.argv.includes('--panel')) { await br.close(); console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0) }
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
    await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds' && !!(window as any).__ather.combat, { timeout: 120000 }); ok(await gl(p, 3), '5. the Wilds: the three are rigged'); await sleep(5000)
    ok(await p.evaluate(() => { const F = (window as any).__formation, S = (window as any).__spiritFight?.(); return ['p0', 'p1', 'p2'].every(i => F?.members.some((m: any) => m.id === i)) && S?.spirits.length === 3 }), '5. in the formation and in the fight brain')
    await p.evaluate(() => { (window as any).__m173.r = {}; const W = window as any, A = W.__ather, D = W.__f = { fight: true, on: 0, mine: new Set<number>() }; let shotAt = 0
      setInterval(() => { const C = A.combat(), e = A.camAim(); if (!D.fight) { D.mine.clear(); C.hollows.length = 0; C.spits.length = 0; C.packs = {}; return }
        C.keeper.hp = C.keeper.maxHp; for (const id of D.mine) if (!C.hollows.some((h: any) => h.id === id)) D.mine.delete(id)
        C.hollows = C.hollows.filter((h: any) => D.mine.has(h.id))
        if (D.mine.size < 3) { const n = C.hollows.length; A.spawn(D.mine.size * 2 - 2, -9, 'shambler'); if (C.hollows.length > n) { const h = C.hollows.at(-1); h.state = 'chase'; D.mine.add(h.id) } }
        const t = C.hollows.find((h: any) => h.hp > 0); if (t && performance.now() - shotAt > 900) { shotAt = performance.now(); const dx = t.x - e.cx, dz = t.z - e.cz, d = Math.hypot(dx, dz) || 1; C.rounds.push({ x: t.x - dx / d * 0.5, y: t.y + 0.9, z: t.z - dz / d * 0.5, vx: dx / d * 12, vy: 0, vz: dz / d * 12, life: 0.4, dmg: 5, crit: 5 }) }
        if (W.__spiritFight().on) D.on++ }, 60) })
    const t1 = Date.now(); let f: any = {}; const by = new Set<string>()
    while (Date.now() - t1 < 300000 && !(by.has('p0') && by.has('p1'))) {   // each joins a fight only when she chooses (0.7): fight after fight
      for (let k = 0; k < 10; k++) { await sleep(2500); f = await p.evaluate(() => { const S = (window as any).__spiritFight(); return { on: (window as any).__f.on, fights: S.seen.fights, hit: S.seen.hit, by: [...new Set(S.log.filter((e: any) => e.kind === 'hit').map((e: any) => e.id))], spirits: S.spirits.map((s: any) => s.id) } }); for (const x of f.by) by.add(x); if (k === 4 && by.size) await shot(p, `fight-${f.fights}`) }
      await p.evaluate(() => { (window as any).__f.fight = false }); await sleep(8000); await p.evaluate(() => { (window as any).__f.fight = true }) }
    await shot(p, 'fight'); const R3 = await rows(p)
    ok(f.on > 10 && f.spirits.length === 3 && by.has('p0') && by.has('p1'), `5. fights, the owl and the bat each landed a HIT (${[...by]}): ${JSON.stringify(f)}`)
    for (const id of ['p0', 'p1']) ok(!!R3[id]?.length && R3[id].every(r => r.off > -0.06) && R3[id].some(r => r.alt > 0.1), `5. ${R3[id]?.[0]?.sp} flies in it (${R3[id]?.length} frames, off ${Math.min(...R3[id].map(r => r.off)).toFixed(2)} .. ${Math.max(...R3[id].map(r => r.off)).toFixed(2)} m)`)
    await p.close() }
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) }
await br.close()
ok(errs.length === 0, `6. 0 page errors ${errs.join(' | ')}`)
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
