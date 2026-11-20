// ── M49 slice 1: A DEED PLOT ON THE NYX-SIDE CONTINENT, ON THE LIVE PAGE ─────────────────────────────────────────────────
// On the continent at Rune Hold's shipyard deed (towns/deed-site.ts), read it as built:
//   1. a deed exists (__deedPlot()) with its grid + town palette list
//   2. the plot is LEVEL: a real walker standing at each of the grid's four corners has feet y within 0.05 m (spread)
//   3. the building stands in the scene (__bpStacks['deed-<id>'])
//   4. the door is walkable: from 5 m in front, real held W through the door gap into the building (not stopped)
//   5. a wall holds: walking at a wall (not the door) stops the walker outside
//   6. 0 page errors
//   npx tsx scripts/deed-plot-check.mts [http://localhost:3201]
import puppeteer from 'puppeteer-core'
import { deedBlueprint, deedPad, deedGround, type Deed } from '../src/app/shimmer/open/towns/deed-plots'
import { placeBlueprint } from '../src/app/shimmer/open/ather/plot-blueprint'
const url = process.argv.slice(2).filter(a => a.startsWith('http'))[0] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.footTp && !!(window as any).__deedPlot, { timeout: 240000 }).catch(() => {}); await sleep(2000)
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const foot = () => p.evaluate(() => (window as any).__drive.foot()) as Promise<{ px: number; py: number; pz: number }>
  const deed = await p.evaluate(() => (window as any).__deedPlot?.() ?? null) as Deed | null
  ok(!!deed && deed.palettes?.length === 3, `1. a deed stands on the continent${deed ? `: ${deed.town} ${deed.kind} ${deed.w}x${deed.d}, ${deed.palettes.length} palettes, level ${deed.level.toFixed(2)}` : ' (none)'}`)
  if (deed) {
    const bp = deedBlueprint(deed), pl = placeBlueprint(bp, deedPad(deed))
    await p.mouse.click(550, 340).catch(() => {})
    const tpFoot = async (x: number, z: number, yaw = 0) => { await p.evaluate((a: number, b: number, c: number) => (window as any).__drive.footTp(a, b, c), x, z, yaw); await sleep(1500) }
    // footTp stands the walker on the NATURAL land: deed-site.ts guarantees a walkable corridor on the deed's front, so every walk starts out there, beyond the bank, and goes on by real W.
    const run = (deed.level - deed.base) / 0.5 + 3
    const walkTo = async (x: number, z: number, tol = 0.45, ms = 60000) => {
      await p.keyboard.down('KeyW'); const t = Date.now(); let s = await foot()
      while (Date.now() - t < ms) {
        s = await foot(); if (Math.hypot(s.px - x, s.pz - z) < tol) break
        await p.evaluate((yw: number) => (window as any).__drive.look(yw), Math.atan2(-(x - s.px), -(z - s.pz))); await sleep(120)
      }
      await p.keyboard.up('KeyW'); await sleep(250); return foot()
    }
    // 2. level: walk onto the plot and round its margin, read feet y at the four corners of the GRID (0.5 m inside its edge)
    const ys: number[] = [], c0 = -0.5, c1 = bp.w + 0.5, r0 = -0.5, r1 = bp.d + 0.5
    const f0 = pl.toWorld(c0, r0 - run); await tpFoot(f0.x, f0.z, Math.atan2(-(pl.toWorld(c0, r0).x - f0.x), -(pl.toWorld(c0, r0).z - f0.z)))
    for (const [u, v] of [[c0, r0], [c1, r0], [c1, r1], [c0, r1]]) { const q = pl.toWorld(u, v); const s = await walkTo(q.x, q.z, 0.35); ys.push(s.py) }
    const gy = [[c0, r0], [c1, r0], [c1, r1], [c0, r1]].map(([u, v]) => { const q = pl.toWorld(u, v); return deedGround(deed, q.x, q.z) })
    ok(Math.max(...gy) - Math.min(...gy) <= 0.05, `2a. the deed's own ground is level at the grid corners (${gy.map(y => y.toFixed(3)).join(' ')})`)
    ok(Math.max(...ys) - Math.min(...ys) <= 0.05 && Math.abs(ys[0] - deed.level) < 0.2, `2. the plot is level: feet y at the four corners ${ys.map(y => y.toFixed(3)).join(' ')} (spread ${(Math.max(...ys) - Math.min(...ys)).toFixed(3)} m, want <= 0.05; level ${deed.level.toFixed(2)})`)
    // 3. the building in the scene
    ok(await poll(async () => !!(await p.evaluate((id: string) => (window as any).__bpStacks?.[id] ?? null, bp.id)), 20000), `3. the building stands in the scene (${bp.id})`)
    // 4. the door: from 5 m in front, held W through the gap
    const doorU = Object.entries(bp.walls).filter(([k, w]) => w.kind === 'door' && k.startsWith('h,') && k.endsWith(',0')).map(([k]) => +k.split(',')[1] + 1)[0]
    const from = pl.toWorld(doorU, -5 - run), inside = pl.toWorld(doorU, 2)
    const yaw = Math.atan2(-(inside.x - from.x), -(inside.z - from.z))
    await tpFoot(from.x, from.z, yaw)
    const s4 = await walkTo(inside.x, inside.z, 0.9, 70000), got = Math.hypot(s4.px - inside.x, s4.pz - inside.z) < 0.9
    const loc = (q: { px: number; pz: number }) => { const dx = q.px - pl.toWorld(0, 0).x, dz = q.pz - pl.toWorld(0, 0).z, r = pl.toWorld(1, 0), ux = r.x - pl.toWorld(0, 0).x, uz = r.z - pl.toWorld(0, 0).z, f = pl.toWorld(0, 1), vx = f.x - pl.toWorld(0, 0).x, vz = f.z - pl.toWorld(0, 0).z; return `u${(dx * ux + dz * uz).toFixed(1)} v${(dx * vx + dz * vz).toFixed(1)}` }
    console.log(`   door walk: start v${(-5 - run).toFixed(1)} run ${run.toFixed(1)} end ${loc(s4)} door u${doorU}`)
    ok(got, `4. the walker walked in through the door gap (${Math.hypot(s4.px - inside.x, s4.pz - inside.z).toFixed(2)} m from the room point, feet y ${s4.py.toFixed(2)})`)
    // 5. a wall holds: aim at the front wall beside the door
    const wallU = doorU + 3.5, wf = pl.toWorld(wallU, -4 - run), wi = pl.toWorld(wallU, 2)
    await tpFoot(wf.x, wf.z, Math.atan2(-(wi.x - wf.x), -(wi.z - wf.z)))
    const s5 = await walkTo(wi.x, wi.z, 0.9, 50000), d5 = Math.hypot(s5.px - wi.x, s5.pz - wi.z)
    ok(d5 > 1.2, `5. a wall holds: aimed at the front wall, the walker ends ${d5.toFixed(2)} m from the point inside it`)
  }
  ok(errs.length === 0, `6. 0 page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
