# ather.games Account Layer — Design Spec

> Draft 2026-07-24 (jin-cc). The identity keystone. One layer — Google sign-in +
> username + friends, server-trusted `user_id` — under THREE features: garden visits,
> arcade leaderboards, and the Magii card game with friends. Prerequisite for the
> garden build-sync (see `src/app/shimmer/play3d/BUILD_SYNC_SPEC.md`).

## Why now / why it's the foundation

`multiplayer.ts` already names the gap: *"a real friends list would be security theater
until identity is server-trusted."* `player_id` is client-claimed today — anyone can
spoof anyone. Every multiplayer trust decision (whose garden is this, whose score is
this, who's my opponent) is fake until a server vouches for identity. Google auth is
that server vouch. It's not scope creep; it's the thing three features are all waiting on.

## What already exists (build against this, don't reinvent)

- **Front half of the UI:** `UsernamePicker` (→ `GET /api/shimmerfile/check?username=`)
  and `FriendsPanel` (→ `GET/POST /api/friends`, actions `add|accept|remove`, Friend =
  `{ userId, username, status }`). The contracts are designed; the backends are stubs.
- **`api/shimmerfile`** returns anonymous `{ username:"player", user_id:"local" }`. Stub.
- **`api/arcade/leaderboard`** — real, file-backed (`data/leaderboards/<game>.json`),
  in-process write lock, single PM2 process. Works; identity is client-submitted and
  "trivially spoofable" (its own comment). Accounts upgrade it in place.
- **Auth pattern in-house:** owner gate = httpOnly cookie (`ather_owner`) checked
  server-side. Cookie auth is already how this app gates things.
- **Google infra:** a Google Cloud project already backs guardia's OAuth creds
  (`guardia-core/.env`). The stack already runs raw Google OAuth for Drive/Gmail — copy
  that, no `next-auth`. Need a NEW OAuth **web client** (or an added redirect URI):
  `https://ather.games/api/auth/google/callback`. One console step (Alex).
- **Card game exists:** `src/app/magii/` (engine.ts, game-board.tsx, npc.ts) — turn-based
  vs NPC today. Deterministic, log-based state = clean to add netplay onto later.
- **Stack:** Next 16 (app router), React 19, single PM2 process (`ather-games` :3200).
  Persistence house-style = file-backed JSON + in-process lock. No DB yet.

## Architecture — the two-process identity problem, and the bridge

Two servers, and identity has to span both:
- **Next app (:3200)** — runs the site, does the OAuth redirect dance, sets cookies.
- **FastAPI WS server (`shimmer-server` :8400)** — needs to trust `user_id` on WS
  connect for garden ownership and (later) card-game seating.

**Bridge = a signed session cookie both sides can verify.** After Google login the Next
app mints a JWT (HS256, `ATHER_SESSION_SECRET` shared with the WS server) carrying
`{ user_id, username, exp }`, set as httpOnly `ather_session`.
- Next verifies it per API request.
- The WS connects to `wss://ather.games/shimmer-ws/ws` — **same origin**, so the browser
  sends the `ather_session` cookie on the WS upgrade automatically. FastAPI reads the
  `Cookie` header on connect and verifies the JWT with the shared secret. **No token in
  the URL, httpOnly stays httpOnly, no shared DB for the trust check.** (Verify nginx +
  cloudflared forward the Cookie header on the WS upgrade — they should; flag to test.)

**The WS server stays stateless about accounts.** It never reads the account DB. It only
(a) verifies the session cookie = identity, and (b) verifies a short-lived **visit
ticket** = authorization to enter a specific garden. Both are signature checks. All
account/friend state lives in the Next app.

**Visit authorization:** to enter a friend's garden you must be their friend. The
friendship check lives where the friends DB lives — the Next app. `POST /api/garden/visit
{ hostId }` → Next verifies you + friendship → returns a signed ticket
`{ visitor_id, host_id, exp ~60s }`. Client hands the ticket to the WS on connect; WS
verifies the signature and admits you to `garden_<host_id>` (read-only). Keeps the WS
dumb and the authorization where the data is.

## Data model (Next app owns; first real datastore)

Accounts + friends are genuinely relational (lookup by google sub, by username,
bidirectional friend edges, uniqueness). File-JSON gets awkward here. Use **sqlite via
better-sqlite3** — synchronous, single file, zero-config, fits the single-process
in-process-lock model exactly. It's the right first DB. The WS server never touches it
(bridge is JWT), so no cross-process sqlite locking.

```sql
accounts (
  user_id     TEXT PRIMARY KEY,      -- our stable id ('u_'+nanoid); NOT the google sub
  google_sub  TEXT UNIQUE NOT NULL,  -- google subject — the login key
  email       TEXT,
  username    TEXT UNIQUE COLLATE NOCASE,  -- claimed once; null until picked
  avatar      TEXT,                  -- google picture or a chosen sprite
  created_at  INTEGER
)
friends (
  a_id       TEXT NOT NULL,   -- requester
  b_id       TEXT NOT NULL,   -- target
  status     TEXT NOT NULL,   -- 'pending' | 'accepted'
  created_at INTEGER,
  PRIMARY KEY (a_id, b_id)    -- edge stored once; reads treat 'accepted' as bidirectional
)
```

Leaderboard scores stay in the existing file-JSON — one change: read `user_id`/`username`
from the session cookie, not the request body. Trusted scores, tiny diff.

## OAuth flow (raw, no next-auth)

- `GET /api/auth/google/start` → redirect to Google consent (`scope=openid email profile`,
  `state` CSRF nonce in a short cookie).
- `GET /api/auth/google/callback` → exchange code → verify `id_token` → upsert account by
  `google_sub` → set httpOnly `ather_session` → redirect to username picker if
  `username IS NULL`, else back into the game.
- `GET /api/auth/session` → `{ user_id, username, avatar } | null`. **Replaces the
  shimmerfile stub** as the real "who am I".
- `POST /api/auth/logout` → clear cookie.

Cookie: `ather_session`, httpOnly + Secure + SameSite=Lax, signed JWT (HS256), ~30d exp.

## Anonymous → account linking (first login)

Players today have a garden in `localStorage` (`ather:save:shimmer`) and a
client-generated `player_id`. On first Google login: create the account, pick a username,
and **rebind the client's `player_id` to the account `user_id`** so garden ownership and
friend identity are the same handle going forward.

> ⚠ **Consequence to accept (it's the same tradeoff as "no offline visits"):** gardens are
> host-authoritative and live in the device's localStorage — they are NOT server-persisted.
> So the ACCOUNT is cross-device (sign in anywhere = your identity, friends, scores), but
> the GARDEN is tied to the browser it was built in. Log in on your phone and you're you,
> but your desktop garden isn't there. Cross-device gardens require server-persisted
> gardens — the exact upgrade we deferred with "no offline visits." One decision, two
> consequences. Flagged, not solved. (Open call #1 below.)

## Login is OPTIONAL (don't wall the front door)

Shimmer + arcade stay fully playable anonymously, exactly as today. Sign-in *unlocks*:
friends, garden visits, and trusted-leaderboard placement. Anonymous players get a local
`player_id` and a solo garden. This keeps the on-ramp frictionless and makes the
first-login adoption path (claim your local garden into a new account) natural.

## API surface

New (Next app):
- `GET  /api/auth/google/start` · `GET /api/auth/google/callback`
- `GET  /api/auth/session` · `POST /api/auth/logout`
- `GET  /api/shimmerfile` — real profile from session (replaces stub)
- `GET  /api/shimmerfile/check?username=` — real availability (replaces stub)
- `GET  /api/friends` — list (accepted + pending)  ·  `POST /api/friends` `{action, ...}`
- `POST /api/garden/visit { hostId }` — friendship check → signed visit ticket

Modified:
- `POST /api/arcade/leaderboard` — identity from session cookie, not body

WS server (`shimmer-server`):
- verify `ather_session` cookie on connect → trusted `user_id` / `username`
- accept + verify visit ticket → admit to `garden_<host_id>` (read-only)

## How each feature consumes it

- **Garden visits** — friend picks you in `FriendsPanel` → `/api/garden/visit` → ticket →
  WS admits to your garden → build-sync (other spec) streams your build. Owner-guard
  (`player_id == owner_id`) is now real because both are server-trusted.
- **Arcade leaderboards** — already built; just swap client id → session id. Anti-spoof.
- **Magii card game (later)** — friends + trusted identity + a WS room; the engine is
  already deterministic/log-based, so netplay is "sync the move log between two seated,
  authenticated players." Not this spec, but this is what unblocks it.

## Phasing

- **Phase A — auth core.** Google OAuth + `ather_session` cookie + accounts sqlite + real
  `/api/auth/session` + username picker wired. Ship: sign in, pick a username, stay
  signed in. Immediately swap leaderboard identity → trusted (small, visible win).
- **Phase B — friends.** `/api/friends` backend against the existing panel:
  add-by-username, accept, remove, list. Ship: a real friends list.
- **Phase C — WS trust bridge.** FastAPI verifies the session cookie; `/api/garden/visit`
  tickets; WS admits verified visitors. Ship: the WS knows who you really are — the
  prerequisite the garden build-sync owner-guard needs.
- **Then:** garden build-sync (other spec) plugs into C. Card-game netplay plugs into B+C.

Order ships visible wins early (login, your-name-on-the-board, friends) before the
invisible plumbing (WS trust), and ends exactly where build-sync begins.

## Setup tasks (Alex / one-time)

- Google Cloud console: add an OAuth web client (or redirect URI)
  `https://ather.games/api/auth/google/callback`; note client id/secret.
- Env on the box: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (ather.games client),
  `ATHER_SESSION_SECRET` (shared Next↔WS), `GOOGLE_REDIRECT_URI`.
- `npm i better-sqlite3` in ather-games; `pip` JWT lib (PyJWT) in shimmer-server.

## Design calls — LOCKED 2026-07-24

1. **Cross-device gardens: ACCEPT device-local v1.** Garden lives on the browser it was
   built in; account (identity/friends/scores) is cross-device, garden is not. No server
   garden state. Cross-device gardens = a future upgrade, same lift as offline visits.
2. **Login: OPTIONAL.** Shimmer + arcade stay fully playable anonymously; sign-in unlocks
   friends, garden visits, trusted leaderboard. No hard wall.
3. **Username: CLAIM-ONCE, changeable rarely.** Pick at first login, can change later
   occasionally; leaderboard renders current name.
4. **Providers: Google-only for v1** (default; room to add later).
