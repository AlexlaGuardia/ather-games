// #692 end-to-end: does the browser actually move one keeper's world into their account, and stay
// out of everybody else's? Run: npx tsx scripts/save-owner-probe.mts [url]
//
// ⚠ IT REFUSES TO REPORT UNLESS IT MEASURED THE RIGHT PAGE. Twice on 2026-08-23 a probe pointed at
// a redirect target and returned a number shaped exactly like a real finding. Here the tell is the
// session fetch: it exists on /shimmer/voxel3d only because of this change, so if the page never
// asks who is playing, the server is stale or the route moved and the reading means nothing.
import puppeteer from 'puppeteer-core'

const EXE = process.env.CHROME ?? '/usr/bin/chromium-browser'
const URL_ = process.argv[2] ?? 'http://localhost:3203/shimmer/voxel3d'
const A = 'u_aaa111aaa111aaa111'
const B = 'u_bbb222bbb222bbb222'

let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

const browser = await puppeteer.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  let who: string | null = null
  let askedWhoIsPlaying = 0

  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.url().includes('/api/auth/session')) {
      askedWhoIsPlaying++
      void req.respond({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ session: who ? { user_id: who } : null }) })
      return
    }
    void req.continue()
  })

  // Seed the anonymous world the way a pre-login keeper leaves it: two columns and a player record.
  const seed = async () => page.evaluate(() => new Promise<void>(res => {
    const req = indexedDB.open('shimmer-voxel', 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('edits')) req.result.createObjectStore('edits') }
    req.onsuccess = () => {
      const tx = req.result.transaction('edits', 'readwrite')
      const s = tx.objectStore('edits')
      s.put({ edits: { idx: [1], mat: [4] }, pieces: [] }, '1337:0,0')
      s.put({ edits: { idx: [2], mat: [4] }, pieces: [] }, '1337:plot:4,4')
      s.put({ v: 1, x: 9, y: 70, z: 9 }, '1337:player')
      tx.oncomplete = () => res()
    }
  }))
  const keys = async () => page.evaluate(() => new Promise<string[]>(res => {
    const req = indexedDB.open('shimmer-voxel', 1)
    req.onsuccess = () => {
      const r = req.result.transaction('edits', 'readonly').objectStore('edits').getAllKeys()
      r.onsuccess = () => res((r.result as IDBValidKey[]).map(String).sort())
    }
  }))
  const claim = async () => page.evaluate(() => new Promise<unknown>(res => {
    const req = indexedDB.open('shimmer-voxel', 1)
    req.onsuccess = () => {
      const r = req.result.transaction('edits', 'readonly').objectStore('edits').get('1337:anon-owner')
      r.onsuccess = () => res(r.result ?? null)
    }
  }))
  // The gate awaits the session and the move before it flips the phase, so the black 'checking'
  // screen going away IS the signal that adoption finished. Waiting on the DOM rather than a sleep.
  const load = async () => {
    await page.goto(URL_, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.body.innerText.trim().length > 0 || !!document.querySelector('canvas'),
      { timeout: 45_000 }).catch(() => {})
  }

  // ── 1. anonymous: the world stays exactly where it has always been ────────────────────────────
  who = null
  await load()
  await seed()
  await load()
  const anon = await keys()
  ok(askedWhoIsPlaying > 0, `★ the page asked who is playing (${askedWhoIsPlaying}×) — 0 means this probe measured a stale build, not a passing fix`)
  // Compared as a SET: `getAllKeys` comes back in IndexedDB's own key order, and asserting a
  // hand-written order tests my memory of that order rather than the fix.
  ok(['1337:0,0', '1337:plot:4,4', '1337:player'].every(k => anon.includes(k)) && anon.length === 3,
     `anonymous keys untouched (${anon.join(', ')})`)
  ok(await claim() === null, 'an anonymous session claims nothing')

  // ── 2. account A signs in: the garden moves, once ─────────────────────────────────────────────
  who = A
  await load()
  const afterA = await keys()
  ok(afterA.includes(`u:${A}:1337:0,0`), '★ #692: the wilds column moved into A')
  ok(afterA.includes(`u:${A}:1337:plot:4,4`), 'the plot column moved with it')
  ok(afterA.includes(`u:${A}:1337:player`), 'the keeper moved with their garden')
  ok(!afterA.some(k => /^1337:(0,0|plot|player)/.test(k)), `nothing was left behind in the anonymous space (${afterA.join(', ')})`)
  ok(await claim() === A, 'the anonymous space is stamped for A')

  // ── 3. account B signs in on the same browser: A's world is not theirs ────────────────────────
  who = B
  await load()
  const afterB = await keys()
  ok(!afterB.some(k => k.startsWith(`u:${B}:`)), `★ #692: B inherits nothing — B has no records at all (${afterB.filter(k => k.includes(B)).join(', ') || 'none'})`)
  ok(afterB.filter(k => k.startsWith(`u:${A}:`)).length === 3, "A's three records are untouched by B's visit")
  ok(await claim() === A, "B's sign-in does not re-stamp the claim")

  // ── 4. B builds, A comes back: two worlds, one browser, no crossing ───────────────────────────
  await page.evaluate((b: string) => new Promise<void>(res => {
    const req = indexedDB.open('shimmer-voxel', 1)
    req.onsuccess = () => {
      const tx = req.result.transaction('edits', 'readwrite')
      tx.objectStore('edits').put({ edits: { idx: [7], mat: [9] }, pieces: [] }, `u:${b}:1337:0,0`)
      tx.oncomplete = () => res()
    }
  }), B)
  who = A
  await load()
  const both = await keys()
  ok(both.includes(`u:${A}:1337:0,0`) && both.includes(`u:${B}:1337:0,0`),
     '★ the same column exists twice, once per keeper — which is the whole fix')
  const cellA = await page.evaluate((a: string) => new Promise<unknown>(res => {
    const req = indexedDB.open('shimmer-voxel', 1)
    req.onsuccess = () => {
      const r = req.result.transaction('edits', 'readonly').objectStore('edits').get(`u:${a}:1337:0,0`)
      r.onsuccess = () => res((r.result as { edits: { mat: number[] } }).edits.mat[0])
    }
  }), A)
  ok(cellA === 4, `A's block is still A's block (material ${cellA}, B put 9 in the same coordinates)`)
  // ── 5. ★ THE RUNE, WHICH IS THE ONE A PLAYER FEELS ────────────────────────────────────────────
  // Everything above is blocks. This is identity: a second account on this browser used to find the
  // first keeper's birth rune sitting in a shared key, skip the ritual entirely, and spawn holding
  // somebody else's affinity and cast book. The page itself is the instrument — if B is owed a
  // birth, the boot gate puts the ritual on screen instead of the world.
  // ⚠ THE ANONYMOUS LOAD IS NOT SETUP NOISE — IT STAMPS THE EPOCH. `resetIfStale` clears a
  // character whose browser is behind, so seeding a rune into a browser with no epoch stamp gets it
  // legitimately wiped and the probe reads a broken fix. It found the real epoch bug that way (the
  // reset could not see a scoped rune) and then kept firing on its own setup, which is the tell:
  // let the page write its own epoch first, then seed.
  who = null
  await page.evaluate(() => localStorage.clear())
  await load()
  await page.evaluate(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'rune_ember')
    localStorage.setItem('ather:shimmer:book', '["bolt"]')
    localStorage.setItem('ather:gfx:shimmer', '{"quality":"high"}')
  })
  const local = () => page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).map(k => [k, localStorage.getItem(k) ?? ''])))

  who = A
  await load()
  const forA = await local()
  ok(forA[`u:${A}:ather:shimmer:birthRune`] === 'rune_ember', '★ the birth rune moved into A')
  ok(forA['ather:shimmer:birthRune'] === undefined, 'and no longer answers to the shared key')
  ok(forA[`u:${A}:ather:shimmer:book`] === '["bolt"]', "A's move book came with it")
  ok(forA['ather:gfx:shimmer'] === '{"quality":"high"}', 'graphics quality stayed on the DEVICE, where it belongs')
  ok(forA['ather:shimmer:anon-keeper'] === A, 'the browser is stamped for A')

  who = B
  await load()
  const forB = await local()
  ok(forB[`u:${B}:ather:shimmer:birthRune`] === undefined,
     `★★ B is NOT born holding A's rune (${forB[`u:${B}:ather:shimmer:birthRune`] ?? 'nothing'})`)
  ok(forB[`u:${A}:ather:shimmer:birthRune`] === 'rune_ember', "A's rune survived B's visit")
  // The page's own answer, not an inference from storage: B is owed the ritual and gets it.
  const sawRitual = await page.evaluate(() => document.body.innerText.toLowerCase())
  ok(/rune|born|choose/.test(sawRitual), `★ B is shown the birth ritual rather than dropped into a world (page said: ${sawRitual.slice(0, 60).replace(/\s+/g, ' ')})`)
  // ── 6. ★★ THE PURSE, ON /magii — AND THE RACE NO UNIT TEST HERE CAN REACH ─────────────────────
  // Marks split per account (Alex, 2026-08-23). The store's own test covers the slots; this covers
  // the thing that only exists in a real page: the account is answered a few FRAMES after load, so
  // between mount and that answer every surface is reading the anonymous purse. The card game's
  // welcome stake fires on `marks === 0` — and an unresolved read of an empty anonymous purse looks
  // exactly like a new player, so an ungated stake would re-grant itself on every sign-in and write
  // the coins somewhere the account cannot spend them. `useWallet().loading` is what holds it.
  const MAGII = new globalThis.URL(URL_).origin + '/magii'
  const loadMagii = async () => {
    await page.goto(MAGII, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.body.innerText.trim().length > 0, { timeout: 45_000 }).catch(() => {})
    // The stake lands in an effect chained behind the session fetch, so settle before reading.
    await page.waitForFunction(() => (window as unknown as { __t?: number }).__t !== undefined || true, { timeout: 1000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 1200))
  }
  const purse = (o: string | null) => page.evaluate((k: string) => {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as { marks: number }).marks : null
  }, o ? `ather:save:wallet:${o}` : 'ather:save:wallet')

  who = null
  await page.evaluate(() => localStorage.clear())
  await loadMagii()
  await page.evaluate(() => localStorage.setItem('ather:save:wallet', '{"marks":240,"totalEarned":240,"totalSpent":0}'))

  who = A
  await loadMagii()
  ok(await purse(A) === 240, `★★ A's 240 anonymous marks were adopted, to the coin (got ${await purse(A)})`)
  ok(await purse(null) === null, 'and the anonymous purse is emptied, so nobody adopts it twice')

  who = B
  await loadMagii()
  const bPurse = await purse(B)
  ok(bPurse !== 240, `★★ B does NOT inherit A's coins (B has ${bPurse})`)
  ok(await purse(A) === 240, "and A's balance survived B's visit")
  // ⚠ B is a genuinely new player, so the welcome stake is CORRECT for them — what must not happen
  // is A's 240 being read as "empty" and topped up, or B being seeded twice.
  ok(bPurse === null || bPurse > 0, `B either has no purse yet or a fresh stake, never a partial of A's (${bPurse})`)

  who = A
  await loadMagii()
  ok(await purse(A) === 240, `★★ returning as A does not re-grant a welcome stake — the balance is still exactly 240 (got ${await purse(A)})`)

  // ── 7. ★★ THE CARD SAVE READ BEFORE THE OWNER IS KNOWN ────────────────────────────────────────
  // ⚠ THIS CASE EXISTS BECAUSE THE OBVIOUS ONE DID NOT FAIL. A mutation sweep removed BOTH gates
  // meant to hold the welcome stake and this probe stayed green — the stake is really protected by
  // the persisted `seeded` flag inside the (now per-account) card save, so the guards I wrote for it
  // were never the thing standing in the way. What IS reachable is one layer down: the card save is
  // read once, on mount, through a slot that answers ANONYMOUS until the session lands. So the setup
  // has to be one adoption cannot paper over — an account that ALREADY has a save (adoption locks,
  // and moves nothing) while a different anonymous save sits beside it. Read early, the signed-in
  // player gets the anonymous collection for the whole session and never re-reads.
  who = A
  await page.evaluate((a: string) => {
    localStorage.setItem(`ather:save:magii:${a}`, JSON.stringify({ seeded: true, ownedCollections: ['tavern', 'vault'] }))
    localStorage.setItem('ather:save:magii', JSON.stringify({ seeded: true, ownedCollections: ['tavern'] }))
  }, A)
  await loadMagii()
  const collections = await page.evaluate((a: string) => {
    const raw = localStorage.getItem(`ather:save:magii:${a}`)
    return raw ? (JSON.parse(raw) as { ownedCollections?: string[] }).ownedCollections ?? [] : []
  }, A)
  ok(collections.includes('vault'),
     `★★ A's own card save is what was read and re-saved, not the anonymous one beside it (${collections.join(',') || 'nothing'})`)
} finally {
  await browser.close()
}
console.log(fails ? `\n#692 probe: ${fails} FAILED` : '\n#692 probe: all checks passed')
process.exit(fails ? 1 : 0)
