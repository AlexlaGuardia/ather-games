// Card Art — maps card data to image paths
// Spirit forms: /magii/spirits/{spirit}_{element}.png
// Rune stones:  /magii/runes-sm/{rune}.png

// Rune name → filename (handles mismatches)
const RUNE_FILE_MAP: Record<string, string> = {
  Metalergy: 'metallurgy',
  Metallurgy: 'metallurgy',
}

export function getSpiritImage(spirit: string, element: string): string {
  return `/magii/spirits/${spirit}_${element.toLowerCase()}.png`
}

export function getRuneImage(rune: string): string {
  const file = RUNE_FILE_MAP[rune] ?? rune.toLowerCase()
  return `/magii/runes-sm/${file}.png`
}
