// ── BETA M120 slice 1: THE WILDS GET TEETH, ON THE LIVE PAGE ───────────────────────────────────────────────────────────
// A fresh profile (born in the Glade, out by the gate's E, as node-check / m117), then in the Wilds:
//   1. the strays come in PACKS (every populated Hollow has a pack; packs of 3+), with the raised HP (shambler 45, floater 30)
//   2. a pack MOVES TOGETHER: its middle moves while its members stay in a clump
//   3. the shambler is faster: a chasing one closes at > 1.85 m/s of sim time (was ~1.7)
//   4. a floater ZIPS >= 2 spots, then fires a 3-shot burst; a shot that lands SPLASHES (combat.splashes +1)
//   5. 390x844, 0 page errors
// Hooks: __ather.state / zone / gladeAt / combat / spawn, __fight.hp. Positions are set in the sim.
//   npx tsx scripts/m120-wilds-teeth-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
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
    await p.waitForFunction(() => /the gate \(the Wilds\)/.test(document.body.innerText), { timeout: 15000 }).catch(() => {})
    await p.keyboard.press('KeyE') }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 90000 })
  console.log('in the Wilds')
  const C = (f: string) => p.evaluate(`(() => { const C = window.__ather.combat(); ${f} })()`) as Promise<any>
  // ── 1. packs, with the raised HP ──
  await poll(async () => (await C('return C.hollows.length')) >= 6, 30000)
  const hs = await C('return C.hollows.map(h => ({ id: h.id, kind: h.kind, pack: h.pack, maxHp: h.maxHp, x: h.x, z: h.z, st: h.state }))') as { id: number; kind: string; pack?: number; maxHp: number; x: number; z: number; st: string }[]
  const packs = new Map<number, typeof hs>(); for (const h of hs) if (h.pack) packs.set(h.pack, [...(packs.get(h.pack) ?? []), h])
  ok(hs.length >= 6 && hs.every(h => !!h.pack), `1. ${hs.length} strays, all in packs (${hs.filter(h => !h.pack).length} loose)`)
  ok([...packs.values()].some(ms => ms.length >= 3), `   ${packs.size} packs, sizes ${[...packs.values()].map(ms => ms.length).join(',')}`)
  ok(hs.every(h => h.maxHp === (h.kind === 'floater' ? 30 : 45)), `   HP raised: ${[...new Set(hs.map(h => `${h.kind} ${h.maxHp}`))].join(', ')}`)
  // ── 2. a pack moves together (the biggest wandering pack, ~15 s of sim) ──
  {
    const [pid] = [...packs.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    const snap = async () => await C(`const ms = C.hollows.filter(h => h.pack === ${pid}); const mx = ms.reduce((a, h) => a + h.x, 0) / ms.length, mz = ms.reduce((a, h) => a + h.z, 0) / ms.length; return { n: ms.length, mx, mz, spread: Math.max(...ms.map(h => Math.hypot(h.x - mx, h.z - mz))), clock: C.clock }`) as { n: number; mx: number; mz: number; spread: number; clock: number }
    const s0 = await snap(); let s1 = s0, spreadMax = s0.spread
    for (let t = 0; t < 60000 && s1.clock - s0.clock < 15; t += 500) { await sleep(500); s1 = await snap(); if (s1.n) spreadMax = Math.max(spreadMax, s1.spread) }
    ok(s1.n >= 3 && Math.hypot(s1.mx - s0.mx, s1.mz - s0.mz) > 1.5 && spreadMax < 8, `2. pack ${pid} (${s1.n}) moved ${Math.hypot(s1.mx - s0.mx, s1.mz - s0.mz).toFixed(1)} m in ${(s1.clock - s0.clock).toFixed(1)} s, widest ${spreadMax.toFixed(1)} m from its middle`)
  }
  const clear = () => C('C.hollows.length = 0; C.spits.length = 0; C.keeper.hp = C.keeper.maxHp; C.packs = {}')
  // freeze the strays' top-up for the rest: populate only adds when below target, so we hold the field with one test body
  // ── 3. a chasing shambler's closing speed (sim clock) ──
  {
    await clear()
    const s = await stt()
    let best = 0
    for (const a of [0, 1.57, 3.14, 4.71]) {
      if (best > 1.85) break
      await C(`C.hollows.length = 0; C.keeper.hp = C.keeper.maxHp; const x = ${s.x} + Math.cos(${a}) * 18, z = ${s.z} + Math.sin(${a}) * 18; C.hollows.push({ id: C.nextId++, kind: 'shambler', x, y: ${s.y}, z, yaw: 0, hp: 9999, maxHp: 9999, state: 'chase', t: 0, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false })`)
      const at = () => C(`const h = C.hollows.find(q => q.hp > 999); C.keeper.hp = C.keeper.maxHp; return h ? { d: Math.hypot(h.x - ${s.x}, h.z - ${s.z}), clock: C.clock, st: h.state } : null`) as Promise<{ d: number; clock: number; st: string } | null>
      await sleep(400); const a0 = await at(); await sleep(3500); const a1 = await at()
      if (a0 && a1 && a1.clock > a0.clock && a1.d > 3) best = Math.max(best, (a0.d - a1.d) / (a1.clock - a0.clock))
      console.log(`   heading ${a}: ${a0?.d.toFixed(1)} -> ${a1?.d.toFixed(1)} m over ${a1 && a0 ? (a1.clock - a0.clock).toFixed(2) : '?'} s (${a1?.st})`)
    }
    ok(best > 1.85, `3. the shambler closes at ${best.toFixed(2)} m/s of sim time (was ~1.7)`)
  }
  // ── 4. the floater: zips, then a 3-shot burst that splashes ──
  {
    let rec: any = null
    for (let tryN = 0; tryN < 4 && !(rec && rec.spits >= 3); tryN++) {
      await clear()
      const s = await stt(), a = tryN * 1.57
      await p.evaluate(`(() => { const C = window.__ather.combat(), s = ${JSON.stringify(s)}
        const x = s.x + Math.cos(${a}) * 13, z = s.z + Math.sin(${a}) * 13
        C.hollows.push({ id: C.nextId++, kind: 'floater', x, y: s.y + 2.2, z, yaw: 0, hp: 9999, maxHp: 9999, state: 'chase', t: 0, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false })
        const R = window.__m120 = { zips: 0, zipsAtFirst: -1, spits: 0, shotClocks: [], splash0: C.splashes ?? 0, splashes: 0, moved: false, wasZip: false, done: false }
        const seen = new WeakSet(); for (const q of C.spits) seen.add(q)
        const tick = () => { if (R.done) return; const f = C.hollows.find(q => q.hp > 999); C.keeper.hp = C.keeper.maxHp
          if (f) { const z = f.zx !== undefined; if (R.wasZip && !z && R.spits === 0) R.zips++; R.wasZip = z }
          for (const q of C.spits) if (!seen.has(q)) { seen.add(q); if (q.splash) { R.spits++; R.shotClocks.push(C.clock); if (R.zipsAtFirst < 0) R.zipsAtFirst = R.zips } }
          // the keeper side-steps 1.3 m once the burst starts: the first shot lands BESIDE them and splashes
          if (R.spits >= 1 && !R.moved) { R.moved = true; window.__ather.tp(s.x + 1.3 * Math.cos(${a} + 1.57), s.z + 1.3 * Math.sin(${a} + 1.57)) }
          R.splashes = (C.splashes ?? 0) - R.splash0
          requestAnimationFrame(tick) }
        requestAnimationFrame(tick) })()`)
      for (let t = 0; t < 60000; t += 500) { await sleep(500); rec = await p.evaluate(() => (window as any).__m120); if (rec.spits >= 3 && rec.splashes >= 1) break }
      await p.evaluate(() => { (window as any).__m120.done = true })
      console.log(`   try ${tryN}: ${JSON.stringify(rec)}`)
      await p.evaluate((x, z) => (window as any).__ather.tp(x, z), s.x, s.z); await sleep(800)
    }
    ok(rec && rec.zipsAtFirst >= 2, `4. the floater zipped ${rec?.zipsAtFirst} spots before its first shot (want >= 2)`)
    ok(rec && rec.spits >= 3 && rec.shotClocks[2] - rec.shotClocks[0] < 1, `   then a 3-shot burst (sim clocks ${rec?.shotClocks.slice(0, 3).map((c: number) => c.toFixed(2)).join(' / ')})`)
    ok(rec && rec.splashes >= 1, `   a shot landed and SPLASHED (combat.splashes +${rec?.splashes})`)
    await p.screenshot({ path: `${out}/m120-floater.png` }).catch(() => {})
  }
  await clear()
  ok(errs.length === 0, `5. 390x844, 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
