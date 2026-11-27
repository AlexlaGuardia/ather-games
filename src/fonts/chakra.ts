import localFont from 'next/font/local'

// Chakra Petch, self-hosted (M221: the Google Fonts fetch at build time and flaked the build).
// The squared, industrial game display face. One instance for the whole site: the root layout
// exposes it as --font-game (gameui.css), and Nolmir / the birth screen apply `chakra.className`.
// Files + OFL licence: src/fonts/chakra-petch/ (from @fontsource/chakra-petch 5.3.0, latin subset).
export const chakra = localFont({
  src: [
    { path: './chakra-petch/chakra-petch-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './chakra-petch/chakra-petch-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './chakra-petch/chakra-petch-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-game',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
