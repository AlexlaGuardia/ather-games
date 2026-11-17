# M12 step 5: the open world's cloud save (DESIGN, not built)

> serb (2f9b1aaa), 2026-11-17, for Jin hub review, then Alex. **Save format + server API are Alex's call.**
> Nothing here is code. Inputs: BETA.md "M12 spec", `src/app/api/saves/route.ts`, `src/lib/save-slot.ts`,
> `src/lib/cloud-sync.ts`, `src/lib/accounts/db.ts`, `src/lib/keeper-local.ts` + its test's unclassified list.

## 0. What is true today

- Only `shimmer` (Shimmer3D) ever pushes. `cloud-sync.ts` debounces, sends on `pagehide` by `sendBeacon`, and pulls
  **only into a blank device**. The server is blind last-writer-wins (`putSave` = upsert, no version).
- `wallet` and `magii` are allowed by `GAMES` but nothing pushes them. **Marks have never left the browser.**
- The open world's state is ~19 unscoped localStorage keys (`open.inv.v1`, `open.loadout.v1`, `ather.garden.v1`,
  `ather.fog.v2`, `open.journal.v1`, ...). Step 1 (Jin) scopes them. This design assumes step 1 and 2 are done.
- Server authz is the session cookie (`httpOnly`, `secure`, `SameSite=Lax`) + the #682 `_owner` check, which
  deliberately **accepts unstamped** blobs for legacy clients.

## 1. Decision: a new game row with its own route, Shimmer3D untouched

- New game id **`open`**, same `saves` table, one row per account. `shimmer`, `wallet`, `magii` and
  `/api/saves` keep their current contract byte for byte. Shimmer3D's slot (`ather:save:shimmer[:<uid>]`) is not read
  or written by anything in this design.
- New route **`src/app/api/saves/open/route.ts`**, because `open` needs a different contract (revisions, compare and
  swap, section validation). Bolting that onto the dumb route would make one handler hold two conflict policies.
- **Additive schema change only** (a new column with a default never touches existing rows):
  `ALTER TABLE saves ADD COLUMN rev INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE saves ADD COLUMN lease_device TEXT`, `ALTER TABLE saves ADD COLUMN lease_at INTEGER`.
  The old route ignores all three. `deleteAccount` already deletes every `saves` row, so erasure is covered.

## 2. The document

```jsonc
{
  "v": 1,                       // document format. Server refuses an unknown v (fail closed, client keeps local).
  "_owner": "u_abc",            // REQUIRED and must equal the session user (no legacy grace: `open` is new).
  "_epoch": 2,                  // the world epoch the data was written under (ather-epoch.ts).
  "rev": 41,                    // server-assigned. Client echoes it back as base_rev; never invents one.
  "garden": {                   // ONE per account, shared by every keeper on it
    "keys": { "ather.garden.v1": "<raw string>", "ather.fog.v2": "...", "open.journal.v1": "...", ... },
    "updated_at": 1763380000000
  },
  "keepers": [                  // the roster, max 8
    { "id": "k_7f3a...",        // client-generated random id, stable forever, never reused
      "created_at": 1763300000000,
      "keys": { "ather:shimmer:birthRune": "...", "open.inv.v1": "...", "open.loadout.v1": "...", ... },
      "updated_at": 1763380000000 }
  ],
  "active": "k_7f3a...",        // must name a keeper in keepers[] (or null when the roster is empty)
  "retired": [ { "id": "k_...", "retired_at": ... } ]   // tombstones, see §6
}
```

- **Sections carry raw localStorage strings keyed by BASE key** (the unscoped name). The client re-applies its own
  scoping (`keeperKeyFor`, account scope) on pull. The server never parses a game value, so a game change never
  needs a server change, and the server can't corrupt game data by "fixing" it.
- **Which keys are legal is one registry**: `KEEPER_KEY_SPECS` (keeper section) plus a new `GARDEN_KEY_SPECS`
  (garden section), both in `keeper-local.ts`, imported by the route. A key outside the registry is **rejected**
  (400, naming it), not silently stored. That keeps the doc from turning into a dump of arbitrary localStorage, and
  it makes step 1's registry the single source of truth for what syncs. Device keys (`open.settings.v1`,
  `open.keymap.v1`, `ather:gfx:shimmer`, voxel settings) are never in either list and never upload.
