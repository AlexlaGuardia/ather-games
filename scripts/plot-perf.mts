// What the home plot costs to DRAW, against the Wilds, measured on the live page.
//
//   npx tsx scripts/plot-perf.mts
//   PERF_AT='garden' PERF_VS='' npx tsx scripts/plot-perf.mts    — override the two places
//
// ★ WHY THIS EXISTS RATHER THAN `WORLD_FPS=1`. Alex reports a STEADY low frame rate in the plot on a
// desktop GPU — not hitching, so this is not chunk generation, it is what a frame has to do. The
// headless box runs SwiftShader, so **any frame RATE it reports is meaningless** and the frame meter
// cannot answer this. Draw calls, triangles, geometries and instance counts are CPU-side scene facts
// and are exactly as true under SwiftShader as under a real driver. Those are what this reads.
//
// ⚠⚠ IT SAMPLES UNTIL THE COUNTS STOP CLIMBING, AND THAT IS THE WHOLE INSTRUMENT. The world streams
// in; a single reading after a fixed settle measures how far the loader got, not what the place
// costs — and the two are indistinguishable in the output. `ather-games` has been bitten by exactly
// this before (a terrain shot read as a render regression because ground cover trails the column by
// tens of seconds). So: poll, and only believe a number that has stopped moving.
//
// ⚠⚠⚠ `/goto garden` DOES NOT PUT YOU IN THE FOLD — IT LANDS YOU AT ITS DOOR, OUTSIDE, IN THE WILDS.
// This cost a full afternoon of measurements on 2026-08-22 and every one of them was internally
// consistent, reproducible and plausible. `void-check.mts` says it outright and has said so since
// 08-16: the reply is *"is a fold — you are at its door"* and its own assert is
// `hypot(gx, gz) > 480`, **"standing outside the fold, not in it"**. That half is true and stands:
// `/goto garden` is the DOOR, and a probe that only teleports never leaves the Wilds.
//
// ── ★★★ CORRECTED 2026-08-23 (world lane). WHAT THIS HEADER SAID NEXT WAS FALSE WHEN WRITTEN ────
// It said *"no console command reaches the plot"*, and concluded **"treat any fold measurement as
// UNMEASURED"**. `/space [plot|wilds]` reaches it, is owner-gated, and has shipped since
// **2026-08-15** — `51e6b7f`, *"plot: the second space — the Home Plot exists and can be stood in"*,
// command table at `VoxelWorld.tsx:809`. This file was added 08-22, seven days later.
// `enterSpace('plot')` is a real crossing: it flips `space.current`, clears every voxel and flora
// cache, and lands the keeper at the derived threshold. Measured headless the same way this script
// runs — see `scripts/fold-profile.mts`, which crosses and confirms position twice from
// `space.current` itself.
//
// ⚠ THE DAMAGE WAS NOT THE FALSE SENTENCE, IT WAS THE CONCLUSION DRAWN FROM IT. Being wrong is
// discoverable by looking; a doc that tells you not to look retires the question instead, and the
// fold went unmeasured for a day on the strength of this paragraph. The reasoning was that the canon
// door is slice 2 — true, and it does not imply the console cannot cross. **An absence claim needs a
// stronger measurement than a presence claim, and this one had none.** Same family as the comment
// citing `brew-reach.test.ts`, a file that has never existed.
//
// ★ WHAT GAVE IT AWAY, AND IT WAS NOT THE SCENE: the game's own HUD stat line printed
// `moonwell-glade` for BOTH readings. My scene traversal could not see that, because a traversal
// reports what is in the scene and never where the scene IS. The lesson is the one this repo keeps
// paying for — **use the instrument the game already publishes before building a second one** — and
// the sharper half: my hand-rolled probe and the numbers it produced agreed with each other
// perfectly the whole time. Self-consistency is not evidence about position.
//
// So the two places below are labelled HERE and AFTER-GOTO. They are still not "wilds" and "plot" —
// this script does not cross, so its own two readings remain two Wilds locations and it must not
// claim otherwise. That is now a statement about THIS SCRIPT, not about the fold: the fold is
// reachable and has been measured. Use `fold-profile.mts` for it, or teach this one `/space`.
//
// ★ NO PAGE CODE IS ADDED. `THREE.WebGLRenderer` and `THREE.Scene` announce themselves on
// `window.__THREE_DEVTOOLS__` at construction if it exists. Installing an EventTarget there BEFORE
// any page script gets us the live renderer with no dev global, no owner-only hook, and nothing to
// remember to take back out.
import puppeteer from 'puppeteer-core'

