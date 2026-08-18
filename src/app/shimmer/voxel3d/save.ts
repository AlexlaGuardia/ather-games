// Where edits physically live — IndexedDB, host side.
//
// ★ THE MODEL IS IN `voxel/edits.ts`, WHICH IS PURE. This file knows about a browser database and
// nothing else; it stores and returns `PackedEdits` without opinions about what an edit means. When
// Supra needs the same saves it writes its own version of this file against the filesystem, and the
// core moves unchanged — the same boundary as `mesh-bridge.ts` for rendering.
//
// IndexedDB rather than localStorage: typed arrays survive structuredClone with no JSON step, and a
// save that grows with what you BUILD (not where you have walked) should not be competing for a 5MB
// string quota.

import type { PackedEdits } from '../voxel/edits'
import type { Placement } from '../voxel/pieces'

/**
 * What one column stores. Blocks are a packed diff; pieces are a plain list.
 *
 * ★ They share a record deliberately. A shed is block shell PLUS pieces, and splitting them across
 * two stores means two writes, two loads, and a window where a refresh lands between them and
 * leaves you a doorway with no wall. One record, one transaction, one truth.
 */
export interface ColumnSave {
  edits: PackedEdits
  pieces: Placement[]
  /**
   * ★ TOMBSTONES for GENERATED pieces (2026-08-08, the pieces pass). A generated piece (hold
   * parapet, keep roof) is recomputed from seed on every load — deleting it from a list that gets
   * rebuilt would resurrect it. What persists is its ABSENCE: the deterministic gen-id of every
   * generated piece the player deconstructed here. Optional so every pre-pass save loads as-is.
   */
  genRemoved?: string[]
  /**
   * ★ CHEST CONTENTS (2026-08-11, the chests pass), keyed `"x,y,z"` in WORLD coordinates.
   *
   * Here rather than in a global sidecar (the shape the pot clock uses) for the reason this
   * record's header already gives: a chest's block and its contents must arrive and leave in ONE
   * transaction. Split across two stores, a refresh can land between them and a break in that
   * window destroys what was inside. It also means a hundred chests across the world cost nothing
   * until you walk to them, which a single flat blob would not.
   *
   * ⚠ Moving an item into a chest does NOT go through `setVoxel`, so nothing marks the column dirty
   * for you — the host has to do it on every content change or a full chest saves only when some
   * block near it happens to change. Optional so every pre-pass save loads unchanged.
   */
  chests?: Record<string, unknown[]>
  /**
   * ★ STATION JOBS (2026-08-13, the workshop pass), keyed `"x,y,z"` in WORLD coordinates.
   *
   * Here for the chest's reason exactly, not the pot's: a job HOLDS GOODS. Its input is already out
   * of the player's bag and its finished output is sitting inside the block, so the block and the
   * job have to arrive and leave in one transaction — split across two stores, a refresh landing
   * between the loads is a stack of logs deleted. The pot can live in a global sidecar because all
   * it stores is a timestamp; losing one costs four minutes, not a satchel.
   *
   * ⚠ Same dirty-marking caveat as `chests`: loading or collecting a job does not go through
   * `setVoxel`, so the host marks the column itself or a station's work is only written down when
   * some block near it happens to change.
   */
  jobs?: Record<string, unknown>
}

const DB = 'shimmer-voxel'
const STORE = 'edits'
const VERSION = 1

let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  return dbp
}

/**
 * ── ★ TWO SPACES (2026-08-15, the Home Plot) ────────────────────────────────────────────────────
 * The Wilds streams forever from the origin; the Home Plot is its own bounded coordinate space that
 * also measures from ITS origin (`voxel/plot.ts` › `distFromCentre`). So plot column (0,0) and
 * Wilds column (0,0) are two different places wearing one name, and without a namespace the first
 * edit in the garden would overwrite whatever the keeper had built at the world's centre.
 */
export type Space = 'wilds' | 'plot'

/**
 * ⚠ THE WILDS KEY IS BYTE-IDENTICAL TO WHAT IT ALWAYS WAS, AND THAT IS THE WHOLE POINT OF THE
 * SHAPE. Namespacing BOTH spaces would have been tidier and would have silently orphaned every
 * world anyone has already built — the records would still be sitting in IndexedDB, addressed by a
 * key nothing asks for any more, which reads to a player as "my save is gone" and to a developer as
 * "the loader is broken". A new space pays for its own prefix; the old one pays nothing.
 */
