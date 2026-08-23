// Does a LIVED-IN fold cost more than an empty one? The half of Alex's question his own reading
// cannot answer, because his garden is planted and every fold this box can generate is bare.
//
//   set -a; . /root/ather-games/.env; set +a
//   CROPS=200 npx tsx scripts/fold-crops.mts
//
// ── ★★ WHY CROPS AND NOT CHESTS OR WALLS (hub's steer, 08-23) ──────────────────────────────────
// Built structures bake into the CHUNK MESH and arrive with the column. Crops do not: they are
// instances in `flora-mesh`, a separate renderer with its own pool, its own cap and its own sync —
// the pipeline that trails a column by tens of seconds and the one that has already been caught
// overrunning silently (herbs at 199% of cap on 08-22: present, breakable, undrawn). Seeding walls
// would have exonerated "content" while missing the only part of content with a second pipeline.
//
// ── ★★★ THE SAVE IS THE GAME'S OWN, AND ONLY `beds` IS INJECTED ────────────────────────────────
// A hand-built `PlayerSave` is a mirror of a shape this script does not own, and the 08-22 law says
// a copy and its original agree right up until they don't. So: let the page boot, cross, and write
// its OWN player record; then read that record back, add `beds` to it, put it back, and reload.
// Every other field is the game's. What is injected is one array whose element shape comes straight
// out of `planting.ts:123`.
//
// ── ⚠⚠⚠ THE GATE, AND IT IS THE WHOLE POINT OF THE FILE ────────────────────────────────────────
// A seed the game silently rejects reads as **"crops cost nothing"** — a confident wrong answer in
// the direction that gets acted on. Three checks, and any one failing means BLIND rather than free:
//
//   1. **THE DELTA, NOT THE ABSOLUTE.** `instances` is not trustworthy across a crossing — measured
//      r6: wilds 10523 -> plot 0, and r12: wilds 777 -> plot 777 to the unit, because the flora
//      rebuild after `enterSpace` is async and a short window reads the PREVIOUS space's mesh. So
//      this compares plot-with-crops against plot-without-crops, same procedure, same crossing, and
//      reads only the DIFFERENCE. ⚠ An exact match between two readings is not corroboration — it
//      is the single most persuasive output a broken probe can produce.
//   2. **≈ N, NOT > 0.** `CAP.crop` is 6000 (`flora-mesh.ts:97`) and the pool stops QUIETLY at it.
//      Seed 8000, read 6000, and a `> 0` gate passes while the slope flattens into "crops get
//      cheaper at scale". A slope measured across a ceiling is two regimes averaged into one line.
//   3. **THE OVERFLOW WARNING.** `noteOverflow` (`flora-mesh.ts:111`) console.warns `[flora] crop
//      pool overflowed: N wanted, M drawn`. Captured here. If it fires, the reading above the cap is
//      invalid BY CONSTRUCTION rather than by judgement — no interpretation required.
//
// ⚠ SwiftShader: frame rate and gpu time are void, as ever. Draws / triangles / instances are
// CPU-side facts and are what this reads. And a seeded fold is MY approximation of Alex's, not his.
import puppeteer from 'puppeteer-core'

const URL_ = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 12)
const N = Number(process.env.CROPS ?? 200)
const STEP = Number(process.env.PERF_STEP ?? 6)
const MAX_POLLS = Number(process.env.PERF_POLLS ?? 14)
const SHA = process.env.PROBE_SHA ?? 'unstamped'
const FLORA_SHA = process.env.PROBE_FLORA_SHA ?? 'unstamped'

const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set — `set -a; . /root/ather-games/.env; set +a`'); process.exit(2) }
if (N > 6000) console.log(`⚠ CROPS=${N} is above CAP.crop (6000) — the pool will clip and say so. Deliberate?`)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})

type Sample = { calls: number; triangles: number; instances: number; meshes: number; geometries: number }