const URL_ = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 10)
const RADIUS = Number(process.env.WORLD_RADIUS ?? 0)
/** Where to measure. Empty string = wherever a keeper spawns (the glade, Wilds side). */
const AT = process.env.PERF_AT ?? 'garden'
const VS = process.env.PERF_VS ?? ''
/** Poll interval and the ceiling on how long we will wait for saturation. */
const STEP = Number(process.env.PERF_STEP ?? 3)
const MAX_POLLS = Number(process.env.PERF_POLLS ?? 12)

type Sample = {
  calls: number; triangles: number; geometries: number; programs: number
  meshes: number; instanced: number; instances: number; visible: number
  transparent: number; points: number
}

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,760'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })

  await page.evaluateOnNewDocument((R: number) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'barrier')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['barrier']))
    if (R) localStorage.setItem('shimmer.voxel.settings.v1', JSON.stringify({ viewRadius: R }))
    // The devtools channel, installed before three exists. `observe` fires once per renderer and
    // once per scene, at construction.
    const w = window as unknown as Record<string, unknown>
    const hub = new EventTarget()
    const seen: { renderers: unknown[]; scenes: unknown[] } = { renderers: [], scenes: [] }
    hub.addEventListener('observe', (e: Event) => {
      const d = (e as CustomEvent).detail as { isWebGLRenderer?: boolean; isScene?: boolean }
      if (d?.isWebGLRenderer) seen.renderers.push(d)
      else if (d?.isScene) seen.scenes.push(d)
    })
    w.__THREE_DEVTOOLS__ = hub
    w.__probe = seen
  }, RADIUS)

  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  const KEY = process.env.OWNER_KEY
  if ((AT || VS) && !KEY) {
    console.error('needs OWNER_KEY (teleport is owner-gated) — `set -a; . /root/ather-games/.env; set +a`')
    process.exit(2)
  }
  if (KEY) await page.goto(`${new globalThis.URL(URL_).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })

  await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60_000 })
  await new Promise(r => setTimeout(r, SETTLE * 1000))

  const grabbed = await page.evaluate(() => {
    const p = (window as unknown as { __probe?: { renderers: unknown[]; scenes: unknown[] } }).__probe
    return { renderers: p?.renderers.length ?? 0, scenes: p?.scenes.length ?? 0 }
  })
  if (!grabbed.renderers) {
    console.error(`no renderer observed (renderers=${grabbed.renderers} scenes=${grabbed.scenes}) — the devtools hook did not catch it; do not read anything below as a measurement`)
    process.exit(3)
  }
  console.log(`hooked: ${grabbed.renderers} renderer(s), ${grabbed.scenes} scene(s)`)

  const sample = (): Promise<Sample> => page.evaluate(() => {
    const p = (window as unknown as { __probe: { renderers: any[]; scenes: any[] } }).__probe
    const gl = p.renderers[0]
    // The BIGGEST scene, not the first — R3F pages carry small offscreen scenes too.
    let scene: any = null, best = -1
    for (const s of p.scenes) { let n = 0; s.traverse(() => n++); if (n > best) { best = n; scene = s } }
    let meshes = 0, instanced = 0, instances = 0, visible = 0, transparent = 0, points = 0
    scene?.traverse((o: any) => {
      if (o.isPoints) points++
      if (!o.isMesh) return
      if (o.isInstancedMesh) { instanced++; instances += o.count ?? 0 } else meshes++
      if (o.visible) visible++
      const m = o.material
      const mats = Array.isArray(m) ? m : m ? [m] : []
      if (mats.some((x: any) => x?.transparent)) transparent++
    })
    return {
      calls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, programs: gl.info.programs?.length ?? 0,
      meshes, instanced, instances, visible, transparent, points,
    }
  })

  /**
   * Who the draw calls actually belong to.
   *
   * ⚠ A TOTAL SAYS THERE IS A COST AND NEVER WHOSE IT IS. The face census said plot terrain has
   * 0.33x the Wilds' exposed faces while the page draws 2.40x the calls, so the extra is not the
   * ground and no amount of staring at the totals separates the candidates. Grouped by the object's
   * own name, falling back to its parent's and then its type, because `drawn` meshes are named by
   * their column key and would otherwise be one row each.
   */
  const breakdown = (): Promise<[string, number, number, number][]> => page.evaluate(() => {
    const p = (window as unknown as { __probe: { scenes: any[] } }).__probe
    let scene: any = null, best = -1
    for (const s of p.scenes) { let n = 0; s.traverse(() => n++); if (n > best) { best = n; scene = s } }
    const tally = new Map<string, [number, number, number]>()   // count, triangles, instances
    scene?.traverse((o: any) => {
      if (!o.isMesh || !o.visible) return
      const g = o.geometry
      const idx = g?.index ? g.index.count : (g?.attributes?.position?.count ?? 0)
      const tris = (idx / 3) * (o.isInstancedMesh ? (o.count ?? 1) : 1)
      // A column mesh is named for its chunk, so name-alone would give one row per chunk.
      const raw = o.name || o.parent?.name || o.type
      const key = /^-?\d+,-?\d+/.test(raw) ? 'column mesh' : (raw || o.type)
      const cur = tally.get(key) ?? [0, 0, 0]
      cur[0]++; cur[1] += tris; cur[2] += o.isInstancedMesh ? (o.count ?? 0) : 0
      tally.set(key, cur)
    })
    return [...tally.entries()].map(([k, v]) => [k, v[0], Math.round(v[1]), v[2]] as [string, number, number, number])
      .sort((a, b) => b[2] - a[2])
  })

  /** Poll until `calls` AND `triangles` stop climbing, so a number that is still loading is never reported as a cost. */
  const measure = async (label: string): Promise<Sample | null> => {
    let prev: Sample | null = null, still = 0, s: Sample | null = null
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, STEP * 1000))
      s = await sample()
      const grew = !prev || s.calls > prev.calls || s.triangles > prev.triangles
      still = grew ? 0 : still + 1
      console.log(`  ${label} t+${((i + 1) * STEP + SETTLE)}s  calls ${s.calls}  tris ${s.triangles.toLocaleString()}  geom ${s.geometries}  inst ${s.instanced}/${s.instances}${still ? `  · settled x${still}` : ''}`)
      if (still >= 2) return s
      prev = s
    }
    console.log(`  ⚠ ${label} NEVER SETTLED in ${MAX_POLLS * STEP + SETTLE}s — the numbers below are a lower bound, not a cost`)
    return s
  }

  const goto = async (zone: string) => {
    await page.keyboard.press('KeyT'); await new Promise(r => setTimeout(r, 300))
    await page.keyboard.type(`/goto ${zone}`); await page.keyboard.press('Enter')
    await new Promise(r => setTimeout(r, 300)); await page.keyboard.press('Escape')
    await new Promise(r => setTimeout(r, SETTLE * 1000))
  }

  const places: { name: string; zone: string }[] = []
  // ⚠ Named for WHAT WAS DONE, never for where we hope that landed — see the header.
  places.push({ name: VS ? `after /goto ${VS}` : 'spawn (glade)', zone: VS })
  if (AT) places.push({ name: `after /goto ${AT}`, zone: AT })

  const out: Record<string, Sample | null> = {}
  for (const pl of places) {
    if (pl.zone) await goto(pl.zone)
    console.log(`\n── ${pl.name} ──`)
    out[pl.name] = await measure(pl.name)
    // ★ AND THE GAME'S OWN STAT LINE, WHICH IS THE INSTRUMENT THAT ALREADY EXISTED. `onStats`
    // publishes `N col · N mesh · N draws · Nk tris · geo N prog N` every 10th frame. It carries the
    // one number no scene traversal can recover — how many COLUMNS are loaded — which is what
    // separates "the plot holds more ground" from "the plot's ground costs more per column".
    // My own grouped breakdown collapsed to a single `Mesh` row because column meshes carry no
    // name; reading the HUD is both cheaper and authoritative.
    const hud = await page.evaluate(() => {
      const hit = [...document.querySelectorAll('*')]
        .map(e => (e.textContent ?? '').trim())
        .filter(t => / col · /.test(t) && / draws · /.test(t))
        .sort((a, b) => a.length - b.length)[0]
      return hit ?? null
    })
    console.log(`  hud · ${hud ?? 'NOT FOUND — the stat line did not match; treat nothing here as a column count'}`)
  }

  console.log('\n─── settled ───')
  const names = Object.keys(out)
  for (const n of names) {
    const s = out[n]
    if (!s) { console.log(`${n}: no sample`); continue }
    console.log(`${n.padEnd(22)} calls ${String(s.calls).padStart(5)}  tris ${s.triangles.toLocaleString().padStart(11)}  geom ${String(s.geometries).padStart(4)}  progs ${s.programs}  mesh ${s.meshes}  inst ${s.instanced}/${s.instances}  transparent ${s.transparent}  points ${s.points}`)
  }
  if (names.length === 2 && out[names[0]] && out[names[1]]) {
    const a = out[names[0]]!, b = out[names[1]]!
    const r = (x: number, y: number) => y === 0 ? 'n/a' : `${(x / y).toFixed(2)}x`
    console.log(`\nratio ${names[1]} / ${names[0]}:  calls ${r(b.calls, a.calls)}  tris ${r(b.triangles, a.triangles)}  geom ${r(b.geometries, a.geometries)}  instances ${r(b.instances, a.instances)}`)
  }
  console.log('\n⚠ SwiftShader: these are SCENE facts (valid). Any frame RATE from this box is not.')
  if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 6).join('\n  ')}`)
} finally {
  await browser.close()
}
