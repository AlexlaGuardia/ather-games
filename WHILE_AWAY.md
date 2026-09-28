# While Jin's away — the ather.games queue

> Written 2026-09-28 by Jin (hub `b9c37739`) the day Alex asked how the game keeps moving while Claude is gone.
> **The shape:** Alex keeps touching the game as a **player and designer**; the lite agents (Gemini / DeepSeek) do
> **small, test-guarded jobs**; nothing big gets built until Jin is back. When Jin returns, this file plus Alex's notes
> are the first thing read, so the next session starts warm instead of cold.
>
> The game stays up either way: ather.games runs on Hetzner and, if the box is lost, comes back from the EliteDesk on
> the same address (`/root/cortex/STANDBY_PLAN.md`).

---

## Part 1 — Alex's queue (play it, call it, write it down)

No code in any of these. Each one is a thing only Alex can decide, and each answer turns straight into a build later.
**Write the answer as a line at the bottom of this file (Part 4)**, or tell a lite agent to log it: a one-line call
("the Breach round 10 is too late, make it 7") is worth more than a perfect note.

In the order that unblocks the most:

1. **Walk both errands on a fresh keeper** (an incognito window is the cleanest fresh keeper). Birth → Greg → the Temple (Idony)
   → bracelet lit → Greg's glove line → Idony names the Breach → a Breach run to **round 10** → the cache → back to
   Idony → glove lit. *Call:* is round 10 right? does the chip + guide lead you without thinking? does it feel earned?
2. **Place the Enchant Temple.** Idony stands in for it at Rune Hold `56,55`. Say where it goes (a tile, or "next to
   X"); a lite agent can move her in one line (Part 2, job A).
3. **Cast the two new ultimates.** Overpressure (a Barrier / Gem / Hydro keeper: `/reborn gem` in the voxel world's console, or the dev rune picker in play3d) under fire: does the
   dome read, and does the flaw's shatter feel fair? Gate (Enchant / Illuminate / Metalergy) in the **voxel world**
   (`/shimmer/voxel3d`): strike, step through, step back. *Call:* 4 mana a second and 12 seconds, too much or too little?
4. **The Breach, one full run on the lab.** Wrack rate, the 7:30 clock, the Slack's lure and stall tell.
5. **Lay out the Rune Hold square** in the 2D MapEditor (the grid is a placeholder shell, `TODO(rune-hold-layout)`).
6. **The Puppet Guards** (T console → THE PUPPET GUARDS): phase length 7s, box shrink, Wren's counter window 1.1s are
   all first guesses in `GUARD_TUNING`.
7. **Draw distance in the Wilds:** walk Home Plot → Outfields → the Wilds; is `DEFAULT_RADIUS 3` enough?
8. **Textured vs flat** at `/shimmer/voxel3d/tex` (keys 1/2, 32 vs 64): fly back until they stop differing.
9. **The look of the placeholders:** the ward is a plain cylinder, the Gate spiral two rings. Say what they should be
   (a sketch, a word, a reference); that is a brief for later, not a job for now.
10. **Anything that bugs you while playing.** A bug report is as simple as: where you were, what you did, what happened.

⚠ **cortex has ~45 older "Alex walks / judges …" P1 rows** for the game (#831 → #1382). Many are from builds that
have since changed. Skim them once; close the ones that no longer matter (`cortex_task` update → completed). A row
closed is a question retired; a row left open keeps asking.

---

## Part 2 — Jobs a lite agent may do (each one small, each one guarded)

Pick ONE, finish it, verify it, log it. Every job names its file, its check, and its limit.

| | Job | Where | Done when |
|---|---|---|---|
| **A** | Move Idony to where Alex placed the Temple | `src/app/shimmer/play3d/npcs3d.ts`, the `temple-imbuer` row (`tileX`, `tileY`); update the `TODO(temple-placement)` comment | tile is walkable in Rune Hold; `npx tsx src/app/shimmer/play3d/glove-road.test.ts` passes |
| **B** | Retune a number Alex called (Breach glove round, Gate drain/duration, Overpressure mend/flaw, guard timings) | `play3d/hold.ts` › `gloveRound` · `play3d/cast.ts` › `gate` / `overpressure` · `GUARD_TUNING` | ONLY the number Alex named changes; its test file passes (`glove-road`, `gate-spiral`, `ward`, `cast`) |
| **C** | Clear the 7 old typecheck errors (all in TEST files, none in the game) | `src/app/seedfall/lib/seedfall.test.ts` (5), `src/app/shimmer/engine/farming.test.ts` (1), `src/app/ward/lib/ward.test.ts` (1) | `npx tsc --noEmit -p .` prints **0** errors and those three tests still pass |
| **D** | Log Alex's calls from Part 4 into cortex as one `[game-calls]` signal | cortex | each call quoted verbatim, dated |
| **E** | Close stale cortex rows Alex says are done | cortex | only rows Alex named |

**Not for a lite agent** (wait for Jin): new systems, new dialogue (all game text is `@lark`'s, locked by Alex), canon
questions (Magii's), the ward/spiral visuals, the play3d body-move path, anything in `Shimmer3D.tsx` or
`VoxelWorld.tsx` beyond a one-line number.

---

## Part 3 — The rules on the game (lite agents: read before touching anything)

1. **ather.games is Alex's live save and a public site.** Clicks there are real actions.
2. **Claim a lane first:** `cd /root/ather-games && COORD_WIN=hub COORD_SESSION=<your session id> tools/coord.sh claim hub "<what>"`.
   Release it when done: `COORD_WIN=hub tools/coord.sh release`.
3. **NEVER** run `npm run build`, `pm2 restart ather-games` or a bare `npm run dev`. They rewrite the live `.next` and can
   take the site down or OOM the box. Preview with `tools/devwin.sh play` (its own port, 3203).
4. **Before any deploy**, all three must be true: the job's test file passes; `npx tsc --noEmit -p .` shows **no more
   errors than before** (7 today, 0 after job C); `npm run canon` still says `13 CLEAN`.
5. **Deploy only** with `COORD_WIN=hub tools/coord.sh build "<one line>"`, then check `curl -s -o /dev/null -w
   '%{http_code}' localhost:3200/shimmer/play3d` is `200`. If the build fails, **stop and log it**. Do not retry in a
   loop, do not "fix" the build by editing other files.
6. **Commit only your files:** `git commit -m "..." -- <paths>`. Never `git add -A`. Pull before push.
7. **No new words.** No NPC line, item name, place or lore that is not already in a locked canon file.
8. **Log it:** a `[game]` cortex signal saying what changed, the commit, and whether it deployed.
9. **When in doubt, don't.** Write the question into Part 4 for Alex or for Jin. A question parked costs nothing; a
   wrong change on the live game costs Alex's trust in the lite agents.

---

## Part 4 — Alex's calls and notes (append below; newest at the bottom)

<!-- format: YYYY-MM-DD · what you played · the call. e.g. "2026-10-02 · glove errand · round 10 is too late, 7" -->
