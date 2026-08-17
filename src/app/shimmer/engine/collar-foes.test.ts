// Run: npx tsx src/app/shimmer/engine/collar-foes.test.ts
//
// Two things are guarded here and they are not the same kind of thing.
//
// The first is CANON, and it is the one that would do real damage: this class has no health, cannot
// die, and stops being a target the instant its collar comes off. A change that quietly gave a
// collared Moglin a wounded state, or let a freed one re-arm, would contradict a fact already
// printed in the books — and it would do it silently, because the fight would still "work".
//
// The second is the TRIANGLE. Three foes that differ only in integrity are one foe with three bars.
// hollows.ts had to fight for that rule once already; asserting it here is what stops a balance pass
// converging them back into each other.

import {
  COLLAR_FOES, POSTURE_ORDER, foeDef, pickPosture, spawnFoe, strike, hostile, collarFrac, stepFoe, answerCollar, LEAVING_SPEED,
  rollPatrol, pressArrival, sendbackClock, sightClear, SIGHT_STEP, PATROL_SIZE, recoverySeconds,
  type FoePosture,
} from './collar-foes'
import { TIER_DIALS } from '../play3d/collar-raid'
import { HOLDS } from '../voxel/holds'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

// ── 1. Alex's numbers, verbatim ─────────────────────────────────────────────────────────────────
{
  check('the road-blocker carries 175', COLLAR_FOES.bulwark.integrity === 175)
  check('the one that presses from range carries 125', COLLAR_FOES.channeler.integrity === 125)
  check('the fast one carries 100', COLLAR_FOES.skirmisher.integrity === 100)
}

// ── 2. ★ CANON: NO DEATH, NO WOUNDED STATE, NO RE-ARM ──────────────────────────────────────────
{
  const f = spawnFoe('m1', 'bulwark', 0, 0)
  check('a spawned foe starts at a full collar', f.collar?.integrity === 175 && f.collar?.max === 175)
  check('and is hostile while collared', hostile(f))

  const part = strike(f, 100)
  check('a partial strike weakens the collar', part.foe.collar?.integrity === 75)
  check('and does not free him yet', !part.freed && hostile(part.foe))

  const done = strike(part.foe, 75)
  check('★ emptying the collar frees him', done.freed && done.foe.collar === null)
  // ★ The whole canon payoff: he is simply the sweet creature again. No corpse, no HP, no phase two.
  check('★ a freed Moglin is never hostile again', !hostile(done.foe))
  check('★ and has no bar left to draw', collarFrac(done.foe) === 0)

  // ⚠ RE-STRIKING A FREED ONE MUST BE A NO-OP, not a re-arm. Canon gives nothing here to model, so
  // the only wrong answer is a second collar appearing out of a stray damage tick.
  const again = strike(done.foe, 999)
  check('★ striking a freed Moglin does nothing at all', !again.freed && again.foe.collar === null)

  // Overkill frees exactly once and does not go negative — a caller firing the deflate off `freed`
  // must never see it twice.
  const one = strike(spawnFoe('m2', 'skirmisher', 0, 0), 10_000)
  check('overkill frees on exactly one strike', one.freed && one.foe.collar === null)
  check('a zero strike changes nothing', !strike(spawnFoe('m3', 'bulwark', 0, 0), 0).freed)
}

// ── 3. ★ THE TRIANGLE IS A TRIANGLE ────────────────────────────────────────────────────────────
// Each posture must OWN an axis, not merely sit at a different point on one.
{
  const by = (k: keyof typeof COLLAR_FOES.bulwark) =>
    POSTURE_ORDER.map(p => COLLAR_FOES[p][k] as number)

  // ⚠ STRICTLY GREATER THAN THE OTHER TWO, not merely equal to the maximum.
  // This first read `Math.max(...vals) === COLLAR_FOES[p][k]`, which passes VACUOUSLY when every
  // posture shares a value: zeroing the channeler's standoff — turning it into a second melee foe,
  // exactly the convergence this block exists to prevent — left all three at 0 and the assert stayed
  // green. Caught by mutation, not by reading. Owning an axis means being alone at the top of it.
  const maxAt = (k: keyof typeof COLLAR_FOES.bulwark, p: FoePosture) => {
    const mine = COLLAR_FOES[p][k] as number
    return POSTURE_ORDER.every(q => q === p || (COLLAR_FOES[q][k] as number) < mine)
  }
  check('★ the bulwark owns toughness AND body — it is the wall',
    maxAt('integrity', 'bulwark') && maxAt('body', 'bulwark'))
  check('★ the channeler owns reach and standoff — it is the reason to close',
    maxAt('reach', 'channeler') && maxAt('standoff', 'channeler'))
  check('★ the skirmisher owns speed — it is the reason not to stand still',
    maxAt('speed', 'skirmisher'))

  // And the frail one is genuinely frail: the cheapest to free is what makes triage a choice.
  check('★ the fastest is also the cheapest to free',
    COLLAR_FOES.skirmisher.integrity === Math.min(...by('integrity')))

  // No two postures may share an entire profile — the converge-check.
  const sig = (p: FoePosture) => JSON.stringify(COLLAR_FOES[p])
  check('no two postures are the same foe', new Set(POSTURE_ORDER.map(sig)).size === 3)

  // ⚠ Nothing may out-run a keeper, or walking away stops being an answer. Voxel run speed is 22
  // units/s; even the drained floor (locomotion DRAINED_SPEED 4.2) must beat the fastest posture.
  check('★ nothing out-runs even a drained keeper', Math.max(...by('speed')) < 4.2)
}

