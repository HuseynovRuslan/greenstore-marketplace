import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/styles/index.css'
import { AppStoreProvider } from '@/state/store'
import { siteUrl } from '@/seo/env'
import { robotsFor } from '@/seo/metadata'
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_TITLE } from '@/seo/site'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: robotsFor(),
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
  openGraph: { type: 'website', siteName: SITE_NAME, locale: SITE_LOCALE, title: SITE_TITLE, description: SITE_DESCRIPTION, images: [DEFAULT_OG_IMAGE] },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="az">
      <body>
        <AppStoreProvider>{children}</AppStoreProvider>
      </body>
    </html>
  )
}
