# Garden Build-Sync — Design Spec

> Draft 2026-07-24 (jin-cc). Goal: a friend you invite into your garden sees the
> stations/chests/props you placed, live. Today they see an empty lot, because
> placements never leave your browser.

## The one-line problem

The garden (`garden-world`, `WORLD_ZONE_ID`) is the stitched continent we've built.
The play3d client connects to it as a **public `zone`** (`instance_type: 'zone'`), so
the matchmaker throws every player into one shared instance of it — and even standing
in the same instance, a visitor sees none of your builds, because your placements live
only in **your** browser (`ather:save:shimmer` → `data.built: PlacedStruct[]`). There
is no world-state on the wire and no persistence on the server.

## The model we're building toward

- **Garden** = private, owner-keyed instance (`garden_<ownerId>`). Alone by default.
  Invite a friend → they drop into *your* garden and see *your* build.
- **Wilds** (future, not built) = the shared matchmade commons (`find_zone_instance`).
- Party host = garden host. Joining a party = visiting the host's garden.

## Authority decision: HOST-AUTHORITATIVE (not server-authoritative)

The owner's client is the single source of truth. The server keeps a **live in-memory
projection** of the current build per garden instance and relays changes. It never
writes to disk and never writes back to the owner's save.

Why this and not server-authoritative persistence:

- **One writer, many readers = no divergence.** The exact failure PATTERNS.md keeps
  finding (two stores of the same fact silently drift) is impossible here: only the
  owner's client ever mutates `built`; the server cache and every visitor are read-only
  replicas. localStorage stays authoritative across sessions; the server cache is a
  projection of the last thing the owner broadcast.
- **Near-zero new server code.** Reuse `Instance.broadcast`; add one blob field on the
  instance; add an owner-id check. No sqlite, no migration, no reconcile-on-load.
- **It serves the actual goal.** "Show off your garden" is synchronous — you're present.
  Host-present-only is a feature boundary, not a limitation, for v1.
