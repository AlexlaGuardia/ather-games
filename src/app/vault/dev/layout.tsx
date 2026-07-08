import type { Metadata } from 'next'

// Owner tool — keep it out of the index (mirrors /shimmer/dev).
export const metadata: Metadata = {
  title: 'Vault · Map Editor',
  robots: { index: false, follow: false },
}

export default function VaultDevLayout({ children }: { children: React.ReactNode }) {
  return children
}
