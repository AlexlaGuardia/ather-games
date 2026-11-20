import { pinPrograms } from './program-keeper'
const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1) } }
const a = { usedTimes: 1 }, b = { usedTimes: 2 }
ok(pinPrograms([a, b]) === 2 && a.usedTimes === 2 && b.usedTimes === 3, 'pins once each')
ok(pinPrograms([a, b]) === 0 && a.usedTimes === 2, 'idempotent')
ok(pinPrograms(undefined) === 0, 'undefined safe')
console.log('program-keeper ok')
