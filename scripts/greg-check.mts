// Greg's fold-widening conversation, in the real page.
//
// ★ THE PURE ORACLE CANNOT REACH THIS. `fold-ledger.test.ts` proves the vector is canon-shaped and
// the arithmetic holds; it cannot prove Greg's panel READS the live book, that the button applies a
// tier, that the tier is persisted, or that the ground actually changes. "The panel worked and
// nothing was written" is this world's most-repeated failure and it has its own harness for that
// reason.
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1280,900'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  // Start past the tutorial: Greg only talks about folds once he has finished teaching, and the
  // harness cannot chop a tree.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('voxel3d:tutorial:1337', JSON.stringify({ stage: 'done' }))
  })
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  await sleep(16000)

  // ⚠ `close` IS NOT COSMETIC. Escape's handler closes the console AND any open dialogue, so the
  // trailing Escape that every other harness ends its commands with was slamming Greg's box shut
  // the instant `/greg` opened it — nine asserts red against a feature that worked.
  const cmd = async (line: string, close = true) => {
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(900)
    if (close) { await page.keyboard.press('Escape'); await sleep(500) }
  }
  // ⚠ `/greg` RATHER THAN AIMING AT HIM. Talking needs the crosshair on his box within range, and
  // the camera cannot be turned without pointer lock — same wall `/brew` hit, same owner-gated door.
  const talk = async () => {
    await cmd('/greg', false); await sleep(1100)
    // ⚠ BY `data-panel`, NEVER BY TEXT. Both text guesses fail while looking almost right: the
    // outermost match drags the whole page in, the shortest is the header row alone ("Gregoryesc").
    return page.evaluate(() => document.querySelector('[data-panel="greg"]')?.textContent ?? '')
  }
  const savedTier = () => page.evaluate(() => new Promise<number>((res) => {
    const rq = indexedDB.open('shimmer-voxel')
    rq.onsuccess = () => {
      const db = rq.result
      try {
        const tx = db.transaction(db.objectStoreNames[0], 'readonly')
        const g = tx.objectStore(db.objectStoreNames[0]).get('1337:player')
        g.onsuccess = () => res((g.result as { plotTier?: number } | undefined)?.plotTier ?? -1)
        g.onerror = () => res(-2)
      } catch { res(-3) }
    }
    rq.onerror = () => res(-4)
  }))

  // ⚠ ONE WARM-UP COMMAND FIRST. The very first `T` after boot does not reliably open the console
  // in headless Chrome — the keystroke lands before the canvas has taken focus — so the first real
  // command is silently swallowed and every assert after it describes an empty screen. Costs one
  // no-op; found by a debug run where the identical sequence worked only when something ran first.
  await cmd('/help')

  // ── 1. an empty book: he says so, and offers nothing ─────────────────────────────────────────
  const first = await talk()
  ok(first.length > 0, 'Gregory talks once the tutorial is done')
  ok(/entries/.test(first), `and he reads the book out loud — ${JSON.stringify(first.slice(-90))}`)
  ok(/Not yet/i.test(first), 'an empty book gets the waiting line, not the ceremony')
  ok(!/let him fold it/.test(first), '★ and there is no button to press — nothing is owed yet')
  await page.keyboard.press('Escape'); await sleep(600)

  // ── 2. ★ THE LIBERATOR'S FACE PAYS ───────────────────────────────────────────────────────────
  // `/party lend 6` mints six spirits into the roster — canon's "who YOURS are" face, which alone
  // must be able to earn a fold.
  // ⚠ FOUR, NOT SIX. `/party lend` clamps at the roster cap — asking for six silently gives four,
  // which is how the first run of this harness "proved" the liberator's face did not pay.
  await cmd('/party lend 4 10')
  const owed = await talk()
  ok(/let him fold it/.test(owed), '★ a full roster earns a wider fold — the liberator\'s face pays')
  ok(/4 yours/.test(owed), `the counter names the liberator's half — ${JSON.stringify(owed.match(/\d+ met[^·]*·[^·]*yours/)?.[0])}`)
  ok(/4 met/.test(owed), '★ and holding four species fills the index face too — you know what you hold')

  // ── 3. ★★ THE BUTTON ACTUALLY WIDENS THE FOLD, AND IT PERSISTS ───────────────────────────────
  const before = await savedTier()
  ok(before === 0, `the save starts at tier 0 (got ${before})`)
  const pressed = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /let him fold it/.test(x.textContent ?? ''))
    if (!b) return false
    ;(b as HTMLElement).click()
    return true
  })
  ok(pressed, 'the fold button is pressable')
  await sleep(2500)
  const after = await savedTier()
  ok(after === 1, `★ the tier is RAISED AND WRITTEN TO DISK (${before} → ${after})`)
  const said = await page.evaluate(() => document.body.innerText)
  ok(/widens to 400 blocks/.test(said), 'and the world says what changed')

  // ── 4. he does not do it twice for the same book ─────────────────────────────────────────────
  await page.keyboard.press('Escape'); await sleep(600)
  const again = await talk()
  ok(!/let him fold it/.test(again), '★ the same book does not buy a second fold — the ceremony is spent')
  ok(/Not yet|nothing left/i.test(again), 'and he goes back to counting')

  console.log(fails ? `\ngreg-check: ${fails} FAILED` : '\ngreg-check: CLEAN')
} finally {
  await browser.close()
}
process.exit(fails ? 1 : 0)
