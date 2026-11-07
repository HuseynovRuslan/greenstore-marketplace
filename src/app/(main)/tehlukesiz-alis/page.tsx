import type { Metadata } from 'next'
import { safeBuyingPage } from '@/data/helpPages'
import { pageMetadata } from '@/seo/metadata'
import HelpPage from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({ title: 'Təhlükəsiz alış', description: 'Bitkini görmədən beh göndərməyin: kökü, yarpağı və ölçünü necə yoxlamalı, çatdırılma və xidmətlər üçün məsləhətlər.', canonical: '/tehlukesiz-alis' })

export default function Page() {
  return <HelpPage page={safeBuyingPage} />
}
