# M28: shared fights (plan for Alex, written overnight 11-19 by the hub)

**The goal:** friends in one party fight the SAME Hollow: same position, same health, one death, one drop each (or shared).

## Where it stands
- **Combat is local.** `ather/combat.ts` runs the whole fight on each client: Hollows, their AI, rounds, spit and drops.
  Spawns come from a seeded random (`rnd(c)`), but each client seeds and populates on its own, so two friends in the same Wilds
  see different Hollows.
- **The server relays little.** `shimmer-server` forwards position (x/y/z/yaw/moving), the look (`sprite`, M29 slice 3),
  chat (text up to 200 characters, to the instance) and party invites. It keeps no game state for the Wilds.
- **Parties already share an instance per zone** (M27 slices 2 + 3), so the people who should share a fight are already
  grouped on the server.

## Three ways to share a fight
| | How | Server change | Cost | Failure mode |
|---|---|---|---|---|
| **A. Host authority** (recommended) | The party's HOST (the leader, else the longest-connected player) runs `combat.ts` for the Hollows near the party and broadcasts a compact snapshot 5-10×/s (id, x, z, hp, state). Others draw those Hollows and send their HITS (`{hollow, dmg, crit}`) to the host, who applies them and broadcasts deaths + drops. | Small: one generic `relay` message (JSON up to ~1 KB, broadcast to the instance, rate-limited per player). | Medium: about a day client side; the server part is about 30 lines plus a test. | Host leaves → hand-off to the next player (their client resumes from the last snapshot). Host lag = everyone's Hollows lag. |
| B. Shared seed + events | Every client simulates from the SAME seed + spawn clock, and broadcasts only hits and deaths; Hollow AI must be deterministic. | Same `relay` message. | High: today's AI reads the local keeper, frame times and `Math.random` in places, and every drift is a desync bug. | Silent divergence: friends see a Hollow in two places. |
| C. Server authority | Port the Hollow sim to the Python server (or a Node worker beside it). | Large: a second copy of combat. | Very high. | The cleanest for PvP later, but too much now. |

## Recommendation: A, in three slices
1. **Server:** a `relay` message (party/instance broadcast, size + rate caps), with a test in `shimmer-server/test_ws.py`.
   ⚠ It's outside the repo and pm2-managed, so it needs Alex's yes and a restart of `shimmer-server` (live sockets drop
   once and reconnect, about 5 s).
2. **Client, host side:** pick the host deterministically from the party roster. The host's `combat.ts` stays as it is and
   gains `snapshot()` / `applyHit()`. Non-hosts stop populating Hollows locally and render the snapshot, with an
   interpolation buffer like remote keepers.
3. **Client, hits + drops:** non-hosts fire locally (instant feedback, hit-scan stays client-side) and send the hit. The host
   confirms the kill, and drops spawn for everyone, each keeper picking up their own copy (no loot fights, a cosy-side rule
   worth a Magii glance).
   - **Check:** `shared-fight-check.mts`, two browsers in one party. Both see the same Hollow id at the same spot (within
     1.5 m); B's shots lower the hp A sees; one death; both get a drop; the host leaves and B becomes host with the Hollows
     intact.

## Not in M28
PvP damage between keepers (frames, shields, Meltbore's shield strip already exist as data). That wants server authority
(option C) or at least server-validated hits, so it comes after M28.

## Asks for Alex
- Yes or no on the server `relay` message plus the brief `shimmer-server` restart.
- Drops: each keeper gets their own (my pick), or one shared drop?
