import localFont from 'next/font/local'

// The site's two root faces, self-hosted (M221: the Google Fonts fetch at build time and flaked
// the build). Same families, weights and CSS variables as before. Files + OFL licences live beside
// this file (from @fontsource 5.3.0, latin subset).
export const cormorant = localFont({
  src: [
    { path: './cormorant-garamond/cormorant-garamond-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './cormorant-garamond/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './cormorant-garamond/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './cormorant-garamond/cormorant-garamond-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'serif'],
})

// Inter as Google served it with no weight given: the variable font, 100-900.
export const inter = localFont({
  src: [{ path: './inter/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