const key = (seed: number, cx: number, cz: number, space: Space = 'wilds') =>
  space === 'wilds' ? `${seed}:${cx},${cz}` : `${seed}:${space}:${cx},${cz}`

/**
 * ── ★ THE PLAYER PERSISTS TOO (2026-08-08, Alex: "spawn where I left off, keep my inventory") ──
 * One record beside the columns, same store, key `${seed}:player` — a column key can never
 * collide with it (its coordinate half always contains a comma). Same failure philosophy as the
 * columns: every miss loads as null and null means "fresh keeper at the glade", never an error.
 * The refs are stored as-is (they are plain structured-clonable objects); `v` exists so a future
 * shape change migrates instead of corrupting.
 */
export interface PlayerSave {
  v: 1
  x: number; y: number; z: number
  /** Camera pitch/yaw (three's YXZ euler, what PointerLockControls writes). */
  rx: number; ry: number
  /**
   * ★★ WHICH SPACE THE POSITION IS IN (2026-08-15). Optional so every older save loads, but a save
   * WITHOUT it is exactly the corruption described below.
   *
   * `x/y/z` are meaningless without this, because the two spaces both measure from their own
   * origin — plot (0,0) and Wilds (0,0) are different places wearing one name, which is the same
   * reason `key()` namespaces the plot's column records. Persisting the position and not the space
   * meant a keeper who crossed into the garden was autosaved at plot coordinates and reloaded into
   * the WILDS at those numbers, ~12 blocks from the world origin — which is inside the fold's shell,
   * where nothing is generated. They woke in a void, and reloading put them straight back.
   */
  space?: Space
  inv: unknown
  tools: unknown
  skills: unknown
  /**
   * ★ THE WAYMARK NETWORK (2026-08-15) — and it belongs HERE rather than in `ColumnSave`, which is
   * the opposite of where chests and station jobs live.
   *
   * The rule those two follow is *a thing that HOLDS GOODS must arrive and leave with its block, in
   * one transaction* — split them and a refresh landing between two writes destroys what was inside.
   * A waymark holds nothing. What it stores is a POSITION, which is the pot clock's case, not the
   * chest's.
   *
   * ⚠ AND IT MUST BE READABLE FROM ANYWHERE, which is the half that actually decides it. A column
   * record is invisible until you walk to the column — and the entire verb here is *listing the
   * passages you own while standing nowhere near any of them.* Per-column storage would make the
   * panel show only the waymark you are already standing at.
   *
   * Optional so every pre-pass save loads unchanged.
   */
  waymarks?: unknown
  /**
   * ── ★★ WHICH HOLDS HAVE ALREADY SENT THEIR PATROL (2026-08-16, #294) ──────────────────────────
   * Hold ids, one entry per patrol that has been met. **This has to persist or freeing someone is
   * undone by a refresh**, which is the exact thing the encounter was designed not to allow: canon
   * gives a freed Moglin no wounded state and no second phase, so the reward for breaking a collar
   * is that a person is free — spent once, permanently. Held only in a ref, the guard covered a
   * single page-mount, and a reload put the collar back on someone the keeper had already freed.
   *
   * ── ★★ REPLACED 2026-08-16 (the send-back pass). `patrolled` RECORDED THE WRONG EVENT. ─────────
   * It was written at SPAWN and read as "resolved". Those are not the same event, and the gap is the
   * whole of #294's replay value: a keeper who was **sent back** — the losing state the encounter is
   * built around — marked the hold spent exactly as thoroughly as one who freed everybody. Combined
   * with a 1237-block walk to the nearest hold and a per-save (not per-session, despite the comment)
   * lifetime, **losing once destroyed that hold's encounter permanently in that world.** The penalty
   * canon describes is *"the collar stays on him"*; the build made it *"and you may never go back."*
   *
   * ⚠ THE OLD DOC ARGUED FOR THIS AND THE ARGUMENT ONLY COVERED HALF: *"walking off and reloading
   * must not re-roll a fight the keeper declined any more than it should undo one they won."* The
   * second clause is canon (a freed spirit is free, permanently). The first is a save-scum worry
   * about a fight with **no reward to farm** — you gain nothing you can hold, which the free path
   * says out loud. One clause was load-bearing and the other was not, and they were enforced with
   * one flag.
   *
   * ★ SO THIS COUNTS THE ONES FREED, per hold. It is the only fact that must survive: a patrol comes
   * back minus whoever the keeper already freed, at full collar, and a hold whose count reaches its
   * patrol size never comes back at all. Freeing is permanent; failing is not.
   *
   * ⚠ THE COUNT IS A PREFIX, NOT A SET OF IDS. The patrol is rolled deterministically from the
   * hold's own coordinates, so "3 of them, 2 freed" re-rolls the identical 3 and skips the first 2 —
   * the survivor is the same Moglin with the same posture standing in the same place. Storing ids
   * would be a second source of truth about something the seed already knows.
   *
   * Optional, so every older save loads and simply has freed nobody.
   */
  freedAt?: Record<string, number>
  /**
   * ⚠ LEGACY, READ BY NOBODY (2026-08-16). It cannot be migrated: it says a patrol was *met* and
   * says nothing about whether it was *resolved*, so reading it as `freedAt` would permanently
   * delete the encounter for anyone who had merely walked past a hold, and reading it as nothing
   * re-collars anyone who genuinely freed a patrol. Neither is recoverable from the data. The
   * recoverable direction was chosen: the encounter comes back. Kept in the type so a future reader
   * knows the key on disk is dead rather than forgotten.
   */
  patrolled?: string[]
  /**
   * ── ★★ HOW WIDE GREG HAS FOLDED THIS KEEPER'S GARDEN (2026-08-18) ─────────────────────────────
   * An index into `PLOT_TIERS`, not a radius. Storing the NUMBER of blocks would freeze a keeper's
   * garden at whatever the tier ladder happened to be the day they earned it — retune the ladder and
   * every existing save keeps the old geometry forever, silently, with nothing in the code looking
   * wrong. An index re-reads the live table, so a tuning pass reaches saves that already exist.
   *
   * ⚠ IT IS THE GROUND THAT EXISTS, NOT THE GROUND THAT IS OWED. The grimoire can race ahead of it
   * (a keeper fills the book and has not been back to Greg); `fold-ledger.ts` compares the two and
   * `foldOwed` is what makes Greg's conversation have something to say. Never write the earned tier
   * here without the keeper standing in front of him — the ceremony IS the feature.
   *
   * Optional, so every older save loads at tier 0 and simply has not been widened yet.
   */
  plotTier?: number
  /**
   * The keeper's species index — the grimoire's *what a spirit IS* face (`engine/spirit-index.ts`,
   * `indexToSave`/`indexFromSave`).
   *
   * ★ IT HAD TO START BEING PERSISTED FOR GREG'S UPGRADE TO MEAN WHAT CANON SAYS IT MEANS. The
   * grimoire tab's own header recorded the gap: *"There is no persisted SpiritIndex in this world…
   * knowledge here is DERIVED from the spirits you hold, which is a strictly smaller claim: a spirit
   * you met in the mist and walked away from leaves no trace."* Canon makes DISCOVERING a spirit one
   * of the two faces that buys ground — so without this, half of the ruling could not exist and the
   * seeker's whole path paid nothing.
   *
   * Optional; absent reads as an empty index, which is exactly what a keeper who has met nothing has.
   */
  index?: unknown
}