// ── 4. ★ THE TWO AXES MUST NOT SILENTLY MERGE ──────────────────────────────────────────────────
// collar-raid.ts tiers integrity by WHAT IS AT STAKE (70/120/200, canon-anchored). This file tiers
// by HOW ONE FIGHTS. They describe different encounters; if someone ever multiplies them, difficulty
// is counted twice. Asserting they are separate tables is the cheapest way to notice that happening.
{
  const raidValues = [TIER_DIALS.base.integrity, TIER_DIALS.second.integrity, TIER_DIALS.awakened.integrity]
  const patrolValues = POSTURE_ORDER.map(p => COLLAR_FOES[p].integrity)
  check('★ patrol integrity is its own table, not the raid tiers',
    JSON.stringify(raidValues) !== JSON.stringify(patrolValues))
  check('the raid tiers are untouched by this file',
    TIER_DIALS.base.integrity === 70 && TIER_DIALS.second.integrity === 120 && TIER_DIALS.awakened.integrity === 200)
}

// ── 5. the weighted pick ────────────────────────────────────────────────────────────────────────
{
  check('roll 0 takes the first posture', pickPosture(0) === POSTURE_ORDER[0])
  check('roll 1 is clamped, never undefined', POSTURE_ORDER.includes(pickPosture(1)))
  check('a negative roll is clamped too', POSTURE_ORDER.includes(pickPosture(-3)))
  const seen = new Set<FoePosture>()
  for (let i = 0; i < 200; i++) seen.add(pickPosture(i / 200))
  check('every posture is reachable', seen.size === 3)
  check('foeDef agrees with the table', foeDef('channeler') === COLLAR_FOES.channeler)
}

