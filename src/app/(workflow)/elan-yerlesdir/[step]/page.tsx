import { redirect } from 'next/navigation'
import { ClientGate } from '@/components/layout/ClientGate'
import { STEP_COUNT, type StepNumber } from '@/features/posting/draft'
import { PostingSkeleton } from '@/features/posting/PostingSkeleton'
import { PostingWizard } from '@/features/posting/PostingWizard'
import { privateMetadata } from '@/seo/metadata'

export const metadata = privateMetadata('Elan yerləşdir')

type Props = { params: Promise<{ step: string }> }

/** /elan-yerlesdir/1…6. Any other step redirects to step 1; a step past the furthest one reached goes back there. */
export default async function Page({ params }: Props) {
  const { step } = await params
  const n = /^\d+$/.test(step) ? Number(step) : NaN
  if (!Number.isInteger(n) || n < 1 || n > STEP_COUNT) redirect('/elan-yerlesdir/1')
  return (
    <ClientGate fallback={<PostingSkeleton />}>
      {/* Keyed by step: each step starts with fresh «tried / visited» state and re-reads the saved draft. */}
      <PostingWizard key={n} step={n as StepNumber} />
    </ClientGate>
  )
}
