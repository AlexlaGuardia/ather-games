'use client'

const DB_NAME = 'shimmer-dev'
const DB_VERSION = 1
const STORES = ['editor-state', 'map-state', 'dialogue-state', 'stamps'] as const
type StoreName = typeof STORES[number]

interface SavedState {
  key: string
  data: any
  timestamp: number
  dirty: boolean
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'key' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function saveState(store: StoreName, key: string, data: any, dirty = true): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put({ key, data, timestamp: Date.now(), dirty } satisfies SavedState)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadState(store: StoreName, key: string): Promise<SavedState | null> {
  const db = await openDB()
  const tx = db.transaction(store, 'readonly')
  const req = tx.objectStore(store).get(key)
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteState(store: StoreName, key: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(key)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listKeys(store: StoreName): Promise<string[]> {
  const db = await openDB()
  const tx = db.transaction(store, 'readonly')
  const req = tx.objectStore(store).getAllKeys()
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as string[])
    req.onerror = () => reject(req.error)
  })
}