- **Marks.** The spec puts Marks in the garden. They live in the `wallet` slot today and have never synced.
  Proposal: **leave Marks in their own `wallet` row** and give it this same rev/CAS contract in a follow-up, rather
  than copying currency into the garden doc (two homes for a balance is how coins get duplicated or eaten).
  ⚠ Alex call (§9 Q3).

## 3. API

| | |
|---|---|
| `GET /api/saves/open` | → `{ doc, rev, lease: { device, at } }` or `{ doc: null, rev: 0 }`. `no-store`. |
| `POST /api/saves/open` | body `{ base_rev, device, doc }` → `200 { rev }` or `409 { reason, rev, doc }`. |
| `POST /api/saves/open/lease` | body `{ device }` → takes the write lease (§4). Returns the current doc + rev. |

The server does, in this order: session → user id (401 if none) · Origin check (§7) · size (§5) · JSON parse ·
`v` known · `_owner === user id` (409 otherwise) · every section key in the registry · `active` in `keepers` ·
keeper ids unique · `device` holds the lease · then ONE statement:
`UPDATE saves SET data=?, rev=rev+1, updated_at=? WHERE user_id=? AND game='open' AND rev=?` (INSERT when no row and
`base_rev = 0`). Zero rows changed = someone else wrote first → `409 { reason: 'stale', rev, doc }`.
`node:sqlite` runs statements one at a time, so the compare and swap is atomic without an explicit transaction.

## 4. Two devices: a write lease plus compare and swap

The failure to design against is the one `route.ts` names: **a stale copy overwriting live play**. Merging two
gardens or two packs field by field is where currency and items get duplicated, so this design never merges game
values. It makes "two devices writing at once" impossible instead:

1. **One writer per account at a time.** A device takes the lease when the open world boots (signed in) or when the
   player comes back to a tab that has lost it. Taking the lease returns the server doc, so the new device always
   starts from the latest server state.
2. **Every push carries `base_rev`.** A push from a device that no longer holds the lease, or whose `base_rev` is
   behind, gets 409. That device **stops pushing**, keeps its local data untouched, and shows one line:
   "Playing on another device. Continue here?" Yes = take the lease (pull, then play). It never deletes anything.
3. **Boot rule, replacing "pull only into a blank device"** for `open`:
   - no local open-world data → adopt the server doc.
   - local data whose `base_rev` == server rev (nothing new on the server) → keep local, push.
   - server rev ahead AND local has unpushed changes (both sides moved, e.g. offline play on a laptop) →
     **server wins, and the local copy is moved to a backup key** `ather:open:backup:<uid>:<ts>`, never deleted.
     **One backup per account** (`ather:open:backup:<uid>`, holding `{ saved_at, rev, doc }`): a newer conflict
     replaces the older backup, because localStorage is ~5 MB per origin and a pile of 1 MB backups would starve the
     live save. If writing the backup throws (quota), the client **does NOT adopt the server copy**: it keeps local,
     stops pushing, and shows the "Playing on another device" line, so a full disk can never turn into a silent loss.
     ⚠ Alex call (§9 Q1). Alternative: a "which one do you keep" panel.
4. Lease expiry: 10 minutes without a push or heartbeat. That only matters for the "Continue here?" wording.
   Correctness comes from the rev check, not the lease.

Why not per-section merge: it looks safe (garden on device A, keeper 2 on device B), but the garden holds Moglins,
storage and deeds that a keeper's pack trades with. A merge that takes A's garden and B's pack can put the same item
in both. The lease makes that state unreachable. It costs one tap in a rare case.

## 5. Size limits (bytes, measured with `Buffer.byteLength`, not `string.length`)

| Limit | Value | Why |
|---|---|---|
| whole doc | **1 MB** | `route.ts` uses 512 KB for one Shimmer save. Fog and journal grow over time, and 8 keepers. |
| one section (garden, or one keeper) | **256 KB** | a runaway in one key fails that push loudly instead of starving the rest |
| keepers | **8** | roster cap. Make it a constant so Alex can tune it. |
| pushes | **1 per 10 s per user** (429 above that) | client debounces 30 s + pagehide beacon, so real play never hits it |

