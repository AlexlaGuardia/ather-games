// ── BETA M120 slice 3: THE FLOATER'S (Flit's) INSECT LOOK, ON THE LIVE PAGE ───────────────────────────────────────────
// A fresh profile out in the Wilds (m120-wilds-teeth-check's route), then, read off the REAL drawn mesh (__ather.flit):
//   1. a floater draws the new body (26 lumps), no emissive, two of them share one geometry (and one material on one ground)
//   2. s3c hit area (Alex 11-24 'bigger hit area'; MOVED from '0.42 m off hits, 0.62 m off misses' all round): 0.42 m still hits,
//      0.62 m over its back still misses; a wing tip, the tail and (tell) the raised wing HIT; past the tip, between wing and
//      tail, and the place the wing was before the tell MISS. The points are poseFlit's own drawn lumps.
//   3. fighting for real: the wings move in a zip, and hold still between zips
//   4. before EACH of two bursts the tell pose is fully drawn (wings up, the tail curled under) at the first shot
//   5. stills: zip, hold, tell (the sim pinned in that state 6 m (and 14 m) ahead of the camera, so the shot is of that state)
//   6. 390x844, 0 page errors
//   npx tsx scripts/m120-flit-look-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { pickWilds } from './lib/glade-gate.mts'   // M172: E at the Glade's gate opens the fold map; the Wilds is a stop on it
import * as THREE from 'three'
import { FLIT, flitMats, poseFlit } from '../src/app/shimmer/open/ather/flit-body'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const stt = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py, z: a.pz } }) as Promise<{ x: number; y: number; z: number }>
  // ── fresh profile: born in the Glade, out by the gate (node-check's route) ──
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  for (let t = 0; t < 90000 && !(await p.evaluate(() => (window as any).__ather.zone() === 'glade' || !!document.querySelector('[data-panel="birth"]') || !!document.querySelector('[data-creator-done]'))); t += 500) await sleep(500)
  if (await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))) {
    const box = await p.evaluate(() => { let best: DOMRect | null = null, area = Infinity
      for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) { const t = (e.innerText ?? '').trim(); if (!t || !/^BE BORN/i.test(t) || t.length > 40) continue
        const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue; if (r.width * r.height < area) { area = r.width * r.height; best = r } }
      return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 } })
    if (box) await p.mouse.click(box.x, box.y)
  }
  for (let t = 0; t < 45000 && !(await p.evaluate(() => (window as any).__ather.zone() === 'glade')); t += 500) { await p.evaluate(() => document.querySelector<HTMLElement>('[data-creator-done]')?.click()); await sleep(500) }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'glade', { timeout: 60000 })
  { const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
    await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
    await p.waitForFunction(() => /the gate \(fold map\)/.test(document.body.innerText), { timeout: 15000 }).catch(() => {})
    await p.keyboard.press('KeyE'); await pickWilds(p) }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 90000 })
  console.log('in the Wilds')
  const C = (f: string) => p.evaluate(`(() => { const A = window.__ather, C = A.combat(); ${f} })()`) as Promise<any>
  const frames = (n: number) => p.evaluate((k: number) => new Promise<void>(r => { let i = 0; const f = () => { if (++i >= k) r(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }), n)
  const body = (x: number, z: number, y: number, st = 'chase', t = 0) => `{ id: C.nextId++, kind: 'floater', x: ${x}, y: ${y}, z: ${z}, yaw: 0, hp: 9999, maxHp: 9999, state: '${st}', t: ${t}, wx: ${x}, wz: ${z}, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }`
  // only ours stay on the field (strays keep welling up); the keeper never goes down
  await p.evaluate(() => { const A = (window as any).__ather; const t = () => { const C = A.combat?.(); if (C) { C.hollows = C.hollows.filter((h: any) => h.hp > 999); C.keeper.hp = C.keeper.maxHp } requestAnimationFrame(t) }; t() })
  await sleep(2500)
  const s = await stt(), aim = await p.evaluate(() => (window as any).__ather.camAim()) as { x: number; z: number; cx: number; cz: number }
  const fl = Math.hypot(aim.x, aim.z) || 1, fx = aim.x / fl, fz = aim.z / fl, ahead = (d: number, side = 0) => [aim.cx + fx * d - fz * side, aim.cz + fz * d + fx * side] as const
  // ── 1 ──
  { const [ax, az] = ahead(9, -2), [bx, bz] = ahead(9, 2)
    const ids = await C(`C.hollows.length = 0; const a = ${body(ax, az, s.y + 2.2, 'recover', 99)}, b = ${body(bx, bz, s.y + 2.2, 'recover', 99)}; C.hollows.push(a, b); return [a.id, b.id]`) as number[]
    await frames(8)
    const [a, b] = await p.evaluate((i: number[]) => i.map(k => (window as any).__ather.flit?.(k) ?? null), ids)
    console.log(`   ${JSON.stringify(a)}`)
    ok(!!a && a.lumps === 26 && a.drawn > 0, `1. a floater draws the new body (${a?.lumps ?? 'old'} lumps, ${a?.tris ?? '?'} triangles)`)
    ok(!!a && a.emissive === 0 && !a.emissiveMap, '   no emissive')
    ok(!!a && !!b && a.geo === b.geo, '   two floaters share one geometry'); console.log(`   same material too: ${a?.mat === b?.mat}`)
    ok(!!a && Math.max(...[1, 3, 5].map(k => parseInt(a.colour.slice(k, k + 2), 16))) - Math.min(...[1, 3, 5].map(k => parseInt(a.colour.slice(k, k + 2), 16))) <= 4, `   the goop grey, no hue (${a?.colour})`) }
  // ── 2 ── each round crosses the point in one step (fired along the body's own side / front, or straight UP: a round that ends its step underground is stopped before it is tested), so its drift cannot move it off
  const pose = (tell: number) => { const m = flitMats(); poseFlit({ t: 0.4, zip: 0, tell, bank: 0, kick: 0, knock: 0 }, m); return m }
  const on = (m: THREE.Matrix4, k = 0) => { const v = new THREE.Vector3().setFromMatrixPosition(m).addScaledVector(new THREE.Vector3().setFromMatrixColumn(m, 0), k); return [v.x, v.y, v.z] as [number, number, number] }
  // q = the point, body local (+z = its facing); d = the round's direction, body local
  const shot = async (q: [number, number, number], d: [number, number, number], tell = false) => {
    const [hx, hz] = ahead(9)
    await C(`C.hollows.length = 0; C.rounds.length = 0; C.spits.length = 0; const h = ${body(hx, hz, s.y + 2.2, tell ? 'charge' : 'recover', tell ? 0.2 : 99)}; h.shots = 3; C.hollows.push(h); window.__fl = h
      const k = () => { if (window.__fl !== h) return; ${tell ? "h.state = 'charge'; h.t = 0.2" : "h.state = 'recover'; h.t = 99"}; requestAnimationFrame(k) }; k()`); await frames(8)
    await C(`const h = window.__fl, c = Math.cos(h.yaw), n = Math.sin(h.yaw), W = v => [v[0] * c + v[2] * n, v[1], -v[0] * n + v[2] * c], q = W(${JSON.stringify(q)}), d = W(${JSON.stringify(d)})
      C.rounds.push({ x: h.x + q[0] - d[0] * 1.2, y: h.y + q[1] - d[1] * 1.2, z: h.z + q[2] - d[2] * 1.2, vx: d[0] * 120, vy: d[1] * 120, vz: d[2] * 120, life: 0.06, dmg: 5, crit: 5 })`)
    await frames(6); const r = await C('const r = window.__fl.hp < 9999; window.__fl = null; return r') as boolean
    await C('C.hollows.length = 0'); return r
  }
  { const H = pose(0), T = pose(1), X: [number, number, number] = [1, 0, 0], D: [number, number, number] = [0, 1, 0], tail = on(H[FLIT.abd + FLIT.abdN - 1])
    const wing = on(H[FLIT.wings + 1], 0.8), wingL = on(H[FLIT.wings], 0.8), up = on(T[FLIT.wings + 1], 0.8), f = (a: number[]) => a.map(v => v.toFixed(2)).join(' ')
    ok((await shot([0, 0.42, 0], X)) && (await shot([0, -0.42, 0], X)), '2. the core: 0.42 m off its middle hits')
    ok(await shot(wing, D), `   a wing tip hits (${f(wing)})`); ok(await shot(wingL, D), `   the other wing tip hits (${f(wingL)})`)
    ok(await shot(tail, X), `   the tail's end hits (${f(tail)})`)
    ok(await shot(up, X, true), `   tell: the raised wing hits (${f(up)})`)
    ok(!(await shot([0, 0.62, 0], X)), '   0.62 m over its back misses'); ok(!(await shot([1.1, 0, 0], D)), '   1.1 m out, past the wing tip, misses')
    ok(!(await shot([0.55, 0, -0.85], D)), '   between wing and tail misses'); ok(!(await shot([wing[0], 0, wing[2]], D, true)), '   tell: where the wing WAS misses') }
  // ── 3 + 4 ── a real fight, two bursts
  { const [hx, hz] = ahead(13)
    await C(`C.hollows.length = 0; C.spits.length = 0; C.hollows.push(${body(hx, hz, s.y + 2.2)})
      const R = window.__fl = { zip: [], hold: [], bursts: [], spits: 0, tellMinInCharge: 9, done: false }; const seen = new WeakSet(); let inB = 0
      const tick = () => { if (R.done) return; const f = C.hollows.find(q => q.hp > 999), P = f && A.flit?.(f.id)
        if (P) { if (f.state === 'chase' && P.zip > 0.85) R.zip.push(P.wingTipY); if (f.state === 'chase' && P.zip < 0.03 && P.tell < 0.03) R.hold.push(P.wingTipY); if (f.state === 'recover' && P.tell < 0.02 && P.zip < 0.02) R.hold.push(P.wingTipY), R.holdTail = P.tailZ }
        for (const q of C.spits) if (!seen.has(q)) { seen.add(q); if (q.splash) { R.spits++; if (f && inB === 0 && P) R.bursts.push({ tell: P.tell, lift: P.lift, tailZ: P.tailZ, wingTipY: P.wingTipY }); inB = (inB + 1) % 3 } }
        requestAnimationFrame(tick) }; requestAnimationFrame(tick)`)
    let R: any; for (let t = 0; t < 120000; t += 500) { await sleep(500); R = await p.evaluate(() => (window as any).__fl); if (R.spits >= 6 || (t > 60000 && !R.zip.length && !R.hold.length && R.spits >= 3)) break }
    await p.evaluate(() => { (window as any).__fl.done = true })
    const r = (a: number[]) => a.length ? Math.max(...a) - Math.min(...a) : 0
    ok(R.zip.length >= 4 && r(R.zip) > 0.5, `3. the wings move in a zip (tip through ${r(R.zip).toFixed(2)} m, ${R.zip.length} frames)`)
    ok(R.hold.length >= 4 && r(R.hold) < 0.2, `   and are held still in the hold (${r(R.hold).toFixed(2)} m, ${R.hold.length} frames)`)
    ok(R.bursts.length >= 2 && R.bursts.every((b: any) => b.tell > 0.95 && b.lift > 1), `4. the tell pose is fully drawn at the first shot of each burst (${R.bursts.map((b: any) => b.tell.toFixed(2)).join(', ')})`)
    ok(R.bursts.length >= 2 && R.bursts.every((b: any) => b.tailZ > R.holdTail + 0.25), `   the tail curled under toward the keeper (z ${R.bursts.map((b: any) => b.tailZ.toFixed(2)).join(', ')}; hold ${R.holdTail?.toFixed(2)})`) }
  // ── 5. stills ──  (the creator opens over the Wilds on a fresh profile: close it, or the still shows the panel, not the Flit)
  ok(await poll(async () => p.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-creator-done]') ?? [...document.querySelectorAll('button')].find(q => /^looks good$/i.test(q.innerText.trim())); b?.click(); return !b }), 15000), '   the creator is closed')
  await C('C.hollows.length = 0'); await p.evaluate((x, z) => (window as any).__ather.tp(x, z), s.x + fx * 6 + 26 * fz, s.z + fz * 6 - 26 * fx); await sleep(3000)   // clear of the gate
  await p.mouse.click(195, 600); await sleep(2500)
  ok(await p.evaluate(() => !/Click to play/i.test(document.body.innerText)), '   nothing covers the view')
  Object.assign(s, await stt()); Object.assign(aim, await p.evaluate(() => (window as any).__ather.camAim()))
  for (const [st, dist, tag] of [['zip', 6, ''], ['hold', 6, ''], ['tell', 6, ''], ['hold', 14, '-14m'], ['tell', 14, '-14m']] as const) {
    const [hx, hz] = ahead(dist), [tx, tz] = ahead(dist, 8)
    await C(`C.hollows.length = 0; C.spits.length = 0; const h = ${body(hx, hz, s.y + 2.1)}; C.hollows.push(h); window.__pin = h; const k = () => { if (window.__pin !== h) return; h.x = ${hx}; h.z = ${hz}; h.y = ${s.y + 2.1}
      ${st === 'zip' ? `h.state = 'chase'; h.zips = 2; h.t = 0.9; h.zx = ${tx}; h.zz = ${tz}` : st === 'hold' ? `h.state = 'chase'; h.zips = 2; h.t = 0.9; h.zx = h.zz = undefined` : `h.state = 'charge'; h.shots = 3; h.t = 0.25`}
      requestAnimationFrame(k) }; k()`)
    await frames(25); const P = await C('return A.flit?.(window.__pin.id) ?? null')
    console.log(`   still ${st}: zip ${P?.zip?.toFixed(2)} tell ${P?.tell?.toFixed(2)} wing lift ${P?.lift?.toFixed(2)} drawn ${P?.drawn}`)
    ok(!!P && (st === 'zip' ? P.zip > 0.8 : st === 'hold' ? P.zip < 0.1 && P.tell < 0.1 : P.tell > 0.95), `5. ${st}${tag} still is of the ${st} pose`)
    await p.screenshot({ path: `${out}/flit-${st}${tag}.png` })
  }
  await C('window.__pin = null; C.hollows.length = 0')
  ok(errs.length === 0, `6. 390x844, 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