// ── 6. the approach (2026-08-16, #294) ──────────────────────────────────────────────────────────
{
  const at = (p: FoePosture, x: number, z: number) => spawnFoe(`t-${p}`, p, x, z)
  const KEEPER = { px: 0, pz: 0 }

  // ★★ THE RULING, NOT A BALANCE NUMBER — AND IT CHANGED ON 2026-08-16. This first asserted that a
  // freed Moglin goes completely INERT, which I filed as a placeholder and canon then refused:
  // *"the only thing that separates this from a nicer collar is that he can go… the exit is not a
  // courtesy feature. It is the canon. Build it and never hide it."* A Moglin standing frozen on
  // the road forever is the build quietly keeping him. He walks off.
  const freed = strike(at('skirmisher', 5, 0), 999).foe
  const fi = stepFoe(freed, KEEPER, 0.1)
  check('★★ a freed Moglin never presses again', !fi.pressing)
  check('★★ and he LEAVES — the exit is canon, not a courtesy', fi.moveTo !== null)
  check('★ away from the keeper, not toward them',
    (fi.moveTo?.x ?? 0) > 5, `moved to ${fi.moveTo?.x?.toFixed(3)} from 5`)
  // ⚠ Leaving is a walk, not a rout. Canon's beat is deflation; a freed Moglin sprinting away reads
  // as fear, and the line's whole point is that he was never the frightening one.
  const gone = Math.hypot((fi.moveTo?.x ?? 5) - 5, fi.moveTo?.z ?? 0)
  check('at a leaving pace, slower than he fought at',
    Math.abs(gone - LEAVING_SPEED * 0.1) < 1e-9 && LEAVING_SPEED < COLLAR_FOES.skirmisher.speed,
    `${gone.toFixed(3)} in 0.1s`)

  // The channeler holds its line instead of closing, and presses from it — reach 8 > standoff 7 is
  // what makes "hold still and lean on you" a behaviour rather than a stalemate.
  const ch = at('channeler', 7, 0)
  const chI = stepFoe(ch, KEEPER, 0.5)
  check('the channeler holds its standoff', chI.moveTo === null)
  check('★ and presses from it — reach outlives standoff', chI.pressing)
  const chFar = stepFoe(at('channeler', 40, 0), KEEPER, 0.5)
  check('but from far off it closes and does not press', !!chFar.moveTo && !chFar.pressing)
  check('and it closes toward the keeper, never away',
    (chFar.moveTo?.x ?? 99) < 40, `moved to ${chFar.moveTo?.x}`)

  // ⚠ Nothing may end up INSIDE the keeper. standoff 0 means "come all the way", not "occupy them".
  let bul = at('bulwark', 12, 0)
  for (let i = 0; i < 400; i++) {
    const it = stepFoe(bul, KEEPER, 0.05)
    if (it.moveTo) bul = { ...bul, x: it.moveTo.x, z: it.moveTo.z }
  }
  const rest = Math.hypot(bul.x, bul.z)
  check('★ a standoff-0 foe stops AT the keeper, never inside them',
    rest >= COLLAR_FOES.bulwark.body, `rested at ${rest.toFixed(3)}`)
  check('and it did arrive — a blockade that never blocks is scenery', rest < 2)
  check('and it presses once it is there', stepFoe(bul, KEEPER, 0.05).pressing)

  // A step never overshoots the line it is closing to, at any dt the frame loop can hand it.
  const over = stepFoe(at('skirmisher', 3, 0), KEEPER, 5)
  check('★ a long frame cannot overshoot the keeper', (over.moveTo?.x ?? -1) >= 0)

  // ⚠ The wall case. A foe that stops dead on its first obstacle reads as a failed spawn.
  const wallAt5 = (x: number, _z: number) => x > 4.5 && x < 5.5
  const blocked = stepFoe(at('skirmisher', 5.6, 3), { ...KEEPER, blocked: wallAt5 }, 0.2)
  check('★ a blocked foe slides along the wall rather than parking on it',
    blocked.moveTo !== null && Math.abs((blocked.moveTo?.x ?? 0) - 5.6) < 1e-9,
    'x is held by the wall, z is free to slide')

  // ★ Pressing is billed from where it STANDS. Otherwise a foe presses you through a wall it never
  // got around — the fight would resolve on the far side of geometry the player is using correctly.
  // ⚠ THE DISTANCE HAS TO BE CHOSEN SO THE TWO ANSWERS DIFFER. A walled foe 30 blocks out is not
  // pressing under either rule, so that version of this assert was green for the wrong reason and
  // survived the mutation. Here the step it WANTS would carry it from 1.5 (outside reach 0.85) to
  // 0.71 (inside), while the wall means it never actually goes anywhere.
  const sealed = () => true
  const stuck = stepFoe(at('skirmisher', 1.5, 0), { ...KEEPER, blocked: sealed }, 0.3)
  check('★ a walled-off foe cannot press you from where it merely WANTED to be',
    stuck.moveTo === null && !stuck.pressing)

  // ── ★★ COVER (2026-08-17): PRESSING NEEDS A LINE, AND LOSING IT MUST NOT BUILD A STATUE ────────
  // The channeler pressed through the curtain wall — reach was a distance and nothing else, so a
  // keeper doing the right thing about a body 8 blocks away was worn down from behind a wall.
  //
  // A wall standing between the keeper (0,0) and anything out along +x. Deliberately NOT a function
  // of t: the probe's job is answering about a POINT, and a test that keyed off t would pass for a
  // stepper that never moved the sample.
  const curtain = (x: number, _z: number) => x > 3.5 && x < 4.5
  {
    const walled = { ...KEEPER, opaque: curtain }
    const chW = stepFoe(at('channeler', 7, 0), walled, 0.5)
    check('★★ a channeler cannot press through a wall it is only standing behind', !chW.pressing)
    // ★ THE SECOND HALF, AND WITHOUT IT THE FIX IS A NEW BUG. Deny the press alone and it stands at
    // its standoff pressing nothing forever — the encounter quietly ends, exactly the failure the
    // `blocked` slide above exists to prevent. It must come looking.
    check('★★ and it closes instead of holding a line it cannot see across',
      !!chW.moveTo && (chW.moveTo?.x ?? 9) < 7, `moved to ${chW.moveTo?.x?.toFixed(3)}`)

    // ⚠ THE RULE IS ON PRESSING, NOT ON A POSTURE. Reach 8 is what made the channeler the visible
    // case; a bulwark at reach 1.3 pressed through a one-block wall in exactly the same way.
    // ⚠ AND THE DISTANCE HAS TO PUT HIM IN REACH, or this is green because he is 4 blocks away and
    // survives any mutation — the same wrong-reason trap the `stuck` assert above documents. At 1.2
    // he is inside reach 1.30, so the wall is the only thing deciding it.
    const nearWall = (x: number) => x > 0.5 && x < 0.9
    const bulW = stepFoe(at('bulwark', 1.2, 0), { ...KEEPER, opaque: nearWall }, 0.05)
    check('★ nor a bulwark stood on the far side of a wall he is otherwise in reach through',
      !bulW.pressing)
    check('and the same bulwark presses the moment the wall is gone',
      stepFoe(at('bulwark', 1.2, 0), KEEPER, 0.05).pressing)
  }

  // ⚠ ENDPOINTS ARE NOT SAMPLED. A foe with its shoulder against a wall, or a keeper standing in a
  // doorway, must not blind themselves with the cell they are standing in — that would make cover
  // depend on where a body happens to be rather than on what is between two bodies.
  {
    const onlyEnds = (x: number, _z: number) => x < 0.4 || x > 6.6
    check('★ a body pressed against a wall still sees past it',
      stepFoe(at('channeler', 7, 0), { ...KEEPER, opaque: onlyEnds }, 0.5).pressing)
  }

  // A wall BEHIND the foe is not between anybody. The naive version of this fix tested a box around
  // the pair and would have called this covered.
  {
    const behind = (x: number, _z: number) => x > 9
    check('a wall behind the foe covers nobody',
      stepFoe(at('channeler', 7, 0), { ...KEEPER, opaque: behind }, 0.5).pressing)
  }

  // ★ THE SAMPLING IS FINE ENOUGH FOR THE THING IT GUARDS. A one-block wall may not fall between two
  // samples at any distance the channeler presses from, or cover would work at some ranges and not
  // others — the worst kind of rule, since a player would learn it as "it sometimes cheats".
  {
    let missed = 0
    for (let d = 1; d <= 8; d += 0.25) {
      for (let w = 0.5; w + 1 <= d - 0.5; w += 0.25) {
        const wall = (x: number) => x > w && x < w + 1
        if (sightClear(d, 0, 0, 0, x => wall(x))) missed++
      }
    }
    check('★ no one-block wall slips between two sight samples', missed === 0, `${missed} misses`)
    check('the step is half a cell — the number that guarantee rests on', SIGHT_STEP === 0.5)
  }

  // `t` is what lets a host lift the line from the foe's head to the keeper's eye. It must run
  // strictly between the two, or a probe using it samples one of the endpoints it was promised not.
  {
    const ts: number[] = []
    sightClear(0, 0, 8, 0, (_x, _z, t) => { ts.push(t); return false })
    check('★ t is handed out strictly between the endpoints', ts.length > 0 && ts[0] > 0 && ts[0] < 1)
    const along: number[] = []
    sightClear(0, 0, 8, 0, (x, _z, t) => { along.push(Math.abs(x - t * 8)); return false })
    check('and it agrees with how far along the line the sample is',
      along.every(d => d < 1e-9))
  }

  // A probe that is never asked is the default, and it is today's behaviour exactly — every caller
  // that has not been taught about walls keeps working.
  check('no probe means an open line', sightClear(0, 0, 40, 0) &&
    stepFoe(at('channeler', 7, 0), KEEPER, 0.5).pressing)

  // Speed is honoured — the defs bound it so nothing out-runs a keeper, and the stepper must not
  // quietly exceed the number that guarantee rests on.
  const sk = at('skirmisher', 20, 0)
  const one = stepFoe(sk, KEEPER, 0.1)
  const moved = Math.hypot((one.moveTo?.x ?? 20) - 20, (one.moveTo?.z ?? 0))
  check('a step is exactly speed x dt', Math.abs(moved - COLLAR_FOES.skirmisher.speed * 0.1) < 1e-9,
    `moved ${moved.toFixed(4)}`)
}

