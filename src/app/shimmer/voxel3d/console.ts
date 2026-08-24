// THE CONSOLE — the registry, the dispatcher, and the suggestion strip.
//
// ── ★★★ WHY THIS IS ITS OWN FILE ─────────────────────────────────────────────────────────────
// It lived inside `VoxelWorld.tsx`, an 8964-line component no test can import — so **not one
// console verb has ever been harness-covered.** `/space`, `/brew`, `/goto`, `/waymark`: every one
// of them shipped on review alone, including their OWNER GATES. A cheat command whose gate is
// checked by nobody is the kind of thing that reads fine in a diff and is a live cheat in prod.
//
// ⚠ AND THE REGISTRY IS SHIPPED VOCABULARY THE MOMENT IT TAB-COMPLETES. `/gate` would have made a
// retired noun canon by accident (the world lane caught exactly that, and shipped `/waymark`
// instead). A name here is a public surface, so it wants the same gate canon's nouns get.
//
// ★ NOTHING BELOW CHANGED IN THE MOVE. Same rows, same order, same gates, same text. The point is
// only that `console.test.ts` can now reach them. Everything here is pure: the commands act on the
// world exclusively through `ConsoleCtx`'s callbacks, which is what makes the whole surface
// testable with a stub context and no GPU, no DOM and no React.

import { WORLD_SEED as SEED } from './world-seed'
import { WORLD_ITEMS } from './obtainable'
import { POTION_IDS } from '../engine/alchemy'
import { VIEW_RADIUS_MAX, VIEW_RADIUS_MIN } from './settings'
import { MistLedger, quietMinutes, residentAt } from './mist-encounter'
import { dayProgress, getDisplayTime, isTimePinned, setTimePin } from '../engine/day-cycle'
import { bubbleSwallows, passageApproach } from '../voxel/bubble'
import { findLands, LAND_IDS } from '../voxel/character'
import { getBreakRate, setBreakRate } from '../voxel/mine'
import { mistPatchesNear } from '../voxel/mist'
import { WILDS_BUBBLE, wildsSwallows } from '../voxel/column'
import { ZONE_ANCHORS, zoneAt } from '../voxel/zones'
import { RUNES } from '../play3d/birth/runes.data'

/**
 * Every item id the console may conjure — what a block drops plus what a recipe produces.
 *
 * ★ MOVED HERE WITH THE REGISTRY BECAUSE `/give` IS ITS ONLY CONSUMER. It is derived from the two
 * shipped sources rather than listed, so an item added to either is conjurable without anyone
 * remembering this line — the alternative is a hand-kept mirror, and a mirror reads as
 * corroboration right up until it goes stale.
 */
export const KNOWN_ITEMS: ReadonlySet<string> = new Set([...WORLD_ITEMS, ...POTION_IDS])


