// BETA M169 s1: a building piece's icon (build-catalog.ts pieceIcon), the same in Creative's Place palette and the garden's catalog
import { ICON, pieceIcon } from './build-catalog'
export function BuildIcon({ id, size = 28 }: { id: string; size?: number }) {
  const faces = pieceIcon(id)
  return <svg data-build-icon={id} width={size} height={size} viewBox={`0 0 ${ICON} ${ICON}`} aria-hidden style={{ flex: '0 0 auto', display: 'block' }}>
    {faces.map((f, i) => <path key={i} d={f.d} fill={f.fill} stroke="rgba(0,0,0,.25)" strokeWidth={0.4} strokeLinejoin="round" />)}
  </svg>
}
