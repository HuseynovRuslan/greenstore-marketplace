import type { Metadata } from 'next'
import { termsPage } from '@/data/helpPages'
import { pageMetadata } from '@/seo/metadata'
import HelpPage from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({ title: 'İstifadə şərtləri', description: 'GreenStore-un istifadə şərtləri: hesab, ödənişli xidmətlər və məsuliyyət.', canonical: '/istifade-sertleri' })

export default function Page() {
  return <HelpPage page={termsPage} />
}