export interface ConsoleCtx {
  isOwner: boolean
  setRadius: (r: number) => void
  radius: () => number
  give: (id: string, n: number) => string
  tp: (x: number, z: number) => string
  /** Player position, for `~` relative coordinates (MC's convention, ported with the chat). */
  pos: () => { x: number; z: number }
  /** Cross between the Wilds and the Home Plot. Owner-gated — see the `/space` row. */
  space: (to?: string) => string
  /**
   * The passages the keeper holds. Bare is VIEW-GRADE — reading your own reach is not a cheat, and
   * it is the one thing that explains why a socket on the station is dark. `reach` is cheat-grade
   * and checked in the command row, the same split `/rune` and `/goto` already draw.
   *
   * ── ★★ IT SEEDS THE NET, NEVER THE LAMPS, AND THAT IS THE WHOLE DESIGN ───────────────────────
   * Canon 08-24: *"the station grants nothing — it displays reach the keeper has already earned."*
   * A test grant that lit sockets directly, or special-cased `socketLit` for an owner, would put
   * the station back to ASSERTING reach instead of reflecting it — the exact defect fixed hours
   * ago, re-entered from the other side. So this plants real waymarks through `plant()` and lets
   * the lamps follow, which also means the thing being tested is the shipped path.
   *
   * ⚠ THIS IS A TEST HARNESS, NOT THE ACQUISITION SYSTEM — same standing warning as `/rune`.
   * Canon (`world/gates.md`, 08-12) rules that reach is BOUGHT FROM GREG: *"the destination is
   * free because it is yours; what is bought is the REACH."* None of that is built. This exists so
   * the station is testable before it is, and must not become how a keeper gets a passage.
   */
  waymark: (arg?: string) => string
  /**
   * The garden, as the console can see and touch it. `list` is VIEW-GRADE — a keeper reading their
   * own roster is not a cheat, and it is the one thing that explains a refused spar prompt. The
   * other three write to the SHARED save (`ather:save:shimmer`, the same spirits the 2D game and
   * play3d own), so they are owner-only: a lent test party landing in a real keeper's garden would
   * be a cheat that also overwrites the save it cheated into.
   */
  party: {
    list: () => string
    lend: (count: number, level: number) => string
    heal: () => string
    clear: () => string
  }
  /** The withdrawal ledger, so `/mist` can name who is standing in a patch rather than only where
   *  it lies. View-grade: it reports what walking there would show you anyway, one scale further. */
  mistLedger: () => MistLedger
  /**
   * Who is on the road right now, how far off, and how much collar is left. OWNER-GATED and it is
   * a TEST INSTRUMENT, not a player verb — a keeper is supposed to learn a patrol is there by being
   * met by one. It exists because the encounter cannot otherwise be verified: by the time a patrol
   * has closed, every foe is standing ON the keeper and below the frame, so a screenshot cannot say
   * whether they arrived, and a shot that hits nothing is indistinguishable from a shot that hits
   * something the rules refused to open.
   */
  foes: () => string
  /** `/press` — the send-back dials. Bare lists them; a key+value sets one; `reset` restores. */
  press: (key?: string, value?: number) => string
  /**
   * ★ `/brew` — raise the cauldron's panel where you stand. OWNER-GATED and it is a TEST
   * INSTRUMENT, not a player verb: a keeper is supposed to craft a cauldron and right-click it.
   *
   * It exists because that is the ONE step of this feature no harness can drive. Opening the panel
   * needs a right-click on a placed block, and a right-click needs pointer lock, which headless
   * Chrome will not grant — so without this row the brew list, the refusals and the spend path
   * could only ever be checked by hand, forever, on every future change. Same argument `/foes`
   * makes one field up: the verb exists because the thing cannot otherwise be verified.
   */
  brew: () => string
  /**
   * ★ `/greg` — raise Gregory's conversation from where you stand. OWNER-GATED, and it exists for
   * the same reason `/brew` does: the real door is *aiming the crosshair at a character within talk
   * range*, and headless Chrome grants no pointer lock, so without this row the fold-widening
   * ceremony — the payoff of the whole grimoire arc — could only ever be checked by hand.
   */
  greg: () => string
  /**
   * ★ `/look <deg>` — point the camera along a compass bearing. OWNER-GATED, a TEST INSTRUMENT.
   *
   * It exists because **camera yaw is the one thing no harness can drive**: turning needs pointer
   * lock and headless Chrome grants none, so every visual check of a thing that is only visible from
   * one direction — a seam in a wall, a herb patch, the far side of a plot — has been a coin flip on
   * whichever way the camera happened to be pointing. Three checks in two days were blocked on it.
   * Same argument as `/foes` and `/brew`: the verb exists because the thing cannot otherwise be seen.
   *
   * 0 is north (-Z), 90 east (+X) — the compass the map and `/goto` already speak.
   */
  look: (deg: number) => string
  /**
   * ★ THE RUNES A KEEPER HOLDS. Bare `/rune` is VIEW-GRADE — reading your own hand is not a cheat,
   * and it is the one thing that explains why a cast key does nothing. GRANTING is cheat-grade and
   * checked inside, exactly as `/goto`'s compass-vs-teleport split does it.
   *
   * ⚠ THIS IS A TEST HARNESS, NOT THE ACQUISITION SYSTEM. Canon ruled acquisition on 2026-08-03:
   * a rune is trained off the birth rune along its lane (element row / state column), never bought;
   * a Knowledge Scroll teaches a MOVE, never a rune, and the Passage under Rune Hold is where that
   * trade happens. None of that is built. This command exists so the cast layer is testable before
   * it is, and it must NOT become the way a player gets a second rune.
   */
  rune: (arg?: string) => string
}
export const NAMED_HOURS: Record<string, number> = { midnight: 0, dawn: 6.5, noon: 12, dusk: 18.75, night: 21 }
/** `~` / `~-5` → relative to `cur`; anything else parses as absolute. NaN propagates for the caller. */
export const parseCoord = (tok: string, cur: number): number =>
  tok.startsWith('~') ? cur + (tok.length > 1 ? Number(tok.slice(1)) : 0) : Number(tok)
