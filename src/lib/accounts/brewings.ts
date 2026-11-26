// ── BREWINGS POSTED TO THE CHORDSTONE: the shared record (BETA M188 s4) ─────────────────────────────────────────────────
// Canon (62a71de + game/alchemy.md): 'a brewing' is hosted on a keeper's plot; brewings post to the Chordstone; it gives
// MORE, never ONLY: a seat is a hand at one step, never a key to a recipe, and nothing here gates the solo brew.
// Alex 11-26: the HOST schedules ahead (time, public / private, the potion, and first pick of which steps keepers may sign
// up for: the steps not opened stay the host's); the FINDER lists them (time, host, potion, seats free) and taking a seat
// is the RSVP, which disappears at the scheduled time; inside the door window the host's garden shows on the map.
// Rules: WHO YOU ARE is the session (api/brewing); a private brewing is seen only by the host's friends; one seat per keeper
// per brewing; the host cannot sit in their own; nothing past `at` is listed or held. The session itself (doing the steps
// together) is party-brew.ts's and not this record's.
// Run: npx tsx src/lib/accounts/brewings.test.ts
import { randomBytes } from 'node:crypto'
import { accountsDb, areFriends } from './db'
import { ALC_POTIONS } from '@/app/shimmer/open/ather/alchemy-set'
import { BREW_HOST_MAX, BREW_LEAD_MAX_MS, BREW_LEAD_MIN_MS, cleanSeats, doorOpen, rsvpLive } from './brewing-rules'

export interface BrewSeat { step: number; user_id: string | null; name: string | null }
export interface BrewingView {
  brewing_id: string
  host_id: string
  host: string | null
  potion: string
  at: number
  public: boolean
  /** the steps the host opened, each with who sits there (null = free) */
  seats: BrewSeat[]
  /** is the viewer the host */
  mine: boolean
  /** the step the viewer sits at, or null */
  my_step: number | null
}
/** an RSVP the viewer holds; `door` is set only inside the door window and once the host's client has posted it */
export interface Rsvp { brewing: BrewingView; step: number; door: { code: string; look: string } | null }

export type Result<T = true> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

interface Row { brewing_id: string; host_id: string; host: string | null; potion: string; at: number; public: number; seats: string; door_code: string | null; door_look: string | null }
const SELECT = `SELECT b.brewing_id, b.host_id, a.username AS host, b.potion, b.at, b.public, b.seats, b.door_code, b.door_look
  FROM brewings b LEFT JOIN accounts a ON a.user_id = b.host_id`

function view(r: Row, viewer: string): BrewingView {
  const d = accountsDb()
  const taken = d.prepare(`SELECT s.step, s.user_id, a.username AS name FROM brewing_seats s LEFT JOIN accounts a ON a.user_id = s.user_id
    WHERE s.brewing_id = ?`).all(r.brewing_id) as { step: number; user_id: string; name: string | null }[]
  const open = JSON.parse(r.seats) as number[]
  const seats = open.map(step => { const t = taken.find(x => x.step === step); return { step, user_id: t?.user_id ?? null, name: t ? (t.name ?? 'a keeper') : null } })
  return {
    brewing_id: r.brewing_id, host_id: r.host_id, host: r.host, potion: r.potion, at: r.at, public: r.public === 1, seats,
    mine: r.host_id === viewer, my_step: taken.find(x => x.user_id === viewer)?.step ?? null,
  }
}
const canSee = (r: Row, viewer: string) => r.host_id === viewer || r.public === 1 || areFriends(r.host_id, viewer)
const getRow = (id: string) => accountsDb().prepare(`${SELECT} WHERE b.brewing_id = ?`).get(id) as Row | undefined

