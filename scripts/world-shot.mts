// Screenshot the running voxel world, headless.
//
// Run: npx tsx scripts/world-shot.mts [out.png] [seconds-to-settle]
//   WORLD_URL=http://localhost:3201/shimmer/voxel3d?hour=12   — a lane's dev server, day pinned
//   WORLD_GOTO=twilight-thicket                               — drive the console before shooting
//   WORLD_CMD='tp -139 -588'                                  — any console line (owner-gated, same as GOTO)
//   WORLD_CMD='space plot; tp 254 18'                         — several, in order, ';' separated
//   WORLD_FLY=8                                               — rise for N seconds first (owner-only)
//   WORLD_OWNER=1                                             — fetch the owner cookie for a GATED PAGE (dev/*)
//   WORLD_PITCH=-10                                           — degrees; negative looks UP
//   WORLD_YAW=180                                             — degrees, + turns right (spawn faces -Z)
//   WORLD_LOG='\\[canopy\\]'                                     — forward matching console lines to stdout
//   WORLD_EVAL='(() => document.title)'                       — run an expression in the page, print it
//   WORLD_RADIUS=10                                           — load ring, in columns (default: the app's 6)
//   WORLD_FPS=1                                               — turn the frame meter on for the shot
//
// It prints the HUD counter line after the shot. `mesh` is geometry BUILT, `draws` is what survived
// frustum culling this frame — the two are far apart and only the second is the frame's cost.
//
// ★ WORLD_LOG EXISTS BECAUSE A SCREENSHOT ONLY SHOWS YOU THAT SOMETHING IS WRONG, NEVER WHY. The
// smooth-canopy spike (2026-08-13) drew ONE crown in a forest and the picture could not say whether
// that was placement, scale, culling or a probe rejecting every tree. A counter in the page answers
// it in one run. Opt-in and regex-filtered so a normal shot stays quiet.
//
// ★ WHY `WORLD_GOTO` EXISTS: the player always spawns in the GLADE, which is a clearing — there is
// no saved position to seed, so without this every headless shot photographs the one place in the
// world with the fewest trees in it. The console is the only mover the page exposes to a script,
// and `/goto` is already the command a human uses for exactly this. Zones: `/goto` bare lists them.
//
// ── ⚠⚠ AND UNTIL 2026-08-16 IT NEVER MOVED ANYTHING. READ THIS BEFORE TRUSTING AN OLD SHOT. ──────
// `/goto <zone>` splits: the COMPASS half is view-grade, the TELEPORT half is keeper-of-the-realm
// only. A headless profile carries no owner cookie, so every `WORLD_GOTO` run typed the command,
// got a polite bearing back, and photographed **the glade** — the exact failure the paragraph above
// says this flag exists to prevent, wearing the flag's own name. Nothing errored, nothing was empty,
// and the filename said `twilight-thicket`. Any zone shot taken before this date is the glade.
// The fix is the `/owner` visit below; `OWNER_KEY` comes from `/root/ather-games/.env`.
// ★ THE GENERAL SHAPE, third time in two days: A COMMAND THAT ANSWERS IS NOT A COMMAND THAT RAN.
//
// ★ WHY THIS IS AWKWARD AND WORTH IT: unlike the icon sheet, the 3D world cannot be rendered from
// pure code — it needs a GL context, a canvas, a streaming loop and a HUD. So this drives the real
// page in the real renderer, which is the only way to see what actually ships.
//
// ── the three things that make it work on a headless server ────────────────────────────────────
// 1. SWIFTSHADER. This box has no GPU. Chrome refuses WebGL without one unless software GL is
//    explicitly allowed, and the page dies at "generating…" forever with no error.
// 2. THE BIRTH GATE. voxel3d mounts a rune ritual before the world exists, so a cold profile
//    screenshots the ritual, not the garden. The keys are seeded before the page's first script
//    runs — `addInitScript`'s whole purpose — including the EPOCH, or `resetIfStale` wipes the
//    seed we just wrote and hands us the ritual anyway.
// 3. TIME. Terrain streams in over several seconds and a screenshot taken on `load` is a blue void.
//
// ── ⚠⚠ SETTLE TIME: JUDGING AN ABSENCE NEEDS A LONGER SETTLE THAN JUDGING A PRESENCE ───────────
// Learned 2026-08-19, and it cost a false production alarm. GROUND COVER AND TERRAIN ARE TWO
// PIPELINES: trees and terrain are baked into the greedy CHUNK mesh and arrive with the column,
// while grass, flowers and scatter are a separate instanced renderer synced off `floraDirty`.
// Flora trails terrain by a wide margin — instrumented at spawn: 10s gives cols=24 spots=853,
// 30s gives cols=117 spots=7546.
//
// So an under-settled shot produces, precisely and every single time: TERRAIN RENDERS, TREES
// RENDER, GROUND COVER COMPLETELY ABSENT. That is not a symptom that narrows to a bug — it is the
// exact shape of a half-loaded world, and it reads as a catastrophic render regression. It even
// survives the obvious cross-check: the block-target reticle will happily name a "Grass Tuft" over
// what looks like bare ground, because the raycast reads the generated VOXEL while the instance
// for it has not synced yet.
//
// ★ THE TELL IS THE DRAW COUNT, WHICH THIS SCRIPT ALREADY PRINTS. 41 draws and 66 draws are the
// same scene at different settles. **Never conclude that something is ABSENT until the draw count
// has stopped climbing** — raise the settle and shoot again. A presence claim is safe at the
// default; an absence claim is not, because the default 12s is below where flora finishes.
//
// ── ⚠⚠ AND A NODE PROBE AND THE RENDERED PAGE CAN RUN TWO DIFFERENT GENERATORS ─────────────────
// Learned the same day, one hour lost. **Generation on the page runs the PREBUILT
// `public/voxel-gen.worker.<hash>.js`; a `.mts` script imports the source modules directly.** So
// after any edit to something in the worker's import graph (height/depth/character/flora/column/
// trees/scatter/boulders...), a headless probe reports the NEW world while the browser draws the
// OLD one — and the disagreement is silent, because both halves are internally consistent.
//
// The shape it takes: every measurement insists the feature is there, every screenshot says it is
// not, and the hunt goes to framing, yaw, pitch and settle — none of which are wrong. Rebuild the
// worker (`npm run build:worker`, or just `coord build`) and restart the server BEFORE believing a
// probe-vs-picture contradiction. **If code and camera disagree, suspect the artifact first.**

