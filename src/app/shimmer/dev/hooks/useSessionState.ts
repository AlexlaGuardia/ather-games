'use client'

import { useState, useEffect } from 'react'

const PREFIX = 'shimmer-dev:'

/**
 * useState backed by sessionStorage — survives tab switches and page
 * refreshes but clears when the tab closes. Perfect for editor workflow
 * state that shouldn't persist forever but shouldn't vanish on remount.
 */
export function useSessionState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const fullKey = PREFIX + key

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const stored = sessionStorage.getItem(fullKey)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(value))
    } catch { /* quota exceeded — non-critical */ }
  }, [fullKey, value])

  return [value, setValue]
}
