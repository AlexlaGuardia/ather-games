/** Pieces of a season's vessel: carried out of the Breach, joined by the cutter. Run: `npx tsx src/app/shimmer/play3d/vessel-pieces.test.ts` */
import { PIECES_KEY, PIECES_PER_VESSEL, PIECE_TIER, FINISH_FEE, loadPieces, addPiece, finishVessel, pieceLine } from './vessel-pieces'
import { loadStowed, ownedCount, isComplete, seatLetters, MAX_PER_KIND, grantVessel } from './vessels'
import { BAND_FOR_VESSEL } from './vessels'
import { ALL_BANDS } from './cast'
import { KEEPER_MOVES } from './keeper-moves'
import { KEEPER_KEYS } from '@/lib/keeper-local'
import { CHEST_LOOT, VESSEL_PIECES_WIRED } from './hold'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }

ok(KEEPER_KEYS.includes(PIECES_KEY), 'the pieces key is registered per keeper')
ok(VESSEL_PIECES_WIRED && CHEST_LOOT.legendary.some(e => e.loot.kind === 'part'), 'a legendary Breach cache gives a piece, and it is wired')
ok(PIECES_PER_VESSEL === 3 && PIECE_TIER === 2, 'three pieces make one tier-2 vessel (Alex 09-27: a three piece set)')

// a bracelet word with at least one seat, for the finish
const word = KEEPER_MOVES.find(m => ALL_BANDS[BAND_FOR_VESSEL.bracelet] === m.tier && seatLetters({ move: m.id }, null).length > 0)!
ok(!!word, 'a bracelet word with seats exists to test with')

wipe()
ok(loadPieces() === 0, 'a new keeper carries no pieces')
ok(addPiece() === 1 && addPiece() === 2, 'a piece is carried, one at a time')
ok(pieceLine(2) === `A vessel piece — 2 of ${PIECES_PER_VESSEL}`, 'the cache names the count')
let r = finishVessel('bracelet', word.id, 999, null)
ok(!r.ok && loadPieces() === 2 && r.marks === 999, '★ two pieces are not a vessel: refused, nothing spent')
addPiece()
ok(pieceLine(3).includes('cutter'), 'at three, the line points at the cutter')
r = finishVessel('bracelet', word.id, FINISH_FEE - 1, null)
ok(!r.ok && r.why === 'too-dear' && loadPieces() === 3, 'short of the fee: refused, pieces kept')
r = finishVessel('bracelet', word.id, 500, null)
ok(r.ok && r.marks === 500 - FINISH_FEE, `the cutter charges ${FINISH_FEE} Marks`)
ok(loadPieces() === 0, '★ the three pieces are spent')
const v = loadStowed().find(s => s.move === word.id && s.tier === PIECE_TIER)
ok(!!v && v.kind === 'bracelet', 'a tier-2 bracelet for that word is in the satchel')
ok(!!v && isComplete(v, null), '★ it arrives with its letters woven in: written, wearable, no gem spent')
ok(r.say.includes('cutter joins'), 'the copy says the CUTTER joined them (a keeper never assembles one)')

// the cap: at MAX_PER_KIND the cutter will not make another, and keeps the pieces
wipe()
for (let i = 0; i < MAX_PER_KIND; i++) grantVessel('bracelet', 1, null, 'bought')
for (let i = 0; i < 3; i++) addPiece()
r = finishVessel('bracelet', word.id, 500, null)
ok(!r.ok && r.why === 'at-cap' && loadPieces() === 3 && ownedCount('bracelet') === MAX_PER_KIND, 'at the cap: refused, pieces and Marks kept')

console.log(`vessel-pieces: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
