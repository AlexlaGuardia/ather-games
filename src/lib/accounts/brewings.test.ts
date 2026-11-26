// Brewings record oracle (BETA M188 s4) — run: npx tsx src/lib/accounts/brewings.test.ts
import { unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, upsertGoogleAccount, claimUsername, addFriend, acceptFriend, deleteAccount, accountsDb } from './db'
import * as B from './brewings'
import { BREW_DOOR_MS, BREW_HOST_MAX, cleanSeats, doorOpen, rsvpLive, whenLabel } from './brewing-rules'

let failures = 0, passes = 0
const check = (label: string, ok: boolean, detail = '') => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) } }

const path = join(tmpdir(), `brewings-${process.pid}.db`)
_openAt(path)
const mk = (name: string) => { const a = upsertGoogleAccount(`g-${name}`, null, null); claimUsername(a.user_id, name); return a.user_id }
const [host, pal, stranger, pal2] = ['hosty', 'pally', 'strange', 'pally2'].map(mk)
addFriend(host, 'pally'); acceptFriend(pal, host)
addFriend(host, 'pally2'); acceptFriend(pal2, host)

const T0 = 1_800_000_000_000, MIN = 60_000
// rules
check('seats: clean + sorted + unique', JSON.stringify(cleanSeats([2, 0, 2], 4)) === '[0,2]')
check('seats: empty is no pick', cleanSeats([], 4) === null)
check('seats: out of range refused', cleanSeats([4], 4) === null && cleanSeats([-1], 4) === null && cleanSeats([1.5], 4) === null)
check('rsvp live until the time, gone at it', rsvpLive(T0, T0 - 1) && !rsvpLive(T0, T0))
check('door: shut 21 min before, open 20 min before, shut at start', !doorOpen(T0, T0 - 21 * MIN) && doorOpen(T0, T0 - BREW_DOOR_MS) && doorOpen(T0, T0 - 5 * MIN) && !doorOpen(T0, T0))
check('when label', whenLabel(T0 + 12 * MIN, T0) === 'in 12 min' && whenLabel(T0 + 125 * MIN, T0) === 'in 2 h 5 min')

// hosting
check('unknown potion refused', !B.hostBrewing(host, { potion: 'nope', at: T0 + 30 * MIN, public: true, seats: [0] }, T0).ok)
check('prototype key is not a potion', !B.hostBrewing(host, { potion: 'constructor', at: T0 + 30 * MIN, public: true, seats: [0] }, T0).ok)
check('too soon refused', !B.hostBrewing(host, { potion: 'health', at: T0 + MIN, public: true, seats: [0] }, T0).ok)
check('too far refused', !B.hostBrewing(host, { potion: 'health', at: T0 + 8 * 24 * 60 * MIN, public: true, seats: [0] }, T0).ok)
check('no open step refused', !B.hostBrewing(host, { potion: 'health', at: T0 + 30 * MIN, public: true, seats: [] }, T0).ok)
const pub = B.hostBrewing(host, { potion: 'health', at: T0 + 30 * MIN, public: true, seats: [1, 2] }, T0)
check('public brewing set', pub.ok && pub.value.seats.length === 2 && pub.value.mine && pub.value.host === 'hosty')
const priv = B.hostBrewing(host, { potion: 'mana', at: T0 + 60 * MIN, public: false, seats: [0] }, T0)
check('private brewing set', priv.ok && priv.ok && !priv.value.public)
const pid = pub.ok ? pub.value.brewing_id : '', vid = priv.ok ? priv.value.brewing_id : ''

// seeing
const seen = (who: string) => B.listBrewings(who, T0).map(b => b.brewing_id)
check('a friend sees both', seen(pal).includes(pid) && seen(pal).includes(vid))
check('a stranger sees the public one only', seen(stranger).includes(pid) && !seen(stranger).includes(vid))
check('the host sees their own', seen(host).length === 2)

