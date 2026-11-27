// BETA M193 (Alex 11-26/27: a dashed pale line across the meadow on the home plot, 'had to position the camera just right'):
// THE GROUND IS WATERTIGHT. Reads every drawn ground mesh (userData.gladeGround: own island, meadow, mates' islands) from the
// live three.js scene (__THREE_DEVTOOLS__ observe hook), in world space as the GPU gets it (f32), and checks that every edge with
// ground on both sides is shared BIT-EXACTLY by two triangles (an unshared or float-near-miss seam rasterises sub-pixel cracks
// at grazing angles) and that no two ground triangles overlap. --cluster = a 4-keeper cluster shaped like Alex's (test keepers
// dummy-m193-*, never a real account; writes data/accounts.db for them only and takes them back out): before M193 the three
// mates' islands, drawn through a turned <group>, left 18 near-miss edges on their meadow seams.
//   npx tsx scripts/m193-edges.mts [url=https://ather.games] [query=&ground=layers] [--cluster]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
if (!process.env.ATHER_SESSION_SECRET) { const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m); if (m) process.env.ATHER_SESSION_SECRET = m[1].trim() }
const { mintSession } = await import('../src/lib/accounts/session')
const { upsertGoogleAccount, claimUsername, addFriend, acceptFriend } = await import('../src/lib/accounts/db')
const C = await import('../src/lib/accounts/clusters')
const CLUSTER = process.argv.includes('--cluster')
const NAMES = ['dummy_m193a', 'dummy_m193b', 'dummy_m193c', 'dummy_m193d']
const K = NAMES.map(n => { const a = upsertGoogleAccount(`dummy-m193-${n}`, null, null); if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}`) } return { id: a.user_id, name: n } })
for (const a of K) for (const b of K) if (a.id < b.id) { const r = addFriend(a.id, b.name); if (r.ok || /already/i.test((r as { error?: string }).error ?? '')) acceptFriend(b.id, a.id) }
const reset = () => { for (const k of K) { if (C.getCluster(k.id)) C.takeBackCorner(k.id) } for (const k of K) for (const o of C.offersFor(k.id)) C.answerOffer(k.id, o.cluster_id, o.quarter, false, 0, 0) }
reset()
if (CLUSTER) { const [KH, ...KM] = K, SEAT = ['nw', 'sw', 'se'] as const
  const f = C.foldCluster(KH.id, 'ne', true, 0, 0); if (!f.ok) throw new Error(`fold: ${f.error}`)
  KM.forEach((k, i) => { const q = SEAT[i], o = C.offerQuarter(KH.id, k.name, q); if (!o.ok) throw new Error(`offer ${o.error}`)
    for (const m of C.getCluster(KH.id)!.members) C.consentOffer(m.user_id, q)
    const y = C.answerOffer(k.id, f.value.cluster_id, q, true, 0, 0); if (!y.ok) throw new Error(`answer ${y.error}`) }) }
const url = process.argv[2] ?? 'https://ather.games', q = process.argv[3] ?? '&ground=layers'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const p = await br.newPage()
p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
await p.setViewport({ width: 960, height: 600 })
await p.evaluateOnNewDocument('window.__name = (f) => f')
if (CLUSTER) await p.setCookie({ name: 'ather_session', value: mintSession(K[0].id, K[0].name), domain: new URL(url).hostname, path: '/', httpOnly: true })
await p.evaluateOnNewDocument((tut: unknown, id: string | null) => {
  const w = window as any, hub = new EventTarget(), seen: any = { scenes: [] }
  seen.renderers = []; hub.addEventListener('observe', (e: Event) => { const d = (e as CustomEvent).detail; if (d?.isScene) seen.scenes.push(d); if (d?.render && d?.domElement) seen.renderers.push(d) })
  w.__THREE_DEVTOOLS__ = hub; w.__probe = seen
  localStorage.setItem('ather:epoch', '2'); for (const pre of ['', id ? `u:${id}:` : '']) localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(tut))
  const owned: string[] = []; for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) owned.push(`${i},${j}`)
  for (const pre of ['', id ? `u:${id}:` : '']) localStorage.setItem(`${pre}ather.garden.v1`, JSON.stringify({ owned, grey: 0, pages: 9, layout: 3 }))
}, TUT, CLUSTER ? K[0].id : null)
await p.goto(`${url}/shimmer/open/ather?hour=14${q}`, { waitUntil: 'load', timeout: 300000 })
await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__green, { timeout: 300000, polling: 1000 })
await sleep(4000)
const r = await p.evaluate(() => {
  const pr = (window as any).__probe; let s: any = null, best = -1
  for (const sc of pr.scenes) { let n = 0; sc.traverse(() => n++); if (n > best) { best = n; s = sc } }
  const tris: number[][] = [], meshes: string[] = []
  s.updateMatrixWorld(true)
  s.traverse((o: any) => {
    if (!o.isMesh || !o.userData?.gladeGround || !o.visible) return
    const pos = o.geometry.attributes.position, e = o.matrixWorld.elements, idx = o.geometry.index
    meshes.push(`${pos.count}v id${o.id}`)
    const n = idx ? idx.count : pos.count
    const V = (k: number) => { const i = idx ? idx.getX(k) : k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      return [Math.fround(e[0] * x + e[4] * y + e[8] * z + e[12]), Math.fround(e[1] * x + e[5] * y + e[9] * z + e[13]), Math.fround(e[2] * x + e[6] * y + e[10] * z + e[14])] }
    for (let k = 0; k < n; k += 3) { const a = V(k), b = V(k + 1), c = V(k + 2)
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz) || 1
      if (Math.abs(ny) / L < 0.3) continue   // a skirt
      tris.push([...a, ...b, ...c, o.id]) }
  })
  const key = (x: number, z: number, t: number) => `${Math.round(x / t)},${Math.round(z / t)}`
  const exact = new Map<string, number>(), loose = new Map<string, number>()
  const ek = (a: number[], b: number[], t: number) => { const ka = t ? key(a[0], a[2], t) : `${a[0]},${a[1]},${a[2]}`, kb = t ? key(b[0], b[2], t) : `${b[0]},${b[1]},${b[2]}`; return ka < kb ? ka + '|' + kb : kb + '|' + ka }
  for (const t of tris) { const P = [[t[0], t[1], t[2]], [t[3], t[4], t[5]], [t[6], t[7], t[8]]]
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) { const k1 = ek(P[i], P[j], 0), k2 = ek(P[i], P[j], 0.01); exact.set(k1, (exact.get(k1) ?? 0) + 1); loose.set(k2, (loose.get(k2) ?? 0) + 1) } }
  // cover test: a grid of triangles by xz
  const G = 8, grid = new Map<string, number[]>()
  tris.forEach((t, k) => { const xs = [t[0], t[3], t[6]], zs = [t[2], t[5], t[8]]
    for (let gx = Math.floor(Math.min(...xs) / G); gx <= Math.floor(Math.max(...xs) / G); gx++) for (let gz = Math.floor(Math.min(...zs) / G); gz <= Math.floor(Math.max(...zs) / G); gz++) { const kk = `${gx},${gz}`; if (!grid.has(kk)) grid.set(kk, []); grid.get(kk)!.push(k) } })
  const covered = (x: number, z: number) => (grid.get(`${Math.floor(x / G)},${Math.floor(z / G)}`) ?? []).some(k => { const t = tris[k]
    const d = (x1: number, z1: number, x2: number, z2: number) => (x - x2) * (z1 - z2) - (x1 - x2) * (z - z2)
    const d1 = d(t[0], t[2], t[3], t[5]), d2 = d(t[3], t[5], t[6], t[8]), d3 = d(t[6], t[8], t[0], t[2])
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) })
  const cracks: any[] = []; let exactBoundary = 0, nearMiss = 0
  for (const t of tris) { const P = [[t[0], t[1], t[2]], [t[3], t[4], t[5]], [t[6], t[7], t[8]]]
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
      if (exact.get(ek(P[i], P[j], 0)) !== 1) continue
      exactBoundary++
      const a = P[i], b = P[j], mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2, dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1
      const both = covered(mx - dz / L * 0.3, mz + dx / L * 0.3) && covered(mx + dz / L * 0.3, mz - dx / L * 0.3)
      if (!both) continue
      const lm = loose.get(ek(a, b, 0.01)) ?? 0
      if (lm >= 2) nearMiss++
      if (cracks.length < 30) cracks.push({ a: a.map(v => +v.toFixed(4)), b: b.map(v => +v.toFixed(4)), mesh: t[9], looseMatch: lm })
      else cracks.length < 31 && cracks.push('...')
    } }
  let overlap = 0; const ov: any[] = []
  tris.forEach((t, k) => { const x = (t[0] + t[3] + t[6]) / 3, z = (t[2] + t[5] + t[8]) / 3, y = (t[1] + t[4] + t[7]) / 3
    const hit = (grid.get(`${Math.floor(x / G)},${Math.floor(z / G)}`) ?? []).filter(j => { if (j === k) return false; const u = tris[j]
      const d = (x1: number, z1: number, x2: number, z2: number) => (x - x2) * (z1 - z2) - (x1 - x2) * (z - z2)
      const d1 = d(u[0], u[2], u[3], u[5]), d2 = d(u[3], u[5], u[6], u[8]), d3 = d(u[6], u[8], u[0], u[2])
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) })
    if (hit.length) { overlap++; if (ov.length < 8) ov.push({ at: [+x.toFixed(1), +y.toFixed(2), +z.toFixed(1)], mesh: t[9], others: hit.map(j => [tris[j][9], +((tris[j][1] + tris[j][4] + tris[j][7]) / 3).toFixed(2)]) }) } })
  return { overlap, ov, meshes, tris: tris.length, exactBoundary, interiorUnshared: cracks.length, nearMiss, cracks }
})
console.log(JSON.stringify(r, null, 0).slice(0, 3000))
const fails: string[] = [], ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
ok(r.meshes.length === (CLUSTER ? 5 : 2), `ground meshes: own island + meadow${CLUSTER ? ' + 3 mates' : ''} (${r.meshes.length})`)
ok(r.interiorUnshared === 0, `every ground edge with ground on both sides is shared bit-exactly (unshared ${r.interiorUnshared}, float near-misses ${r.nearMiss}; before M193: 18 on the mate seams)`)
ok(r.overlap === 0, `no two ground triangles overlap (${r.overlap})`)
ok(errs.length === 0, `0 page errors (${errs.slice(0, 2).join(' | ')})`)
await br.close()
reset()
console.log(fails.length ? `FAIL ${fails.length}` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
