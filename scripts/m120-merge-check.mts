// ── BETA M120 slice 2: THE MERGING HOLLOW, ON THE LIVE PAGE ────────────────────────────────────────────────────────────
// A fresh profile (born in the Glade, out by the gate's E, as m120-wilds-teeth-check), then in the Wilds:
//   1. two crawlers (build word for the merging Hollow) touching on DRAINED ground pool into ONE: mass 2, hp + maxHp summed
//      (35+35), the merge counted, and the body DRAWN bigger (__ather.drawnScale > 1.2)
//   2. a third pools on: mass 3, hp 105 (endless adding)
//   3. OFF drained ground (a node cleared for this visit only, __ather.spend) two touching crawlers stay two
//   4. the keeper's rounds DISPERSE the pooled one: it ends, nothing splits off
//   5. 390x844, 0 page errors
// Hooks: __ather.state / zone / gladeAt / tp / combat / nodes / owner / drained / spend / drawnScale.
//   npx tsx scripts/m120-merge-check.mts [--url https://ather.games] [--out dir]
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
  const C = (f: string) => p.evaluate(`(() => { const A = window.__ather, C = A.combat(); ${f} })()`) as Promise<any>
  const clear = () => C('C.hollows.length = 0; C.spits.length = 0; C.keeper.hp = C.keeper.maxHp; C.packs = {}')
  // two (or more) crawlers held still (stagger 99) at given spots; returns their ids
  const put = (pts: [number, number][]) => C(`const ids = []; for (const [x, z] of ${JSON.stringify(pts)}) { const h = { id: C.nextId++, kind: 'crawler', mass: 1, x, y: A.state().py, z, yaw: 0, hp: 35, maxHp: 35, state: 'stagger', t: 99, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }; C.hollows.push(h); ids.push(h.id) } return ids`) as Promise<number[]>
  const mine = (ids: number[]) => C(`return C.hollows.filter(h => ${JSON.stringify(ids)}.includes(h.id)).map(h => ({ id: h.id, mass: h.mass, hp: h.hp, maxHp: h.maxHp, x: h.x, z: h.z, drawn: A.drawnScale(h.id) }))`) as Promise<{ id: number; mass: number; hp: number; maxHp: number; x: number; z: number; drawn: number | null }[]>
  // ── 1. pooling on drained ground ──
  await sleep(2000); await clear()
  const s = await stt(), px = s.x + 7, pz = s.z
  const drainedHere = await C(`return A.drained(${px}, ${pz})`)
  ok(drainedHere === true, `   the spot 7 m off the keeper is drained ground (${drainedHere})`)
  const m0 = await C('return C.merges ?? 0') as number
  const ids = await put([[px, pz], [px + 0.8, pz]])
  let got: Awaited<ReturnType<typeof mine>> = []
  await poll(async () => { got = await mine(ids); return got.length === 1 && got[0].drawn !== null && got[0].drawn > 1.2 }, 15000)
  const m1 = await C('return C.merges ?? 0') as number
  ok(got.length === 1 && got[0].mass === 2 && got[0].hp === 70 && got[0].maxHp === 70, `1. two touching crawlers pooled: ${JSON.stringify(got)}`)
  ok(m1 > m0, `   merge counted (${m0} -> ${m1})`)
  ok(!!got[0] && (got[0].drawn ?? 0) > 1.2, `   drawn bigger: scale ${got[0]?.drawn?.toFixed(2)}`)
  await p.screenshot({ path: `${out}/m120-merged.png` }).catch(() => {})
  // ── 2. a third pools on ──
  const third = await put([[got[0].x + 1.1, got[0].z]])
  let got3: Awaited<ReturnType<typeof mine>> = []
  await poll(async () => { got3 = await mine([...ids, ...third]); return got3.length === 1 && got3[0].mass === 3 }, 15000)
  ok(got3.length === 1 && got3[0].mass === 3 && got3[0].hp === 105, `2. a third pooled on: ${JSON.stringify(got3)}`)
  // ── 4. the keeper's rounds disperse it (fired from the keeper's eye at its body, as the gun's rounds fly) ──
  {
    const big = got3[0]
    let killed = false, shots = 0
    for (let i = 0; i < 120 && !killed; i++) {
      killed = await C(`const h = C.hollows.find(q => q.id === ${big.id}); if (!h) return true
        const s = A.state(), ex = s.px, ey = s.py + 1.5, ez = s.pz, ty = h.y + 0.35 * (A.drawnScale(h.id) ?? 1.5)
        const dx = h.x - ex, dy = ty - ey, dz = h.z - ez, l = Math.hypot(dx, dy, dz)
        C.rounds.push({ x: ex + dx / l, y: ey + dy / l, z: ez + dz / l, vx: dx / l * 90, vy: dy / l * 90, vz: dz / l * 90, life: 1, dmg: 12, crit: 24 }); C.keeper.hp = C.keeper.maxHp; return false`) as boolean
      shots++; await sleep(120)
    }
    await sleep(500)
    const left = await C(`return C.hollows.filter(h => h.kind === 'crawler' && Math.hypot(h.x - ${big.x}, h.z - ${big.z}) < 6).length`) as number
    ok(killed && left === 0, `4. the pooled one (hp 105) dispersed after ${shots} rounds; ${left} crawlers left there (no split)`)
  }
  // ── 3. off drained ground: clear the nearest node for this visit, stand on its ground, two touching crawlers stay two ──
  {
    await clear()
    const nodes = await C('return A.nodes().map(n => ({ id: n.id, x: n.x, z: n.z }))') as { id: string; x: number; z: number }[]
    const me = await stt()
    const n = nodes.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]
    await C(`A.spend(${JSON.stringify(n.id)})`)
    // a walkable spot on that node's ground, off the mound
    let spot: { x: number; z: number } | null = null
    for (const r of [12, 18, 25, 8]) for (let k = 0; k < 8 && !spot; k++) {
      const x = n.x + Math.cos(k * 0.785) * r, z = n.z + Math.sin(k * 0.785) * r
      const q = await C(`return { own: A.owner(${x}, ${z}), dr: A.drained(${x}, ${z}) }`) as { own: string | null; dr: boolean | null }
      const q2 = await C(`return A.drained(${x + 0.8}, ${z})`)
      if (q.own === n.id && q.dr === false && q2 === false) spot = { x, z }
    }
    ok(!!spot, `   node ${n.id} cleared for this visit; its ground reads NOT drained at ${spot?.x.toFixed(0)},${spot?.z.toFixed(0)}`)
    if (spot) {
      // the keeper stands near (tp may land a little off on rough ground); the crawlers go on the checked spot itself
      await p.evaluate((x, z) => (window as any).__ather.tp(x, z), spot.x - 7, spot.z); await sleep(3000); await clear()
      const ox = spot.x, oz = spot.z
      await C(`A.spend(${JSON.stringify(n.id)})`)   // the page drops its this-visit clears when the node list reloads (a tp can do that)
      const dr = await C(`return A.drained(${ox}, ${oz})`)
      const m2 = await C('return C.merges ?? 0') as number
      await C(`A.spend(${JSON.stringify(n.id)})`)
      const ids2 = await put([[ox, oz], [ox + 0.8, oz]])
      // hold the clear for the whole window (the page drops this-visit clears whenever its node list reloads) and watch the
      // ground under both: if it ever read drained the run proves nothing, so say so instead of passing or failing on it
      let everDrained = false
      for (let t = 0; t < 20; t++) {
        everDrained ||= await C(`A.spend(${JSON.stringify(n.id)}); return C.hollows.filter(h => ${JSON.stringify(ids2)}.includes(h.id)).some(h => C.drained?.(h.x, h.z) !== false)`) as boolean
        await sleep(300)
      }
      const got2 = await mine(ids2), m3 = await C('return C.merges ?? 0') as number
      ok(dr === false && !everDrained && got2.length === 2 && got2.every(h => h.mass === 1) && m3 === m2, `3. off drained ground (drained ${dr}, ever drained in the window: ${everDrained}) two touching crawlers stayed two: ${JSON.stringify(got2.map(h => ({ id: h.id, mass: h.mass })))}`)
    }
  }
  await clear()
  ok(errs.length === 0, `5. 390x844, 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