// seats
check('host cannot sit in their own', !B.takeSeat(host, pid, 1, T0).ok)
check('a closed step refused', !B.takeSeat(pal, pid, 0, T0).ok)
check('a stranger cannot sit in a private one', !B.takeSeat(stranger, vid, 0, T0).ok)
check('a friend takes a seat', B.takeSeat(pal, pid, 1, T0).ok)
check('one seat per keeper', !B.takeSeat(pal, pid, 2, T0).ok)
check('a taken seat refused', !B.takeSeat(stranger, pid, 1, T0).ok)
check('a stranger takes the other public seat', B.takeSeat(stranger, pid, 2, T0).ok)
const v = B.listBrewings(host, T0).find(b => b.brewing_id === pid)
check('host sees who sits where', !!v && v.seats.find(s => s.step === 1)?.name === 'pally' && v.seats.find(s => s.step === 2)?.name === 'strange')

// RSVP + door
let rs = B.myRsvps(pal, T0)
check('the seat is an RSVP', rs.length === 1 && rs[0].brewing.brewing_id === pid && rs[0].step === 1)
check('no door before the window', rs[0]?.door === null && !B.postDoor(host, pid, 'ABCDE', 'p_1', T0).ok)
const inWin = T0 + 30 * MIN - 10 * MIN
check('only the host posts the door', !B.postDoor(pal, pid, 'ABCDE', 'p_1', inWin).ok)
check('a bad code refused', !B.postDoor(host, pid, 'a b', 'p_1', inWin).ok)
check('host posts the door in the window', B.postDoor(host, pid, 'ABCDE', 'p_host', inWin).ok)
rs = B.myRsvps(pal, inWin)
check('RSVP holder sees the door', rs[0]?.door?.code === 'ABCDE' && rs[0]?.door?.look === 'p_host')
check('the door is not shown in the listing', !JSON.stringify(B.listBrewings(pal2, inWin)).includes('ABCDE'))
check('RSVP gone at the time', B.myRsvps(pal, T0 + 30 * MIN).length === 0)
check('cannot sit once started', !B.takeSeat(pal2, pid, 1, T0 + 30 * MIN).ok)
check('listing drops a started brewing', !B.listBrewings(pal, T0 + 30 * MIN).some(b => b.brewing_id === pid))

// leaving / cancel / limits
check('give the seat back', B.leaveSeat(stranger, pid).ok && !B.leaveSeat(stranger, pid).ok)
check('only the host cancels', !B.cancelBrewing(pal, vid).ok)
B.takeSeat(pal, vid, 0, T0)
check('host cancels: brewing + seats go', B.cancelBrewing(host, vid).ok && B.myRsvps(pal, T0).every(r => r.brewing.brewing_id !== vid))
for (let i = 0; i < BREW_HOST_MAX; i++) B.hostBrewing(pal2, { potion: 'wisdom', at: T0 + (10 + i) * MIN, public: true, seats: [0] }, T0)
check(`a host holds at most ${BREW_HOST_MAX}`, !B.hostBrewing(pal2, { potion: 'wisdom', at: T0 + 50 * MIN, public: true, seats: [0] }, T0).ok)
B.sweepBrewings(T0 + 9 * 24 * 60 * MIN)
check('sweep drops past brewings + seats', (accountsDb().prepare('SELECT COUNT(*) AS n FROM brewings').get() as { n: number }).n === 0
  && (accountsDb().prepare('SELECT COUNT(*) AS n FROM brewing_seats').get() as { n: number }).n === 0)
const again = B.hostBrewing(host, { potion: 'health', at: T0 + 30 * MIN, public: true, seats: [0] }, T0)
if (again.ok) B.takeSeat(pal, again.value.brewing_id, 0, T0)
deleteAccount(host)
check('erasing the host takes their brewings + seats', (accountsDb().prepare('SELECT COUNT(*) AS n FROM brewings').get() as { n: number }).n === 0 && B.myRsvps(pal, T0).length === 0)

// canon 62a71de: on screen the word is 'a brewing', never 'potion party' / 'swaray' / 'podium' (comments may name them)
{
  const src = readFileSync(join(__dirname, '..', '..', 'app', 'shimmer', 'open', 'ather', 'brewing-card.tsx'), 'utf8')
  const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*\*[\s\S]*?\*\//g, '')
  check('no retired word on the brewings card', !/potion party|swaray|podium/i.test(code))
  check('the card says brewing', /Brewings<\/div>/.test(code))
}
try { unlinkSync(path) } catch { /* scratch */ }
console.log(failures ? `brewings: ${failures} FAIL, ${passes} pass` : `brewings: all ${passes} pass`)
process.exit(failures ? 1 : 0)
