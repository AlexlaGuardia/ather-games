'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { saveState, loadState, deleteState } from './useShimmerDB'

type StoreName = 'editor-state' | 'map-state' | 'dialogue-state' | 'stamps'

interface UseAutoSaveOptions {
  store?: StoreName
  interval?: number  // ms, default 5000
}

interface RecoveryState {
  data: any
  timestamp: number
}

export function useAutoSave(
  key: string,
  state: any,
  dirty: boolean,
  options: UseAutoSaveOptions = {}
) {
  const { store = 'editor-state', interval = 5000 } = options
  const [recovery, setRecovery] = useState<RecoveryState | null>(null)
  const stateRef = useRef(state)
  const dirtyRef = useRef(dirty)
  const mountedRef = useRef(true)
  const hasLoadedRef = useRef(false)

  stateRef.current = state
  dirtyRef.current = dirty

  // Check for crash recovery on mount
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadState(store, key).then(saved => {
      if (saved && saved.dirty && mountedRef.current) {
        setRecovery({ data: saved.data, timestamp: saved.timestamp })
      }
    }).catch(() => {}) // Silently fail if IndexedDB unavailable
  }, [store, key])

  // Auto-save on interval
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current) {
        saveState(store, key, stateRef.current, true).catch(() => {})
      }
    }, interval)
    return () => clearInterval(timer)
  }, [store, key, interval])

  // Save on unmount if dirty
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (dirtyRef.current) {
        saveState(store, key, stateRef.current, true).catch(() => {})
      }
    }
  }, [store, key])

  // Clear recovery state after successful save (dirty becomes false)
  useEffect(() => {
    if (!dirty && hasLoadedRef.current) {
      deleteState(store, key).catch(() => {})
    }
  }, [dirty, store, key])

  const restore = useCallback(() => {
    const data = recovery?.data
    setRecovery(null)
    deleteState(store, key).catch(() => {})
    return data
  }, [recovery, store, key])

  const discard = useCallback(() => {
    setRecovery(null)
    deleteState(store, key).catch(() => {})
  }, [store, key])

  return { recovery, restore, discard }
}
