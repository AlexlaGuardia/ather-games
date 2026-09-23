// Run: npx tsx src/app/privacy/privacy.test.ts
// ★ The privacy page says it is "TRUE of the code as it actually is". It drifted once: it said signing
// in uploads nothing while /api/saves had been keeping the Shimmer save for two months. So every table
// in the accounts schema must be named here with the phrase the page uses for it, and a NEW table with
// no entry is red until somebody writes it onto the page (and here).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const root = process.cwd()
const page = readFileSync(join(root, 'src/app/privacy/page.tsx'), 'utf8').replace(/\s+/g, ' ')
const schema = readFileSync(join(root, 'src/lib/accounts/db.ts'), 'utf8')

/** table → a phrase the page must carry for it. */
const NAMED: Record<string, string> = {
  accounts: 'your Google account id',
  friends: 'the friends you add',
  saves: 'a copy of your Shimmer save is kept on our server',
  clusters: 'which cluster you are in',
  cluster_members: 'which corner is yours',
  cluster_offers: 'the invitations and yeses that are waiting',
  cluster_consents: 'the invitations and yeses that are waiting',
  cluster_plots: 'a picture of the blocks you have built in your garden',
}
const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m => m[1])
ok(tables.length >= 8, `found the schema's tables (${tables.length})`)
for (const t of tables) {
  ok(t in NAMED, `★ table \`${t}\` is on the page's list — a new server store must be written onto /privacy`)
  if (NAMED[t]) ok(page.includes(NAMED[t]), `the page names \`${t}\`: "${NAMED[t]}"`)
}
ok(!/Signing in does not upload it/.test(page), '★ the old false line is gone')
ok(/picture of your garden, all from our server/.test(page), 'deletion lists the cluster picture')

if (fails.length) { for (const f of fails) console.log('  FAIL ', f); console.log(`privacy: ${pass} passed, ${fails.length} FAILED`); process.exit(1) }
console.log(`privacy: ${pass}/0`)
