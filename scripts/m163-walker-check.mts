// ── BETA M163 s1: THE WALKER'S LOCKED LOOK, ON THE LIVE PAGE ──────────────────────────────────────────────────────────
// A fresh profile out in the Wilds, then, read off the REAL drawn mesh (__ather.walker):
//   1. a walker draws the new skin (one shared geometry, eight bones), near-black, wet, no glow, borrowing an env
//   2. what a round hits: the dome (crit), the chest, the hanging arm, a heel; past the arm / beside the dome miss
//   3. the sim's wind-up and lunge are the drawn ones (tell rises, fall forward)
//   4. a REAL fight: the Repeater fired (__fight-free: R + clicks, aim by __ather.look) lowers one; it is killed, dispersal + grey matter as today
//   5. cost: draw calls and frame ms with six up against none   6. stills   7. 0 page errors
//   npx tsx scripts/m163-walker-check.mts [--phone] [--cost] [--url https://ather.games] [--out dir]     (--cost: part 5 only, the before / after leg)
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const phone = process.argv.includes('--phone'), costOnly = process.argv.includes('--cost')
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 760 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'charred-rifle'], primary: 'repeater', secondary: 'charred-rifle', kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' })) } catch { /* sandboxed frame */ } })
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const stt = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py, z: a.pz } }) as Promise<{ x: number; y: number; z: number }>
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__ather.combat?.()), 240000), 'in the Wilds')
  await sleep(3000); await (phone ? p.touchscreen.tap(195, 420) : p.mouse.click(550, 380)); await sleep(1000)
  await poll(async () => p.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-creator-done]'); b?.click(); return !b }), 8000)
  const C = (f: string) => p.evaluate(`(() => { const A = window.__ather, C = A.combat(); ${f} })()`) as Promise<any>
  const frames = (n: number) => p.evaluate((k: number) => new Promise<void>(r => { let i = 0; const f = () => { if (++i >= k) r(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }), n)
  { const a = await stt(); await p.evaluate((x, z) => (window as any).__ather.tp(x, z), a.x + 70, a.z + 10); await sleep(6000) }
  await p.evaluate(() => { const A = (window as any).__ather; const t = () => { const C = A.combat?.(); if (C && !(window as any).__free) { C.hollows = C.hollows.filter((h: any) => h.hp > 999); C.keeper.hp = C.keeper.maxHp } requestAnimationFrame(t) }; t() })
  await frames(6)
  const s = await stt(), aim = await p.evaluate(() => (window as any).__ather.camAim()) as { x: number; z: number; cx: number; cz: number }
  const fl = Math.hypot(aim.x, aim.z) || 1, fx = aim.x / fl, fz = aim.z / fl, ahead = (d: number, side = 0) => [aim.cx + fx * d - fz * side, aim.cz + fz * d + fx * side] as const
  const face = Math.atan2(-fx, -fz)
  const body = (x: number, z: number, st = 'recover', t = 99, kind = 'shambler') => `{ id: C.nextId++, kind: '${kind}', x: ${x}, y: ${s.y}, z: ${z}, yaw: ${face}, hp: 9999, maxHp: 9999, state: '${st}', t: ${t}, wx: ${x}, wz: ${z}, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }`
  const cost = async (n: number) => { await C(`C.hollows.length = 0; for (let i = 0; i < ${n}; i++) C.hollows.push(${body(0, 0)}); C.hollows.forEach((h, i) => { const sd = (i - 2.5) * 1.3, d = 9; h.x = ${aim.cx} + ${fx} * d - ${fz} * sd; h.z = ${aim.cz} + ${fz} * d + ${fx} * sd; h.wx = h.x; h.wz = h.z })`); await frames(6)
    return p.evaluate(() => new Promise<{ calls: number; ms: number }>(r => { const c: number[] = [], t: number[] = []; let l = performance.now(); const f = () => { const n = performance.now(); t.push(n - l); l = n; c.push((window as any).__ather.calls?.() ?? -1); if (c.length >= 25) { const m = (v: number[]) => [...v].sort((x, y) => x - y)[v.length >> 1]; r({ calls: m(c), ms: m(t) }) } else requestAnimationFrame(f) }; requestAnimationFrame(f) })) }
  { const L: string[] = []; let e: any, m: any; for (let k = 0; k < 3; k++) { e = await cost(0); m = await cost(6); L.push(`${e.calls} -> ${m.calls} calls, ${e.ms.toFixed(0)} -> ${m.ms.toFixed(0)} ms`) }
    console.log(`   cost, none -> six walkers 9 m off: ${L.join(' | ')}`); ok((m.calls - e.calls) / 6 <= 3.01, `5. a walker costs ${((m.calls - e.calls) / 6).toFixed(1)} draw calls (the lumps: 3)`) }
  if (!costOnly) {
  // ── 1 ──
  { const ids = await C(`C.hollows.length = 0; const a = ${body(...ahead(8, -1.5))}, b = ${body(...ahead(8, 1.5))}; C.hollows.push(a, b); return [a.id, b.id]`) as number[]
    await frames(12)
    const [a, b] = await p.evaluate((i: number[]) => i.map(k => (window as any).__ather.walker?.(k) ?? null), ids)
    console.log(`   ${JSON.stringify(a)}`)
    ok(!!a && a.bones === 8 && a.shared && !!b?.shared && a.drawn > 0, `1. both draw the one shared skin (${a?.tris ?? 'old'} triangles)`)
    const hx = [1, 3, 5].map(k => parseInt((a?.colour ?? '#ffffff').slice(k, k + 2), 16)); ok(Math.max(...hx) <= 0x18 && Math.max(...hx) - Math.min(...hx) <= 4, `   near-black, no hue (${a?.colour})`)
    ok(!!a && a.emissive === 0 && a.env && a.rough < 0.3, '   wet, borrowing, no glow') }
  // ── 2 ── each round crosses its point in one step, down the walker's own front line
  const shot = async (q: [number, number]) => { const [hx, hz] = ahead(9)
    await C(`C.hollows.length = 0; C.rounds.length = 0; const h = ${body(hx, hz)}; C.hollows.push(h); window.__w = h`); await frames(4)
    await C(`const h = window.__w, c = Math.cos(h.yaw), n = Math.sin(h.yaw); h.state = 'recover'; h.t = 99; C.rounds.push({ x: h.x + ${q[0]} * c + n * 1.2, y: h.y + ${q[1]}, z: h.z - ${q[0]} * n + c * 1.2, vx: -n * 120, vy: 0, vz: -c * 120, life: 0.06, dmg: 5, crit: 8 })`)
    await frames(6); return 9999 - (await C('return window.__w.hp') as number) }
  { const H = { dome: [0, 1.6], chest: [0, 1], arm: [0.38, 0.75], heel: [0.2, 0.14] } as Record<string, [number, number]>
    for (const [n, q] of Object.entries(H)) { const d = await shot(q); ok(d === (n === 'dome' ? 8 : 5), `2. the ${n} hits (${d})`) }
    for (const q of [[0.7, 1], [0.42, 1.55], [0.6, 0.14]] as [number, number][]) { const d = await shot(q); ok(d === 0, `   ${q} misses (${d})`) } }
  // ── 3 + 6 ── the sim pinned in a state, the body drawn in it, a still of it
  for (const [st, want] of [['rest', (w: any) => w.tell < 0.1 && w.fall < 0.1], ['windup', (w: any) => w.tell > 0.8 && w.sy > 1.12], ['lunge', (w: any) => w.fall > 0.8]] as const) {
    const [hx, hz] = ahead(5)
    await C(`C.hollows.length = 0; const h = ${body(hx, hz)}; C.hollows.push(h); window.__pin = h; const k = () => { if (window.__pin !== h) return; h.x = ${hx}; h.z = ${hz}; h.yaw = ${face}${st === 'rest' ? ' + 0.5' : ' + 0.9'}; h.state = '${st === 'rest' ? 'recover' : st}'; h.t = ${st === 'windup' ? 0.04 : st === 'lunge' ? 0.2 : 99}; requestAnimationFrame(k) }; k()`)
    await frames(25); const w = await C('return A.walker?.(window.__pin.id) ?? null'); ok(!!w && want(w), `3. ${st} is drawn (tell ${w?.tell?.toFixed(2)} fall ${w?.fall?.toFixed(2)} height x${w?.sy?.toFixed(2)})`)
    await p.screenshot({ path: `${out}/live-${st}-${phone ? '390' : 'desk'}.png` as `${string}.png` }) }
  await C('window.__pin = null; C.hollows.length = 0')
  // ── 4 ── a real fight: R, aim, the real trigger, until it is gone
  { await p.evaluate(() => { (window as any).__free = true }); await p.keyboard.press('KeyR'); await sleep(2500)
    const [hx, hz] = ahead(8); const id = await C(`C.hollows.length = 0; const h = ${body(hx, hz, 'chase', 0)}; h.hp = h.maxHp = 45; h.y = ${s.y}; C.hollows.push(h); return h.id`) as number
    const hp = () => C(`const h = C.hollows.find(q => q.id === ${id}); return h ? h.hp : null`) as Promise<number | null>
    const d0 = await C('return (C.drops ?? C.pickups ?? []).length'); let low = 45, gone = false, up = 0, disp = false, drops = 0
    for (let i = 0; i < 60 && !gone; i++) {
      await C('C.keeper.hp = C.keeper.maxHp'); await p.evaluate((k: number) => { const A = (window as any).__ather, C = A.combat(); C.hollows = C.hollows.filter((h: any) => h.id === k); const h = C.hollows[0], c = A.camAim(); if (!h) return; const e = (window as any).__fight?.eye?.() ?? { x: c.cx, y: c.cy, z: c.cz }, dx = h.x - e.x, dz = h.z - e.z, dd = Math.hypot(dx, dz) || 1; A.look(Math.atan2(-dx, -dz), Math.atan2(h.y + 0.95 - e.y, dd)) }, id)
      await p.mouse.down(); await sleep(260); await p.mouse.up(); up++; await sleep(phone ? 500 : 350)
      const v = await hp(); if (v === null) gone = true; else low = Math.min(low, v)
      disp = disp || ((await p.evaluate(() => (window as any).__ather.dispersing?.() ?? [])) as unknown[]).length > 0; drops = Math.max(drops, await C('return (C.drops ?? C.pickups ?? []).length') as number) }
    console.log(`   ${up} trigger pulls, lowest seen ${low}, drops ${d0} -> ${drops}`)
    ok(gone, '4. a real fight: the Repeater put it down'); ok(disp, '   it dispersed'); ok(drops > d0 || (await C('return C.keeper.grey ?? C.grey ?? 0')) > 0, '   grey matter left, as today') }
  }
  ok(errs.length === 0, `7. 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
