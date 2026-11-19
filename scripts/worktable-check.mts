// ── M39 slice 2: THE SETTLEMENT WORKTABLE, AS THE OWNER (world d5a9e927, 11-19) ─────────────────────────────────────────
// /shimmer/dev/blueprints with real input: draw a 6 x 4 room (four mouse drags, screen points projected through the page's own
// orbit lens: shelf-rig's view yaw pi/2, pitch 0.75, dist 18 round (6.5, 0.5, 4), fov 45), tap a door into its front, pick a
// lot with NO saved blueprint (never Alex's), Save; the status strip shows it; New clears, Load brings it back; at the Glade
// that lot stands it. The keeper's save is untouched (open.works.v1 never written). The test save is set aside in a finally.
//   set -a; . /root/ather-games/.env; set +a; npx tsx scripts/worktable-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import * as THREE from 'three'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/worktable-check')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set: set -a; . /root/ather-games/.env; set +a'); process.exit(2) }
const VIEW = { yaw: Math.PI / 2, pitch: 0.75, dist: 18 }, TGT = new THREE.Vector3(6.5, 0.5, 4)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1200, height: 800 })
let saved: string | null = null
try {
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 60000 })
  await p.goto(`${url}/shimmer/dev/blueprints`, { waitUntil: 'load', timeout: 240000 })
  const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  ok(await poll(() => p.evaluate(() => !!(window as any).__worktable && !!document.querySelector('[data-bench="worktable"] canvas')), 120000), 'the worktable loads (owner)')
  await sleep(3000)
  const rect = await p.evaluate(() => { const r = document.querySelector('[data-bench="worktable"] canvas')!.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  const cam = new THREE.PerspectiveCamera(45, rect.w / rect.h, 0.1, 500)
  const cp = Math.cos(VIEW.pitch), sp = Math.sin(VIEW.pitch)
  cam.position.set(TGT.x + Math.cos(VIEW.yaw) * cp * VIEW.dist, TGT.y + sp * VIEW.dist, TGT.z + Math.sin(VIEW.yaw) * cp * VIEW.dist); cam.lookAt(TGT); cam.updateMatrixWorld()
  const scr = (x: number, z: number) => { const v = new THREE.Vector3(x, 0, z).project(cam); return { x: rect.x + (v.x + 1) / 2 * rect.w, y: rect.y + (1 - v.y) / 2 * rect.h } }
  const dragW = async (ax: number, az: number, bx: number, bz: number) => { const a = scr(ax, az), b = scr(bx, bz); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 10 }); await p.mouse.up(); await sleep(600) }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); await sleep(400); return true }
  const before = await p.evaluate(() => localStorage.getItem('open.works.v1'))
  // a lot with NO blueprint of Alex's
  await poll(async () => Object.keys(await p.evaluate(() => (window as any).__worktable.status())).length === 5, 20000)
  const st0 = await p.evaluate(() => (window as any).__worktable.status()) as Record<string, string>
  const lot = ['hazel', 'sax', 'yarrow', 'mallow', 'fennel'].find(l => st0[l] === 'blockout') ?? null
  if (!lot) { ok(false, 'a lot without a saved blueprint to test on'); throw new Error('no free lot') }
  console.log(`testing on ${lot}'s lot`)
  await tap('[data-tool="walls"]')
  await dragW(3, 1, 9, 1); await dragW(3, 5, 9, 5); await dragW(3, 1, 3, 5); await dragW(9, 1, 9, 5)
  const w1 = await p.evaluate(() => ({ walls: (window as any).__worktable.walls(), rooms: (window as any).__worktable.rooms() }))
  ok(w1.walls === 20 && w1.rooms === 1, `1. four real drags draw a 6 x 4 room (${w1.walls} pieces, ${w1.rooms} room)`)
  await tap('[data-tool="door"]'); { const d = scr(5.5, 1); await p.mouse.click(d.x, d.y); await sleep(600) }
  const msg = await p.evaluate(() => document.querySelector('[data-wt-msg]')?.textContent ?? '')
  try { await p.screenshot({ path: `${out}-1.png` }) } catch { /* slow */ }
  await p.select('#wt-lot', lot); await sleep(300)
  await tap('[data-act="save"]')
  ok(await poll(async () => ((await p.evaluate(() => (window as any).__worktable.status())) as Record<string, string>)[lot] === 'blueprint 13 x 8', 20000), `2. Save: ${lot}'s lot now reads 'blueprint 13 x 8' in the status strip (${msg})`)
  saved = `glade-${lot}`
  const bp = await p.evaluate((id: string) => fetch(`/shimmer/open/house-blueprints?id=${id}`, { cache: 'no-store' }).then(r => r.json()), saved)
  ok(Object.values(bp.walls ?? {}).filter((w: any) => w.kind === 'door').length === 2, '   the saved blueprint has the 2 m door')
  await tap('[data-act="new"]'); const cleared = await p.evaluate(() => (window as any).__worktable.walls())
  await tap('[data-act="load"]')
  ok(cleared === 0 && await poll(async () => (await p.evaluate(() => (window as any).__worktable.walls())) === 20), '3. New clears the lot, Load brings the blueprint back')
  ok(await p.evaluate(() => localStorage.getItem('open.works.v1')) === before, "   the keeper's save was never touched")
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => ((await p.evaluate(() => (window as any).__glade?.blueprints?.() ?? [])) as string[]).includes(lot), 240000), `4. at the Glade, ${lot}'s lot stands it`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally {
  if (saved) { const st = await p.evaluate((id: string) => fetch(`/shimmer/save-house-blueprint?id=${id}`, { method: 'DELETE' }).then(r => r.status), saved).catch(() => 0); console.log(`cleanup: test blueprint ${saved} set aside (${st})`) }
  await br.close()
}
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
