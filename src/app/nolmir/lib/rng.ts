// Nolmir's PRNG now lives in the shared arcade toolkit. Re-exported here so
// existing imports ('./rng') keep working unchanged.

export { mulberry32, randInt, pick, type Rng } from '@/lib/arcade/rng'
