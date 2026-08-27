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
| **play** | `play/` · `play3d/` · `save-battle-bg/` · `save-dialogue/` · `save-npc/` · `doctor/` | Battle, UI, dialogue, doctor. |
| **sound** | `audio/` · every `*-sfx.ts` / `*-fx.ts` · `dev/creep` · `dev/sfx-*` | ★ NEW 2026-08-27. Dev server on **3206**. See below. |

Lanes are a starting cut, not law — repartition per session, but keep them **file-disjoint** and
the **hub the sole owner of the shared surface**. A satellite that needs an engine change asks the hub.

### ★ The `sound` lane (added 2026-08-27, Alex: *"i think we should have a whole lane for sound"*)
**The reason it needs a lane and not just a ticket: the audio files are spread across THREE lanes,
so nobody could own the layer, and it shows.** Audited the day the lane was cut:

- **Six independent `AudioContext`s**, each with its own private `let _ac` and its own private gain:
  `play3d/gather-fx.ts`, `play3d/rin-fx.ts`, `voxel3d/hollow-sfx.ts`, `engine/chatterbox.ts`,
  `magii/lib/audio.ts`, `nolmir/sfx-lab`. `gather-fx` and `rin-fx` hold **two copies of the same
  `tone()`** — a hand-kept mirror, in the layer least likely to be tested.
- **⚠ SO "UNLOCK THE AUDIO" IS NOT ONE ACT.** A context resumes only on a user gesture, and each
  module has its own. `unlockHollowSfx()` on the canvas click unlocks **hollow-sfx's** context and
  no other; `gather-fx` makes its own lazily on the first tone, from whatever gesture happens to be
  live. So a player can be in a world where some sounds work and others never do, with nothing on
  screen to say which — and the failure is silence, which reads as "no sound was written yet".
- **⚠ AND THERE IS NO MASTER VOLUME OR MUTE ANYWHERE IN THE GAME.** `setHollowVolume` exists and has
  **no caller**. Six contexts cannot share one setting, so the setting cannot be built until they do.
- Browsers cap concurrent `AudioContext`s (historically ~6 a page). Not hit yet; it is a ceiling that
  rises by one with every new sound, which is the wrong direction for a lane about adding sounds.
- `rin-fx.ts` line 1 has said *"the walker has no shared sfx module"* since it was written. The
  codebase already knew.

**First job, and everything else is cheap after it: ONE shared bus.** A single context, one master
gain, one unlock, one volume setting, and the five existing modules pointed at it. The invariant is
testable in a line — *exactly one `new AudioContext` in the tree* — which is the kind of guard that
cannot go quietly stale.

⚠ **The one boundary that needs stating:** `engine/` is hub-only by the rule above, and
`engine/music.ts` + `engine/chatterbox.ts` live there. Move them to `audio/` in a single hub-executed
commit rather than carving an exception into the shared surface — an exception is what the lane
exists to stop. Until that move lands, a sound window asks the hub for those two files.

★ **House style, inherited and worth keeping:** every sound in the game is SYNTHESISED — no files, so
no download, no licence, no 404. `hollow-sfx.ts`'s header says *"Keep it that way"*, and the arcade
games agree. A sound lane is not an excuse to start shipping samples.

