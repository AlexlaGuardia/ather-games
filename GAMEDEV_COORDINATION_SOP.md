# Game-Dev Coordination SOP
> How multiple CC windows work `/root/ather-games` at once as a small game-dev team.
> Model chosen 2026-07-21 (Alex + jin): **swarm one game, trunk-based, serialized deploy.**

## The model in one breath
One shared machine. One `master`. One build on `:3200`, one `.next`. Windows split a
**single game** into disjoint lanes, commit small to master, and deploy **through a lock**
so no two builds ever collide. Everything else is etiquette on the `[coord]` cortex thread.

The only hard mechanism is the **build lock** — because games deploy, and two `npm run build`s
at once corrupt `.next` and can OOM the 8GB box. Etiquette can't be trusted with that; the lock can.

## Roles (swarm = Shimmer, default lanes)
One window is the **hub** (integration + deploy owner). The rest are **satellites** on disjoint lanes.

| Lane | Owns (paths under `src/app/shimmer/`) | Notes |
|------|----------------------------------------|-------|
| **hub** | `engine/` · `lib/` · `systems/` · `components/` · `data/` + root config | Shared surface. ONLY the hub edits these. Owns green-ness. |
| **world** | `world/` · `arena/` · `save-map/` · `save-structure/` | Map, collision, pathing, verticality. |
| **sprites** | `sprites/` · `beasts/` · `spirits/` · `dev/` (editors) · `save-sprite/` · `save-durations/` · `save-heights/` · `save-movement-style/` | Art wiring + editors. `pixel`'s domain. |
| **play** | `play/` · `play3d/` · `audio/` · `save-battle-bg/` · `save-dialogue/` · `save-npc/` · `doctor/` | Battle, UI, dialogue, doctor. |

Lanes are a starting cut, not law — repartition per session, but keep them **file-disjoint** and
the **hub the sole owner of the shared surface**. A satellite that needs an engine change asks the hub.

## Per-window boot ritual
```bash
export COORD_WIN=<lane>                 # hub | world | sprites | play — your identity
export COORD_SESSION=<this-cc-session>  # so [coord] signals land in YOUR handoff
alias coord='tools/coord.sh'            # from /root/ather-games
coord claim <lane> "one-line what you're doing"
coord status                           # see who else is live + build-lock state
```

## Git discipline (trunk-based)
- **Stage by pathspec, never `git add -A`.** `git add src/app/shimmer/world/...` — only your lane.
- **Pull before push. Commit small and often.** Disjoint lanes ⇒ conflicts are rare and section-local.
- **No feature branches.** The live site builds from the working tree, not a branch — branches buy nothing here and cost merge overhead.
- Shared surface (`engine/`, `components/`, `lib/`, `data/`) is committed **only by the hub**.

## Deploy — always through the lock
```bash
coord build "what changed"     # acquire lock -> npm run build -> pm2 restart -> release
```
- Any window may deploy; the lock **serializes** it. If another window is building you wait (up to 4m), then it's your turn.
- A build older than 15m is treated as dead and stolen (a wedged build never blocks the team forever).
- **Never run `npm run build` / `pm2 restart` / a side `npm run dev` directly.** All three touch `.next`; only `coord build` is safe. No background dev servers in swarm mode — they hold `.next` and block every build.
- Iterate by reading code, running the **doctor** (`/shimmer/dev?mode=doctor`) and tests; see it live by deploying through the lock.

## Coordination bus = `[coord]` cortex thread
- `coord claim` / `coord build` auto-signal. Add your own `[coord]` notes for anything cross-lane
  ("touching the movement state machine, hub heads-up").
- This is the async standup. `coord status` is the live board; cortex is the log.

## Boards & canon (unchanged)
- **GBOARD** per-game blocks are section-disjoint — bump your game's block, commit it with your lane.
- **CANON_GAPS.md** is append-only — safe from any window. Canon stays **read-only** (Magii owns it).
  Hit an unsettled fact → park the build piece, add an `[OPEN]` block, let Alex bridge to /magii.
- Canon-touching work runs the drift gate: `npm run canon` (safe concurrently — read-only).

## Anti-patterns
- ❌ `git add -A` — sweeps another window's uncommitted lane into your commit.
- ❌ Direct `npm run build` / `pm2 restart` — the `.next`-corruption + OOM footgun the lock exists to kill.
- ❌ Two windows editing the shared engine — that's the hub's job; ask it.
- ❌ Editing the `/root/akatskii-web` fossil — live games are here in `ather-games` (:3200).
- ❌ Hand-writing a canon name/NPC/region to unblock — that ships accidental canon. Park + flag.
```
coord {claim <lane> [note] | status | build [msg] | release [lane] | lock | unlock}
```
