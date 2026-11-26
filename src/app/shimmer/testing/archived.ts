/**
 * ★ M214 (2026-11-26): reading a dev page that may have been ARCHIVED.
 *
 * Alex's dev-dash cleanup removed 30 old voxel / play3d / pixel dev routes from the app (git keeps them;
 * DEV_ARCHIVE.md at the repo root lists each with its sha). Several engine tests read one of those pages
 * as the consumer end of a chain ("and a bench mounts it"). With the bench archived that end has no
 * subject, so those asserts SLEEP, and they re-arm by themselves the day the page is restored.
 *
 * ⚠ It only excuses an archive that SAYS so: a page that is missing without a DEV_ARCHIVE.md row throws,
 * because that is a broken path, not a retirement (a guard that cannot find its subject must not pass).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** `rel` is relative to the repo root, e.g. 'src/app/shimmer/dev/hollow/page.tsx'. Returns null iff archived. */
export function readUnlessArchived(rel: string): string | null {
  const root = process.cwd()
  const abs = join(root, rel)
  if (existsSync(abs)) return readFileSync(abs, 'utf8')
  const route = '/' + rel.replace(/^src\/app\//, '').replace(/\/page\.tsx$/, '')
  const archive = existsSync(join(root, 'DEV_ARCHIVE.md')) ? readFileSync(join(root, 'DEV_ARCHIVE.md'), 'utf8') : ''
  if (archive.includes('| `' + route + '` |')) return null
  throw new Error(`${rel} does not exist and DEV_ARCHIVE.md has no row for ${route}: a broken path, not an archive`)
}
