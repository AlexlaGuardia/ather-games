import type { Metadata } from 'next'
import DevBack from '../../shimmer/dev/templates/DevBack'

// Owner tool — keep it out of the index (mirrors /shimmer/dev).
export const metadata: Metadata = {
  title: 'Vault · Map Editor',
  robots: { index: false, follow: false },
}

export default function VaultDevLayout({ children }: { children: React.ReactNode }) {
  // DevBack mounts the way back to the dev index. It renders nothing for a non-owner, which
  // matters here specifically: `/vault/dev` answers 200 to the public (see proxy.ts), unlike
  // every page under `/shimmer/dev`.
  return <>{children}<DevBack /></>
}
