import { Space_Grotesk, Syne } from 'next/font/google'

export const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
})

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-space',
})

export const fontClassName = `${syne.variable} ${spaceGrotesk.variable}`
