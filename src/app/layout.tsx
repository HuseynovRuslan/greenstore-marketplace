import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/styles/index.css'
import { AppStoreProvider } from '@/state/store'
import { PRE_HYDRATION_SCRIPT } from '@/state/bootstrap'
import { InlineScript } from '@/components/layout/InlineScript'
import { SkipLink } from '@/components/layout/SkipLink'
import { MotionProvider } from '@/components/motion/MotionProvider'
import { ToastProvider } from '@/components/ui/Toast'
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

// viewport-fit=cover: the page paints edge to edge on notched phones; the bottom nav, the sheet footer and the page
// gutters pad themselves with env(safe-area-inset-*). Zoom stays enabled (fields are 16 px on touch screens instead).
// interactive-widget=resizes-content: on Android the keyboard shrinks the layout like on iOS, so bottom sheets and
// dvh heights stay above it. theme-color is the header's white (--color-surface): the browser bar runs into it. The
// site has one, light, colour scheme, so form controls never turn dark under a dark OS setting.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-hydration script sets data-auth / data-banner / --gs-user-name on <html>.
    // data-scroll-behavior: Next.js 16 keeps CSS smooth scrolling during route changes unless asked to reset it,
    // so in-page jumps stay smooth while a new page opens at the top instantly.
    <html lang="az" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <InlineScript html={PRE_HYDRATION_SCRIPT} />
      </head>
      <body>
        {/* First Tab stop of every page; each frame's <main id="main"> is its target. */}
        <SkipLink />
        <AppStoreProvider>
          <MotionProvider>
            <ToastProvider>{children}</ToastProvider>
          </MotionProvider>
        </AppStoreProvider>
      </body>
    </html>
  )
}
