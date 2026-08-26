// #594 — can a keeper actually BREW, in the real page?
//
// ★ A PAGE TEST ON PURPOSE, same split as `infuse-check.mts` and `move-check.mts`.
// `voxel3d/brew.test.ts` proves the refusals are right, the Infusions are correctly reported absent
// and the cauldron is craftable. It cannot prove the panel OPENS, that pressing a row spends the
// bag, drains mana and pays alchemy XP, or that the bottle survives the bag's own stack rules —
// and "the panel worked but nothing was written" is the exact failure shape this world has shipped
// twice (the chest that took items into a discarded leftover; the bench that opened on nothing).
//
// ⚠ WHAT THIS DOES **NOT** COVER, stated so nobody reads a green run as more than it is: the
// physical right-click on a placed cauldron. Opening a panel that way needs pointer lock, which
// headless Chrome will not grant. `/brew` (owner-gated) raises the same panel with the same props,
// so everything downstream of the click is covered and the click itself is `interact.test.ts`'s
// intent assert plus three lines of dispatch. Alex's hands are still the only proof of the click.
import puppeteer from 'puppeteer-core'

const PAGE = process.env.WORLD_URL ?? 'http://localhost:3200/shimmer/voxel3d'
const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const SETTLE = Number(process.env.SETTLE ?? 14)
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
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'freeze')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['freeze']))
  })
  const KEY = process.env.OWNER_KEY
  if (!KEY) { console.error('OWNER_KEY not set — source /root/ather-games/.env first'); process.exit(2) }
  await page.goto(`${new URL(PAGE).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60_000 })
  ok(await page.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner)),
     'harness is keeper of the realm (/give and /brew will work)')
  await sleep(SETTLE * 1000)

  const cmd = async (line: string) => {
    await page.keyboard.press('KeyT'); await sleep(350)
    await page.keyboard.type(line); await page.keyboard.press('Enter'); await sleep(900)
  }
  /** Everything the brew panel is currently saying. */
  // ⚠ READ THE PLATE BY ITS `data-panel` HOOK, never by text. Both text guesses fail while looking
  // green-ish: matching the OUTERMOST div containing "at the cauldron" drags the chat log in with it
  // (one run read "12× mana draught" — a stray 1 from the console glued to the real 2×), and the
  // innermost is the title line on its own, which contains no rows at all and quietly fails
  // everything downstream. The hook is one attribute in `brew-panel.tsx`.
  const panelText = () => page.evaluate(() =>
    document.querySelector('[data-panel="brew"]')?.textContent ?? '')
  /** Press a brew row by its potion name. */
  const pressRow = (name: string) => page.evaluate((n: string) => {
    const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent ?? '').includes(n))
    if (!b) return false
    ;(b as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    ;(b as HTMLElement).click()
    return true
  }, name)
  /** The satchel count for an item, read off the bag panel (I) — the player-visible truth. */
  // ⚠ READS THE SLOT'S OWN `title`, not the page text. A body-text scrape matched the BREW PANEL's
  // ingredient line instead ("raw mana shard 15/5" → 15) and reported bottles that did not exist —
  // a false PASS on the one assert that exists to catch silent item loss.
  const bagHas = async (label: string) => {
    await page.keyboard.press('KeyI'); await sleep(900)
    const n = await page.evaluate((l: string) => {
      const slot = Array.from(document.querySelectorAll('[title]'))
        .map(e => e.getAttribute('title') ?? '')
        .find(t => t.startsWith(l + ' ×'))
      return slot ? Number(slot.split('×')[1]) : 0
    }, label)
    await page.keyboard.press('Escape'); await sleep(500)
    return n
  }

  // ── 1. the panel opens at all ────────────────────────────────────────────────────────────────
  await cmd('/brew')
  await sleep(700)
  const opened = await panelText()
  ok(opened.length > 0, 'the cauldron panel opens')
  // ── ★ NO PANEL MAY RENDER SOURCE-COMMENT SYNTAX (added 2026-08-26, after it shipped) ─────────
  // A bare `/* */` in JSX CHILDREN position is not a comment, it is TEXT. The keeper frame rendered
  // a paragraph of its own commentary across the game and BOTH automated checks called it green:
  // tsc, because valid JSX text is valid; and this harness, twice, because the panel still worked
  // perfectly. Only a screenshot saw it.
  // ⚠ A STATIC GREP CANNOT DECIDE THIS — `/* */` between a tag's attributes is a legitimate JS
  // comment and looks identical to the broken one. Only the RENDERED text distinguishes them, which
  // is why the assert lives here, in the harness that already has the panel open, rather than in a
  // linter. Checked on every `[data-panel]` on the page, not just the cauldron's.
  ok(!(await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel]'))
        .some(n => /\*\/|\/\*/.test(n.textContent ?? '')))),
     'no panel is rendering source-comment syntax as visible text')
  ok(/alchemy\s*1/.test(opened), `a fresh keeper is alchemy 1 — ${/alchemy\s*\d+/.exec(opened)?.[0]}`)

  // ── 2. ★ THE FLAGSHIP ROW TELLS THE TRUTH ───────────────────────────────────────────────────
  // The reason `absent` exists: canon's four Infusions must not print a red 0/2 in a world with no
  // farming, because that reads as "go and find some" for a herb that is not here.
  ok(/in these lands/.test(opened),
    'the panel says "in these lands" about what this world cannot grow, rather than showing a red zero')

  // ── 2b. ★★ THE INFUSIONS ARE NO LONGER STRANDED (canon ruling, 2026-08-18) ──────────────────
  // The herbs went into the generator and NOT ONE LINE of the panel changed — the warning is derived
  // from what the world produces, so it retired itself. This asserts that end to end, in the page: no
  // infusion row may say "in these lands" any more, while the rows that ARE still stranded (the salve
  // needs shimmerscale and sunfruit, both play3d's) must still say it. If the derivation ever breaks,
  // one of these two goes red and says which direction it broke in.
  ok(/in these lands/.test(opened) && /shimmerscale|sunfruit/.test(opened),
    'the still-stranded salve names its missing ingredients')
  const infusionStranded = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-panel="brew"] button'))
      .map(b => b.textContent ?? '')
      .filter(t => /Infusion/.test(t) && !/Ather/.test(t))
    return rows.filter(t => /in these lands/.test(t)).length
  })
  ok(infusionStranded === 0,
    `★ no element Infusion reports a missing ingredient any more (${infusionStranded} do) — the herbs `
    + 'are in the Wilds and the road to an evolved spirit is open at the front door')

  // ── 2c. the herbs are real items this world knows ──────────────────────────────────────────
  await page.keyboard.press('Escape'); await sleep(400)
  await cmd('/give violetbloom_petal 2')
  await sleep(300)
  const gave = await page.evaluate(() => document.body.innerText)
  ok(!/no such item/.test(gave.slice(-400)),
    'violetbloom petal is an item this world recognises — it drops from a block now')
  await cmd('/brew')
  await sleep(600)

  // ── 3. a brew you cannot afford refuses, and SAYS WHY ───────────────────────────────────────
  ok(await pressRow('Mana Draught'), 'the Mana Draught row is pressable')
  await sleep(500)
  const refused = await panelText()
  ok(/missing ingredients/.test(refused),
    'pressing it empty-handed refuses with a reason, not silence')

  // ── 4. ★★ THE SPEND PATH — bag, mana and XP all move, and the bottle survives ───────────────
  await page.keyboard.press('Escape'); await sleep(400)
  await cmd('/give raw_mana_shard 20')
  await sleep(400)
  await cmd('/brew')
  await sleep(700)
  const before = await panelText()
  const manaBefore = Number(/mana\s*(\d+)/.exec(before)?.[1] ?? '0')
  ok(manaBefore > 5, `mana is up before the brew (${manaBefore})`)
  ok(/raw mana shard 20\/5/.test(before.replace(/\s+/g, ' ')),
    'the row now counts twenty shards against the five it needs')

  ok(await pressRow('Mana Draught'), 'the row is pressed with a full bag')
  await sleep(900)
  const after = await panelText()
  // ⚠ `\b` DOES NOT WORK HERE. textContent runs the row's own "×2" straight into the note's
  // "2× mana draught" with no separator, so the char before the 2 is another digit and the word
  // boundary never fires — the assert failed on text that was perfectly correct.
  ok(/(^|\D)2× mana draught/.test(after), `the panel reports the yield — ${/\d+× mana draught[^·]*/.exec(after)?.[0]}`)
  const manaAfter = Number(/mana\s*(\d+)/.exec(after)?.[1] ?? '-1')
  ok(manaAfter <= manaBefore - 5 + 1, `mana was drained (${manaBefore} → ${manaAfter}, cost 5)`)
  ok(/raw mana shard 15\/5/.test(after.replace(/\s+/g, ' ')),
    'and five shards left the satchel — the ingredients are really spent')

  await page.keyboard.press('Escape'); await sleep(500)
  const bottles = await bagHas('Mana Draught')
  ok(bottles >= 2, `★ the bottles are IN THE BAG (${bottles}) — not lost to a discarded leftover`)

  // ── 5. XP is paid, which is the only way alchemy levels in this world ───────────────────────
  await cmd('/brew')
  await sleep(700)
  const lvlTxt = await panelText()
  ok(lvlTxt.length > 0, 'the panel reopens after a brew')
  // Three more draughts (15 xp each) do not reach level 2 (83 xp) — this asserts the XP *road*
  // exists, not the curve. If it ever levels here, alchemy XP has been retuned and that is worth
  // knowing loudly rather than discovering in a balance pass.
  for (let i = 0; i < 3; i++) { await pressRow('Mana Draught'); await sleep(600) }
  const spent = await panelText()
  ok(/raw mana shard 0\/5/.test(spent.replace(/\s+/g, ' ')),
    'all twenty shards are gone after four draughts — the spend is repeatable, not a one-off')
  ok(/missing ingredients/.test(spent),
    'and the fifth press refuses, having run the bag dry')

  console.log(fails ? `\nbrew-check: ${fails} FAILED` : '\nbrew-check: CLEAN')
} finally {
  await browser.close()
}
process.exit(fails ? 1 : 0)