export interface ConsoleCmd {
  name: string; usage: string; help: string; owner?: boolean
  run: (a: string[], c: ConsoleCtx) => string
  /** Tab-completion values for argument N (0-based), MC's suggestion strip. Filtered by prefix. */
  suggest?: (argIdx: number, c: ConsoleCtx) => string[]
}
export const CONSOLE_CMDS: ConsoleCmd[] = [
  { name: 'help', usage: 'help', help: 'list commands', run: (_a, c) =>
      CONSOLE_CMDS.filter(k => !k.owner || c.isOwner).map(k => `/${k.usage} — ${k.help}`).join('\n') },
  { name: 'time', usage: 'time <0-24 | dawn|noon|dusk|night|midnight | free>', help: 'pin the clock (this tab only) or hand it back',
    run: (a) => {
      const w = (a[0] ?? '').toLowerCase()
      if (!w) return `it is ${getDisplayTime(dayProgress())}${isTimePinned() ? ' (pinned)' : ''}`
      if (w === 'free' || w === 'live') { setTimePin(null); return 'clock handed back to the world' }
      const h = w in NAMED_HOURS ? NAMED_HOURS[w] : Number(w)
      if (!Number.isFinite(h)) return `not an hour: ${w}`
      setTimePin(h)
      return `pinned at ${getDisplayTime(dayProgress())} — 'time free' to release`
    },
    suggest: () => [...Object.keys(NAMED_HOURS), 'free'] },
  // ★ OWNER-GATED because it is a balance dial, not a view. `time` is view-grade (it pins one tab's
  // clock and touches nothing shared); this changes how the game PLAYS, which is the line this
  // registry already draws between cheat-grade and view-grade verbs.
  { name: 'mine', usage: 'mine [rate]  (1 = normal, 2 = twice as slow)', help: 'dial how long blocks take to break', owner: true,
    run: (a) => {
      if (!a[0]) return `break rate ${getBreakRate()}x — 'mine 2' for twice as slow, 'mine 1' for normal`
      const r = Number(a[0])
      if (!Number.isFinite(r) || r <= 0) return `not a rate: ${a[0]}`
      setBreakRate(r)
      return `blocks now take ${getBreakRate()}x as long — session only, tell Jin the number to bake in`
    },
    suggest: () => ['1', '1.5', '2', '3'] },
  { name: 'radius', usage: 'radius [4-12]', help: 'view/load ring, in columns of 16',
    run: (a, c) => {
      if (!a[0]) return `radius is ${c.radius()} (${c.radius() * 16} blocks)`
      const r = Math.round(Number(a[0]))
      if (!Number.isFinite(r) || r < VIEW_RADIUS_MIN || r > VIEW_RADIUS_MAX) return `radius takes ${VIEW_RADIUS_MIN}..${VIEW_RADIUS_MAX}`
      c.setRadius(r)
      return `radius ${r} (${r * 16} blocks)`
    },
    suggest: () => ['4', '6', '8', '10', '12'] },
  // ★ /rune (2026-08-12, Alex: "I went to test but as a new player I have none").
  // Bare /rune is the keeper's own hand — what you hold, what it opens, what is bound. That half is
  // VIEW-GRADE and gates nothing: a player whose keys do nothing deserves to be told WHY, and until
  // the Passage exists the panel is the only other place that says it. Granting is cheat-grade and
  // checked inside `c.rune`, so the readout survives for everyone.
  { name: 'rune', usage: 'rune [id]  (bare: your hand · id: develop/drop it)', help: 'the runes you hold and the moves they open',
    run: (a, c) => c.rune(a[0]),
    suggest: (i, c) => i === 0 && c.isOwner ? RUNES.map(r => r.id).sort() : [] },
  { name: 'give', usage: 'give <item> [count]', help: 'conjure items into the bag', owner: true,
    run: (a, c) => a[0] ? c.give(a[0], Math.max(1, Math.round(Number(a[1]) || 1))) : 'give what?',
    suggest: (i) => i === 0 ? [...KNOWN_ITEMS].sort() : ['1', '4', '16', '64'] },
  { name: 'tp', usage: 'tp <x> <z>  (~ = here, ~-20 = 20 west)', help: 'teleport to ground level', owner: true,
    run: (a, c) => {
      if (!a[0] || !a[1]) return 'tp needs two coordinates'
      const p = c.pos()
      const x = parseCoord(a[0], p.x), z = parseCoord(a[1], p.z)
      if (!Number.isFinite(x) || !Number.isFinite(z)) return `not coordinates: ${a[0]} ${a[1]}`
      return c.tp(Math.floor(x), Math.floor(z))
    },
    suggest: () => ['~'] },
  // ★ /goto (2026-08-08, Alex: "I wasn't able to locate the springs.. its a big map lol").
  // Bare /goto is the compass: every ruled place with distance and bearing from where you stand.
  // That half is VIEW-GRADE (this file's own rule) and gates nothing — the zones are islands in a
  // lot of wild country, and a player who cannot find them has a worse problem than a player who
  // knows where they are. Only the TELEPORT is cheat-grade, checked inside so the compass survives.
  { name: 'goto', usage: 'goto [zone]', help: 'bare: bearings to every ruled place · named: teleport there',
    run: (a, c) => {
      const q = (a[0] ?? '').toLowerCase()
      const p = c.pos()
      if (!q) return ZONE_ANCHORS.map(z => `${z.id.padEnd(16)} ${bearing(z.x - p.x, z.z - p.z)}`).join('\n')
      const z = ZONE_ANCHORS.find(zn => zn.id === q) ?? ZONE_ANCHORS.find(zn => zn.id.startsWith(q))
      if (!z) return `no such place: ${q} — bare /goto lists them`
      if (!c.isOwner) return `${z.id}: ${bearing(z.x - p.x, z.z - p.z)} — teleport is keeper-of-the-realm only`
      // ── ★★ AN ANCHOR INSIDE THE FOLD IS A DOOR, NOT A DESTINATION (2026-08-16) ─────────────────
      // `/goto garden` used to hand `tp` the anchor's raw centre, and the landing altitude comes
      // from `columnHeight` — the CONTINENT's rule, which has never heard of the bubble. The garden
      // anchor is at (0,0), dead centre of the shell, whose interior is AIR for all 256 blocks: the
      // keeper arrived in a column with zero solid cells, the settle gate probed `py - 3`, found
      // air, and returned early every frame FOREVER. Listed, tab-completable, owner-gated, and a
      // guaranteed hang. 7 of the 8 anchors settle; this was the one.
      //
      // ★ ASKED OF THE GUARD, NOT HARDCODED FOR `garden`, and this is `bubbleSwallows`' FIRST LIVE
      // CALLER — until now it existed only inside a test, checked against a hand-written list that
      // happened to leave `garden` out. Fed the real anchor it is exactly the question this command
      // needs answered ("is this centre inside the fold"), so any future anchor swallowed by any
      // future fold routes to a door instead of shipping the same hang a second time.
      //
      // ⚠ NO EXEMPTION LIST HERE, ON PURPOSE. `WILDS_SWALLOW_EXEMPT` answers a different question —
      // *"is this collision a bug"* — and `garden` is on it because the collision is intended. It is
      // still not somewhere a keeper can stand. Pass the list here and the one anchor that needs
      // this routing is the one anchor that would not get it.
      if (bubbleSwallows(WILDS_BUBBLE, [z]).length > 0) {
        const at = passageApproach(SEED, WILDS_BUBBLE)
        // Say what happened. A keeper who asked for one place and was silently put down somewhere
        // else 500 blocks away reads it as the command being broken.
        return `${c.tp(at.x, at.z)}\n${z.id} is a fold — you are at its door, not inside it. walk into the seam.`
      }
      return c.tp(z.x, z.z)
    },
    suggest: () => ZONE_ANCHORS.map(z => z.id) },
  // ★ /foes (2026-08-16, #294) — the instrument the patrols needed before they could be trusted.
  // Owner-only in FULL, unlike /goto and /mist: those two split because knowing a PLACE exists is
  // not a cheat, but knowing where three people are standing and how close their collars are to
  // breaking is exactly the information the encounter is supposed to make you earn.
  { name: 'foes', usage: 'foes', help: 'the collared patrol near you: distance and collar left', owner: true,
    run: (_a, c) => c.foes() },
  // ★ /press (2026-08-16) — the send-back's dials, live. Owner-only for the same reason /foes is:
  // these decide how long a keeper survives a patrol, and handing that to a player is handing them
  // the encounter's difficulty slider. It exists because eight first guesses cannot be judged from a
  // file, only from standing in front of a patrol — and a rebuild per guess is a feel pass nobody
  // finishes. ⚠ RUNTIME ONLY, deliberately not persisted: what a session decides gets written back
  // into `SENDBACK_DEFAULT` and `COLLAR_FOES` by hand, so the shipped numbers stay reviewable in the
  // file rather than living in one keeper's save.
  { name: 'press', usage: 'press [key value | reset]', owner: true,
    help: 'the send-back dials: guard, calm, regen, wake, meet, <posture>.dps/.reach/.speed',
    run: (a, c) => c.press(a[0]?.toLowerCase(), a[1] === undefined ? undefined : Number(a[1])),
    suggest: () => ['reset', 'guard', 'calm', 'regen', 'wake', 'meet',
      ...['bulwark', 'channeler', 'skirmisher'].flatMap(p => [`${p}.dps`, `${p}.reach`, `${p}.speed`])] },
  // ★ /mist (2026-08-09) — the same lesson /goto was built for, one scale down. A patch is ~52
  // blocks across in a region 2000 across, and there are three of them: found by walking is found
  // by accident. The compass half is VIEW-GRADE for the same reason /goto's is (knowing a place
  // exists is not a cheat); only the teleport is gated.
  // ★ /space (2026-08-15) — the Home Plot's coordinate space, reached before its door exists.
  // OWNER-GATED, unlike /mist's compass half: this is not "knowing a place exists", it is standing
  // in it, and the canon door is a passage through the bubble (slice 2). Shipping the risky half
  // behind a command means it gets walked before travel depends on it.
  { name: 'space', usage: 'space [plot|wilds]', help: 'bare: toggle · plot/wilds: cross to that space', owner: true,
    run: (a, c) => c.space(a[0]) },
  // ── ★ /land (2026-08-19) — Alex: *"is it possible to set up test maps to see the biome gen in
  // action without wandering for 30 min looking for one?"* ────────────────────────────────────
  // He is describing a real property of what we built, not asking for a convenience: highland is
  // 4% of the world and crag 2%, so the two most visually distinct grounds are the two you are
  // least likely to walk into. A generator nobody can review gets tuned by argument.
  //
  // Same view-grade line `/goto` and `/mist` draw: the COMPASS is for everyone (knowing that dry
  // high plains exist somewhere north is not a cheat, and a keeper who cannot find the country
  // has a worse problem than one who can), the TELEPORT is keeper-of-the-realm only.
  //
  // ⚠ SHARES `findLands` WITH `scripts/land-tour.mts`. If the console and the contact sheet
  // searched separately they would disagree about where a dell is, and the picture would stop
  // being evidence about the place you can actually walk to.
  { name: 'land', usage: 'land [id]  (bare: bearings to every land)', help: 'find the nine grounds — meadow, dell, crag…',
    run: (a, c) => {
      const p = c.pos()
      const q = (a[0] ?? '').toLowerCase()
      // ⚠ `wildsSwallows` — without it every nearby answer is inside the fold, where there is no
      // ground at any altitude and the teleport silently does nothing. See findLands' own note.
      const found = findLands(Math.floor(p.x), Math.floor(p.z), SEED, { exclude: (x, z) => wildsSwallows(x, z, 220) })
      if (!q) {
        const missing = LAND_IDS.filter(id => !found.some(f => f.id === id))
        const rows = found.map(f =>
          `${f.id.padEnd(10)} ${bearing(f.x - p.x, f.z - p.z)}   ${(f.t * 100).toFixed(0)}% pure`)
        // Naming what was NOT found matters more than it looks: an empty row is the difference
        // between "there is no crag near you" and "crag is broken", and those read identically
        // when the answer is silence.
        if (missing.length) rows.push(`— none within reach: ${missing.join(', ')}`)
        return rows.join('\n')
      }
      const hit = found.find(f => f.id === q) ?? found.find(f => f.id.startsWith(q))
      if (!hit) return `no ${q} within reach — bare /land lists what is near you`
      if (!c.isOwner) return `${hit.id}: ${bearing(hit.x - p.x, hit.z - p.z)} — teleport is keeper-of-the-realm only`
      return c.tp(hit.x, hit.z)
    },
    suggest: (i) => i === 0 ? [...LAND_IDS] : [] },
  { name: 'mist', usage: 'mist [go]', help: 'bare: bearings to nearby mist patches · go: teleport to the nearest',
    run: (a, c) => {
      const p = c.pos()
      const found = mistPatchesNear(p.x, p.z, SEED, MIST_FIND_REACH)
        .sort((m, n) => Math.hypot(m.x - p.x, m.z - p.z) - Math.hypot(n.x - p.x, n.z - p.z))
      if (!found.length) return `no mist patch within ${MIST_FIND_REACH} blocks — they gather inside the ruled regions (/goto)`
      if ((a[0] ?? '').toLowerCase() === 'go') {
        if (!c.isOwner) return `nearest: ${bearing(found[0].x - p.x, found[0].z - p.z)} — teleport is keeper-of-the-realm only`
        return c.tp(found[0].x, found[0].z)
      }
      // ★ Names who answers and at what level, because a patch's strength is a property of its
      // region now and a band nobody can read is a band that reads as an ambush. Same view-grade
      // line the prompt draws in the world, at compass range: choosing which mist to walk to IS
      // the difficulty choice, so the compass has to carry the number.
      const ledger = c.mistLedger()
      const now = Date.now()
      return found.slice(0, 5).map(m => {
        const r = residentAt(m, zoneAt(m.x, m.z, SEED).zone?.id, ledger, now)
        const who = r
          ? `${r.name} lv ${r.level}${r.second ? ` + ${r.second.name} lv ${r.second.level}` : ''}`
          : quietMinutes(ledger, m, now) > 0 ? `quiet ${quietMinutes(ledger, m, now)}m` : 'no answer'
        return `mist patch      ${bearing(m.x - p.x, m.z - p.z)}      ${who}`
      }).join('\n')
    },
    suggest: () => ['go'] },
  // ★ /party (2026-08-09) — the mist spar refuses to start without spirits, by design and by canon
  // (Greg's seed sleeps a while yet), which means testing the spar on a fresh world is impossible
  // without first playing the 2D game to a party. That is a fine rule for a player and a wall for
  // whoever is dialling the feature. Bare `/party` is the roster; the rest is the workbench, and it
  // writes to the same save every surface shares, so it is keeper-of-the-realm only.
  { name: 'party', usage: 'party [lend [n] [level] | heal | clear]', help: 'bare: your spirits · lend/heal/clear: the spar workbench',
    run: (a, c) => {
      const verb = (a[0] ?? '').toLowerCase()
      if (!verb) return c.party.list()
      if (!c.isOwner) return 'the garden answers only its keeper — bare /party reads your roster'
      if (verb === 'heal') return c.party.heal()
      if (verb === 'clear') return c.party.clear()
      if (verb === 'lend') {
        const n = Math.min(4, Math.max(1, Math.round(Number(a[1]) || 4)))
        const lv = Math.min(50, Math.max(1, Math.round(Number(a[2]) || 10)))
        return c.party.lend(n, lv)
      }
      return `party takes lend, heal or clear — not ${verb}`
    },
    suggest: (i) => i === 0 ? ['lend', 'heal', 'clear'] : i === 1 ? ['1', '2', '3', '4'] : ['5', '10', '20', '30'] },
  { name: 'brew', usage: 'brew', help: 'open the cauldron here (owner)', owner: true,
    run: (_a, c) => c.brew() },
  { name: 'greg', usage: 'greg', help: 'talk to Gregory from here (owner)', owner: true,
    run: (_a, c) => c.greg() },
  { name: 'look', usage: 'look <deg>  (0 = north, 90 = east)', help: 'point the camera (owner)', owner: true,
    run: (a, c) => c.look(Number(a[0]) || 0) },
  // ⚠ NAMED `waymark`, NOT `gate`, AND CANON RULED THAT BEFORE ANYONE ASKED. Alex's words for this
  // were "extensions"/"extension gate rune", and `world/gates.md` (08-12) answers his phrasing
  // directly: *"What Alex's 'extension gate rune' actually is: a HOMEWARD WAYMARK… A rune is never
  // bought, so the purchase is the same object — a waymark… Vocabulary stays waymark / passage /
  // fold / threshold — never GATE for in-Ather travel, never a bought RUNE."* A console verb is
  // shipped vocabulary the moment it tab-completes, so calling this `/gate` would make the retired
  // phrasing canon by accident — the same one-word drift the SocketKind rename just undid.
  { name: 'waymark', usage: 'waymark [reach [n]]', help: 'bare: the passages you hold · reach: bind test passages (owner)',
    run: (a, c) => {
      if ((a[0] ?? '') === '' ) return c.waymark()
      if (a[0] !== 'reach') return `not a waymark verb: ${a[0]} — try 'waymark' or 'waymark reach'`
      if (!c.isOwner) return 'binding passages is the owner\'s — bare /waymark reads the ones you hold'
      return c.waymark(`reach ${a[1] ?? ''}`.trim())
    },
    suggest: (i, c) => i === 0 && c.isOwner ? ['reach'] : [] },
  { name: 'weather', usage: 'weather', help: 'someday', run: () =>
      'no weather in the Ather yet — the day it exists, its command lands here' },
]