/** One full pass: boot, cross into the fold, saturate, report. `seed` injects crops before the read. */
async function pass(label: string, seed: number): Promise<{ s: Sample; overflow: string[]; saturated: boolean }> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  const origin = new globalThis.URL(URL_).origin
  const overflow: string[] = []
  page.on('console', m => { const t = m.text(); if (/\[flora\]/.test(t)) overflow.push(t) })

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
    localStorage.setItem('shimmer.voxel.settings.v1', JSON.stringify({ showFps: true }))
    const w = window as unknown as Record<string, unknown>
    const hub = new EventTarget()
    const s: { renderers: unknown[]; scenes: unknown[] } = { renderers: [], scenes: [] }
    hub.addEventListener('observe', (e: Event) => {
      const d = (e as CustomEvent).detail as { isWebGLRenderer?: boolean; isScene?: boolean }
      if (d?.isWebGLRenderer) s.renderers.push(d); else if (d?.isScene) s.scenes.push(d)
    })
    w.__THREE_DEVTOOLS__ = hub; w.__probe = s
  })
  await page.goto(`${origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(SETTLE * 1000)

  const cmd = async (line: string): Promise<string> => {
    await page.keyboard.press('KeyT'); await sleep(320)
    await page.keyboard.type(line); await page.keyboard.press('Enter')
    let r = ''
    for (let t = 0; t < 1400; t += 200) { await sleep(200); r += `\n${await page.evaluate(() => document.body.innerText)}` }
    await page.keyboard.press('Escape'); return r
  }

  await cmd('/space plot')
  await sleep(2500)
  const already = await cmd('/space plot')
  ok(/already in the plot/.test(already), `${label}: space.current === 'plot' (the ref, not a place name)`)

  if (seed > 0) {
    // ── Let the game write its OWN record first, then add one field to it ────────────────────────
    // ⚠ THE POSITION IS READ BACK FROM THE SAVE, NOT ASSUMED. Crops are placed around wherever the
    // keeper actually landed, because a crop outside the view frustum costs nothing to draw and
    // would read as "crops are free" — the failure this whole file exists to refuse.
    await sleep(4000)
    const placed = await page.evaluate(async (n: number) => {
      const open = (): Promise<IDBDatabase> => new Promise((res, rej) => {
        const r = indexedDB.open('shimmer-voxel', 1)
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
      })
      const db = await open()
      const all = await new Promise<{ k: IDBValidKey[] }>((res, rej) => {
        const tx = db.transaction('edits', 'readonly')
        const rq = tx.objectStore('edits').getAllKeys()
        rq.onsuccess = () => res({ k: rq.result }); rq.onerror = () => rej(rq.error)
      })
      const pk = all.k.find(k => String(k).endsWith(':player'))
      if (!pk) return { ok: false, why: 'no player record — the game never autosaved', n: 0 }
      const rec: any = await new Promise((res, rej) => {
        const tx = db.transaction('edits', 'readonly')
        const rq = tx.objectStore('edits').get(pk)
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error)
      })
      if (!rec) return { ok: false, why: 'player record empty', n: 0 }
      if (rec.space !== 'plot') return { ok: false, why: `record says space=${rec.space}, not plot`, n: 0 }
      const bx = Math.round(rec.x), by = Math.round(rec.y), bz = Math.round(rec.z)
      // A block of beds in front of the keeper. `zoneId` MUST be `bed:<y>` — `bedsFromSave` drops
      // any crop whose zone is not, on purpose, so a play3d save cannot land in voxel beds.
      const side = Math.ceil(Math.sqrt(n))
      const beds: unknown[] = []
      for (let i = 0; i < n; i++) {
        const x = bx + (i % side) - Math.floor(side / 2)
        const z = bz + Math.floor(i / side) + 2
        beds.push({
          id: `bed-${x},${by},${z}`, cropId: 'atherwheat',
          tileX: x, tileY: z, zoneId: `bed:${by}`,
          plantedAt: Date.now() - 60_000, growthDuration: 600_000,
        })
      }
      rec.beds = beds
      await new Promise<void>((res, rej) => {
        const tx = db.transaction('edits', 'readwrite')
        tx.objectStore('edits').put(rec, pk)
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
      })
      return { ok: true, why: `${beds.length} beds at y${by} around ${bx},${bz}`, n: beds.length }
    }, seed)
    ok(placed.ok, `${label}: seeded — ${placed.why}`)
    if (!placed.ok) { await page.close(); return { s: { calls: 0, triangles: 0, instances: 0, meshes: 0, geometries: 0 }, overflow, saturated: false } }
    // Reload so the save is HYDRATED by the game's own loader rather than by us poking live state.
    await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60_000 })
    await sleep(SETTLE * 1000)
    const back = await cmd('/space plot')
    ok(/already in the plot/.test(back), `${label}: still in the plot after reload (save carried the space)`)
  }

  const sample = (): Promise<Sample> => page.evaluate(() => {
    const p = (window as unknown as { __probe: { renderers: any[]; scenes: any[] } }).__probe
    const gl = p.renderers[0]
    let scene: any = null, best = -1
    for (const s of p.scenes) { let n = 0; s.traverse(() => n++); if (n > best) { best = n; scene = s } }
    let instances = 0, meshes = 0
    scene?.traverse((o: any) => { if (!o.isMesh) return; if (o.isInstancedMesh) instances += o.count ?? 0; else meshes++ })
    return {
      calls: gl?.info?.render?.calls ?? 0, triangles: gl?.info?.render?.triangles ?? 0,
      geometries: gl?.info?.memory?.geometries ?? 0, instances, meshes,
    }
  })

  let prev: Sample | null = null, stable = 0, s = await sample(), saturated = false
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(STEP * 1000)
    s = await sample()
    const same = prev && s.calls === prev.calls && s.triangles === prev.triangles && s.instances === prev.instances
    stable = same ? stable + 1 : 0
    console.log(`   ${label} t+${String((i + 1) * STEP).padStart(3)}s  ${String(s.calls).padStart(4)} draws · ${String(Math.round(s.triangles / 1000)).padStart(4)}k tris · ${String(s.instances).padStart(5)} inst${stable ? `  (steady ×${stable})` : ''}`)
    prev = s
    if (stable >= 3) { saturated = true; break }
  }
  if (!saturated) console.log(`   ⚠ ${label} NEVER SATURATED in ${MAX_POLLS * STEP}s — counts are a FLOOR`)
  await page.close()
  return { s, overflow, saturated }
}

try {
  console.log(`measured at ${SHA}  ·  flora-mesh ${FLORA_SHA}  ·  seeding ${N} crops\n`)
  console.log('── BARE FOLD ────────────────────────────────────────────────')
  const bare = await pass('bare', 0)
  console.log('\n── PLANTED FOLD ─────────────────────────────────────────────')
  const sown = await pass('sown', N)

  console.log('\n════════ BARE vs PLANTED ════════════════════════════════════')
  const d = (a: number, b: number) => `${b - a >= 0 ? '+' : ''}${b - a}`
  console.log(`  draws        ${String(bare.s.calls).padStart(6)} -> ${String(sown.s.calls).padStart(6)}   ${d(bare.s.calls, sown.s.calls)}`)
  console.log(`  triangles    ${String(bare.s.triangles).padStart(6)} -> ${String(sown.s.triangles).padStart(6)}   ${d(bare.s.triangles, sown.s.triangles)}`)
  console.log(`  instances    ${String(bare.s.instances).padStart(6)} -> ${String(sown.s.instances).padStart(6)}   ${d(bare.s.instances, sown.s.instances)}`)

  const delta = sown.s.instances - bare.s.instances
  const over = [...bare.overflow, ...sown.overflow]
  console.log('')
  if (over.length) { console.log('  ⚠⚠ FLORA POOL OVERFLOWED — the reading above the cap is invalid BY CONSTRUCTION:'); for (const o of over) console.log(`     ${o}`) }
  // ── THE GATE ─────────────────────────────────────────────────────────────────────────────────
  if (delta === 0) {
    console.log(`  ⚠⚠⚠ BLIND, NOT FREE. ${N} crops seeded and the instance count did not move.`)
    console.log('     The save was rejected, the beds are out of frustum, or the planted feed never ran.')
    console.log('     This is NOT evidence that crops are cheap. Do not report it as a measurement.')
    fails++
  } else if (delta < N * 0.5) {
    console.log(`  ⚠⚠ SHORTFALL: seeded ${N}, instances moved ${delta}. A shortfall is the finding —`)
    console.log('     the pool clipped, the loader dropped rows, or beds fell outside the view. Not a slope.')
    fails++
  } else {
    console.log(`  ✓ seed took: ${N} seeded, instances +${delta} (${Math.round((delta / N) * 100)}%)`)
    console.log(`  → cost of ${N} crops: ${d(bare.s.calls, sown.s.calls)} draws, ${d(bare.s.triangles, sown.s.triangles)} triangles`)
  }
  if (!bare.saturated || !sown.saturated) console.log('  ⚠ at least one side never saturated — treat the delta as a floor')
  console.log(`\n${fails ? `✗ ${fails} check(s) failed` : '✓ all gates passed'}`)
  process.exit(fails ? 1 : 0)
} finally { await browser.close() }