// ── 7. what a round does to a collar (2026-08-16, #294) ─────────────────────────────────────────
{
  const collared = spawnFoe('a', 'bulwark', 3, 0)
  const freed = strike(spawnFoe('b', 'bulwark', 3, 0), 999).foe

  // ★★ THE RULE THE WHOLE REGION-COMBAT DESIGN RESTS ON. Canon forbids guns to answer this class:
  // you free a person, and a bullet cannot free anyone. If this ever goes green the wrong way,
  // "runes ARE the combat" quietly becomes "gun fights with a different bar".
  check('★★ a move that strikes the collar opens it', answerCollar(collared, 'opens') === 'opens')
  check('★★ lead does not', answerCollar(collared, 'lead') === 'refused-lead')

  // ⚠ TWO REFUSAL CLASSES, AND THEY ARE NOT INTERCHANGEABLE (ruled 2026-08-16). Class 1 is Rule 3 —
  // the body IS the described mechanism. Class 2 is thematic — the move IS the line's named evil,
  // and it catches moves that are perfectly gentle. **A move can pass Rule 3 cleanly and still fail
  // class 2**, so collapsing them into one "refused" would lose the distinction canon drew.
  check('★ cruelty is refused (class 1 — Rule 3)', answerCollar(collared, 'cruelty') === 'refused-cruelty')
  check('★ control is refused (class 2 — hypocrisy)', answerCollar(collared, 'control') === 'refused-control')
  check('★ and the two refusals are distinguishable',
    answerCollar(collared, 'cruelty') !== answerCollar(collared, 'control'))
  // Canon's verb is DEFEATING. A heal or a launch is a legitimate part of winning and never the
  // thing that opens a collar — delivery-agnostic was never "any cast counts".
  check('★ a move that never enters the contest cannot win it',
    answerCollar(collared, 'no-contest') === 'no-contest')

  // ★★ FAIL CLOSED. An unclassified move has never been checked against Rule 3, so it must not be
  // the thing that frees someone. Same shape as WILDS_SWALLOW_EXEMPT and focus_active's allowlist:
  // never let an unrecognised value land in the band that GRANTS permission.
  check('★★ an unclassified move is REFUSED, never allowed through',
    answerCollar(collared, undefined) !== 'opens')

  // ⚠ Refused is NOT the same as absent. Lead must STOP on a collared body — a round passing through
  // a person reads as a broken hitbox, and the player blames the game rather than their choice of
  // tool. A freed Moglin is the opposite: nothing there to answer.
  check('★ a freed pair is not a target at all', answerCollar(freed, 'opens') === 'not-a-target')
  check('and lead does not target them either', answerCollar(freed, 'lead') === 'not-a-target')
  check('★ refused and not-a-target are distinct answers',
    answerCollar(collared, 'lead') !== answerCollar(freed, 'lead'))
}

