import { readFile, writeFile, readdir, mkdir, unlink } from 'fs/promises'
import { join, dirname, relative } from 'path'

const BACKUP_DIR = join(process.cwd(), '.shimmer-backups')
const MAX_BACKUPS_PER_FILE = 20

/** Create a timestamped backup of a file before overwriting it */
async function backupFile(filePath: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const rel = relative(process.cwd(), filePath)
    const backupSubdir = join(BACKUP_DIR, dirname(rel))
    await mkdir(backupSubdir, { recursive: true })

    const basename = filePath.split('/').pop()!
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(backupSubdir, `${basename}.${ts}.bak`)
    await writeFile(backupPath, content, 'utf-8')

    // Enforce retention — keep newest MAX_BACKUPS_PER_FILE
    const prefix = basename + '.'
    const files = (await readdir(backupSubdir))
      .filter(f => f.startsWith(prefix) && f.endsWith('.bak'))
      .sort()
    if (files.length > MAX_BACKUPS_PER_FILE) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS_PER_FILE)
      await Promise.all(toDelete.map(f => unlink(join(backupSubdir, f)).catch(() => {})))
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') return
    console.warn('[shimmer-backup] Warning:', err)
  }
}

/** Write file with automatic pre-write backup */
export async function safeWriteFile(filePath: string, content: string, _encoding?: string): Promise<void> {
  await backupFile(filePath)
  await writeFile(filePath, content, 'utf-8')
}
