'use client'

import Link from 'next/link'
import { Eye, Pencil, Rocket } from 'lucide-react'
import { CheckboxField, ChoiceCard, FieldGroup } from '@/components/ui/FormControls'
import { categoryById } from '@/data/categories'
import { promotionOption } from '@/data/promotions'
import { sellerById } from '@/data/sellers'
import { formatPrice } from '@/lib/format'
import { ListingDetail } from '@/views/ListingDetailPage'
import { toListing, STEPS } from './draft'
import type { StepProps } from './steps'
import { stepPath } from './ui'
import { fieldDomId } from './validation'

/** One option per package offered while posting (the full choice is on /reklam). */
const OFFERS = ['ireli-cek-5', 'one-cixar-7', 'paket-7']

/**
 * Step 6 — the listing exactly as buyers will see it (the real listing page components in preview mode), links back
 * to each step, an optional promotion package (paid only after moderation approves the listing; mocked), and the
 * rules checkbox.
 */
export function ReviewStep({ draft, update, error, urls, user }: StepProps & { urls: Record<string, string | undefined> }) {
  const images = draft.photos.map((p) => urls[p.id]).filter((u): u is string => Boolean(u))
  const listing = toListing(draft, { images, now: new Date(), sellerId: user?.sellerId, status: 'active' })
  const seller = sellerById(user?.sellerId)
  const chosen = draft.promotion ? promotionOption(draft.promotion.optionId) : undefined

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

      <FieldGroup
        legend={
          <span className="inline-flex items-center gap-2">
            <Rocket aria-hidden size={16} strokeWidth={2} className="text-olive" />
            Daha çox alıcı görsün
          </span>
        }
        optional
        hint="Ödəniş elan yoxlamadan keçəndən sonra alınır. Demo: ödəniş edilmir."
      >
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <ChoiceCard name="promotion" value="" checked={!draft.promotion} onChange={() => update({ promotion: null })} title="Pulsuz yerləşdir" description="30 gün saytda, «Ən yenilər» siyahısında" meta={<span className="text-sm font-semibold text-forest">0 ₼</span>} />
          {OFFERS.map((optionId) => {
            const found = promotionOption(optionId)
            if (!found) return null
            const { pkg, option } = found
            return (
              <ChoiceCard
                key={optionId}
                name="promotion"
                value={optionId}
                checked={draft.promotion?.optionId === optionId}
                onChange={() => update({ promotion: { packageId: pkg.id, optionId } })}
                title={`${pkg.name} · ${option.label}`}
                description={pkg.summary}
                meta={<span className="text-sm font-semibold text-forest">{formatPrice(option.price)}</span>}
              />
            )
          })}
        </div>
        <p className="text-[13px] leading-[1.5] text-muted">
          {chosen ? `Seçildi: ${chosen.pkg.name}, ${chosen.option.label} — ${formatPrice(chosen.option.price)}. ` : ''}
          <Link href="/reklam" className="font-semibold text-forest underline-offset-2 hover:underline">
            Paketlər haqqında
          </Link>
        </p>
      </FieldGroup>

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