// ★ GENERALIZE, because this is the fifth instrument failure in one day (a mutation that crashed
// instead of failing and read as green; `npx tsx` passing types `tsc` rejects; misread specks in a
// contact sheet; settle time; a stale worker artifact): EVERY ONE WAS WRONG IN THE DIRECTION
// THAT LOOKED LIKE A REAL FINDING.
// Verify the instrument before believing the reading — the same rule the backgrounded-tab entry in
// PATTERNS states, arriving here by a different road.

// ⚠ Uses the SYSTEM chromium, not a downloaded one: `/` sits near the disk-watcher's prune
// threshold and Playwright's bundled browser is ~400MB.

import puppeteer from 'puppeteer-core'

const OUT = process.argv[2] ?? 'world.png'
const SETTLE = Number(process.argv[3] ?? 12)
const URL = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const GOTO = process.env.WORLD_GOTO ?? ''
// WORLD_CMD: any console line, for vantages `/goto` cannot name — `tp -139 -588` to stand off a
// landmark and shoot its SILHOUETTE, which is the half a close-up can never show. Owner-gated the
// same way GOTO is, and for the same reason: `tp` is keeper-of-the-realm only.
const CMD = process.env.WORLD_CMD ?? ''
// WORLD_FLY: seconds of ascent before the shot, for the vantage no ground position can give — above
// the canopy, where a landmark's SILHOUETTE is against sky instead of behind trees. Owner-only, both
// because fly is (2026-08-16) and because it is a camera trick, never something a player sees.
const FLY = Number(process.env.WORLD_FLY ?? 0)
const PITCH = Number(process.env.WORLD_PITCH ?? 0)
const YAW = Number(process.env.WORLD_YAW ?? 0)   // degrees, + turns right. A fresh keeper faces -Z.
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    // Software GL. Without BOTH of these Chrome reports a context and then refuses to draw.
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,760',
  ],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })

  // Seed BEFORE any page script: born, with the epoch already current.
  await page.evaluateOnNewDocument((R: number, FPS: boolean) => {
    localStorage.setItem('ather:epoch', '2')
    // ⚠ 'ember' IS NOT A RUNE ID, and this seeded it for weeks (fixed 2026-08-12). The real ids are
    // in `play3d/birth/runes.data.ts` — manalic/barrier/star/life/enchant/lightning/… — so every
    // headless shot was of a keeper holding NOTHING: no affinity, no book, no loadout, no castable
    // move. Harmless while this only photographed terrain; a lie the moment anyone shot the HUD or
    // the cast layer, which is exactly what it was about to be used for. 'barrier' is a deliberate
    // pick: it is a `defense` rune, so a shot also exercises the +25 shield cap.
    localStorage.setItem('ather:shimmer:birthRune', 'barrier')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['barrier']))
    // WORLD_RADIUS: measure a bigger load ring than the default 6 without a human in the settings
    // panel. `loadSettings` merges over the defaults, so a lone `viewRadius` is a safe partial.
    // WORLD_FPS=1 turns the frame meter on for the shot. The RATE it reports from this box is
    // meaningless (SwiftShader), but whether the meter renders and publishes at all is not.
    const st: Record<string, unknown> = {}
    if (R) st.viewRadius = R
    if (FPS) st.showFps = true
    if (R || FPS) localStorage.setItem('shimmer.voxel.settings.v1', JSON.stringify(st))
  }, Number(process.env.WORLD_RADIUS ?? 0), process.env.WORLD_FPS === '1')

  const errors: string[] = []
  const LOG = process.env.WORLD_LOG ? new RegExp(process.env.WORLD_LOG) : null
