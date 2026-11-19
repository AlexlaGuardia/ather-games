# M29 slice 3: carrying a keeper's look to other players

> play (Jin 4, `ccb58127`), 2026-11-19 overnight. For hub + Alex to pick in one line in the morning.
> Context: M29 slices 1–2 are live (the creator, the look saved per keeper as `open.look.v1`, mittens + frame in play).
> M27's remote keepers (`open/shared/open-mp.tsx` › `RemoteKeepers`) still draw the old jointed rig for everyone.
> A look is 12 small choices; `packLook()` makes it a 12-character string (`shared/keeper-look.ts`).

## What the server actually does (read 11-19, `/root/shimmer-server`, not changed)

- `main.py` accepts `sprite: str = Query("default")` on the websocket connect and stores it in `PlayerState.sprite`.
- `player_joined` and `instance_state` send the **whole** `PlayerState` (`asdict`), `sprite` included, to everyone already
  in the instance and to the newcomer. Only `player_moved` is trimmed (x/y/z/yaw/moving), which is why it looked like
  "the server forwards only x/y/z/yaw/moving": that is true of MOVES, not of JOINS.
- The 2D game used `sprite` for exactly this (a per-player look key). Nothing in the 3D clients sends it today
  (`play3d/multiplayer.ts` › `wsUrl` leaves it at "default").

## The three ways

| | A. `sprite` on connect (recommended) | B. presence socket | C. API read by user id |
|---|---|---|---|
| Server change | **none** (the field and the broadcast already exist) | a new message type on `lib/presence` / `presence.py` | a route + a read of the `saves` doc (`/api/saves/open`) |
| Works for | everyone in the instance, signed in or not | signed-in friends only | signed-in only (anon keepers have no doc) |
| When it arrives | with the player (first sight) | separate channel, can race the body | one fetch per new peer, after they appear |
| A look change mid-session | reconnects the socket once (looks change rarely: creator only) | a push | a re-fetch |
| Cost | ~20 lines client: `sprite` opt on `useMultiplayer` → `wsUrl`; read `p.sprite` in `upsert`; `RemoteKeepers` draws `KeeperFigure` from `unpackLook` | a server deploy outside this repo + client | a route, auth, caching, a fetch per peer |
| Risk | the 2D `sprite` meaning: prefix the value (`lk1:<12 chars>`), anything else draws the old rig | two sockets agreeing on who is who | PII surface: reading another account's save |

**Recommendation: A.** No server deploy, works for anonymous keepers too, arrives with the body. The value is versioned
(`lk1:`) so the 2D clients and an old tab keep working (they see an unknown sprite and draw their default).

## Built tonight (inert)

- Client half behind `LOOK_SYNC = false` (`open/shared/open-mp.tsx`): with the flag off nothing is sent and nothing
  changes. Flipping it to `true` is the whole slice-3 ship (+ a two-browser check).
- Not touched: `shimmer-server`, presence, the saves API.

## The ask

Hub/Alex: **"A, flip it"** (I add the two-browser check and ship), or pick B/C.