// ── ★★ FREEING IS PERMANENT, FAILING IS NOT (2026-08-16, the send-back pass) ──────────────────────
//
// This exists because the rule it replaces could only be checked by walking 1237 blocks to the
// nearest hold, losing a fight on purpose, and reloading. Nobody was ever going to do that, and so
// nobody noticed that being SENT BACK — the encounter's own designed losing state — consumed the
// hold as permanently as freeing everybody did, in a save file. The old flag recorded that a patrol
// had SPAWNED and was read as "this encounter is resolved". Those are different events.
{
  // thistle-hold, the nearest one to the glade, and RANK 0 — the first hold on the spine.
  const H = { x: -630, z: -1780, half: 10, rank: 0 }
  const full = rollPatrol(H.x, H.z, H.half, H.rank)

  check('a patrol is a patrol, not a raid', full.size >= 2 && full.size <= 4, `size ${full.size}`)
  check('nobody freed means everybody is out', full.slots.length === full.size)

  // ⚠ THE WHOLE POINT. A keeper who was sent back must find them still standing there.
  check('★★ a hold the keeper LOST at still sends its patrol',
    rollPatrol(H.x, H.z, H.half, H.rank).slots.length === full.size)

  // ★ And the ones actually freed do not come back — that half IS canon, and it is the half the old
  // flag got right. A reload may never re-collar a spirit the keeper let go.
  check('★ one freed comes back one lighter', rollPatrol(H.x, H.z, H.half, H.rank, 1).slots.length === full.size - 1)
  check('★ a fully freed hold never sends anyone again',
    rollPatrol(H.x, H.z, H.half, H.rank, full.size).slots.length === 0)
  check('and an over-count cannot resurrect anyone',
    rollPatrol(H.x, H.z, H.half, H.rank, full.size + 7).slots.length === 0)

  // ★★ THE PREFIX RULE, AND IT IS THE ONE A REFACTOR BREAKS SILENTLY. Skipping a freed Moglin must
  // still consume his rolls: advance the stream without drawing his numbers and the SURVIVOR
  // inherits them, so the keeper walks back to a patrol of the right size standing in the wrong
  // places wearing the wrong postures. That reads exactly like the fight being re-rolled, which is
  // the thing determinism is here to prevent — and the count would still be right, so a length
  // assert alone would stay green through it.
  const tail = rollPatrol(H.x, H.z, H.half, H.rank, 1).slots
  const expected = full.slots.slice(1)
  check('★★ the survivors are the SAME Moglins — same posture, same spot',
    tail.length === expected.length &&
    tail.every((s, i) => s.n === expected[i].n && s.posture === expected[i].posture &&
                         s.spread === expected[i].spread && s.rad === expected[i].rad),
    JSON.stringify({ tail, expected }))

  // Determinism across calls: two keepers meeting the same hold meet the same patrol, and a reload
  // does not reroll it. Same rule hunter-ai had to be extracted to obey.
  const again = rollPatrol(H.x, H.z, H.half, H.rank)
  check('★ the same hold rolls the same patrol every time',
    JSON.stringify(again) === JSON.stringify(full))

  // ⚠ AND THE HOLDS ARE NOT ALL ONE FIGHT. Seeded from coordinates, so three holds at three places
  // must not converge on one patrol — that would make the second and third meeting a repeat.
  const vetch = rollPatrol(-1570, -2130, 12, 1)
  const brack = rollPatrol(-2269, -2977, 14, 2)
  check('the three holds do not roll the same patrol',
    new Set([full, vetch, brack].map(r => JSON.stringify(r.slots.map(s => s.posture)))).size > 1 ||
    new Set([full, vetch, brack].map(r => r.size)).size > 1)

  // A slot the host can actually place: the spread is a bearing offset, the radius is outside the
  // curtain wall. A negative or wall-swallowed radius would spawn the patrol inside the courtyard,
  // which is the ambush read the trigger ring exists to prevent.
  for (const r of [full, vetch, brack]) {
    check('every slot stands outside the hold wall',
      r.slots.every(s => s.rad > (r === full ? H.half : r === vetch ? 12 : 14)))
    check('and within a road-width of the approach bearing',
      r.slots.every(s => Math.abs(s.spread) <= 0.45))
  }
}

