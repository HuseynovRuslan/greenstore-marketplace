import type { Metadata } from 'next'
import { privacyPage } from '@/data/helpPages'
import { pageMetadata } from '@/seo/metadata'
import HelpPage from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({ title: 'Məxfilik siyasəti', description: 'Hansı məlumatı toplayırıq, nə üçün və bunu necə idarə edə bilərsiniz.', canonical: '/mexfilik' })

export default function Page() {
  return <HelpPage page={privacyPage} />
}