Today's route measures `data.length` (UTF-16 units), which under-counts non-ASCII. Same fix there is cheap and
independent (§8). **Before locking 1 MB:** a worker should measure the real `open.*` / `ather.*` sizes on Alex's
browser and on a long-played test keeper, and the cap should be at least 4x the largest one.

## 6. Ownership and authz (the API-hardening audit, applied)

- **User id comes from the session only.** The body never names a user. `_owner` is a second check, not the source.
- **`_owner` is REQUIRED for `open`** (no unstamped grace: there are no legacy `open` blobs to protect).
- **Origin check on every POST:** `Origin` must be `https://ather.games` (plus the devwin origins in dev). `SameSite=Lax`
  already stops a cross-site form POST from carrying the cookie, but `req.json()` parses any body whatever the
  Content-Type, so the Origin check is the explicit guard rather than a side effect of a cookie default.
  `sendBeacon` from the page sends the same-origin `Origin`, so the pagehide push still works.
- **Keeper ids are opaque and per account.** Nothing addresses a keeper across accounts. The roster lives inside the
  owner's row, so there is no IDOR surface: no route takes another user's id or a keeper id from outside the doc.
- **Removing a keeper is soft.** A push that drops a keeper from `keepers[]` must list it in `retired[]` (else 400:
  "keeper vanished"). That stops a buggy or stale client from erasing a keeper by omission. Tombstones keep the
  last data for 30 days, then a cleanup drops it.
- **Epoch:** the server stores `_epoch` and refuses a push whose `_epoch` is OLDER than the stored one (409 'epoch').
  That blocks a pre-reset tab from uploading a dead world. The epoch sweep (`worldTied` on each key spec) runs on the
  client after a pull, same as local.
- **Privacy page:** uploading open-world state is new data leaving the browser. `privacy/page.tsx` and
  `privacy.test.ts` must name it in the same commit that ships the push (the 07-31 lesson that page cites).

## 7. What changes where (for the build after Alex approves the shape)

| File | Change | Owner |
|---|---|---|
| `src/lib/accounts/db.ts` | 3 additive columns, `getOpenSave`, `casOpenSave`, lease helpers | serb |
| `src/app/api/saves/open/route.ts` (+ `lease/`) | new, §3 to §6 | serb |
| `src/lib/keeper-local.ts` | add `GARDEN_KEY_SPECS` beside `KEEPER_KEY_SPECS` (one registry, two sections) | Jin (step 1 owns it) |
| `src/lib/cloud-sync.ts` | `open` path: lease, base_rev, 409 handling, backup key | Jin |
| `src/app/shimmer/open/**` | none from serb | Jin |
| `privacy/page.tsx` + test | name the new upload | whoever ships the push |

Tests that must exist before it ships: CAS (two writers, second gets 409 and nothing changes), foreign `_owner` → 409,
unknown key → 400, keeper dropped without a tombstone → 400, older epoch → 409, 1 MB + 1 byte → 413, Origin
mismatch → 403, and `beta-m7-saves` still green.

## 8. Independent fixes this audit found in the existing route (small, can ship any time)

- `MAX_BYTES` compares `data.length` (UTF-16 units), not bytes. Use `Buffer.byteLength(data)`.
- `/api/saves` POST has no Origin check (same reasoning as §6). Low risk under `SameSite=Lax`, cheap to close.
- No rate limit on `/api/saves` POST. With a 512 KB cap and a write per request, one account can churn the DB.

## 9. Questions for Alex: ANSWERED 2026-11-17 (Alex to Jin hub: "all of this sounds good, you have the green light")

All four DEFAULTS approved: (1) server wins, local copy kept as a recoverable backup · (2) roster cap 8 · (3) Marks stay in
their own `wallet` row · (4) settings + keymaps per device. The shape is approved; build after steps 1-4.


1. **Both devices changed offline:** server wins and the local copy goes to a recoverable backup (proposed), or a
   panel asking which one to keep?
2. **Roster cap of 8 keepers per account.** OK, or a different number?
3. **Marks stay in their own `wallet` row** (proposed, synced later with the same contract), or move into the garden doc?
4. **Settings and keymaps stay per device** (proposed: they're tuned to the machine), or follow the account?
