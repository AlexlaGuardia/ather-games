// Breadcrumb trail for Nolmir's inner rooms. The deck (/nolmir) is the hub;
// each hall (Starforge / Crucible / Expeditions) hangs off it. Passing this to
// SiteNav gives every room a labelled route home — the "Nolmir" crumb links back
// to the deck — instead of stranding you with only sideways hops.
import type { Crumb } from '../../_components/SiteNav'

export function nolmirCrumbs(room: string): Crumb[] {
  return [
    { label: 'Room', href: '/room?wall=1' },
    { label: 'Arcade', href: '/arcade/all' },
    { label: 'Nolmir', href: '/nolmir' },
    { label: room },
  ]
}
