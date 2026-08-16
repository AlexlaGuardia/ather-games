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
  await page.setViewport({ width: 1280, height: 760 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'barrier')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['barrier']))
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
} finally {
  await browser.close()
}
console.log(fails ? `\n✗ ${fails} failed` : '\n✅ the void is escapable')
process.exit(fails ? 1 : 0)
