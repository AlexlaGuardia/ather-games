import DevBack from '../../shimmer/dev/templates/DevBack'

/**
 * Mounts the way back to the dev index over every page in this route.
 *
 * ★ A LAYOUT, NOT A PER-PAGE EDIT, so a page added here next week inherits it by EXISTING —
 * the same reasoning `dev-pages.test.ts` gives for discovered-over-remembered registration.
 * `DevBack` renders nothing for a non-owner and nothing on the index itself.
 */
export default function NolmirDevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<DevBack /></>
}
