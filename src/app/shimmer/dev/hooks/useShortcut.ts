'use client'
import { useEffect } from 'react'

export interface ShortcutBinding {
  key: string           // e.g. 'k', 'z', 'F1'
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean        // Cmd on Mac
  handler: (e: KeyboardEvent) => void
  allowInInput?: boolean  // default false
}

export function useShortcut(shortcuts: ShortcutBinding[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      for (const binding of shortcuts) {
        // Input guard — skip unless explicitly allowed
        if (inInput && !binding.allowInInput) continue

        // Match modifier keys exactly
        if (!!binding.ctrl !== (e.ctrlKey)) continue
        if (!!binding.alt !== (e.altKey)) continue
        if (!!binding.shift !== (e.shiftKey)) continue
        if (!!binding.meta !== (e.metaKey)) continue

        // Match key (case-insensitive for single-char keys)
        const match =
          e.key === binding.key ||
          (binding.key.length === 1 && e.key.toLowerCase() === binding.key.toLowerCase())

        if (match) {
          e.preventDefault()
          binding.handler(e)
          return
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcuts])
}
