// BETA M4: a new keeper's first errand is the active line until they choose one.   npx tsx src/app/shimmer/open/shared/journal.test.ts
import { withDefault, markerOn, trailOn, type JournalEntry, type JournalPrefs } from './journal'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const fresh: JournalPrefs = { v: 1, active: null, marker: {}, trail: {} }
const errand: JournalEntry = { id: 'errand', hand: 'keeper', title: 'See Gregory', note: '', where: { zone: 'ather', x: 0, z: 0 } }
const other: JournalEntry = { id: 'gun-shop', hand: 'keeper', title: 'guns', note: '', where: null }
const d = withDefault(fresh, [other, errand])
ok(d.active === 'errand' && markerOn(d, 'errand') && trailOn(d, 'errand'), 'fresh keeper: the errand is active, beacon + trail on')
ok(withDefault(fresh, [other]).active === null, 'no errand posted: nothing forced')
ok(withDefault(fresh, [{ ...errand, struck: true }]).active === null, 'a finished errand is never forced active')
ok(withDefault({ ...fresh, active: null, chosen: true }, [errand]).active === null, 'the player cleared it: stays cleared')
ok(withDefault({ ...fresh, active: 'gun-shop', chosen: true }, [errand, other]).active === 'gun-shop', "the player's own pick wins")
ok(withDefault({ ...fresh, active: 'gun-shop' }, [errand, other]).active === 'gun-shop', 'an old save with a pick keeps it')
ok(fresh.active === null && fresh.chosen === undefined, 'the stored prefs are not rewritten by the default')
if (fails) { console.log(`${fails} FAILED`); process.exit(1) } else console.log('journal 7/0')
