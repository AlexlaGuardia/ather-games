// ── Crucible match clock — headless oracle ─────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/crucible-phases.test.ts
//
// The match clock is a pure function of elapsed seconds, so it can be proven completely BEFORE any
// renderer touches it. What's locked here:
//   1. determinism — the same second always yields the same state (the reason it's pure at all)
//   2. the canon shape — 3 floors, ruled 5-minute windows, back to back, then the Vault
//   3. no gaps and no overlaps — exactly one floor is passable at any running instant
//   4. sealing is a WARNING INSIDE the window, not extra time (the floor still lasts canon's 5 min)
//   5. ascent dies exactly when the airlocks shut, and pressure starts exactly then and ramps
//   6. bells fire once, on the edge, and never twice

import {
  TUNING, CRUCIBLE_LEVELS, LEVEL_WINDOWS, MATCH_END_SEC, VAULT_END_SEC,
  crucibleAt, levelStateAt, canAscendFrom, pressureDpsOn, bellAt,
} from './crucible-phases'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// 1. determinism
{
  for (const t of [0, 19, 20, 100, 320, 619, 920, 1500]) {
    const a = JSON.stringify(crucibleAt(t))
    const b = JSON.stringify(crucibleAt(t))
    chk(`t=${t} deterministic`, a === b)
  }
  chk('negative elapsed clamps to 0', JSON.stringify(crucibleAt(-50)) === JSON.stringify(crucibleAt(0)))
}

// 2. the canon shape
{
  chk('three floors (canon: City, Dawn, Throne)', CRUCIBLE_LEVELS.length === 3)
  chk('names match canon',
    CRUCIBLE_LEVELS.map((l) => l.name).join('|') === 'The City|The Dawn|The Throne')
  chk('every floor runs the ruled 5 minutes', CRUCIBLE_LEVELS.every((l) => l.openSec === 300))
  chk('the Throne holds the guards', CRUCIBLE_LEVELS[2].guards === true)
  chk('mana bell on L1, second bell on L3',
    CRUCIBLE_LEVELS[0].bell === 'mana' && CRUCIBLE_LEVELS[2].bell === 'second')
  chk('match ends after glyph + 3 floors',
    MATCH_END_SEC === TUNING.glyphSec + 900, String(MATCH_END_SEC))
}

// 3. windows are back to back — no gap, no overlap
{
  for (let i = 1; i < LEVEL_WINDOWS.length; i++) {
    chk(`window ${i} starts exactly where ${i - 1} ends`,
      LEVEL_WINDOWS[i].startSec === LEVEL_WINDOWS[i - 1].endSec)
  }
  // sweep the whole match: exactly one floor passable at every running second
  let badSecs = 0
  for (let t = TUNING.glyphSec; t < MATCH_END_SEC; t++) {
    const passable = crucibleAt(t).levels.filter((l) => l.phase === 'open' || l.phase === 'sealing')
    if (passable.length !== 1) badSecs++
  }
  chk('exactly one floor passable at every running second', badSecs === 0, `${badSecs} bad seconds`)

  // and none during the glyph hold or after the last seal
  chk('no floor passable during the glyph hold', crucibleAt(0).activeLevel === null)
  chk('no floor passable once the last seals', crucibleAt(MATCH_END_SEC).activeLevel === null)
}

// 4. sealing is carved OUT of the window, not added to it
{
  const w = LEVEL_WINDOWS[0]
  const sealingAt = w.endSec - TUNING.warnSec
  chk('open right up to the warning', levelStateAt('city', sealingAt - 1).phase === 'open')
  chk('sealing at the warning edge', levelStateAt('city', sealingAt).phase === 'sealing')
  chk('still sealing one second before the shut', levelStateAt('city', w.endSec - 1).phase === 'sealing')
  chk('sealed exactly at the shut', levelStateAt('city', w.endSec).phase === 'sealed')
  chk('the floor still lasted the canon 300s', w.endSec - w.startSec === 300)
}

// 5. ascent and pressure both hinge on the same instant
{
  const w = LEVEL_WINDOWS[0]
  chk('can ascend while open', canAscendFrom('city', w.startSec + 10))
  chk('can STILL ascend while sealing (it is a warning)', canAscendFrom('city', w.endSec - 1))
  chk('cannot ascend once sealed', !canAscendFrom('city', w.endSec))
  chk('no pressure before the seal', pressureDpsOn('city', w.endSec - 1) === 0)
  chk('pressure starts at the seal', pressureDpsOn('city', w.endSec + 1) > 0)
  chk('pressure ramps, not instant',
    pressureDpsOn('city', w.endSec + 1) < pressureDpsOn('city', w.endSec + TUNING.pressureRampSec))
  chk('pressure caps at the tuned dps',
    Math.abs(pressureDpsOn('city', w.endSec + 999) - TUNING.pressureDps) < 1e-9)
  // a sealed lower floor stays lethal while the floor above is live — the laggard's punishment
  chk('L1 sealed while L2 open', levelStateAt('city', w.endSec + 30).phase === 'sealed'
    && levelStateAt('dawn', w.endSec + 30).phase === 'open')
}

// 6. bells fire once, on the edge
{
  const w1 = LEVEL_WINDOWS[0], w3 = LEVEL_WINDOWS[2]
  chk('mana bell on L1 release', bellAt(w1.startSec, w1.startSec - 1) === 'mana')
  chk('second bell on L3 open', bellAt(w3.startSec, w3.startSec - 1) === 'second')
  chk('no bell mid-floor', bellAt(w1.startSec + 50, w1.startSec + 49) === null)
  chk('a bell does not re-fire', bellAt(w1.startSec + 1, w1.startSec) === null)
}

// 7. match phases in order, and the Vault
{
  chk('glyph before release', crucibleAt(0).matchPhase === 'glyph')
  chk('running once released', crucibleAt(TUNING.glyphSec).matchPhase === 'running')
  chk('vault after the last seal', crucibleAt(MATCH_END_SEC).matchPhase === 'vault')
  chk('over once the vault closes', crucibleAt(VAULT_END_SEC).matchPhase === 'over')
  // the Vault is NOT a combat floor — it must never appear as a passable level
  chk('the Vault is not a level', !CRUCIBLE_LEVELS.some((l) => (l.name as string).includes('Vault')))
}

console.log(`\ncrucible-phases oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
