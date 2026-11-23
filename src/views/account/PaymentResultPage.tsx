import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { Check, Clock3, Rocket, X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { promotionPackages } from '@/data/promotions'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { describeOption, PAYMENT_RETURN_PATH, retryPath } from '@/features/promotion/checkout'
import { PaymentStatusWatcher } from '@/features/promotion/PaymentStatusWatcher'
import { cn, formatDayMonth, formatFullDate, formatPrice } from '@/lib/format'
import { getRepository } from '@/services/repository'
import type { OwnListing, PromotionOrder } from '@/types'

const ORDER_ID_RE = /^[A-Za-z0-9-]{1,80}$/

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** What the paid order does to the listing now, in the owner's words. */
function effectText(order: PromotionOrder, listing: OwnListing | undefined): string {
  const until = listing?.promotion && listing.promotion.packageId !== 'ireli-cek' ? listing.promotion.until : undefined
  const featured = until ? `Elan ${formatDayMonth(until)}-dək «Önə çıxan» nişanı ilə ana səhifədə və axtarışın başındadır.` : 'Elan «Önə çıxan» nişanı ilə ana səhifədə və axtarışın başındadır.'
  const lifted = 'Elan «Ən yenilər» siyahısının başına qaldırılır.'
  if (listing && listing.status !== 'active') return 'Elan hazırda saytda deyil: reklam onu yenidən aktiv edəndə görünəcək.'
  if (order.packageId === 'ireli-cek') return lifted
  if (order.packageId === 'paket') return `${featured} ${lifted}`
  return featured
}

function StatusIcon({ status }: { status: PromotionOrder['status'] }) {
  const look = {
    paid: { icon: <Check size={32} strokeWidth={2.4} />, className: 'bg-success-soft text-success' },
    pending: { icon: <Clock3 size={30} strokeWidth={2} />, className: 'bg-warning-soft text-warning' },
    failed: { icon: <X size={32} strokeWidth={2.4} />, className: 'bg-danger-soft text-danger' },
  }[status]
  return (
    <span aria-hidden className={cn('flex size-16 items-center justify-center rounded-full', look.className)}>
      {look.icon}
    </span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  )
}

/**
 * /kabinet/odenis?order=<id> with DATA_SOURCE=api — where the payment provider brings the owner back after «Ödə»
 * (backend-contract.md 5.1). The order's status on the API decides what the page says, not the address (the fake
 * provider's `&payment=` is a hint only): paid — the promotion works, and how; pending — the provider has not
 * confirmed yet, the page asks again by itself; failed — nothing was charged, «Yenidən cəhd et». Another account's
 * order, or none, is «tapılmadı» (HTTP 404).
 */
export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const id = one((await searchParams).order)
  const repo = getRepository()
  if (!(await repo.getMe())) return <SignInPrompt next={id && ORDER_ID_RE.test(id) ? `${PAYMENT_RETURN_PATH}?order=${id}` : '/kabinet'} />
  if (!id || !ORDER_ID_RE.test(id)) notFound()
  const order = await repo.getPromotionOrder(id)
  if (!order) notFound()
  const [listing, packages] = await Promise.all([repo.getOwnListing(order.listingId), repo.listPromotionPackages().catch(() => promotionPackages)])
  const what = describeOption(packages, order.optionId) ?? describeOption(promotionPackages, order.optionId)
  const summary = what ? `${what.name} · ${what.label}` : 'Reklam'

  const title = { paid: 'Ödəniş qəbul olundu', pending: 'Ödəniş yoxlanılır', failed: 'Ödəniş alınmadı' }[order.status]
  const text = {
    paid: effectText(order, listing),
    pending: 'Ödəniş təsdiqlənən kimi reklam işə düşəcək. Adətən bir neçə saniyə çəkir.',
    failed: 'Kartdan pul çıxılmayıb. Yenidən cəhd edə və ya başqa kartla ödəyə bilərsiniz.',
  }[order.status]

  return (
    <div className="page-x mx-auto flex w-full max-w-[640px] flex-col gap-7 pt-8 pb-16 md:pt-12">
      <div aria-live="polite" className="flex flex-col items-center gap-3 text-center">
        <StatusIcon status={order.status} />
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[32px]">{title}</h1>
        <p className="max-w-[48ch] text-[15px] leading-[1.55] text-ink-soft">{text}</p>
        <PaymentStatusWatcher orderId={order.id} status={order.status} />
      </div>

      <dl className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4 text-sm leading-[1.45] md:p-5">
        <Row label="Sifariş">
          <span className="tabular-nums">№ {order.number}</span>
        </Row>
        <Row label="Reklam">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Rocket aria-hidden size={14} strokeWidth={2} className="shrink-0 text-olive" />
            {summary}
          </span>
        </Row>
        {listing && (
          <Row label="Elan">
            <span className="line-clamp-2 break-words">{listing.title}</span>
          </Row>
        )}
        <Row label="Məbləğ">
          <span className="font-bold text-forest tabular-nums">{formatPrice(order.amount)}</span>
        </Row>
        {order.paidAt && <Row label="Ödənilib">{formatFullDate(order.paidAt)}</Row>}
      </dl>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        {order.status === 'failed' ? (
          <>
            <ButtonLink href={retryPath(order)} className="sm:flex-1">
              Yenidən cəhd et
            </ButtonLink>
            <ButtonLink href="/kabinet" variant="secondary" className="sm:flex-1">
              Elanlarım
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href="/kabinet" className="sm:flex-1">
              Elanlarım
            </ButtonLink>
            {listing?.status === 'active' && (
              <ButtonLink href={`/elanlar/${listing.slug}`} variant="secondary" className="sm:flex-1">
                Elana bax
              </ButtonLink>
            )}
          </>
        )}
      </div>
    </div>
  )
}
