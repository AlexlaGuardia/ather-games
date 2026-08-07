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

const key = (seed: number, cx: number, cz: number) => `${seed}:${cx},${cz}`

/**
 * Load one column's edits. Returns null when there is nothing stored — which is the common case and
 * the whole design: **absence means "pure procedural, regenerate"**, not "empty world".
 *
 * ⚠ Every failure path returns null rather than throwing. A browser in private mode, a corrupt
 * store, a quota error — none of those should cost the player the world, only the edits.
 */
export async function loadColumnEdits(seed: number, cx: number, cz: number): Promise<PackedEdits | null> {
  try {
    const db = await open()
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key(seed, cx, cz))
      req.onsuccess = () => res((req.result as PackedEdits) ?? null)
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
export async function saveColumnEdits(seed: number, cx: number, cz: number, p: PackedEdits): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      if (p.idx.length === 0) store.delete(key(seed, cx, cz))
      else store.put(p, key(seed, cx, cz))
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