// ── ★★ THE SEND-BACK CLOCK, AND THE NUMBER IT REPLACES ──────────────────────────────────────────
// `/press` shipped printing `guard / sum-of-dps` and the board recorded it as the measurement. It is
// a floor that assumes the whole patrol lands on one frame. These asserts exist so the difference
// between the floor and the clock can never quietly close again.
{
  const MEET = 22, GUARD = 100
  const ceiling = (ps: FoePosture[]) => GUARD / ps.reduce((a, p) => a + COLLAR_FOES[p].pressureDps, 0)

  // ── arrival ──
  check('a posture that is already in reach presses immediately',
    pressArrival({ ...COLLAR_FOES.channeler, reach: 99 }, MEET) === 0)
  check('the skirmisher lands first — fastest feet, shortest reach to close',
    pressArrival(COLLAR_FOES.skirmisher, MEET) < pressArrival(COLLAR_FOES.bulwark, MEET))
  check('and the bulwark lands last: slowest over the same ground',
    pressArrival(COLLAR_FOES.bulwark, MEET) > pressArrival(COLLAR_FOES.channeler, MEET))
  // ★ REACH, NOT STANDOFF. Measuring the channeler to its standoff would report it arriving late;
  // it starts pressing a block before it stops walking, which is the whole point of that posture.
  check('the channeler is measured to its reach, not to the line it holds',
    Math.abs(pressArrival(COLLAR_FOES.channeler, MEET) - (MEET - 6 - 8) / 1.4) < 1e-9)
  check('meeting a patrol closer brings every posture in sooner', POSTURE_ORDER.every(p =>
    pressArrival(COLLAR_FOES[p], 16) < pressArrival(COLLAR_FOES[p], 34)))

  // ── the clock ──
  // ⚠ DERIVED FROM THE SHIPPED MAP, NOT COPIED OUT OF IT. This was three hand-written posture lists
  // transcribed from a `/foes` readout, which is a second source of truth about what `rollPatrol`
  // returns — it agrees until the day it does not, and then the clock asserts below are measuring a
  // patrol nobody meets. `HOLDS` is pure map data (no seed, derived from `STORY_NODES` at module
  // load), so the test can just ask.
  const spine: Record<string, FoePosture[]> = Object.fromEntries(
    HOLDS.map((h, rank) => [h.id.replace('-hold', ''), rollPatrol(h.x, h.z, h.half, rank).slots.map(s => s.posture)]))
  for (const [id, ps] of Object.entries(spine)) {
    const real = sendbackClock(ps, MEET, GUARD)
    // ★★ THE ASSERT THE OLD READOUT WOULD HAVE FAILED. The floor is not the clock, and at the
    // shipped meet it is not close to it — this is the number that got written into the board.
    check(`${id}: the clock is well above the all-at-once floor`, real > ceiling(ps) * 1.5,
      `real ${real.toFixed(1)}s vs floor ${ceiling(ps).toFixed(1)}s`)
    check(`${id}: losing is reachable — a keeper who does nothing is sent back inside 15s`,
      real < 15, `${real.toFixed(1)}s`)
  }

  // ★ MUTATION: collapse every arrival to zero and the clock MUST fall back to the floor. This is
  // what pins the piecewise drain — a clock that ignored arrivals entirely would pass every assert
  // above by accident and this one on purpose.
  const inReach = (p: FoePosture) => ({ ...COLLAR_FOES[p], reach: 999 })
  check('with everyone already in reach, the clock IS the old floor',
    Math.abs(sendbackClock(spine.thistle, MEET, GUARD, inReach) - ceiling(spine.thistle)) < 1e-9)

  // ★ MUTATION: a patrol that cannot press is never a send-back, and must say so rather than
  // returning a very large number that reads like a real clock.
  check('a patrol with no pressure never sends anyone back',
    sendbackClock(spine.vetch, MEET, GUARD, p => ({ ...COLLAR_FOES[p], pressureDps: 0 })) === Infinity)

  // ── the two dials, and which one actually owns the clock ──
  check('meeting them closer shortens the fight', POSTURE_ORDER.every(() =>
    sendbackClock(spine.vetch, 16, GUARD) < sendbackClock(spine.vetch, 34, GUARD)))
  // ★ THE FIND OF THE TUNING PASS, PINNED. Doubling every posture's pressure buys less than cutting
  // the meet ring by a third, because most of the clock is walking. If this ever flips, the
  // encounter's shape has changed and the dial a tuner should reach for has changed with it.
  const doubled = sendbackClock(spine.vetch, 34, GUARD, p => ({ ...COLLAR_FOES[p], pressureDps: COLLAR_FOES[p].pressureDps * 2 }))
  check('walking, not pressure, owns the clock: 2x dps buys less than a shorter meet',
    doubled > sendbackClock(spine.vetch, 22, GUARD),
    `2x dps at meet 34 = ${doubled.toFixed(1)}s vs 1x dps at meet 22 = ${sendbackClock(spine.vetch, 22, GUARD).toFixed(1)}s`)

  // ── recovery must not cost more than the loss ──
  // Standing about waiting for a bar is not the penalty; the collar staying on him is. A recovery
  // longer than the fight turns every loss into a second, duller wait.
  // ⚠ THE DIALS ARE IMPORTED, NOT COPIED. This line used to read `3 + GUARD / 15` with the comment
  // *"SENDBACK_DEFAULT's calm + regen, kept in step by hand"* — and a hand-kept mirror of a dial
  // asserts the rule about numbers the game may no longer ship. The 08-17 spine pass turned regen
  // and would have left this measuring the old one.
  const fastest = Math.min(...Object.values(spine).map(ps => sendbackClock(ps, MEET, GUARD)))
  check('recovering the guard costs no more than losing it', recoverySeconds(GUARD) <= fastest,
    `recovery ${recoverySeconds(GUARD).toFixed(1)}s vs the fastest hold's ${fastest.toFixed(1)}s`)
}

