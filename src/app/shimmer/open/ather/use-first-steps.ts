'use client'
// M146: is First Steps still on, for React (the Ather page, the continent). Reads the tutorial's save; saveTut tells it at once,
// and it looks again each second (a sign-in switches keeper).
import { useSyncExternalStore } from 'react'
import { peekFirstSteps, TUT_EVENT } from './glade-tutorial'

const subscribe = (f: () => void) => {
  window.addEventListener(TUT_EVENT, f); const id = setInterval(f, 1000)
  return () => { window.removeEventListener(TUT_EVENT, f); clearInterval(id) }
}
/** true = nothing but First Steps. Server + first paint: held (a beat late for an old keeper, never early for a new one). */
export const useFirstSteps = () => useSyncExternalStore(subscribe, peekFirstSteps, () => true)
