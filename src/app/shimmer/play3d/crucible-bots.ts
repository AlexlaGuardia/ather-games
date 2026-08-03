// crucible-bots.ts — filling the pyramid to 60.
//
// ── CANON (game/pyramid-zero.md § Entry) ───────────────────────────────────────
//   "Four sides, five entry points each (20 total entrances)"
//   "Requires 3 challengers per entrance to activate (60 total)"
//   "When not enough: 'Not enough' is all it says"
//   "When filled: All 60 warped to starting positions"
//
// So the match format is RULED, not chosen: 20 squads of 3, and the pyramid does not open until
// every slot is taken. That's lovely fiction and a hard problem for a web game — we will not have
// 60 humans. Bots are the answer, and canon leaves them entirely to us: it only ever says what the
// pyramid does when the count is short, never that a challenger must be a person.
//
// Everything here is PURE and DETERMINISTIC — same humans + same seed ⇒ same roster, every client.
// No Math.random anywhere: a lobby that shuffles differently per client is a desync waiting to
// happen, and a deterministic roster can be rebuilt from a seed instead of synced.

export const ENTRANCES = 20        // canon: four sides, five entry points each
export const SQUAD_SIZE = 3        // canon: three challengers per entrance
export const ROSTER_SIZE = ENTRANCES * SQUAD_SIZE  // canon: 60

export interface Challenger {
  id: string
  name: string
  bot: boolean
  /** which squad (0..19) — the entrance they came through */
  squad: number
}

export interface Squad {
  /** 0..19 — canon's entrance index */
  entrance: number
  members: Challenger[]
  /** a squad with no humans in it at all — useful for tuning bot difficulty by squad */
  allBots: boolean
}

export interface Roster {
  squads: Squad[]
  challengers: Challenger[]
  humans: number
  bots: number
  /** true once every one of the 60 slots is taken — the pyramid's activation condition */
  ready: boolean
  /** what the pyramid says when it is short. Canon: "Not enough" is all it says. */
  message: string | null
}

export interface HumanEntry {
  id: string
  name: string
  /** party code — teammates who must land in the SAME squad. Undefined = solo. */
  party?: string
}

// ── deterministic bot naming ───────────────────────────────────────────────────
// Challengers answer a beacon broadcast across the galaxy, so they are strangers from anywhere.
// Names are BUILT FROM SYLLABLES, never drawn from a canon list — a bot wearing a canon character's
// name would be accidental canon of the cheapest kind, and it would collide the moment that
// character appears for real. Nothing here is a word from the world.
const HEAD = ['Vor', 'Kal', 'Ser', 'Dro', 'Mek', 'Tal', 'Zan', 'Rhe', 'Ost', 'Bry',
              'Nim', 'Cais', 'Fen', 'Gral', 'Hox', 'Ilv', 'Jarn', 'Kesh', 'Lum', 'Mur']
const TAIL = ['ek', 'as', 'ith', 'or', 'un', 'ax', 'el', 'ir', 'oth', 'ai']

/** xorshift32 — small, fast, and identical on every client. Seeded, never Math.random. */
function rng(seed: number): () => number {
  let s = seed | 0 || 0x9e3779b9
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
}

function botName(next: () => number, taken: Set<string>): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const n = HEAD[Math.floor(next() * HEAD.length)] + TAIL[Math.floor(next() * TAIL.length)]
    if (!taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n }
  }
  // deterministic fallback so we can never loop forever on a hostile seed
  let i = 2
  for (;;) {
    const n = `${HEAD[0]}${TAIL[0]}-${i}`
    if (!taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n }
    i++
  }
}

/**
 * Fill the pyramid.
 *
 * Order matters and is deliberate:
 *   1. **parties stay together** — a party of 3 takes a whole entrance; a party of 2 takes two
 *      slots of one and a bot fills the third. Splitting a party across entrances would be the
 *      single most infuriating bug in the mode, so it is handled first and tested.
 *   2. solo humans backfill the partly-filled squads, so humans meet humans before bots.
 *   3. bots take everything left.
 *
 * A party larger than SQUAD_SIZE is split across squads (canon has no larger unit), keeping the
 * split deterministic rather than dropping anyone.
 */
export function fillRoster(humans: HumanEntry[], seed = 1): Roster {
  const next = rng(seed)
  const taken = new Set<string>(humans.map((h) => h.name.toLowerCase()))
  const slots: (Challenger | null)[][] = Array.from({ length: ENTRANCES }, () => Array(SQUAD_SIZE).fill(null))

  const place = (c: Omit<Challenger, 'squad'>, squad: number, slot: number) => {
    slots[squad][slot] = { ...c, squad }
  }
  const firstFreeSlot = (squad: number) => slots[squad].findIndex((s) => s === null)
  const freeCount = (squad: number) => slots[squad].filter((s) => s === null).length

  // capped at the roster: canon opens the doors at exactly 60
  const entrants = humans.slice(0, ROSTER_SIZE)

  // 1. parties first, largest first so a trio never gets stranded behind two duos
  const parties = new Map<string, HumanEntry[]>()
  const solos: HumanEntry[] = []
  for (const h of entrants) {
    if (h.party) { const g = parties.get(h.party) ?? []; g.push(h); parties.set(h.party, g) }
    else solos.push(h)
  }
  const grouped = [...parties.values()].sort((a, b) => b.length - a.length)
  for (const group of grouped) {
    let rest = group
    while (rest.length) {
      const chunk = rest.slice(0, SQUAD_SIZE)
      rest = rest.slice(SQUAD_SIZE)
      // the emptiest squad that can hold this chunk whole
      let target = -1
      for (let i = 0; i < ENTRANCES; i++) {
        if (freeCount(i) >= chunk.length && (target < 0 || freeCount(i) > freeCount(target))) target = i
      }
      if (target < 0) break  // roster full
      for (const h of chunk) place({ id: h.id, name: h.name, bot: false }, target, firstFreeSlot(target))
    }
  }

  // 2. solos backfill squads that already hold a human, so humans meet humans first
  const hasHuman = (squad: number) => slots[squad].some((s) => s && !s.bot)
  for (const h of solos) {
    let target = slots.findIndex((_, i) => freeCount(i) > 0 && hasHuman(i))
    if (target < 0) target = slots.findIndex((_, i) => freeCount(i) > 0)
    if (target < 0) break
    place({ id: h.id, name: h.name, bot: false }, target, firstFreeSlot(target))
  }

  // 3. bots take the rest
  let botN = 0
  for (let sq = 0; sq < ENTRANCES; sq++) {
    for (let sl = 0; sl < SQUAD_SIZE; sl++) {
      if (slots[sq][sl]) continue
      place({ id: `bot-${botN++}`, name: botName(next, taken), bot: true }, sq, sl)
    }
  }

  const squads: Squad[] = slots.map((members, entrance) => {
    const m = members.filter(Boolean) as Challenger[]
    return { entrance, members: m, allBots: m.every((c) => c.bot) }
  })
  const challengers = squads.flatMap((s) => s.members)
  const humanCount = challengers.filter((c) => !c.bot).length
  const ready = challengers.length === ROSTER_SIZE

  return {
    squads,
    challengers,
    humans: humanCount,
    bots: challengers.length - humanCount,
    ready,
    // canon: when the pyramid is short, "Not enough" is ALL it says. Don't embellish it.
    message: ready ? null : 'Not enough',
  }
}
