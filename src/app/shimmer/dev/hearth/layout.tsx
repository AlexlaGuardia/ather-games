import { Fraunces, Nunito } from 'next/font/google'

// The Carved Hearth mock's two faces. Scoped to this route on purpose: until Alex blesses the
// direction, nothing else in the game should download or wear them.
const display = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-hearth-display', display: 'swap' })
const body = Nunito({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-hearth-body', display: 'swap' })

export default function HearthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>
}
