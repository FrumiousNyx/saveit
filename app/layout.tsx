import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const APP_NAME = 'AnyDownloader'
const APP_DESCRIPTION =
  'Paste a link to download videos and images from Instagram, Reddit, and TikTok. Minimal, fast, and easy to use.'

function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000'

  return new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
}

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} - Instagram, Reddit & TikTok Downloader`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  generator: 'Next.js',
  keywords: [
    'instagram downloader',
    'reddit downloader',
    'tiktok downloader',
    'video downloader',
    'social media downloader',
  ],
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: APP_NAME,
    title: `${APP_NAME} - Instagram, Reddit & TikTok Downloader`,
    description: APP_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${APP_NAME} preview`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} - Instagram, Reddit & TikTok Downloader`,
    description: APP_DESCRIPTION,
    images: ['/twitter-image'],
  },
  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