/** Schedule a brewing. `seats` = the potion's step indexes the host opens for sign-up. */
export function hostBrewing(host_id: string, o: { potion: unknown; at: unknown; public: unknown; seats: unknown }, now = Date.now()): Result<BrewingView> {
  const potion = String(o.potion ?? '')
  const p = Object.prototype.hasOwnProperty.call(ALC_POTIONS, potion) ? ALC_POTIONS[potion] : null
  if (!p) return fail('Which potion?')
  const at = Number(o.at)
  if (!Number.isFinite(at) || at < now + BREW_LEAD_MIN_MS) return fail('Pick a later time')
  if (at > now + BREW_LEAD_MAX_MS) return fail('That is too far ahead')
  const seats = cleanSeats(o.seats, p.steps.length)
  if (!seats) return fail('Open at least one step')
  const d = accountsDb()
  const n = (d.prepare('SELECT COUNT(*) AS n FROM brewings WHERE host_id = ? AND at > ?').get(host_id, now) as { n: number }).n
  if (n >= BREW_HOST_MAX) return fail(`You already have ${BREW_HOST_MAX} brewings set`)
  const id = `b_${randomBytes(8).toString('hex')}`
  d.prepare('INSERT INTO brewings (brewing_id, host_id, potion, at, public, seats, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, host_id, potion, Math.round(at), o.public === false ? 0 : 1, JSON.stringify(seats), now)
  return { ok: true, value: view(getRow(id)!, host_id) }
}

/** The host calls their brewing off: it and every seat (RSVP) in it go. Only the host. */
export function cancelBrewing(host_id: string, id: string): Result {
  const r = getRow(id)
  if (!r || r.host_id !== host_id) return fail('Not your brewing')
  const d = accountsDb()
  d.prepare('DELETE FROM brewing_seats WHERE brewing_id = ?').run(id)
  d.prepare('DELETE FROM brewings WHERE brewing_id = ?').run(id)
  return { ok: true, value: true }
}

/** Every brewing this keeper can see that has not started, soonest first (the Finder + the host's own). */
export function listBrewings(viewer: string, now = Date.now()): BrewingView[] {
  const rows = accountsDb().prepare(`${SELECT} WHERE b.at > ? ORDER BY b.at ASC LIMIT 200`).all(now) as unknown as Row[]
  return rows.filter(r => canSee(r, viewer)).map(r => view(r, viewer)).slice(0, 60)
}

/** Take a free seat = the RSVP. One per keeper per brewing; never the host's own. */
export function takeSeat(user_id: string, id: string, step: number, now = Date.now()): Result<BrewingView> {
  const r = getRow(id)
  if (!r || !canSee(r, user_id) || !rsvpLive(r.at, now)) return fail('That brewing is not open')
  if (r.host_id === user_id) return fail('You are hosting it')
  if (!(JSON.parse(r.seats) as number[]).includes(step)) return fail('That step is not open')
  const d = accountsDb()
  if (d.prepare('SELECT 1 FROM brewing_seats WHERE brewing_id = ? AND user_id = ?').get(id, user_id)) return fail('You already have a seat')
  if (d.prepare('SELECT 1 FROM brewing_seats WHERE brewing_id = ? AND step = ?').get(id, step)) return fail('That seat is taken')
  d.prepare('INSERT INTO brewing_seats (brewing_id, step, user_id, taken_at) VALUES (?, ?, ?, ?)').run(id, step, user_id, now)
  return { ok: true, value: view(r, user_id) }
}

/** Give your own seat back. Nobody can take another keeper's seat away. */
export function leaveSeat(user_id: string, id: string): Result {
  const res = accountsDb().prepare('DELETE FROM brewing_seats WHERE brewing_id = ? AND user_id = ?').run(id, user_id)
  return Number(res.changes) > 0 ? { ok: true, value: true } : fail('You have no seat there')
}

/** The RSVPs this keeper holds (live ones only: past `at` they are gone), each with the door once it opens. */
export function myRsvps(user_id: string, now = Date.now()): Rsvp[] {
  const rows = accountsDb().prepare(`${SELECT} JOIN brewing_seats s ON s.brewing_id = b.brewing_id WHERE s.user_id = ? AND b.at > ? ORDER BY b.at ASC`)
    .all(user_id, now) as unknown as Row[]
  return rows.map(r => {
    const v = view(r, user_id)
    const door = doorOpen(r.at, now) && r.door_code && r.door_look ? { code: r.door_code, look: r.door_look } : null
    return { brewing: v, step: v.my_step ?? -1, door }
  })
}

const CODE_RE = /^[A-Z0-9]{3,12}$/, LOOK_RE = /^[A-Za-z0-9_-]{1,64}$/
/** The HOST's client, inside the door window, posts its chord code + plot id so its seat holders can come to its garden. */
export function postDoor(host_id: string, id: string, code: unknown, look: unknown, now = Date.now()): Result {
  const r = getRow(id)
  if (!r || r.host_id !== host_id) return fail('Not your brewing')
  if (!doorOpen(r.at, now)) return fail('Not yet')
  const c = String(code ?? ''), l = String(look ?? '')
  if (!CODE_RE.test(c) || !LOOK_RE.test(l)) return fail('Bad door')
  accountsDb().prepare('UPDATE brewings SET door_code = ?, door_look = ? WHERE brewing_id = ?').run(c, l, id)
  return { ok: true, value: true }
}

/** Housekeeping: brewings past their time (with their seats) are dropped. Called on reads; cheap. */
export function sweepBrewings(now = Date.now()): void {
  const d = accountsDb()
  d.prepare('DELETE FROM brewing_seats WHERE brewing_id IN (SELECT brewing_id FROM brewings WHERE at <= ?)').run(now)
  d.prepare('DELETE FROM brewings WHERE at <= ?').run(now)
}
