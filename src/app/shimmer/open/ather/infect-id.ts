// M128 s1: the node id of a settlement's infected ground (shared by waymarks.ts and infection.ts; nothing imported, no cycles).
export const infectId = (settlement: string) => `infect:${settlement}`
export const infectedPlace = (nodeId: string): string | null => (nodeId.startsWith('infect:') ? nodeId.slice(7) : null)
/** metres round a settlement's middle that turn to Hollow ground (feel: 🟨) */
export const INFECT_R = 60
