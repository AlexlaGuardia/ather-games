import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shimmer — Athernyx',
  description: 'Your personal Ather domain. Raise spirits in the golden mist.',
}

export default function ShimmerLayout({ children }: { children: React.ReactNode }) {
  return children
}