- **Clean upgrade path.** If async visits (drop by while owner's offline) ever matter,
  the server already holds the last snapshot in `build_state`; persisting that blob to
  disk is an additive change that never touches the client contract.

Trade-off accepted: **if the host isn't in the garden, there's no live state to serve.**
v1 = host-present visits only.

## Wire protocol (additions to `protocol.py` MsgType)

Placement unit is the existing `PlacedStruct`:
`{ itemId, tileX, tileY, facing, zoneId, srcZoneId?, srcTileX?, srcTileY? }`.

Natural key for a placement = `${zoneId}:${tileX}:${tileY}` (origin tile is unique —
placement already refuses overlapping footprints, so one struct per origin tile).

Client → Server (owner only; server rejects if `player_id != instance.owner_id`):
- `build_snapshot { built: PlacedStruct[] }` — owner pushes full state. Sent on
  connect to own garden, and (throttled ~1s) after a burst of edits, as a
  self-healing resync. Overwrites `instance.build_state`.
- `build_place { struct: PlacedStruct }` — one placement. Server appends to
  `build_state`, relays to visitors.
- `build_remove { zoneId, tileX, tileY }` — one removal by natural key. Server drops
  from `build_state`, relays to visitors.

Server → Client:
- `build_state { built: PlacedStruct[] }` — full snapshot handed to a visitor the
  moment they join, straight from `instance.build_state` (empty array if the owner
  hasn't pushed yet).
- `build_place { struct }` / `build_remove { zoneId, tileX, tileY }` — live deltas
  relayed to visitors, so a friend watching sees you drop a chest in real time. (This
  is the delightful part — keep it.)

Snapshot-on-join + deltas-while-live: the join snapshot is always authoritative, the
deltas are cheap live updates on top.

## Server changes (`shimmer-server`)

1. `protocol.py`: add the five MsgType values above.
2. `instances.py`: `Instance.build_state: list[dict] = field(default_factory=list)`.
   Cleared naturally when the instance tears down (garden persists while occupied; owner
   re-pushes `build_snapshot` on next connect, so a cold cache self-heals).
3. `main.py` message loop:
   - `build_snapshot` → guard owner → `inst.build_state = msg["built"]`.
   - `build_place` → guard owner → append (dedupe by natural key) → broadcast to others.
   - `build_remove` → guard owner → drop by key → broadcast to others.
   - In `add_player` (or the join path): after `instance_state`, if
     `instance.build_state` is non-empty, send the joiner a `build_state`.
4. **Owner guard** = `player.player_id == instance.owner_id`. NOTE: `player_id` is
   client-claimed (see multiplayer.ts) — this is friends-grade trust, not tamper-proof.
   Fine for v1; flag it, don't pretend otherwise.

## Client changes (`play3d`)

### Prereq plumbing (Phase 0) — route the garden as a garden
- On connect to your own garden: send `instance_type=garden`, `garden_owner=<selfId>`.
  (Server `get_or_create_garden` already exists; initial-connect currently only reads
  `garden_owner` on `zone_change`, so add it to the connect query — small.)
- Invite/party → visitor connects with `garden_owner=<hostId>`.
- `inviteUrl` already carries a code; extend to carry the host id (or resolve code→host
  server-side). Design call below.

### Build-sync (Phase 1)
- **Owner emits.** The place handler
  (`setStructures(prev => [...prev, logicalStruct(...)])` ~Shimmer3D:2877) and the
  remove handler also fire `build_place` / `build_remove` when you're in your own
  garden. On garden connect, push `build_snapshot(structures)`.
- **Visitor renders a SEPARATE overlay.** A visitor keeps the host's build in a
  distinct `hostStructures` state, fed from `build_state` / `build_place` /
  `build_remove`. The renderer already takes a `structures` array — feed it
  `hostStructures` when you're a visitor, your own `structures` when you're the owner.
- **Never pollute the visitor's save.** `hostStructures` is view-only and is NOT written
  to the visitor's `ather:save:shimmer`. Leaving the garden drops it. This is the one
  rule that keeps host-authoritative honest: a visitor is a read replica, full stop.
- **Owner-only interaction (v1).** Visitors walk and look. Building, harvesting, opening
  the owner's chests/stations are gated to the owner. Read-only visit first; shared
  interaction is a later, bigger design.

## Phasing

- **Phase 0 — garden routing.** Own garden = private owner instance; invite routes a
  visitor to the host's garden. Provable with two browsers before any build-sync: you
  should be *alone* in your garden unless invited. ~half day.
- **Phase 1 — build-sync core.** The five messages, `instance.build_state`, owner guard,
  visitor overlay rendering, snapshot-on-join + live deltas. The payoff: friend joins,
  sees your garden, watches you place a chest. ~1–1.5 days.
- **Phase 2 — polish.** "Visiting <name>'s garden" banner, read-only station guard,
  leave-to-home button, snapshot throttle/resync. Small.

## Design calls — LOCKED 2026-07-24

1. **Visitor interaction: READ-ONLY.** Visitors walk and look. Building, harvesting,
   opening the owner's chests/stations are owner-only. Shared interaction is a later,
   separate design.
2. **Async visits: NO.** v1 (and for now, permanently) is host-present-only. The server
   holds no persistent garden state; host-authoritative stands. Do NOT build the
   persist-the-snapshot path.
3. **Invite identity: ACCOUNTS, not codes.** Superseded by a real ather.games account
   layer (Google OAuth + username → friends list). A visit is launched by picking a
   friend, not pasting a code. This makes the owner-guard (`player_id == owner_id`)
   trustworthy instead of spoofable. **This is now a dependency in front of build-sync**
   — see ACCOUNTS_SPEC (to be written). Build-sync is identity-agnostic except at the
   "how does a visitor learn hostId" seam, which accounts fill.

## Dependency: the account layer comes first

The clean invite path requires server-trusted identity — the exact thing `multiplayer.ts`
flags as missing ("friends list = security theater until identity is server-trusted").
`player_id` is client-claimed today. The account layer (Google OAuth + username + friends,
server-trusted `user_id`) is the keystone under garden visits, arcade leaderboards, AND
the Magii card game — one identity layer, three features. It is NOT required to persist
garden builds (those stay host-authoritative). Open sub-question: **anonymous save
linking** — first Google sign-in must claim the current device's local `ather:save:shimmer`
into the new account, or players lose their garden. Recommended: first-login adoption.

Existing (stubbed) scaffolding to build the account backend against: `UsernamePicker`,
`FriendsPanel`, `api/shimmerfile` (currently returns anonymous `user_id: "local"`).
