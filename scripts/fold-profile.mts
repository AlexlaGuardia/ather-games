// The frame profile taken INSIDE the fold — the reading nobody had taken.
//
//   set -a; . /root/ather-games/.env; set +a
//   npx tsx scripts/fold-profile.mts
//
// ── ★★★ WHAT THIS CAN AND CANNOT ANSWER, SAID FIRST BECAUSE IT IS THE WHOLE RISK ────────────────
// The headless box runs SwiftShader. `plot-perf.mts` already established the split and it holds
// here: **any frame RATE or GPU time this reports is VOID** — a software rasteriser's ms is not a
// desktop driver's ms, and `EXT_disjoint_timer_query_webgl2` is not there at all, so `gpuMs` comes
// back null. Alex's complaint is a steady low rate on a REAL GPU and this script cannot settle it.
//
// What it CAN settle, and what it exists for:
//   · **the crossing** — that a probe can get inside the fold at all (see the stale claim below);
//   · **CPU-side zone ms — as a RANKING between the two places, never as absolutes.** ⚠ MY FIRST
//     CUT OF THIS HEADER CLAIMED THEY WERE TRUE IN ABSOLUTE ms AND THAT WAS WRONG. SwiftShader is
//     not a GPU sitting beside the CPU, it IS the CPU: it reports 96-100% of the frame here, and it
//     is competing with the game's own JS for the same cores. So `world:ticks` reading 124 ms says
//     nothing about what it costs on a machine with a real driver. Percentages are void for the same
//     reason plus an inflated denominator. Read them to see WHICH zone leads, not by how much;
//   · **scene counts** — draws, triangles, geometries, instances are CPU-side facts, exactly true.
//
// ⚠ So this prints wilds and plot SIDE BY SIDE and every conclusion drawn below is a conclusion
// about the DIFFERENCE between two places measured on the same broken clock, never about the clock.
//
// ── ★★★ THE STALE CLAIM THIS SCRIPT EXISTS TO CORRECT (found 2026-08-23, world lane) ────────────
// `plot-perf.mts`'s header states, in bold, that *"no console command reaches the plot and a probe
// that only teleports never leaves the Wilds"*, and on that basis it declares the fold UNMEASURED
// and measures two Wilds locations instead. **That claim was already false when it was written.**
// `/space [plot|wilds]` shipped 2026-08-15 (`51e6b7f`, "the second space — the Home Plot exists and
// can be stood in"); `plot-perf.mts` was added 2026-08-22, seven days later. `enterSpace('plot')` is
// a real crossing — it flips `space.current`, clears every voxel and flora cache, and lands the
// keeper at the derived threshold.
//
// ★ The reason it is worth a paragraph rather than a one-line fix: the claim is an ABSENCE claim
// ("nothing reaches the plot"), and the 08-19 law says an absence claim needs a stronger measurement
// than a presence one. This one had none — it was reasoning from the canon door being slice 2, which
// is true and does not imply the console cannot cross. It then RETIRED THE QUESTION: the fold went
// unmeasured for a day because a comment said it could not be measured. Same family as the doc that
// cited `brew-reach.test.ts`, a file that never existed. **Believe the command table, not the note.**
//
// ── ★★ POSITION IS TAKEN FROM THE GAME'S OWN REF, NEVER FROM A PLACE NAME ───────────────────────
// The HUD stat line prints the SCENE (`moonwell-glade` for both sides of the wall), which is what
// made an afternoon of Wilds-vs-Wilds readings look like plot-vs-wilds. Two confirmations here, both
// sourced from `space.current` itself because that ref is what decides which GENERATOR runs:
//   1. a second `/space plot` must answer **"already in the plot"** — the command reads the ref;
//   2. the snapshot header must read **HOME PLOT (fold)** — `snapshotText` takes `space` from the
//      host's ref for exactly this reason, and refuses to derive it from `biomeAt`.
//
// ── ★★ THE READING IS THE GAME'S, NOT MINE ─────────────────────────────────────────────────────
// `P` copies `snapshotText`. This reads the clipboard rather than scraping the panel, so the zone
// names, the null-gpu wording and the UNACCOUNTED row arrive exactly as Alex would send them. The
// lesson `plot-perf` paid for: use the instrument the game already publishes before building a
// second one — a hand-rolled probe and its numbers agree with each other perfectly while both are
// wrong.
import puppeteer from 'puppeteer-core'

