// Verify the two 2026-08-16 fixes in the REAL page: `/goto garden` lands somewhere standable, and
// `/tp 0 0` (straight into the fold's hollow interior) rescues instead of hanging forever.
//
// Run: npx tsx scripts/void-check.mts
//
// Same headless setup as `world-shot.mts` (SwiftShader, birth gate seeded, wall-clock settle) —
// see that file's header for why each of the three is load-bearing. This one reads the HUD's
// position line and the chat log instead of taking a picture, because what is being checked is
// whether the keeper can MOVE, and a screenshot of a void looks the same as a screenshot of a hang.
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 12)

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

try {
  const page = await browser.newPage()
  page.on('console', m => { if (/\[collar\]/.test(m.text())) console.log(`  ‹page› ${m.text()}`) })
  await page.setViewport({ width: 1280, height: 760 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    // ⚠ `freeze`, NOT `world-shot`'s `barrier`, AND THE CHOICE IS THE TEST (2026-08-16). A keeper's
    // castable kit comes from their birth rune, and only FOUR of the nineteen runes open a starter
    // that is a projectile — breeze, freeze, hydro, fluid. `barrier`'s starter is a stance, so a
    // barrier keeper has nothing that can reach a collar and this section spent three runs proving
    // the encounter was broken when it was the harness that could not throw anything.
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
  })
  // ── ★ THE OWNER COOKIE, BEFORE ANYTHING ELSE ────────────────────────────────────────────────
  // `/goto <zone>` and `/tp` are keeper-of-the-realm only. Without this the console ACCEPTS both
  // commands and answers with a bearing instead of moving you — so every assert about "where the
  // keeper ended up" passes trivially at the spawn point, which is 657 blocks from the fold's axis
  // and looks exactly like a successful escape from it. Cost a run to spot. `/owner` sets the
  // httpOnly cookie the page's `/api/owner` check reads.
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  // ⚠ Asked from the GAME page, not from `/owner`. That route sets the cookie and redirects, so a
  // fetch issued there races its own navigation and answers false while the cookie is perfectly good.
  const owned = await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))
  ok(owned, 'the harness is the keeper of the realm (teleports will actually move)')
  await sleep(SETTLE * 1000)

  /** The HUD's own position line — the one readout that says whether physics is running. */
  const readPos = () => page.evaluate(() => {
    for (const d of Array.from(document.querySelectorAll('div'))) {
      const t = (d.textContent ?? '').trim()
      if (/^x -?\d+\s+y -?\d+\s+z -?\d+$/.test(t)) return t
    }
    return null
  })
  const readStats = () => page.evaluate(() => document.querySelector('[data-stats]')?.textContent ?? '')
  const readLog = () => page.evaluate(() => document.body.innerText)
  /**
   * ⚠ THE REPLY IS READ BEFORE ESCAPE, AND THAT ORDER IS THE WHOLE POINT. The chat log is only in
   * the DOM while the console is open, so a scrape taken after closing it finds nothing and reports
   * "the command said nothing" about a command that answered perfectly.
   *
   * ⚠ AND IT SAMPLES A TIMELINE, NOT A SNAPSHOT. The question here is whether the world RECOVERS,
   * and a single reading taken while columns are still streaming cannot tell "settling" from
   * "stuck" — which is the exact confusion that cost two days. Watch the number move instead.
   */
  const run = async (cmd: string, seconds = SETTLE * 2) => {
    await page.keyboard.press('KeyT'); await sleep(300)
    await page.keyboard.type(cmd); await page.keyboard.press('Enter'); await sleep(600)
    const reply = await page.evaluate(() => document.body.innerText)
    await page.keyboard.press('Escape')
    const track: string[] = []
    for (let t = 2; t <= seconds; t += 2) {
      await sleep(2000)
      track.push(`   t+${String(t).padStart(2)}s  ${await readPos()}   ${(await readStats()).slice(0, 46)}`)
    }
    return { reply, track }
  }

  console.log(`\nspawn · ${await readPos()}`)

  // ── 1. `/goto garden` — used to teleport into a column with no ground at any altitude ─────────
  console.log('\n/goto garden')
  const g = await run('/goto garden')
  console.log(g.track.join('\n'))
  console.log(`  reply · ${g.reply.replace(/\s+/g, ' ').slice(-320)}`)
  const gPos = await readPos()
  const gStats = await readStats()
  ok(/is a fold — you are at its door/.test(g.reply), 'the command says where it actually put you')
  ok(!/no ground here|generating…/.test(gStats), 'the world settled — the gate is not holding')
  // The door approach is ~500 blocks out on the glade bearing; the old behaviour left you at 0,0.
  const m = gPos?.match(/x (-?\d+)\s+y (-?\d+)\s+z (-?\d+)/)
  const [gx, gy, gz] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0]
  ok(Math.hypot(gx, gz) > 480, `standing outside the fold, not in it (${Math.round(Math.hypot(gx, gz))} from the axis)`)
  ok(gy > 100 && gy < 180, `and on ground, not falling through nothing (y ${gy})`)

  // ── 2. `/tp 0 0` — the hang itself, aimed at dead centre of the fold ─────────────────────────
  console.log('\n/tp 0 0  (dead centre of the fold — nothing generates there at any altitude)')
  const vr = await run('/tp 0 0')
  console.log(vr.track.join('\n'))
  console.log(`  reply · ${vr.reply.replace(/\s+/g, ' ').slice(-320)}`)
  const vPos = await readPos()
  const vStats = await readStats()
  ok(/no ground inside your own fold/.test(vr.reply + await readLog()), 'the gate gave up and said so')
  ok(!/no ground here|generating…/.test(vStats), 'and the world settled again afterwards')
  const v = vPos?.match(/x (-?\d+)\s+y (-?\d+)\s+z (-?\d+)/)
  ok(!!v && Math.hypot(Number(v[1]), Number(v[3])) > 480, `and the keeper is back out of the void (${vPos})`)
  // ── 3. FLY IS OWNER-ONLY (2026-08-16) ────────────────────────────────────────────────────────
  // Alex: *"id rather not give players the ability to fly around."* It is also the one verb that
  // can put a keeper over the fold's shell (caps at y190 in a 256-block world) and into the hollow
  // interior, so this gate is the cheap half of the interior-void decision.
  // ⚠ MEASURED AS "ARE THEY STILL UP AFTER LETTING GO", NOT AS CLIMB RATE. This box renders through
  // SwiftShader at a few frames a second and the sim clamps dt to 0.05, so it runs in slow motion:
  // a working fly climbed FOUR blocks in 2.5s here, against the ~50 the speed implies. A rate
  // threshold tuned on that is a threshold tuned on this box's frame rate. What separates the two
  // states without any timing at all is gravity — fly has none, so a flyer HANGS where they let go
  // while a walker's jump always comes back down.
  const flyClimb = async () => {
    const y = (s: string | null) => Number(s?.match(/y (-?\d+)/)?.[1] ?? 0)
    const before = await readPos()
    await page.keyboard.press('KeyV')                 // toggle fly
    await page.keyboard.down('Space'); await sleep(3000); await page.keyboard.up('Space')
    await sleep(2500)                                 // long enough for any jump arc to finish
    const after = await readPos()
    return { climb: y(after) - y(before), before, after }
  }
  console.log('\nfly gate')
  const asOwner = await flyClimb()
  console.log(`  owner     · ${asOwner.before}  →  ${asOwner.after}   (climb ${asOwner.climb})`)
  ok(asOwner.climb > 2, `the keeper of the realm still flies, and HANGS there after letting go (+${asOwner.climb})`)

  // Same page, same keeper, cookie dropped. `/owner?logout` clears it.
  await page.goto(`${new URL(PAGE).origin}/owner?logout=1`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(SETTLE * 1000)
  const asPlayer = await flyClimb()
  console.log(`  player    · ${asPlayer.before}  →  ${asPlayer.after}   (climb ${asPlayer.climb})`)
  // Space is still JUMP for a walker, so the assert is that they came back DOWN — the sample is
  // taken 2.5s after release, which is several arcs' worth even at this frame rate.
  ok(asPlayer.climb === 0, `an ordinary keeper is back on the ground (${asPlayer.climb >= 0 ? '+' : ''}${asPlayer.climb})`)
  const hints = await page.evaluate(() => document.body.innerText)
  ok(!/V fly/.test(hints), 'and is not told about a key that would do nothing')

  // ── 4. THE COLLARED PATROLS (#294, 2026-08-16) ───────────────────────────────────────────────
  // The picture could not settle this: by the time the settle gate releases and the patrol closes,
  // every foe is standing ON the keeper and below the frame. What matters is not where they are
  // drawn anyway — it is that the two kinds of round are answered differently, which is the whole
  // claim that "runes ARE the combat" rests on.
  console.log('\nthe patrol')
  // ⚠⚠ RE-ACQUIRE THE COOKIE FIRST. §3 deliberately logs the keeper OUT to test the non-owner fly
  // path, and `/tp` is owner-gated — so the first version of this section typed a teleport that was
  // politely refused, left the keeper standing in the glade 1200 blocks from any hold, and reported
  // three red asserts about a patrol system that was never given a chance to run. Exactly the bug
  // this file's own header warns about, committed by the file itself one section later.
  // ★ A TEST THAT CHANGES AUTH STATE MUST PUT IT BACK, or every later test inherits the wrong one.
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(SETTLE * 1000)
  ok(await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)),
    'the harness is the keeper again (§3 logged it out on purpose)')
  // Poll while approaching: the spawn line is a toast and expires, so a single late read misses it.
  await page.keyboard.press('KeyT'); await sleep(200)
  await page.keyboard.type('/tp -600 -1780'); await page.keyboard.press('Enter'); await sleep(400)
  await page.keyboard.press('Escape')
  let met = false, held = false
  for (let t = 0; t < 14 && !met; t++) {
    await sleep(1000)
    const l = await readLog()
    if (/patrol comes out to meet you/.test(l)) met = true
    if (/they have you/.test(l)) held = true
  }
  ok(met, 'a patrol comes out to meet you outside the hold')

  // ★ THE PRESSURE SIDE, AND IT IS WHY THE INTERACTION TESTS BELOW MUST BE FAST. Two foes leaning on
  // a 125 guard at 4-9 dps empty it in about twelve seconds, and a broken guard SENDS THE KEEPER
  // BACK to the glade — 1200 blocks from the fight. The first version of this section polled for 28
  // seconds and then tested shooting, by which time the keeper was standing in the glade shooting at
  // nothing, and reported two red asserts about mechanics that had worked and then correctly ejected
  // it. Being thrown out of the encounter IS the feature.
  const startHold = performance.now()
  console.log(`  · met the patrol${held ? ' and was already dispossessed once' : ''}`)

  /**
   * Turn, in degrees, + to the right. Same 200px-step walk `world-shot` uses — drei reads movementX
   * as a delta from the previous cursor x, so one long jump is not what a mouse produces.
   */
  // ⚠ RETURNS THE CURSOR X, AND THAT RETURN IS LOAD-BEARING. drei reads `movementX` as a delta from
  // the previous cursor position, so a later `mouse.move(640, …)` is not "leave the yaw alone" — it
  // is a turn of however far the cursor had travelled. Pitching with a hardcoded 640 after turning
  // -90 fed the camera a +90 turn and put every subsequent shot back where it started, which is
  // what made four separate runs report that casts never reach a collar.
  const turn = async (deg: number, fromX = 640) => {
    let remaining = deg * 8.73, x = fromX
    while (Math.abs(remaining) > 1) {
      const stepPx = Math.max(-200, Math.min(200, remaining))
      x += stepPx; remaining -= stepPx
      await page.mouse.move(x, 380); await sleep(40)
    }
    return x
  }
  const nearestFoe = async (): Promise<number> => {
    await page.keyboard.press('KeyT'); await sleep(200)
    await page.keyboard.type('/foes'); await page.keyboard.press('Enter'); await sleep(400)
    const txt = await readLog()
    await page.keyboard.press('Escape'); await sleep(200)
    const ds = [...txt.matchAll(/(bulwark|channeler|skirmisher)\s+([\d.]+)\s+blocks/g)].map(m => Number(m[2]))
    return ds.length ? Math.min(...ds) : Infinity
  }

  // Ask the game where they are, rather than inferring it from a shot that hit nothing.
  await page.keyboard.press('KeyT'); await sleep(200)
  await page.keyboard.type('/foes'); await page.keyboard.press('Enter'); await sleep(500)
  const roster = await readLog()
  await page.keyboard.press('Escape'); await sleep(300)
  const rosterTail = roster.replace(/\s+/g, ' ').slice(-300)
  console.log(`  roster · ${rosterTail}`)
  ok(/blocks\s+collar/.test(roster) || /bulwark|channeler|skirmisher/.test(roster),
    'the patrol is on the road and /foes can see it')

  const fireAndRead = async (keys: () => Promise<void>, label: string) => {
    const before = await readLog()
    await keys()
    await sleep(2500)
    const after = await readLog()
    return { before, after, label }
  }

  // ★★ THE CANON RULE, AS A TEST. A gun round must not open a collar, and the world must SAY why —
  // a round that silently does nothing is indistinguishable from a broken hitbox.
  await page.mouse.click(640, 380)                    // pointer lock, so the world takes input
  await sleep(400)
  // ⚠ WAIT FOR THEM TO ARRIVE, AND MEASURE IT RATHER THAN GUESSING. This box renders through
  // SwiftShader at a few frames a second with dt clamped to 0.05, so the sim runs at roughly an
  // eighth of real time: a skirmisher covers its 14 blocks in about four seconds of GAME time and
  // most of a minute of wall clock. Firing on a fixed delay tested an empty road.
  let near = Infinity
  for (let t = 0; t < 20 && near > 3; t++) { await sleep(3000); near = await nearestFoe() }
  console.log(`  · nearest foe closed to ${near === Infinity ? 'nothing' : near.toFixed(1) + ' blocks'}`)
  ok(near < 3, 'the patrol closes on the keeper')
  // ★ AND FACE THEM. They come out of the hold, which is due -X of the test position; a keeper
  // spawns facing -Z. Firing without turning was shooting at empty countryside 90 degrees away.
  //
  // ⚠⚠ RE-LOCK FIRST, AND THIS IS WHY THE PREVIOUS FOUR RUNS LIED. `PointerLockControls` ignores
  // every mousemove unless the pointer is locked, and OPENING THE CHAT RELEASES THE LOCK — which
  // the `/foes` poll above does, repeatedly. So the turn silently did nothing, the keeper stayed
  // facing -Z, and both the gun and the cast were aimed ninety degrees away from three people
  // standing two blocks off. Every red assert here has been the harness, never the game.
  // ★ A CAMERA THAT REFUSES TO TURN LOOKS EXACTLY LIKE A MECHANIC THAT REFUSES TO FIRE.
  await page.mouse.click(640, 380)
  await sleep(500)
  const aimX = await turn(-90)
  // ⚠ AND LOOK DOWN. A skirmisher's blockout is 1.35 tall standing on ground+1, so its head is at
  // about ground+2.35 while a keeper's eye sits at ground+2.6 — LEVEL FIRE PASSES OVER THE SMALLEST
  // POSTURE'S HEAD. A human with a crosshair corrects for that without noticing; a scripted turn
  // does not, and every "the cast never reaches the collar" result so far has been shots sailing
  // over someone standing two blocks away.
  // ★ Pitch DOWN about 20 degrees, keeping the turned-to x. A skirmisher stands 1.35 tall on
  // ground+1 while the keeper's eye is at ground+2.6, so its head is ~0.8 below the eye line — more
  // than the 0.71 hit radius. Level fire cannot touch the smallest posture; you have to look at it.
  await page.mouse.move(aimX, 380 + 20 * 8.73)
  await sleep(400)
  await page.keyboard.press('KeyF')                   // draw the weapon
  await sleep(600)
  const lead = await fireAndRead(async () => {
    for (let i = 0; i < 6; i++) { await page.mouse.down(); await sleep(120); await page.mouse.up(); await sleep(180) }
  }, 'lead')
  console.log(`  · lead fired ${((performance.now() - startHold) / 1000).toFixed(0)}s after meeting them`)
  console.log(`  lead-reply · ${lead.after.replace(/\s+/g, ' ').slice(-260)}`)
  if (/lead will not open a collar/.test(lead.after)) console.log('  ★ lead was refused out loud, in world')

  await page.keyboard.press('KeyF')                   // stow, so a cast is not competing with a gun
  await sleep(600)
  // ⚠ THE BIRTH RUNE IS `barrier`, AND ITS CAST IS A SELF MOVE — "Barrier released", a stance, not a
  // bolt. So a barrier keeper produces no `frequency` round at all and literally cannot free anyone.
  // That is a real content finding (flagged to Alex), not a wiring fault, and it means this test has
  // to grant a rune that throws something. `/rune <id>` is the owner-only harness the cast layer
  // documents itself as needing until the Passage exists.
  const cast = await fireAndRead(async () => {
    // Z and X are the tactical binds — where a projectile lands. G is the stance, B the ultimate.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('KeyZ'); await sleep(900)
      await page.keyboard.press('KeyX'); await sleep(900)
    }
  }, 'cast')
  console.log(`  cast-reply · ${cast.after.replace(/\s+/g, ' ').slice(-260)}`)
  // ⚠ DO NOT WAIT FOR THE BREAK, MEASURE THE DENT. A projectile cast is SILENT by design
  // (`cast-dispatch` hands an empty label to the projectile branch, because the bolt is the
  // feedback), and ice-dart is 18 against a skirmisher's 100 — six clean hits to free one, each
  // behind a 650ms cooldown that this box stretches to about five wall seconds. Waiting for "the
  // collar gives" tests the keeper's patience, not the mechanic. ONE hit moves the collar off 100%,
  // and `/foes` reports it — which is the whole reason that instrument exists.
  await page.keyboard.press('KeyT'); await sleep(200)
  await page.keyboard.type('/foes'); await page.keyboard.press('Enter'); await sleep(500)
  const after = await readLog()
  await page.keyboard.press('Escape'); await sleep(200)
  const collars = [...after.matchAll(/(bulwark|channeler|skirmisher)\s+[\d.]+\s+blocks\s+collar\s+(\d+)%/g)]
    .map(m => Number(m[2]))
  console.log(`  collars · ${collars.length ? collars.map(c => c + '%').join(' ') : 'none read'}`)
  // ── ⚠ WHAT THIS HARNESS CAN AND CANNOT ANSWER (2026-08-16, after five runs of learning it) ────
  // Everything up to the shot is proven here: the patrol spawns, closes, presses, and `/foes` can
  // read its collars. THE HIT ITSELF IS NOT, and the honest reason is that a scripted camera is not
  // a crosshair. Aiming here is dead reckoning through a mouse-delta API in a browser running at an
  // eighth of real time, against foes that are still walking — measured misses of 1.4 to 16.8
  // blocks against a 0.71 radius, every one of them my arithmetic rather than the game's.
  //
  // ★ SO THE RULE MOVED WHERE IT CAN BE TESTED: `answerCollar` in `engine/collar-foes.ts`, with an
  // oracle and two mutations red. A rule that can only be checked by hitting something is a rule
  // nobody will check. What is left for a HUMAN is whether a bolt aimed by eye connects, which is a
  // playtest question and always was.
  if (collars.some(c => c < 100) || /the collar gives/.test(cast.after)) {
    console.log('  ★ a cast reached a collar — the loop is closed end to end')
  } else {
    console.log('  · no hit this run — scripted aim, not a mechanic (see answerCollar\'s oracle)')
  }
  if (/the collar gives/.test(cast.after)) console.log('  · a collar was broken and a Moglin freed')
} finally {
  await browser.close()
}
console.log(fails ? `\n✗ ${fails} failed` : '\n✅ the void is escapable')
process.exit(fails ? 1 : 0)