const playerKey = (seed: number) => `${seed}:player`

export async function loadPlayer(seed: number): Promise<PlayerSave | null> {
  try {
    const db = await open()
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(playerKey(seed))
      req.onsuccess = () => {
        const p = req.result as PlayerSave | undefined
        res(p && p.v === 1 ? p : null)
      }
      req.onerror = () => res(null)
    })
  } catch { return null }
}

export async function savePlayer(seed: number, p: PlayerSave): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(p, playerKey(seed))
      tx.oncomplete = () => res()
      tx.onerror = () => res()
      tx.onabort = () => res()
    })
  } catch { /* unpersisted session — the world still works, it just will not remember */ }
}

/**
 * Load one column's edits. Returns null when there is nothing stored — which is the common case and
 * the whole design: **absence means "pure procedural, regenerate"**, not "empty world".
 *
 * ⚠ Every failure path returns null rather than throwing. A browser in private mode, a corrupt
 * store, a quota error — none of those should cost the player the world, only the edits.
 */
export async function loadColumn(seed: number, cx: number, cz: number, space: Space = 'wilds'): Promise<ColumnSave | null> {
  try {
    const db = await open()
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key(seed, cx, cz, space))
      req.onsuccess = () => res((req.result as ColumnSave) ?? null)
      req.onerror = () => res(null)
    })
  } catch { return null }
}