/** How far /mist looks. Bounded because the scan validates every candidate cell it touches (a pad
 *  scan plus a dell ring each), and an unbounded compass would stall the console on a keystroke. */
export const MIST_FIND_REACH = 1200

/** Prompt tint per element — brightened off ELEMENT_COLORS, which are body colours and read muddy
 *  as small text over gold fog. Same four elements, legible weight. */
export const MIST_PROMPT: Record<'mana' | 'storm' | 'earth' | 'water', string> = {
  mana: '#d9b3e8', storm: '#9fb8f0', earth: '#e0c08a', water: '#8fd8d0',
}

/** Distance + 8-way compass toward (dx, dz). MC's convention: −Z is north, +X is east. */
export function bearing(dx: number, dz: number): string {
  const d = Math.hypot(dx, dz)
  if (d < 60) return 'you are here'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const a = Math.atan2(dx, -dz)                       // 0 = north, clockwise
  const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8
  return `${Math.round(d)} blocks ${dirs[k]}`
}
export function runConsoleLine(line: string, ctx: ConsoleCtx): { text: string; err?: boolean } {
  const parts = line.trim().split(/\s+/)
  const name = (parts[0] ?? '').toLowerCase().replace(/^\//, '')
  if (!name) return { text: '' }
  const cmd = CONSOLE_CMDS.find(k => k.name === name)
  if (!cmd) return { text: `unknown command: ${name} — try /help`, err: true }
  if (cmd.owner && !ctx.isOwner) return { text: `/${name} is keeper-of-the-realm only`, err: true }
  return { text: cmd.run(parts.slice(1), ctx) }
}

/**
 * MC's suggestion strip, sized to ours: given the draft line, what completions apply to the token
 * under the cursor (always the LAST token — no mid-line cursor support, deliberately), and how to
 * apply one. Command names complete after `/`; arguments complete from the command's `suggest`.
 */
export function suggestionsFor(line: string, ctx: ConsoleCtx): { options: string[]; apply: (opt: string) => string } {
  const none = { options: [], apply: () => line }
  if (!line.startsWith('/')) return none
  const body = line.slice(1)
  const toks = body.split(/\s+/)
  const completingNew = /\s$/.test(body) || body === ''
  const partial = completingNew ? '' : toks[toks.length - 1]
  const tokIdx = completingNew ? toks.filter(Boolean).length : toks.length - 1
  const stem = completingNew ? body : body.slice(0, body.length - partial.length)
  const build = (opt: string) => `/${stem}${opt} `
  if (tokIdx === 0) {
    const names = CONSOLE_CMDS.filter(k => !k.owner || ctx.isOwner).map(k => k.name)
    return { options: names.filter(n => n.startsWith(partial.toLowerCase())), apply: build }
  }
  const cmd = CONSOLE_CMDS.find(k => k.name === toks[0].toLowerCase())
  if (!cmd?.suggest || (cmd.owner && !ctx.isOwner)) return none
  const opts = cmd.suggest(tokIdx - 1, ctx).filter(o => o.startsWith(partial))
  return { options: opts.slice(0, 8), apply: build }
}