## Per-window boot ritual
> **Identity is inlined per call — do NOT rely on `export`.** CC tool calls run a fresh shell each
> time, so `export COORD_WIN=...` dies between calls. Each Jin window's instance REMEMBERS its lane
> + its cc-session-id and prepends both to every `coord` call. (A human at a persistent terminal
> prompt *can* `export` once — but a CC window can't.)
```bash
cd /root/ather-games
tools/coord.sh status                                  # who's live + build-lock state
COORD_WIN=<lane> COORD_SESSION=<cc-session> tools/coord.sh claim <lane> "what you're doing"
```
`<lane>` = hub | world | sprites | play. Claim a FREE lane (check `status` first) or take the one
Alex assigns. From then on, prefix every `coord` call with `COORD_WIN=<lane> COORD_SESSION=<id>`.

> ⚠ **An empty board is not proof you are alone, and a CLAIMED board is not proof anyone is alive.**
> `status` prints a session column: `(YOU)` marks your own lanes, a bare id marks another window's,
> and `session ?` means the claim predates 2026-08-12 or its window never passed `COORD_SESSION` —
> **unknown, not dead.** Nothing here is a heartbeat; the column tells you whose lane it is so you can
> ask, not whether they are still typing. Releasing another session's lane is refused
> (`COORD_FORCE=1` overrides, once you actually know the window is gone).
> This is here because on 2026-08-12 a booting window read a live hub claim, matched it on timestamp
> alone, and told Alex it held the lane. The id was being passed on every call and thrown away.

> ★ **RE-CLAIM WHEN YOUR WORK CHANGES — the claim note is a statement about what you are doing RIGHT
> NOW, not a lock you take once (2026-08-15).** `claim` is idempotent on your own lane, so running it
> again just updates the note. This was learned the boring way: a hub claim sat for **9h40m** still
> reading *"jin boot 08-15 solo"* while that window had long since shipped three features and moved
> on to a fourth. Nothing broke, and that is the point — **the failure mode is a peer reading it and
> planning around work that finished hours ago**, which is the same misdirection an unreleased claim
> causes, from a lane that is genuinely live. "Release when you wrap" is not enough guidance on its
> own, because the hazard shows up long before anyone wraps.

## New Jin window joins the swarm
1. Boot `/jin` — its boot sequence runs `coord status` and detects the live swarm automatically.
2. Read this file.
3. Claim a free lane (inlined identity, as above). Tell Alex which lane you took.
4. Work your lane only. **Satellites edit + commit their lane; they do NOT `coord build`.** The hub ships.

## Git discipline (trunk-based)
- **★★★ SCOPE THE COMMIT, NOT JUST THE ADD: `git commit -m msg -- <your paths>`.** The old rule here
  said "stage by pathspec, never `git add -A`", and that rule is correct, incomplete, and was
  followed to the letter on 2026-08-27 while six of another window's files went to `origin` anyway.
  **`git add <path>` scopes the ADD. `git commit` then takes whatever is in the INDEX** — including
  files a *different window* staged and had not yet committed. `hub` ran
  `git add …/recoil.ts && git commit -m "recoil: …"` and shipped world's `gate-collapse.ts`,
  `tilemap-source.ts`, `MapEditor.tsx` and `save-map/route.ts` under a message about camera recoil.
  ⚠ **THE INDEX IS THE WORSE HALF OF A SHARED TREE, AND IT IS THE HALF NOTHING SHOWS YOU.** A dirty
  file is at least visible in your own `git status` and in `coord build`'s pre-flight listing. A file
  another window has STAGED is indistinguishable from one you staged, and `git commit` cannot tell
  them apart. The build lock protects you from another window's DEPLOY; **nothing protects you from
  another window's INDEX except naming your paths on the commit itself.**
  ★ It was luck, not discipline, that it cost nothing: world's six files were finished, green and
  tsc-clean, one command from being committed by their own author. Ninety seconds earlier it would
  have been a half-written module and a mid-JSX editor, pushed to `master` — **and every test would
  still have passed, because the suite runs against the TREE.**
- **Stage by pathspec, never `git add -A`.** `git add src/app/shimmer/world/...` — only your lane.
  Still true, and still not sufficient on its own; see the line above.
- ⚠ **THE COMPLETE FORM IS BOTH: `git add <paths> && git commit -m msg -- <paths>`.** A pathspec
  commit **cannot commit an untracked file** — it aborts with *"pathspec … did not match any file(s)
  known to git"*. So a new file still needs the `add`; the pathspec on the commit is what keeps
  another window's staged work out of it. Found within the hour of writing the rule above, by
  hitting it. ★ It **aborted rather than sweeping**, which is the right direction for this to fail
  in — and the abort left the peer's dirty `tokens.test.ts` untouched, so the guard held on its
  first live test.
- **Pull before push. Commit small and often.** Disjoint lanes ⇒ conflicts are rare and section-local.
- **No feature branches.** The live site builds from the working tree, not a branch — branches buy nothing here and cost merge overhead.
- Shared surface (`engine/`, `components/`, `lib/`, `data/`) is committed **only by the hub**.

### ★★★ COMMITTED MEANS SHIPPABLE THIS MINUTE — "the hub will ship it" is a queue, not a gate (2026-08-24)
> A satellite finished work, committed it, and set its lane note to *"awaiting Alex on a version bump,
> hub to ship."* The hub built for an **unrelated reason in another lane** eleven minutes later and the
> work went live — because **`coord build` deploys the TREE, not the lane that ran it.** Nobody was
> wrong and nothing was broken; the model in both heads was simply not the model the tool implements.
- **The lock serialises deploys. It does not scope what a deploy CARRIES.** Any build, by any window,
  for any reason, ships every commit in the tree. There is no per-lane filter and there never was.
- **So the moment you commit, treat it as live.** *"I'll flag it before the hub ships"* is not a
  mechanism — it is a race against a build you cannot see coming and will not be told about.
- **If you do not want it live yet, do not commit it.** Hold it in the working tree, or land it behind
  a flag that is off. ⚠ Holding it in the tree has its own cost — the next `coord build` from ANY
  window bundles your uncommitted edits and reports success — so a flag is the safer of the two, and
  the tree is only for work measured in minutes.
- **Satellites: say what is SHIPPED, not what is ready.** A lane note reading *"landed, hub to ship"*
  describes a gate that does not exist. It has already shipped, or it will, unannounced.

### ⚠ A COMMIT THAT CHANGES VOXEL SOURCE WITHOUT A BUILD MAKES THE NEXT WINDOW DEPLOY DIRTY
> Same day, same pair of windows: a voxel commit landed with no rebuild, so the tracked
> `public/voxel-gen.worker.<hash>.js` predated its own source. The next build — the hub's, in another
> lane — regenerated it, deleted the old hash, re-pointed `worker-url.ts`, and deployed carrying a
> diff it did not author. Only `coord build`'s dirty-tree backstop caught it, **after** the deploy.
- **`npm run worker:fresh`** answers it in seconds and touches nothing: it rebuilds the worker to a
  temp file and compares the hash to the tracked one. Run it before committing anything in the voxel
  import graph. It also catches `worker-url.ts` pointing at an artifact that no longer exists — which
  is a **404 with no error surface**: the Worker constructs, accepts postMessage, never replies, and
  the console stays clean while no terrain ever arrives.
- ★ The guard builds to a temp path on purpose. One that regenerated the real artifact would CREATE
  the dirty tree it exists to detect, and would report "fresh" every time by construction.

### ★★★ A MUTATION SWEEP MAKES A TRACKED FILE DELIBERATELY WRONG, AND NOTHING ON THE BOARD SAYS SO (2026-08-27)
> Every dirty-tree entry above is about work that is INCOMPLETE — a half-written module, a mid-JSX
> editor, an edit saved inside the build window. This is the other kind, and it is worse: a file that
> is **finished, tested, and periodically restored to a state you already know is broken.**
- **What happened:** `sprites` mutation-swept `voxel3d/spirit-portrait-body.ts` five times — writing
  the original bug back in, running the guard, restoring — to prove a new guard could actually fail.
  Minutes later `hub` took the lock, saw that file listed dirty by `coord build`'s pre-flight, and
  built anyway. It landed clean: the chunk was built at 14:34:02, 119s after the commit at 14:32:03,
  and carries all three markers of the committed version. **That was timing, not process.**
- **⚠ A BUILD THAT READS THE FILE MID-SWEEP SHIPS A KNOWN-BAD VERSION, AND EVERY ORACLE STAYS GREEN**
  — because a sweep restores the file before the suite runs. The tree is correct seconds before and
  seconds after; only the bundler's read window is wrong. This is the 08-20 half-edit trap with the
  odds inverted: an unsaved edit is *probably* harmless and *might* be broken, while a mutation
  window is **guaranteed** broken for exactly as long as it is open.
- **★ THE DIRTY FLAG UNDERSTATES IT.** `coord build` names the file, and a reader reasonably thinks
  "someone is typing". Nothing distinguishes *"mid-thought"* from *"currently, intentionally wrong"*,
  so the warning that fires is the mild-sounding one.
- **The rule, and it costs one command:** before a mutation sweep on a TRACKED file, re-claim your
  lane saying so — `coord.sh claim <lane> "mutation-sweeping <file>, do not build"` — and **commit
  before you hand the tree back.** The claim is the only channel that reaches a window deciding
  whether to take the lock. ⚠ And prefer the working-tree backup + `trap` restore over `git
  checkout --`, which destroys uncommitted work on a dirty file (PATTERNS, 08-22).
- **For the hub taking the lock:** a dirty file you cannot attribute is a question, not a warning.
  Ask before overriding — the cost of asking is one message, and the cost of being wrong is a
  known-bad file on prod that every test calls green.

### ⚠⚠ A RELAY TO A WINDOW THAT DIES IS LOST SILENTLY, AND THE BOARD KEEPS SHOWING IT ALIVE
> A travel-layer ruling was relayed to the window holding `world`. That window was killed mid-turn
> seconds later; the message died with it, and **`coord.sh status` still listed the lane as claimed by
> it for an hour afterwards.** The replacement window picked up the lane and never learned the ruling
> existed. Nothing anywhere reported a delivery failure.
- **A lane claim is evidence a window CLAIMED it, never evidence that window is alive.** Same family as
  a stale lane note whose timestamp keeps refreshing while its human-readable half rots.
- **Anything that must survive a window goes in a FILE, not a message** — `CANON_GAPS.md`, GBOARD, a
  cortex signal. Use a relay to draw attention to the file, never as the carrier.
- **If a relay matters and you get no acknowledgement, re-check the board and `ListAgents` before
  assuming it landed.** A window that has died and been replaced looks identical, from the board, to
  one that is simply busy.

#### ★★★ THE FACT SURVIVED. THE ASSIGNMENT DID NOT. (the other half, raised by the world lane)
> The rule above is only half a rule, and the Gate Station proves the missing half rather than the
> present one. The **ruling** was safe the whole time — Magii had authored it into
> `shimmer-geography.md` before relaying. What died with the window was *that the world lane owed a
> build against it.* That existed nowhere but the message. **A fact in a canon file with nothing
> pointing at it is a fact nobody is assigned to build**, and it took an hour and one person's memory
> to resurface.
- **Durable CONTENT goes in a file. Durable ASSIGNMENT goes in a closable row.** They are different
  problems and a file solves only the first. Prose — a signal, a lane note, a handoff paragraph —
  cannot be closed, so it keeps asserting the work is open long after it ships.
- **⚠⚠ RAISE THE ROW WHEN THE WORK IS ASSIGNED, NOT WHEN THE SESSION WRAPS.** A `NEXT{}` marker only
  becomes a row at **session end**, so **a window killed mid-turn loses every open item it raised.**
  That is exactly how the lane turned over with nothing recorded: the dying window never reached its
  own session end, so it opened a row for nothing — including the work it was mid-write on. For
  anything that must survive a kill, open it immediately with `cortex_task action=add`, and let
  `NEXT{}` handle the rest (restating it later dedups to the same row, so there is no cost to both).
- **★ And a row is a CLAIM, not a state — audit before you build on one.** Six rows on this board were
  closed the day this was written: one already built, one ruled by Magii eleven days earlier, one a
  duplicate, one superseded by a later ruling, one whose destination had since been ruled, and one
  that was simply **false** (*"Rune Hold exists only as a dev preview, not a place in any walker"* —
  the shipped tile town is walkable and its doors oracle passes 12/0). A stale row does not sit
  quietly; it keeps directing work.

## Deploy — always through the lock
```bash
coord build "what changed"     # acquire lock -> npm run build -> pm2 restart -> release
```
- **★ COMMIT BEFORE YOU TAKE THE LOCK, so a deploy can only ship what is in git.** `coord build`
  builds the **working tree**, not `HEAD`, and the tree is **shared** — so whoever holds the lock
  deploys *every* window's uncommitted work, not just their own. On 2026-08-11 the hub's ~82
  uncommitted lines went live inside two of the `play` window's deploys: green build, correct
  behaviour, and the running site contained code that existed nowhere in git. Nothing looks wrong
  while that is true, which is the problem — the divergence is only discovered later, by someone
  reading the repo to explain behaviour that is not in it. The rule turns a thing to remember into
  a thing you cannot get wrong: if it is committed first, the tree and `HEAD` agree and the deploy
  is honest by construction.
- **⚠ `coord build "msg"` DOES NOT COMMIT.** It builds, restarts, and signals; the message argument
  is a **signal note**, not a commit message — but it reads exactly like one, which is the trap.
  Same night, the hub ran `coord build "voxel3d: splitting a stack…"`, then saw the `play` window's
  unrelated commit sitting at `HEAD` and briefly read it as *its own commit having been eaten by a
  teammate*. Nothing was lost (pathspec staging held), but the wrong diagnosis there is "another
  window clobbered me", which is the one accusation that stops a swarm cold. Commit separately, by
  pathspec, and check `git log -1` after — not before.
- **★★ AND CHECK `git status` AGAIN *AFTER* THE BUILD — A BUILD WRITES LOAD-BEARING FILES (2026-08-13).**
  The commit-first rule above makes the tree match `HEAD` *going in*. It says nothing about coming
  out, and `coord build` can leave **generated artifacts uncommitted**. `build-worker.mjs` publishes
  the generation worker under a **content hash** and rewrites `src/workers/worker-url.ts` to point at
  it, so any change reaching the worker's import graph deletes the old `public/voxel-gen.worker.<hash>.js`,
  writes a new one, and edits the URL module. On 08-13 the mesh-merge pass touched `attrs.ts` — which
  is in that graph — and the deploy left `HEAD` pointing `VOXEL_WORKER_URL` at a hash that **no longer
  existed on disk**.
  - **Prod was green, and that is the trap.** The *running* tree happened to hold the new file. A
    clean checkout would have shipped a 404ing worker URL, and **that failure is silent by design**:
    the worker never constructs, the liveness probe falls back, worldgen quietly moves onto the main
    thread, and nothing reaches the console. You would meet it as "the game got slow" weeks later.
  - It is the 08-11 lesson **pointed the other way** — there, git was missing code the site was
    running; here, git holds a pointer to a file the site would not have. Same class: *the repo and
    the running thing disagree, and only one of them is being looked at.*
  - **The rule: the hashed artifact and its URL module travel in ONE commit** (as `b50f3ac`/`63b8c7b`
    already did). A deploy is not finished at `prod 200`; it is finished at `git status` clean,
    `master` in sync with `origin`, and the URL in `worker-url.ts` matching a file that is actually
    in `public/`.
  - **⚠ AND DO NOT REPORT A POST-BUILD TREE FROM A PRE-BUILD READING.** The hub called the tree clean
    in its wrap on the strength of a `git status` run *before* taking the lock, which was true when
    it was run and stale by the time it was quoted. A build is exactly the step that invalidates it.
- **Convention: only the hub deploys.** Satellites edit + commit their lane; the hub integrates and runs `coord build`. Keeps git + lock contention near zero. The lock still **serializes** any build as a backstop (and protects you if a second deployer ever happens or you open a real extra window), waiting up to 4m for a held lock.
- A build older than 15m is treated as dead and stolen (a wedged build never blocks the team forever).
- **Never run `npm run build` / `pm2 restart` / a bare `npm run dev` directly.** All three touch the production `.next`; only `coord build` is safe.
- **Satellites preview with `tools/devwin.sh <lane>`, not `npm run dev`.** It pins the window to its own `.next-<lane>` (via `NEXT_DIST_DIR`) and its own port — world 3201, sprites 3202, play 3203, assets 3204 — so a preview can never touch the `.next` the hub deploys from. It refuses `hub` and refuses port 3200. A bare `npm run dev` is still banned because it defaults to both.
- Satellites are no longer blind: your lane runs live on your own port while the hub owns what ships. `coord build` unsets `NEXT_DIST_DIR` itself, so a leaked dev env var can't redirect a production build.
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

## Remote render node (cross-machine — the elitedesk)
> The swarm's `.coord/` board is a SERVER filesystem thing; a window on another box can't share it.
- The **elitedesk render node** owns the `render` lane: runs `/picaso` (Blender/bpy) on its own clone, **syncs via `origin`** (git push producer + sprite), holds **NO build-lock**, and **never deploys** — the hub pulls its push, wires, and `coord build`s.
- **Its lane is registered on the board by HUB PROXY** (it can't write the server's `.coord/`). Its local `coord status` shows only its own empty board — ignore that for swarm state.
- **Cross-machine coordination is the `[coord]` cortex thread**, the one bus that spans both boxes. The render node's live status = its `[coord]` signals (rendering X / pushed Y), not the filesystem board.
- **Naming:** the asset-*wiring* window may claim `sprites`, but that clashes with the SOP's Shimmer-pixel meaning — prefer lane name `assets` for render-to-sprite wiring to keep the two distinct.

## Anti-patterns
- ❌ `git add -A` — sweeps another window's uncommitted lane into your commit.
- ❌ `git commit -m msg` with no pathspec — sweeps another window's **staged** lane, which is worse,
  because nothing on your screen shows you their index. Name the paths: `git commit -m msg -- <paths>`.
- ❌ Direct `npm run build` / `pm2 restart` — the `.next`-corruption + OOM footgun the lock exists to kill.
- ❌ Two windows editing the shared engine — that's the hub's job; ask it.
- ❌ Editing the `/root/akatskii-web` fossil — live games are here in `ather-games` (:3200).
- ❌ Hand-writing a canon name/NPC/region to unblock — that ships accidental canon. Park + flag.
- ❌ **Building from a spec without grepping for its implementation first.** See below — this cost a
  whole duplicate system on 2026-08-12.

## ★ A SPEC IN PLANNING TENSE IS NOT EVIDENCE THE THING IS UNBUILT (2026-08-12)

**Grep for the implementation before you believe a design doc's tense.** One command, every time:

```bash
grep -rln "<the thing>" src/ | grep -v "\.md$"        # is it already code?
ls -la $(grep -rl "<the thing>" --include=*.ts src/)  # and how old is that code?
```

**What happened.** A Jin window read `STRUCTURE-LAYER.md` — which is written as a proposal, with
"§ 4 the trick that keeps it cheap", "§ 5 non-negotiable", recommendations, and open calls marked
for Alex — plus a GBOARD block in the same register, and concluded the piece layer was unbuilt. It
then designed and shipped a registry, placeholder geometry, a rotation transform and an 89-assert
oracle for **six pieces**.

**`voxel/pieces.ts` had shipped on 2026-08-08**: eight pieces, `STRUCTURE`/`STRUCTURE_HALF` occupancy
already written into the voxel grid, already skipped by the mesher, already colliding, persisted in
`ColumnSave.pieces` with tombstones, rendered through `voxel3d/piece-mesh.ts` as merged instanced
blockouts, placeable by the player, 40-assert oracle green. The duplicate was **strictly worse** on
every axis it overlapped, including one it never reached — the live `def.passable` is a per-CELL set
where the duplicate had a per-piece flag.

**Both windows then made the same mistake in the same hour, in opposite directions.** The satellite
asserted the system did not exist without grepping `src/`. The hub asserted the live oracle "very
likely shares the same blind spot" without grepping the oracle — it did not; `pieces.test.ts:70` had
carried an asymmetric `wide` fixture for eight days — and was mid-edit adding a duplicate fixture to
guard it. **A guess dressed as a finding is the thing to catch here, in either direction.**

**Why a duplicate is worse than nothing**, and why the fix was to delete rather than merge: two
catalogues that both claim to be the piece system is the same second-source-of-truth shape as
`ITEM_PALETTES` (written by the editor, read by the editor, read by nothing that renders — 13 items
shipped wrong for months behind it), except with collision and persistence attached. **When you find
a duplicate, one of them dies.** "Merge the best of both" is how you get a third thing.

**What actually worked, and is the reason this cost one afternoon instead of a week:** the hub said
*"stop, I think we have two piece systems, and I'd rather be wrong loudly than let this compound"*
before doing anything else. Then both windows checked each other's claims with `grep` instead of
conceding politely, and each found the other partly right. **Raising it loudly and early costs one
message; a merged duplicate costs a subsystem.**
```
coord {claim <lane> [note] | status | build [msg] | release [lane] | lock | unlock}
```