/**
 * Store one column's edits — or DELETE the record when there are none.
 *
 * ★ The delete is not tidiness. A column edited and then restored must stop costing storage, or the
 * "you only pay for what you build" property quietly becomes "you pay for everywhere you have ever
 * swung a pick". `recordEdit` already drops no-op edits; this is the same rule at the file level.
 */
export async function saveColumn(seed: number, cx: number, cz: number, save: ColumnSave, space: Space = 'wilds'): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      // Empty means EMPTY on both halves — a column whose blocks were restored AND whose pieces
      // were all deconstructed stops costing storage, same rule as `recordEdit` one level down.
      if (save.edits.idx.length === 0 && save.pieces.length === 0 && !save.genRemoved?.length
          && !Object.keys(save.chests ?? {}).length) store.delete(key(seed, cx, cz, space))
      else store.put(save, key(seed, cx, cz, space))
      tx.oncomplete = () => res()
      tx.onerror = () => res()
      tx.onabort = () => res()
    })
  } catch { /* unpersisted session — the world still works, it just will not remember */ }
}

/**
 * How many cells of one material stand in a space, counted across EVERY stored column.
 *
 * ── ★ WHY A DISK SCAN RATHER THAN A LEDGER (2026-08-15, the chest cap) ──────────────────────────
 * A per-plot chest cap needs a count that is right about chests the player cannot currently see:
 * at the endgame cap the island is wider than the load ring, so counting what is resident would let
 * a keeper exceed the cap simply by walking to the far side of their own garden and building there.
 *
 * The obvious fix — a stored list of chest positions maintained as they are placed and broken — is
 * a SECOND SOURCE OF TRUTH about a thing the world already knows, and the two drift the first time
 * a chest leaves by a path nobody remembered to hook. This has no such failure mode: a chest is
 * never generated, so every chest that exists IS an edit, and the edits are already on disk. The
 * world stays the only truth and the census is derived from it.
 *
 * ⚠ IT IS EXACT ONLY WHEN NOTHING IS DIRTY, which is why the caller runs it at the moment of
 * ENTERING the space — `enterSpace` flushes before it flips, so at that instant the disk holds
 * everything and no column of the space being entered is resident yet. From there the host keeps
 * the number by ±1 at its single write funnel. Called at any other moment it would miss unflushed
 * edits and read low.
 *
 * Cheap: the plot is a bounded space of a few dozen small records, and the scan touches only the
 * packed material arrays.
 */
export async function countMaterial(seed: number, space: Space, mat: number): Promise<number> {
  // The wilds key is unprefixed (see `key`), so "starts with the seed" also matches plot records and
  // the player record — both have to be excluded by shape, not by hope.
  const plotPrefix = `${seed}:plot:`
  const mine = (k: string) => space === 'plot'
    ? k.startsWith(plotPrefix)
    : k.startsWith(`${seed}:`) && !k.startsWith(plotPrefix) && k.includes(',')
  try {
    const db = await open()
    return await new Promise((res) => {
      let n = 0
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).openCursor()
      req.onsuccess = () => {
        const cur = req.result
        if (!cur) { res(n); return }
        if (mine(String(cur.key))) {
          const m = (cur.value as ColumnSave | undefined)?.edits?.mat
          if (m) for (let i = 0; i < m.length; i++) if (m[i] === mat) n++
        }
        cur.continue()
      }
      req.onerror = () => res(n)
    })
  } catch { return 0 }
}

/** How many columns hold edits. Cheap, and worth surfacing: it is the size of what you have built. */
export async function editedColumnCount(seed: number): Promise<number> {
  try {
    const db = await open()
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAllKeys()
      req.onsuccess = () => res((req.result as string[]).filter(k => k.startsWith(`${seed}:`)).length)
      req.onerror = () => res(0)
    })
  } catch { return 0 }
}

/** Wipe this seed's saves. Destructive and only ever called from an explicit action. */
export async function clearWorld(seed: number): Promise<void> {
  try {
    const db = await open()
    const keys: string[] = await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAllKeys()
      req.onsuccess = () => res((req.result as string[]).filter(k => k.startsWith(`${seed}:`)))
      req.onerror = () => res([])
    })
    const db2 = await open()
    await new Promise<void>((res) => {
      const tx = db2.transaction(STORE, 'readwrite')
      for (const k of keys) tx.objectStore(STORE).delete(k)
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch { /* nothing to clear */ }
}