// ── ★★ THE SPINE RUNS FORWARDS (2026-08-17, #577) ───────────────────────────────────────────────
//
// Patrol size was `2 + floor(roll() * 2)` off the hold's own coordinates, with no spine axis at all,
// so **difficulty ran backwards**: Thistle — the first hold a keeper ever meets — rolled 3 and was
// the hardest fight on the road, while Brack, the hold canon says *looms*, rolled 2 and was the
// softest. Chance was standing in for design, and no dial could fix it.
//
// ⚠ THESE ASSERTS RUN AGAINST THE SHIPPED MAP, and that is the point. The rule is not *"bigger rank,
// bigger number"* in the abstract — it is *"the road gets harder as you walk it"*, which is a claim
// about the three holds a player actually meets. Move a hold and this must go red.
{
  const MEET = 22, GUARD = 100
  const patrol = (rank: number) =>
    rollPatrol(HOLDS[rank].x, HOLDS[rank].z, HOLDS[rank].half, rank).slots.map(s => s.posture)
  const clock = (rank: number) => sendbackClock(patrol(rank), MEET, GUARD)

  check('★ size escalates along the spine and is not rolled at all',
    HOLDS.every((h, r) => rollPatrol(h.x, h.z, h.half, r).size === PATROL_SIZE[r]) &&
    PATROL_SIZE.every((n, i) => i === 0 || n > PATROL_SIZE[i - 1]), JSON.stringify(PATROL_SIZE))

  // ★★ THE ASSERT THE OLD BUILD FAILED. Lower clock = lost sooner = harder.
  const clocks = HOLDS.map((_, r) => clock(r))
  check('★★ every hold down the spine is harder than the one before it',
    clocks.every((c, i) => i === 0 || c < clocks[i - 1]),
    HOLDS.map((h, i) => `${h.id} ${clocks[i].toFixed(1)}s`).join(' · '))

  // ⚠ AND IT MUST STILL BE A PATROL. The fold raid is the feature that fields a crowd; a road
  // meeting that sends five is not a meeting any more, and `PATROL_SIZE` growing quietly is how
  // that ships.
  check('the last hold still sends a patrol, not a raid', Math.max(...PATROL_SIZE) <= 4)
  check('and losing is reachable at every hold — nobody is unlosable', clocks.every(c => c < 15))

  // ★ THE SEED STILL OWNS *WHO*, and that is what keeps three holds three fights rather than one
  // fight at three sizes. If composition ever became a function of rank too, the holds would
  // converge into a single escalating silhouette — the same convergence the triangle block guards.
  check('★ the spine fixes how many, the seed still picks who',
    new Set(HOLDS.map((_, r) => patrol(r).join(','))).size === HOLDS.length,
    HOLDS.map((h, r) => `${h.id}: ${patrol(r).join(',')}`).join(' · '))

  // ⚠ RANK IS REQUIRED AND CLAMPED, NEVER GUESSED. A caller who omitted it would get *"every hold is
  // the first hold"*, which is the bug this parameter exists to fix, silently restored. TypeScript
  // enforces the requirement; this pins the clamp so an out-of-range rank cannot return `undefined`
  // as a size and spawn a patrol of NaN Moglins.
  const H0 = HOLDS[0]
  check('an over-range rank clamps to the last hold, never undefined',
    rollPatrol(H0.x, H0.z, H0.half, 99).size === PATROL_SIZE[PATROL_SIZE.length - 1])
  check('and a negative rank clamps to the first', rollPatrol(H0.x, H0.z, H0.half, -4).size === PATROL_SIZE[0])

  // ★★ THE VESTIGIAL SIZE DRAW IS LOAD-BEARING, AND NOTHING ELSE WOULD CATCH ITS REMOVAL. Size no
  // longer comes off the stream, but the draw is still taken and thrown away, because composition
  // comes off the SAME stream — delete it and every hold's postures shift by one. That is invisible
  // to every other assert here and highly visible in a live save: a keeper part-way through Thistle
  // walks back to different Moglins standing in different places, which is precisely the re-rolled
  // fight the prefix rule exists to prevent. These two are the pair already standing on that road.
  check('★★ the shipped roll is unchanged — a live save meets the Moglins it left',
    patrol(0).join(',') === 'skirmisher,skirmisher', patrol(0).join(','))

  // ★ THE PREFIX RULE SURVIVES THE SPINE. Size now comes from rank rather than the stream, so the
  // freed-prefix must still line up with the full roll — a keeper mid-way through a hold meets the
  // same Moglins, one lighter.
  const full = rollPatrol(H0.x, H0.z, H0.half, 0)
  const one = rollPatrol(H0.x, H0.z, H0.half, 0, 1)
  check('★ a rank-sized patrol still comes back as its own prefix',
    one.slots.length === full.size - 1 &&
    one.slots.every((s, i) => JSON.stringify(s) === JSON.stringify(full.slots[i + 1])))
}

console.log(`\ncollar foes: ${pass} passed, ${fail} failed`)
if (fail === 0) console.log('✅ a collar to break, never a body to kill')
process.exit(fail === 0 ? 0 : 1)
