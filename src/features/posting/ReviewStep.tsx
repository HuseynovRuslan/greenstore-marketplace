'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, Pencil, Rocket } from 'lucide-react'
import { CheckboxField, ChoiceCard, FieldGroup } from '@/components/ui/FormControls'
import { categoryById } from '@/data/categories'
import { sellerById } from '@/data/sellers'
import { findOption } from '@/features/promotion/checkout'
import { usePromotionPackages } from '@/features/promotion/usePromotionPackages'
import { formatPrice } from '@/lib/format'
import { useDataSource } from '@/state/store'
import type { Seller } from '@/types'
import { ListingDetail } from '@/views/ListingDetailPage'
import { previewSeller } from './actions'
import { toListing, STEPS } from './draft'
import type { StepProps } from './steps'
import { stepPath } from './ui'
import { fieldDomId } from './validation'

/** One option per package offered while posting (the full choice is on /reklam). */
const OFFERS = ['ireli-cek-5', 'one-cixar-7', 'paket-7']


/**
 * Who the preview names as the seller: a business account's «mağaza» (DATA_SOURCE=api asks the API for it; the demo's
 * are in src/data/sellers), nobody for a private account («Fərdi satıcı»).
 */
function usePreviewSeller(user: StepProps['user']): Seller | undefined {
  const api = useDataSource() === 'api'
  const sellerId = user?.accountType === 'business' ? user.sellerId : undefined
  const [fromApi, setFromApi] = useState<{ id: string; seller?: Seller }>()
  useEffect(() => {
    if (!api || !sellerId) return
    let current = true
    void previewSeller().then((seller) => {
      if (current) setFromApi({ id: sellerId, seller })
    })
    return () => {
      current = false
    }
  }, [api, sellerId])
  if (!api) return sellerById(user?.sellerId)
  return fromApi && fromApi.id === sellerId ? fromApi.seller : undefined
}

/**
 * Step 6 — the listing exactly as buyers will see it (the real listing page components in preview mode), links back
 * to each step, an optional promotion package (paid only after moderation approves the listing), and the rules
 * checkbox. The packages are the repository's (DATA_SOURCE=api: the API's names and prices); when none is on sale
 * (no payment provider yet) the step offers no paid choice, and a choice no longer on sale is dropped from the draft.
 */
export function ReviewStep({ draft, update, error, urls, user }: StepProps & { urls: Record<string, string | undefined> }) {
  const images = draft.photos.map((p) => urls[p.id]).filter((u): u is string => Boolean(u))
  const listing = toListing(draft, { images, now: new Date(), sellerId: user?.sellerId, status: 'active' })
  const seller = usePreviewSeller(user)
  const packages = usePromotionPackages()
  const offers = packages ? OFFERS.flatMap((optionId) => findOption(packages, optionId) ?? []) : []
  const chosen = draft.promotion && packages ? findOption(packages, draft.promotion.optionId) : undefined
  const api = useDataSource() === 'api'
  const stale = Boolean(draft.promotion && packages && !chosen)
  useEffect(() => {
    if (stale) update({ promotion: null })
  }, [stale, update])

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="onizleme-basliq" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="onizleme-basliq" className="flex items-center gap-2 text-[15px] leading-[1.35] font-semibold text-forest">
            <Eye aria-hidden size={18} strokeWidth={1.8} />
            Önizləmə
          </h2>
          {/* Phones only: from 768 px the step names above are the same links. */}
          <nav aria-label="Düzəliş et" className="flex flex-wrap gap-x-1 gap-y-1 md:hidden">
            {STEPS.slice(0, 5).map((s) => (
              <Link
                key={s.n}
                href={stepPath(s.n)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-forest transition-colors duration-(--dur-fast) hover:bg-mint"
              >
                <Pencil aria-hidden size={12} strokeWidth={2} />
                {s.title}
              </Link>
            ))}
          </nav>
        </div>
        {/* The preview's own page gutter is replaced by this frame's padding. */}
        <div className="overflow-hidden rounded-2xl border border-line bg-cream px-5 pt-5 md:px-6 md:pt-6 [&>div]:px-0">
          <ListingDetail listing={listing} seller={seller} category={categoryById(listing.categoryId)} others={[]} similar={[]} mode="preview" />
        </div>
      </section>

      {/* Nothing on sale here now (no payment provider yet): no paid choice. */}
      {offers.length > 0 && (
        <FieldGroup
          legend={
            <span className="inline-flex items-center gap-2">
              <Rocket aria-hidden size={16} strokeWidth={2} className="text-olive" />
              Daha çox alıcı görsün
            </span>
          }
          optional
          hint={api ? 'Ödəniş elan yoxlamadan keçəndən sonra «Elanlarım»da edilir.' : 'Ödəniş elan yoxlamadan keçəndən sonra alınır. Demo: ödəniş edilmir.'}
        >
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <ChoiceCard name="promotion" value="" checked={!draft.promotion} onChange={() => update({ promotion: null })} title="Pulsuz yerləşdir" description="30 gün saytda, «Ən yenilər» siyahısında" meta={<span className="text-sm font-semibold text-forest">0 ₼</span>} />
            {offers.map(({ pkg, option }) => (
              <ChoiceCard
                key={option.id}
                name="promotion"
                value={option.id}
                checked={draft.promotion?.optionId === option.id}
                onChange={() => update({ promotion: { packageId: pkg.id, optionId: option.id } })}
                title={`${pkg.name} · ${option.label}`}
                description={pkg.summary}
                meta={<span className="text-sm font-semibold text-forest">{formatPrice(option.price)}</span>}
              />
            ))}
          </div>
          <p className="text-[13px] leading-[1.5] text-muted">
            {chosen ? `Seçildi: ${chosen.pkg.name}, ${chosen.option.label} — ${formatPrice(chosen.option.price)}. ` : ''}
            <Link href="/reklam" className="font-semibold text-forest underline-offset-2 hover:underline">
              Paketlər haqqında
            </Link>
          </p>
        </FieldGroup>
      )}

      <CheckboxField
        id={fieldDomId('rulesAccepted')}
        checked={draft.rulesAccepted}
        onChange={(e) => update({ rulesAccepted: e.target.checked })}
        error={error('rulesAccepted')}
        label={
          <>
            Məlumat düzgündür, şəkillər satdığım bitkiyə aiddir. <Link href="/qaydalar" className="font-semibold text-forest underline underline-offset-2">Elan qaydaları</Link> ilə razıyam.
          </>
        }
      />
    </div>
  )
}
