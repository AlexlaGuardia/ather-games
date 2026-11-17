import type { Metadata } from 'next'
import { OpenCloudSync } from './cloud-sync'

// The open world is the game the landing page calls "Ather" (GAME_TITLE, Alex 11-13), so its tab says so,
// not the parent /shimmer layout's "Shimmer — Athernyx" (the voxel-era name).
export const metadata: Metadata = {
  title: { absolute: 'Ather · ather.games' },
  description: 'An open-world sandbox in the Athernyx universe. Tend your plot in the Ather, then step through the gate.',
}

export default function OpenLayout({ children }: { children: React.ReactNode }) {
  // the cloud save renders FIRST: a stashed adoption is applied in its render, before any page reader runs (cloud-sync.tsx)
  return <><OpenCloudSync />{children}</>
}