/** Fetch the owner cookie even without a console command — for pages that are themselves gated. */
const OWNER = process.env.WORLD_OWNER === '1'
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text())
    else if (LOG && LOG.test(m.text())) console.log(`  ‹page› ${m.text()}`)
  })

  // The owner cookie, before the page — without it `/goto <zone>` answers with a bearing and moves
  // nobody. Only needed when we intend to drive the console; a plain shot stays anonymous.
  // ⚠ `WORLD_OWNER=1` EXISTS BECAUSE THIS CONDITION ENCODED AN ASSUMPTION THAT STOPPED BEING TRUE:
  // *the PAGE is public, only the console is gated*. That holds for `/shimmer/voxel3d`. It does not
  // hold for anything under `/shimmer/dev/*`, which `proxy.ts` 403s outright — so shooting a dev
  // page without a cookie photographs "Forbidden — owner only." Set it for any owner-gated URL.
  if (GOTO || CMD || FLY || OWNER) {
    const KEY = process.env.OWNER_KEY
    if (!KEY) {
      // ⚠ LOUD, AND IT STOPS. Carrying on would hand back a glade shot under the requested zone's
      // filename, which is how this went unnoticed for weeks in the first place.
      console.error('WORLD_GOTO/WORLD_CMD needs OWNER_KEY (teleport is owner-gated) — `set -a; . /root/ather-games/.env; set +a`')
      process.exit(2)
    }
    // ⚠ `globalThis.URL` — this module's own `const URL` shadows the constructor.
    await page.goto(`${new globalThis.URL(URL).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  }

  const resp = await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60_000 })
  // ★★ REFUSE RATHER THAN REPORT, AND THIS TOOL ALREADY KNEW THE RULE — its own header says a shot
  // "only shows you that something is wrong, never why". A 403 is worse than that: the page renders
  // the words "Forbidden — owner only", the canvas never mounts, and the run reports **canvas NONE
  // (no renderer mounted)** while writing a perfectly real PNG. That reads as a BROKEN RENDERER,
  // which is a finding, when the truth is you were never allowed to see the page. Same family as the
  // play3d owner gate photographing `/room` and being read as a failed deploy (2026-08-23) — an
  // instrument that cannot see its subject must say so instead of describing what it can see.
  const status = resp?.status() ?? 0
  if (status >= 400) {
    console.error(`REFUSED: ${URL} answered HTTP ${status} — nothing was photographed.`)
    if (status === 403) console.error('  owner-gated? re-run with WORLD_OWNER=1 (needs OWNER_KEY in /root/ather-games/.env)')
    process.exit(3)
  }
  // The world streams; there is no "ready" event to wait on, so give it wall-clock and say so.
  await new Promise(r => setTimeout(r, SETTLE * 1000))

  if (GOTO || CMD || FLY) {
    // ⚠ Asked from the GAME page: `/owner` sets the cookie and redirects, so a check issued there
    // races its own navigation and reports false while the cookie is perfectly good.
    const owner = await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner).catch(() => false))
    if (!owner) { console.error('the owner cookie did not take — the shot would be of the glade, not of ' + GOTO); process.exit(2) }
  }

  if (GOTO || CMD) {
    // ★ SEMICOLON-SEPARATED, because one vantage can need two commands (2026-08-27). The Home
    // Plot's court is reached by `space plot; tp 254 18`: `/space` crosses into the plot's
    // coordinate space and `/tp` moves within it, and NEITHER alone lands you at the court —
    // `/tp` in the Wilds photographs Wilds terrain at the same numbers, which is the wrong-door
    // failure this codebase already names (the plot and the Wilds share every coordinate and are
    // different worlds). A harness that can only type one line cannot photograph that place at all.
    const lines = (CMD ? CMD.split(';') : [`goto ${GOTO}`]).map(l => l.trim()).filter(Boolean)
    // T opens the chat, Escape closes it. Typed through the real keyboard because the console is a
    // controlled input — dispatching a synthetic KeyboardEvent sets no value and submits nothing.
    for (const line of lines) {
      await page.keyboard.press('KeyT')
      await new Promise(r => setTimeout(r, 300))
      await page.keyboard.type(`/${line.replace(/^\//, '')}`)
      await page.keyboard.press('Enter')
      await new Promise(r => setTimeout(r, 300))
      await page.keyboard.press('Escape')
      // ⚠ Between commands, not only after the last one: `/space` discards every loaded column and
      // streams a new world in, so a `/tp` typed immediately after runs against a half-built place.
      if (lines.length > 1) await new Promise(r => setTimeout(r, 1500))
    }
    // A teleport discards every loaded column and streams a new place in from nothing, so this
    // needs the SAME wall-clock the first load did. Shooting early photographs a blue void.
    await new Promise(r => setTimeout(r, SETTLE * 1000))
  }

  if (FLY > 0) {
    // ⚠ Needs the pointer lock first (the click below earns it) — but the lock is claimed in the
    // yaw/pitch block, so do the click here and let that block reuse it. A refused lock must leave
    // the shot on the ground rather than crash.
    try {
      await page.mouse.click(640, 380)
      await new Promise(r => setTimeout(r, 400))
      await page.keyboard.press('KeyV')
      await page.keyboard.down('Space')
      await new Promise(r => setTimeout(r, FLY * 1000))
      await page.keyboard.up('Space')
      await new Promise(r => setTimeout(r, 400))
    } catch { /* no lock — the shot stays on the ground */ }
  }

  if (PITCH !== 0 || YAW !== 0) {
    // ⚠ The camera only turns while the pointer is LOCKED — `PointerLockControls` ignores every
    // mousemove otherwise. A real click is what earns the lock (headless Chrome treats page.mouse
    // as trusted input); a scripted `requestPointerLock()` has no user activation and is refused.
    // Guarded, because a refused lock must degrade to "the shot has default pitch", never a crash.
    try {
      await page.mouse.click(640, 380)
      await new Promise(r => setTimeout(r, 400))
      // ── ★ WORLD_YAW (2026-08-16) — WITHOUT IT THE HARNESS CAN ONLY PHOTOGRAPH ONE DIRECTION ─────
      // A fresh keeper faces -Z, and both of the fold's useful vantages are behind them: the wall
      // sits +Z of the glade, and looking AT the door means looking back inward. Every shot of the
      // fold taken before this was of the countryside opposite it.
      //
      // ⚠ TURNED IN STEPS, AND THAT IS NOT COSMETIC. drei reads `movementX`, which Chrome computes
      // as the delta from the previous cursor x — so one 1571px jump is a single delta the pointer
      // -lock path handles poorly, while a walk in ~200px steps is what a real mouse produces.
      // 8.73 px per degree: drei's PointerLockControls turns 0.002 rad per pixel at pointerSpeed 1.
      const PX_PER_DEG = 8.73
      let remaining = YAW * PX_PER_DEG
      let x = 640
      while (Math.abs(remaining) > 1) {
        const step = Math.max(-200, Math.min(200, remaining))
        x += step
        remaining -= step
        await page.mouse.move(x, 380)
        await new Promise(r => setTimeout(r, 40))
      }
      // Same sign convention as the mouse: dragging down looks down, so a negative pitch looks up.
      await page.mouse.move(x, 380 + PITCH * 8)
      await new Promise(r => setTimeout(r, 400))
    } catch { /* no lock — default facing */ }
  }

  await page.screenshot({ path: OUT })
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return c ? { w: c.width, h: c.height } : null
  })
  console.log(`shot → ${OUT}  ·  canvas ${canvas ? `${canvas.w}×${canvas.h}` : 'NONE (no renderer mounted)'}`)

  // ── ★ THE HUD COUNTERS, SCRAPED ────────────────────────────────────────────────────────────────
  // `mesh` (built) and `draws` (submitted after frustum culling) are the two numbers a perf claim
  // rests on, and they are hardware-INDEPENDENT — SwiftShader counts them exactly as a real GPU
  // does. Frame RATE from this box is meaningless and is deliberately not reported: the whole point
  // of scraping is to get the honest half rather than invent the other one.
  const stats = await page.evaluate(() => document.querySelector('[data-stats]')?.textContent ?? null)
  console.log(stats ? `stats · ${stats}` : 'stats · NONE (no [data-stats] node — old build?)')
  const perf = await page.evaluate(() => document.querySelector('[data-perf]')?.textContent ?? null)
  if (perf) console.log(`perf  · ${perf.trim()}   ⚠ SwiftShader — the rate is not a real frame rate`)
  // ── ★ WORLD_EVAL — ASK THE PAGE A QUESTION A PICTURE CANNOT ANSWER (2026-08-21) ───────────────
  // Same reason `WORLD_LOG` exists, one level up: a screenshot tells you THAT something is wrong and
  // never WHAT. Added while verifying water depth attenuation, where the picture was genuinely
  // ambiguous — the shore-to-deep gradient I wanted to read as depth ran far-to-near, and DISTANCE
  // FOG produces the identical gradient. No amount of staring separates those two; reading the
  // compiled shader off the live context separates them in one line.
  //
  // ⚠ It runs in the REAL page against the REAL renderer, which is the entire point: it can see the
  // prebuilt worker's output and the actual GL state, neither of which a `.mts` importing source
  // modules can. Opt-in, and the result is JSON-stringified so a returned object survives the hop.
  const EVAL = process.env.WORLD_EVAL
  if (EVAL) {
    try {
      // ⚠ A FUNCTION EXPRESSION IS CALLED, NOT AWAITED. The first cut wrote `await (${EVAL})`, which
      // awaits the FUNCTION OBJECT — a non-thenable, so it resolves to itself and stringifies to
      // `undefined`. It printed a clean `eval · undefined` and looked like the page had no answer,
      // rather than like the harness had not asked. Both shapes are accepted so either style works.
      const r = await page.evaluate(`(async () => { try {
        const _e = (${EVAL});
        const _v = await (typeof _e === 'function' ? _e() : _e);
        return _v === undefined ? 'EVAL RETURNED undefined' : JSON.stringify(_v)
      } catch (e) { return 'EVAL THREW: ' + e.message } })()`)
      console.log(`eval  · ${r}`)
    } catch (e) { console.log(`eval  · FAILED TO RUN: ${(e as Error).message}`) }
  }
  if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 6).join('\n  ')}`)
} finally {
  await browser.close()   // never leave a chrome behind on an 8GB box
}