const URL_ = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 12)
const RADIUS = Number(process.env.WORLD_RADIUS ?? 0)
/** Saturation poll: interval in seconds, and the ceiling on how long we wait for the counts to stop. */
const STEP = Number(process.env.PERF_STEP ?? 6)
const MAX_POLLS = Number(process.env.PERF_POLLS ?? 18)

/** Provenance, printed with every reading — see the note at the readings block. */
const SHA = process.env.PROBE_SHA ?? 'unstamped'
const FLORA_SHA = process.env.PROBE_FLORA_SHA ?? 'unstamped'
const PLANTING_SHA = process.env.PROBE_PLANTING_SHA ?? 'unstamped'

const KEY = process.env.OWNER_KEY
if (!KEY) {
  console.error('OWNER_KEY not set — `set -a; . /root/ather-games/.env; set +a` first.')
  console.error('/space is owner-gated: without it the console ACCEPTS the command and never crosses,')
  console.error('which reads as a successful plot measurement taken in the Wilds.')
  process.exit(2)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,760'],
})

type Sample = { calls: number; triangles: number; geometries: number; programs: number; instances: number; meshes: number }

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })

  // Clipboard, because `P` is how the reading leaves the game.
  const origin = new globalThis.URL(URL_).origin
  await browser.defaultBrowserContext().overridePermissions(origin, ['clipboard-read', 'clipboard-write'])

  await page.evaluateOnNewDocument((R: number) => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
    // ⚠ `showFps` IS THE PROFILER'S ONLY GATE (`prof.current.enabled = settings.showFps`). Without
    // this the page runs perfectly, `P` answers "frame meter is off", and there is no reading at all.
    const s: Record<string, unknown> = { showFps: true }
    if (R) s.viewRadius = R
    localStorage.setItem('shimmer.voxel.settings.v1', JSON.stringify(s))
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

  await page.goto(`${origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60_000 })
  const owned = await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
  ok(owned, 'keeper of the realm (/space will actually cross)')
  await sleep(SETTLE * 1000)

  const hooked = await page.evaluate(() => {
    const p = (window as unknown as { __probe?: { renderers: unknown[]; scenes: unknown[] } }).__probe
    return { r: p?.renderers.length ?? 0, s: p?.scenes.length ?? 0 }
  })
  if (!hooked.r) { console.error(`no renderer observed (r=${hooked.r} s=${hooked.s}) — nothing below is a measurement`); process.exit(3) }
  console.log(`hooked: ${hooked.r} renderer(s), ${hooked.s} scene(s)`)

  const sample = (): Promise<Sample> => page.evaluate(() => {
    const p = (window as unknown as { __probe: { renderers: any[]; scenes: any[] } }).__probe
    const gl = p.renderers[0]
    let scene: any = null, best = -1
    for (const s of p.scenes) { let n = 0; s.traverse(() => n++); if (n > best) { best = n; scene = s } }
    let instances = 0, meshes = 0
    scene?.traverse((o: any) => {
      if (!o.isMesh) return
      if (o.isInstancedMesh) instances += o.count ?? 0; else meshes++
    })
    return {
      calls: gl?.info?.render?.calls ?? 0, triangles: gl?.info?.render?.triangles ?? 0,
      geometries: gl?.info?.memory?.geometries ?? 0, programs: gl?.info?.programs?.length ?? 0,
      instances, meshes,
    }
  })

  /** The chat console. Reply is read BEFORE Escape — the log only exists in the DOM while open. */
  const cmd = async (line: string): Promise<string> => {
    await page.keyboard.press('KeyT'); await sleep(320)
    await page.keyboard.type(line); await page.keyboard.press('Enter')
    let reply = ''
    for (let t = 0; t < 1600; t += 200) { await sleep(200); reply += `\n${await page.evaluate(() => document.body.innerText)}` }
    await page.keyboard.press('Escape')
    return reply
  }

  /**
   * ⚠⚠ POLL UNTIL THE COUNTS STOP CLIMBING. A single reading after a fixed settle measures how far
   * the loader got, not what the place costs, and the two are indistinguishable in the output. Flora
   * trails the column by tens of seconds — `ather-games` has read that as a render regression before.
   * An ABSENCE ("the fold is cheap") needs the saturation check; a presence would not.
   */
  let crossed = false
  const saturate = async (label: string): Promise<Sample> => {
    // ⚠⚠ THREE STEADY ROUNDS, NOT TWO, AND I LEARNED THAT FROM THIS SCRIPT LYING TO ME. The first
    // run used two and declared the WILDS saturated at 69 draws / 206k tris. The real saturated
    // figure is 109 draws / 284k tris — the loader had simply gone quiet for one 3s step, and a lull
    // is indistinguishable from a finish if you only require two. The plot held at 11 across both
    // runs, so the conclusion survived; that is luck, not method. A longer STEP is doing more of the
    // work here than the counter is, which is why the default moved 3s -> 6s.
    // ── ★★★ A CROSSING COLLAPSES, IT DOES NOT SATURATE (measured 08-23, `fold-crops.mts`) ────────
    // Bare fold, 6s steps: t+6 481 inst · t+12 481 (a PLATEAU) · t+18 3476 · t+24 **0** · steady.
    // `enterSpace` disposes the previous space's meshes ASYNCHRONOUSLY, so counts climb, plateau,
    // then FALL. Every saturation rule here assumed a climb to a plateau — so a plateau caught
    // before the collapse is a false saturation that **OVERSTATES the fold**.
    //
    // ⚠⚠ THAT CONTAMINATED THIS FILE'S OWN r12 PLOT READING (20 draws / 11k tris / 777 inst): it
    // reported `777` identical to the wilds value, which is the signature of residue, and the fold's
    // true figure is lower. The direction is the safe one — it makes the fold look MORE expensive,
    // so the wilds-vs-plot gap is wider than that run printed — but it is still a wrong number.
    //
    // ★ AND IT SETTLES THE `instances` DISAGREEMENT BELOW rather than leaving the field demoted:
    // **0 is the fold; 777 and 481 are wilds residue mid-eviction.** Neither run misread what it
    // saw; r12 sampled before the collapse. The field is honest once eviction finishes — it just
    // cannot tell you that it has, which is why the collapse must be REQUIRED, not waited out.
    let prev: Sample | null = null, stable = 0, s = await sample()
    let peak = 0, collapsed = false
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(STEP * 1000)
      s = await sample()
      peak = Math.max(peak, s.triangles)
      // ⚠ ONLY THE PLOT PASS CROSSES; the wilds pass only ever climbs, so requiring a collapse there
      // would hang it forever. `crossed` is false for the wilds reading and true after `/space plot`.
      if (!crossed || s.triangles < peak * 0.75) collapsed = true
      const same = prev && s.calls === prev.calls && s.triangles === prev.triangles && s.instances === prev.instances
      stable = same && collapsed ? stable + 1 : 0
      console.log(`   ${label} t+${String((i + 1) * STEP).padStart(3)}s  ${String(s.calls).padStart(5)} draws · ${String(Math.round(s.triangles / 1000)).padStart(5)}k tris · ${String(s.instances).padStart(6)} inst · geo ${s.geometries}${stable ? `  (steady ×${stable})` : ''}`)
      prev = s
      if (stable >= 3) { console.log(`   ${label} saturated`); return s }
    }
    console.log(`   ⚠ ${label} NEVER SATURATED in ${MAX_POLLS * STEP}s — treat its counts as a floor, not a total`)
    return s
  }

  /** The game's own reading, via `P` → clipboard. Returns null if the copy did not land. */
  const snapshot = async (): Promise<string | null> => {
    await page.keyboard.press('KeyP')
    await sleep(600)
    try {
      const t = await page.evaluate(() => navigator.clipboard.readText())
      return t && t.includes('shimmer frame profile') ? t : null
    } catch { return null }
  }

  // ── WILDS, first, so the plot has something to be compared against on the same clock ──────────
  console.log('\n── WILDS (spawn) ────────────────────────────────────────────')
  const wildsCounts = await saturate('wilds')
  const wildsSnap = await snapshot()

  // ── CROSS ────────────────────────────────────────────────────────────────────────────────────
  console.log('\n── CROSSING INTO THE FOLD ───────────────────────────────────')
  const crossed = await cmd('/space plot')
  ok(/stepping into your garden/.test(crossed), 'the console crossed (`stepping into your garden`)')
  await sleep(2000)
  // ★ CONFIRMATION 1 — the command reads `space.current`, so this answer IS the ref.
  const already = await cmd('/space plot')
  ok(/already in the plot/.test(already), '★ `space.current === "plot"` — the ref says we are inside, not at the door')

  crossed = true
  console.log('\n── HOME PLOT (fold) ─────────────────────────────────────────')
  const plotCounts = await saturate('plot')
  const plotSnap = await snapshot()
  // ★ CONFIRMATION 2 — `snapshotText` takes `space` from the host ref and prints it in the header.
  ok(!!plotSnap && /HOME PLOT \(fold\)/.test(plotSnap), '★ the reading labels ITSELF as the fold (header from the space ref)')

  console.log('\n════════ THE READINGS ════════════════════════════════════════')
  // ★ PROVENANCE IN THE OUTPUT, NOT ONLY THE HEADER (hub, 08-23). A reading pasted into a chat
  // outlives the checkout it was taken at, and `flora-mesh.ts` is under active edit in another lane —
  // a slope measured across that edit is silently against two different renderers.
  console.log(`\nmeasured at ${SHA}  ·  flora-mesh ${FLORA_SHA}  ·  planting ${PLANTING_SHA}`)
  console.log('\n⚠⚠ SWIFTSHADER. Every `fps`, `ms`, `worst` and gpu line below is VOID as an absolute —')
  console.log('   a software rasteriser, not Alex\'s desktop driver. Read the ZONE ms and the scene')
  console.log('   counts, and read them as wilds-vs-plot differences on one broken clock.\n')
  // ── ⚠⚠⚠ AND THE DENOMINATOR THAT WOULD LET YOU CHECK THIS IS NOT PUBLISHED ────────────────────
  // `gpuSamples` is a closure local in `profile.ts` (declared :140, incremented :220, consumed :244)
  // and is NOT a field of `FrameProfile`. `frames` IS — and the interface even says of it *"a window
  // of 1 makes every mean above a single sample, so say so."* **The instrument applies its own
  // honesty rule to `ms`'s denominator and not to `gpuMs`'s.** So no consumer — this probe, the
  // panel, `snapshotText`, or a keeper pasting a reading — can detect the bias below. It cannot be
  // printed from out here; publishing it is a one-field change to `voxel3d/profile.ts`, which is
  // deliberately NOT being made ahead of the real-GPU reading it would perturb.
  //
  // ⚠⚠ THE DANGEROUS OUTPUT IS THE PLAUSIBLE PERCENTAGE, NOT THE ABSURD ONE. A visible 110% gets
  // questioned; "gpu time 62% of frame" does not, and is biased by exactly the same mechanism
  // whenever queries drop — which is the population of machines where the timer extension is flaky
  // in the first place. The 110% was a gift, the same way two runs disagreeing was a gift: the
  // visibly broken reading is the one that saves you.
  console.log('  ⚠ gpu %: gpuSamples is unpublished, so this ratio cannot be validated from a reading.')
  console.log('    Under 100% is affected identically and does not announce itself.\n')
  // ⚠ `gpuMs` AND `ms` ARE MEANS OVER DIFFERENT POPULATIONS, SO THEIR RATIO CAN EXCEED 100% — that
  // is arithmetic, not a defect. `ms` averages over `frames`; `gpuMs` averages over `gpuSamples`, and
  // a query lands a frame or two late while a DISJOINT one is dropped entirely. Measured here at
  // **110%** (470.0 ms gpu against a 428.4 ms frame) on a 10-frame window. Small windows make it
  // worse. If a real-GPU reading shows >100%, widen the window before concluding anything from it.
  console.log('--- wilds ---')
  console.log(wildsSnap ?? '  (no reading — clipboard copy did not land)')
  console.log('\n--- home plot (fold) ---')
  console.log(plotSnap ?? '  (no reading — clipboard copy did not land)')

  console.log('\n--- scene counts, saturated (CPU-side, valid here) ---')
  const row = (n: string, a: number, b: number) => {
    const d = a > 0 ? `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(0)}%` : 'n/a'
    console.log(`  ${n.padEnd(12)} wilds ${String(a).padStart(8)}   plot ${String(b).padStart(8)}   ${d.padStart(6)}`)
  }
  row('draws', wildsCounts.calls, plotCounts.calls)
  row('triangles', wildsCounts.triangles, plotCounts.triangles)
  row('instances', wildsCounts.instances, plotCounts.instances)
  // ── ⚠⚠ THE INSTANCE COUNT IS NOT TRUSTWORTHY ACROSS A CROSSING, AND TWO RUNS PROVED IT ────────
  // radius 6:  wilds 10523 -> plot 0.      radius 12: wilds 777 -> plot 777, to the unit.
  // Same probe, same build, same two places. The field cannot be both. `enterSpace` calls
  // `flora.invalidateAll()` and marks it dirty, but the rebuild is ASYNC — a window closing before it
  // finishes reads the PREVIOUS space's instanced mesh and reports it as this one's.
  //
  // ★ THE DISAGREEMENT IS THE FINDING, NOT AN ANNOYANCE. Either number quoted alone is a confident
  // wrong answer: 0 says "the garden grows nothing", 777 says "the garden is as planted as the
  // wilds". The SOURCE settles what the measurement cannot — `src/app/shimmer/voxel/plot.ts` makes
  // ZERO calls to `plantMaterialAt`/`floraAt` where `src/app/shimmer/voxel/column.ts` makes two, so a
  // fold grows no WILD cover by construction. Believe the generator, not this row.
  //
  // ⚠ AND FOR ANY FUTURE SLOPE: `CAP.crop` is 6000 (`flora-mesh.ts:97`) and the pool STOPS QUIETLY
  // at its cap — the overrun Alex surfaced on 08-22, where herbs wanted 199% of cap, existed, were
  // breakable and did not draw. So `instances > 0` is far too weak a gate: seed 8000 and you read
  // 6000, the gate passes, and the slope FLATTENS into "crops get cheaper at scale". Gate on
  // instances ~= N seeded, and read `floraDemand` (`flora-mesh.ts:119`, `{wanted, cap}` per pool at
  // every sync) so a capped run announces itself instead of flattening.
  if (wildsCounts.instances === plotCounts.instances && plotCounts.instances > 0)
    console.log('    ⚠ instances IDENTICAL across the crossing — the flora rebuild had not finished')
  console.log('    ⚠ read `instances` as "did anything plant here", never as a count')
  row('meshes', wildsCounts.meshes, plotCounts.meshes)
  row('geometries', wildsCounts.geometries, plotCounts.geometries)
  row('programs', wildsCounts.programs, plotCounts.programs)

  if (errors.length) { console.log(`\n⚠ ${errors.length} page error(s):`); for (const e of errors.slice(0, 6)) console.log(`   ${e.slice(0, 180)}`) }
  console.log(`\n${fails ? `✗ ${fails} check(s) failed — do NOT read the numbers above as a fold measurement` : '✓ position confirmed twice from the space ref'}`)
  process.exit(fails ? 1 : 0)
} finally {
  await browser.close()
}
