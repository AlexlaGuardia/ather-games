import { Fraunces, Nunito } from 'next/font/google'

// The Carved Hearth's two faces: a soft serif for what a panel IS (titles, a picked item's name,
// the quiet italic lines) and a rounded sans for everything you read to act. Loaded here, applied by
// `HearthFrame` as CSS variables, so a panel that wears the hearth gets its type by wearing it —
// nothing global changes and the arcade cabinets never download them.
export const hearthDisplay = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-hearth-display', display: 'swap' })
export const hearthBody = Nunito({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-hearth-body', display: 'swap' })
export const HEARTH_FONT_VARS = `${hearthDisplay.variable} ${hearthBody.variable}`
