'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

interface InspectorContextValue {
  setInspectorContent: (content: ReactNode | null) => void
  setInspectorTitle: (title: string | null) => void
}

export const InspectorContext = createContext<InspectorContextValue>({
  setInspectorContent: () => {},
  setInspectorTitle: () => {},
})

export function useInspector() {
  return useContext(InspectorContext)
}
