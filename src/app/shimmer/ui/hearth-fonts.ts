import localFont from 'next/font/local'

// The Carved Hearth's two faces: a soft serif for what a panel IS (titles, a picked item's name,
// the quiet italic lines) and a rounded sans for everything you read to act. Loaded here, applied by
// `HearthFrame` as CSS variables, so a panel that wears the hearth gets its type by wearing it —
// nothing global changes and the arcade cabinets never download them.
// Self-hosted (M221): files + OFL licences in src/fonts/fraunces + src/fonts/nunito (@fontsource 5.3.0, latin).
export const hearthDisplay = localFont({
  src: [
    { path: '../../../fonts/fraunces/fraunces-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../../fonts/fraunces/fraunces-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: '../../../fonts/fraunces/fraunces-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../../fonts/fraunces/fraunces-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: '../../../fonts/fraunces/fraunces-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../../fonts/fraunces/fraunces-latin-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-hearth-display',
  declarations: [{ prop: 'font-family', value: "'Fraunces'" }],   // keep the family name Google gave it
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'serif'],
})
export const hearthBody = localFont({
  src: [
    { path: '../../../fonts/nunito/nunito-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../../fonts/nunito/nunito-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../../fonts/nunito/nunito-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../../fonts/nunito/nunito-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-hearth-body',
  declarations: [{ prop: 'font-family', value: "'Nunito'" }],   // keep the family name Google gave it
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
export const HEARTH_FONT_VARS = `${hearthDisplay.variable} ${hearthBody.variable}`
