import { redirect } from 'next/navigation'
import { ClientGate } from '@/components/layout/ClientGate'
import { STEP_COUNT, type StepNumber } from '@/data/postAd'
import { privateMetadata } from '@/seo/metadata'
import PostAdPage from '@/views/post-ad/PostAdPage'

export const metadata = privateMetadata('Elan yerləşdir')

type Props = { params: Promise<{ step: string }> }

/** /elan-yerlesdir/1…6. Any other step number redirects to step 1 (as the Vite build did). */
export default async function Page({ params }: Props) {
  const { step } = await params
  const n = /^\d+$/.test(step) ? Number(step) : NaN
  if (!Number.isInteger(n) || n < 1 || n > STEP_COUNT) redirect('/elan-yerlesdir/1')
  return (
    <ClientGate>
      <PostAdPage step={n as StepNumber} />
    </ClientGate>
  )
}
