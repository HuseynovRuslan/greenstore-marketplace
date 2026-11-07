import type { Metadata } from 'next'
import { rulesPage } from '@/data/helpPages'
import { pageMetadata } from '@/seo/metadata'
import HelpPage from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({ title: 'Elan qaydaları', description: 'Nə yerləşdirmək olar və olmaz, şəkil və qiymət qaydaları, yoxlama və elanın müddəti.', canonical: '/qaydalar' })

export default function Page() {
  return <HelpPage page={rulesPage} />
}
