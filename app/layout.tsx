import type { Metadata } from 'next'
import { VT323, Share_Tech_Mono } from 'next/font/google'
import './globals.css'
import { TopLoader } from '@/components/TopLoader'

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
  display: 'swap',
})

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-share-tech-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Shipdit — Community-Funded App Building',
  description:
    'Submit app ideas, pledge to fund them, and get free apps built for the community. Shipdit ships apps funded by the people who want them.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${vt323.variable} ${shareTechMono.variable}`}>
      <body>
        <TopLoader />
        {children}
      </body>
    </html>
  )
}
