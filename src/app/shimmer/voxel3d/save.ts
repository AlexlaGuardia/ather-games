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
