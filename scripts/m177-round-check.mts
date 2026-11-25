// ── BETA M175 + M177: ROUNDS ON THE LIVE PAGE ─────────────────────────────────────────────────────────────────────────
// A fresh profile out into the Wilds (m120-merge-check's route), then:
//   1. the held Repeater's round flies at its M177 speed (72 m/s, was 40) and carries its gun (the streak is drawn as that gun's)
//   2. LOW FPS (CDP CPU throttle x6; the game caps a step at 1/20 s): rounds fired from the eye at a low crawler 6 m off, at
//      the gun's speed and at 90 m/s (m120-merge-check's), each lands (>= 90%). Before M175 a step that ended underground
//      past the crawler was stopped before the hit test.
//   3. 0 page errors. --shots before|after: a screenshot per gun's rounds into --out (our own renders, docs/looks/m177-*).
//   npx tsx scripts/m177-round-check.mts [--desk] [--shots after] [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { pickWilds } from './lib/glade-gate.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const desk = process.argv.includes('--desk'), shots = flag('--shots', '')
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844 })
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
    // 11-25: the creator ('Who are you?') can come up late, over the gate or the travel: close it, and try the gate again
    for (let t = 0; t < 8 && !(await p.evaluate(() => (window as any).__ather.zone() === 'wilds')); t++) {
      await p.evaluate(() => document.querySelector<HTMLElement>('[data-creator-done]')?.click()); await sleep(800)
      if (await p.$('[data-panel="fold-map"]')) await pickWilds(p).catch(() => false)
      else { await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz))); await sleep(1500); await p.keyboard.press('KeyE') }
      await sleep(3000)
    } }
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 90000 }).catch(async e => { await p.screenshot({ path: `${out}/m177-nowilds.png` }).catch(() => {}); console.log('NO WILDS; zone', await p.evaluate(() => (window as any).__ather.zone()), '|', (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400)); throw e })
  console.log('in the Wilds')
  const C = (f: string) => p.evaluate(`(() => { const A = window.__ather, C = A.combat(); ${f} })()`) as Promise<any>
  const clear = () => C('C.hollows.length = 0; C.spits.length = 0; C.keeper.hp = C.keeper.maxHp; C.packs = {}')
  const tag = desk ? 'desk' : '390'
  await sleep(2000); await clear()
  // 1. the gun's speed + the round's gun
  const g = await C(`const n0 = C.rounds.length; return { id: C.gun.id, v: C.gun.projSpeed, reach: Math.round(C.gun.projSpeed * C.gun.projLife) }`) as { id: string; v: number; reach: number }
  ok(g.id === 'repeater' && g.v === 72 && g.reach === 72, `1. the newcomer's ${g.id} flies ${g.v} m/s, reach ${g.reach} m (M177: 72 m/s, reach 72 m; before 40 m/s)`)
  // 2. low fps
  const cdp = await p.target().createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
  await sleep(1500)
  const fps = await p.evaluate(() => new Promise<number>(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)) }; requestAnimationFrame(f) }))
  console.log(`   throttled: ${fps.toFixed(1)} fps (a step is capped at 1/20 s)`)
  for (const speed of [g.v, 90]) {
    let hit = 0, n = 0, steps: number[] = []
    for (let i = 0; i < 20; i++) {
      await clear()
      const s = await stt(), a = (i / 20) * Math.PI * 2, cx = s.x + Math.sin(a) * 6, cz = s.z + Math.cos(a) * 6
      const id = await C(`const h = { id: C.nextId++, kind: 'crawler', mass: 1, x: ${cx}, y: A.state().py, z: ${cz}, yaw: 0, hp: 1000, maxHp: 1000, state: 'stagger', t: 99, wx: ${cx}, wz: ${cz}, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false }; C.hollows.push(h); return h.id`) as number
      await sleep(400)
      const fired = await C(`const h = C.hollows.find(q => q.id === ${id}); if (!h) return null
        const s = A.state(), ex = s.px, ey = s.py + 1.5, ez = s.pz, ty = h.y + 0.35 * (A.drawnScale(h.id) ?? 0.5)
        const dx = h.x - ex, dy = ty - ey, dz = h.z - ez, l = Math.hypot(dx, dy, dz)
        const r = { x: ex + dx / l * 0.4, y: ey + dy / l * 0.4, z: ez + dz / l * 0.4, vx: dx / l * ${speed}, vy: dy / l * ${speed}, vz: dz / l * ${speed}, life: 1, dmg: 12, crit: 12 }
        C.rounds.push(r); window.__m177r = r; window.__m177p = { x: r.x, z: r.z }; return h.hp`) as number | null
      if (fired === null) continue
      await poll(async () => await C('return !C.rounds.includes(window.__m177r)') as boolean, 4000)
      const after = await C(`const h = C.hollows.find(q => q.id === ${id}); const r = window.__m177r, q = window.__m177p; return { hp: h ? h.hp : -1, step: Math.hypot(r.x - q.x, r.z - q.z) }`) as { hp: number; step: number }
      n++; if (after.hp < fired) hit++
      steps.push(after.step)
    }
    ok(n >= 15 && hit >= Math.ceil(n * 0.9), `2. low fps (${fps.toFixed(1)} fps), ${speed} m/s at a low crawler 6 m off: ${hit} / ${n} rounds landed`)
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await clear()
  // 3. per-gun shots (look only): each gun's needles laid along the view at 1.2-14 m, held near still, each grown as far as a round fired from
  //    the eye has flown to that spot (the streak's size reads how far it has flown, not how fast), so one frame shows what the gun draws up close and far off. The play overlay is hidden for it.
  if (shots) {
    await p.evaluate(() => { for (const e of document.querySelectorAll<HTMLElement>('div')) if (/^ATHER · YOUR PLOT/.test((e.innerText ?? '').trim()) && e.getBoundingClientRect().height < 500) e.style.display = 'none' })
    for (const gun of ['repeater', 'spitter', 'backbone', 'roar', 'lance', 'charred-rifle']) {
      await clear()
      await C(`const s = A.state(), yaw = A.yaw(), ex = s.px, ey = s.py + 1.5, ez = s.pz, pel = '${gun}' === 'roar' ? 5 : 1
        for (const d of [1.2, 2, 3.5, 6, 10, 14]) for (let j = 0; j < pel; j++) { const a = yaw + 0.05 + (j - (pel - 1) / 2) * 0.025, dx = -Math.sin(a), dz = -Math.cos(a)
          const x = ex + dx * d, y = ey - 0.12 - d * 0.01 + (j % 2) * 0.03, z = ez + dz * d
          C.rounds.push({ x, y, z, vx: dx * 0.01, vy: 0, vz: dz * 0.01, life: 60, dmg: 0, crit: 0, from: { x: ex + dx * 0.4, y: ey - 0.08, z: ez + dz * 0.4 }, gun: '${gun}' }) }`)
      await sleep(1200)
      await p.screenshot({ path: `${out}/${shots}-${tag}-${gun}.png` }).catch(() => {})
    }
    await clear()
    console.log(`   shots: ${out}/${shots}-${tag}-*.png`)
  }
  ok(errs.length === 0, `3. ${tag}, 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
