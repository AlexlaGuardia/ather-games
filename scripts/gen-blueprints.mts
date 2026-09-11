// Regenerate data/blueprints/index.generated.ts from the directory. Run at prebuild (before the
// worker bundle, which imports it) and by hand after adding a blueprint file outside the worktable.
import { writeIndex, INDEX_FILE } from '../src/app/shimmer/data/blueprints/gen-index'
const ids = writeIndex()
console.log(`✅ blueprint index: ${ids.length} file(s) → ${INDEX_FILE.replace(process.cwd() + '/', '')}`)
