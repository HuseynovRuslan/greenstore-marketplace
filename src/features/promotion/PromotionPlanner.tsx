'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowUp, Check, CircleCheck, CreditCard, LogIn, Lock, Rocket } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { ChoiceCard, FieldGroup } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { useToast } from '@/components/ui/Toast'
import { useAccount } from '@/features/account/useAccount'
import { useCabinet } from '@/features/cabinet/useCabinet'
import { listingPrice } from '@/features/listing/facts'
import { optionClass } from '@/features/search/filterStyles'
import { cn, formatPrice } from '@/lib/format'
import { nameChars } from '@/lib/names'
import { useSession } from '@/state/store'
import type { PromotionOrder, PromotionPackage, PromotionPackageId } from '@/types'
import { buyPromotion, type BuyPromotionResult } from './actions'
import { cardErrors, formatCard, formatExpiry } from './card'
import { initialChoice, newOrderKey, openPaymentPage } from './checkout'

const icons: Record<PromotionPackageId, typeof Rocket> = { 'ireli-cek': ArrowUp, 'one-cixar': Rocket, paket: Rocket }

/**
 * /reklam — choose a listing (from «Elanlarım» or ?elan=), a package and its duration (?secim= picks an option, e.g.
 * the one chosen while posting), then pay. Guests see the packages and are asked to sign in to buy.
 * - DATA_SOURCE=api (backend-contract.md 5.1): «Ödə» opens the order's summary; its button creates the order and sends
 *   the browser to the payment provider's page, which brings the visitor back to /kabinet/odenis. The promotion
 *   starts when the provider confirms the payment (the cabinet then shows «Önə çıxan»).
 * - DATA_SOURCE=mock (DEMO): a card form checked in the browser, nothing charged; paying applies the promotion to the
 *   listing in this browser's cabinet.
 */
export function PromotionPlanner({ packages }: { packages: PromotionPackage[] }) {
  const params = useSearchParams()
  const { account } = useAccount()
  const { source } = useSession()
  const cabinet = useCabinet(account)
  const active = cabinet.listings.filter((l) => l.status === 'active')
  const [listingId, setListingId] = useState(params.get('elan') ?? '')
  const [choice, setChoice] = useState<{ packageId: PromotionPackageId; optionId: string }>(() => initialChoice(packages, params.get('secim')))
  const [checkout, setCheckout] = useState(false)
  const listing = active.find((l) => l.id === listingId)
  const pkg = packages.find((p) => p.id === choice.packageId)
  const option = pkg?.options.find((o) => o.id === choice.optionId)

  const pick = (packageId: PromotionPackageId, optionId?: string) =>
    setChoice({ packageId, optionId: optionId ?? packages.find((p) => p.id === packageId)?.options[0]?.id ?? '' })

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="paketler" className="flex flex-col gap-4">
        <h2 id="paketler" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
          Paketi seçin
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {packages.map((p) => {
            const selected = choice.packageId === p.id
            const Icon = icons[p.id]
            return (
              <article
                key={p.id}
                id={p.id}
                className={cn(
                  'relative flex flex-col gap-4 rounded-2xl border bg-surface p-5 transition-[border-color,box-shadow] duration-(--dur-base) ease-out md:p-6',
                  selected ? 'border-forest shadow-[inset_0_0_0_1px_var(--color-forest)]' : 'border-line',
                )}
              >
                {p.id === 'paket' && (
                  <span className="absolute -top-3 left-5 rounded-full bg-olive-text px-3 py-1 text-xs leading-[normal] font-semibold text-white">Ən sərfəli</span>
                )}
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-vip text-olive-text">
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <h3 className="text-[18px] leading-[1.3] font-semibold text-forest">{p.name}</h3>
                </div>
                <p className="text-sm leading-[1.5] text-ink-soft">{p.summary}</p>
                <ul className="flex flex-col gap-2 text-sm leading-[1.45] text-ink">
                  {p.benefits.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check aria-hidden size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-success" />
                      {b}
                    </li>
                  ))}
                </ul>
                <fieldset className="mt-auto flex flex-col gap-2">
                  <legend className="mb-2 text-[13px] font-semibold text-ink">Müddət</legend>
                  <div className="flex flex-wrap gap-2">
                    {p.options.map((o) => {
                      const on = selected && choice.optionId === o.id
                      return (
                        <label key={o.id} className={cn(optionClass(on), 'inline-flex cursor-pointer items-center gap-1.5 pointer-coarse:h-11 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive')}>
                          <input type="radio" name="option" value={o.id} checked={on} onChange={() => pick(p.id, o.id)} className="sr-only" />
                          {o.label} · <span className="tabular-nums">{formatPrice(o.price)}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <Button variant={selected ? 'primary' : 'secondary'} onClick={() => pick(p.id)}>
                  {selected ? 'Seçilib' : 'Bu paketi seç'}
                </Button>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="elan-sec" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 md:p-6">
        <h2 id="elan-sec" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
          Hansı elan üçün?
        </h2>
        {!account ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-[1.5] text-ink">Paket almaq üçün hesabınıza daxil olun: aktiv elanlarınız burada görünəcək.</p>
            <ButtonLink href={`/daxil-ol?next=${encodeURIComponent('/reklam')}`} icon={<LogIn aria-hidden size={17} strokeWidth={1.8} />} className="shrink-0">
              Daxil ol
            </ButtonLink>
          </div>
        ) : cabinet.load.status === 'loading' ? (
          <p className="text-sm text-muted" role="status">
            Elanlarınız yüklənir…
          </p>
        ) : active.length === 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-[1.5] text-ink">Aktiv elanınız yoxdur. Paket yalnız saytda olan elana tətbiq olunur.</p>
            <ButtonLink href="/elan-yerlesdir" className="shrink-0">
              Elan yerləşdir
            </ButtonLink>
          </div>
        ) : (
          <FieldGroup legend="Aktiv elanlarınız">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {active.map((l) => {
                const price = listingPrice(l)
                return (
                  <ChoiceCard
                    key={l.id}
                    name="listing"
                    value={l.id}
                    checked={listingId === l.id}
                    onChange={setListingId}
                    icon={<img src={l.thumbnail ?? l.cover} alt="" className="size-10 rounded-lg object-cover" />}
                    title={l.title}
                    description={`${price.amount}${price.unit ? ` ${price.unit}` : ''}${l.promotion ? ` · «${packages.find((x) => x.id === l.promotion?.packageId)?.name}» aktivdir` : ''}`}
                    className="p-3"
                  />
                )
              })}
            </div>
          </FieldGroup>
        )}
      </section>

      {/* Phones: the summary and «ödə» stay above the bottom nav. From 768 px the page fits the choice and the
          summary side by side, so the bar sits after the listing picker instead of floating over the packages. */}
      <div data-bottom-bar="checkout" className="gs-keyboard-aside z-20 flex flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-4 shadow-popover backdrop-blur-md max-md:sticky max-md:bottom-[calc(86px+env(safe-area-inset-bottom,0px))] sm:flex-row sm:items-center sm:justify-between md:border-forest/30 md:bg-mint md:shadow-none md:backdrop-blur-none">
        <p className="text-sm leading-[1.45] text-ink" aria-live="polite">
          {pkg && option ? (
            <>
              <span className="font-semibold">
                {pkg.name} · {option.label}
              </span>
              {listing ? ` — «${listing.title}»` : ' — elanı seçin'}
            </>
          ) : (
            'Paketi seçin'
          )}
        </p>
        <Button disabled={!account || !listing || !option} onClick={() => setCheckout(true)} aria-haspopup="dialog" icon={<CreditCard aria-hidden size={18} strokeWidth={1.8} />} className="shrink-0">
          {option ? `${formatPrice(option.price)} ödə` : 'Ödə'}
        </Button>
      </div>

      <Dialog open={checkout} onClose={() => setCheckout(false)} title="Ödəniş">
        {listing && pkg && option && source === 'api' ? (
          <ProviderCheckout
            // One order key per listing and option: pressing again after a lost answer gets the same order.
            key={`${listing.id}:${option.id}`}
            summary={`${pkg.name} · ${option.label}`}
            listingTitle={listing.title}
            amount={option.price}
            buy={(orderKey) => buyPromotion({ listingId: listing.id, packageId: pkg.id, optionId: option.id }, orderKey)}
            listingHref={`/elanlar/${listing.slug}`}
            signInHref={`/daxil-ol?next=${encodeURIComponent(`/reklam?elan=${listing.id}`)}`}
          />
        ) : listing && pkg && option ? (
          <Checkout
            summary={`${pkg.name} · ${option.label}`}
            listingTitle={listing.title}
            amount={option.price}
            onPaid={() => cabinet.promote(listing.id, pkg.id, option.days ?? 1)}
            buy={() => buyPromotion({ listingId: listing.id, packageId: pkg.id, optionId: option.id })}
            listingHref={`/elanlar/${listing.slug}`}
          />
        ) : null}
      </Dialog>
    </div>
  )
}

/** What is being paid for: the package and option, the listing, the total. */
function OrderSummary({ summary, listingTitle, amount }: { summary: string; listingTitle: string; amount: number }) {
  return (
    <dl className="flex flex-col gap-1.5 rounded-lg bg-cream p-4 text-sm leading-[1.45]">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Paket</dt>
        <dd className="text-right font-semibold text-ink">{summary}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Elan</dt>
        <dd className="min-w-0 truncate text-right text-ink">{listingTitle}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-line pt-1.5">
        <dt className="font-semibold text-ink">Cəmi</dt>
        <dd className="font-bold text-forest tabular-nums">{formatPrice(amount)}</dd>
      </div>
    </dl>
  )
}

/** A paid order: the package works now. */
function PaidOrder({ order, summary, listingTitle, listingHref }: { order: PromotionOrder; summary: string; listingTitle: string; listingHref: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CircleCheck aria-hidden size={44} strokeWidth={1.8} className="text-success" />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-forest">Paket aktivdir</p>
        <p className="text-sm leading-[1.5] text-ink-soft">
          {summary} — «{listingTitle}». Sifariş № {order.number}, {formatPrice(order.amount)}.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:flex-row">
        <ButtonLink href="/kabinet" className="flex-1">
          Elanlarım
        </ButtonLink>
        <ButtonLink href={listingHref} variant="secondary" className="flex-1">
          Elana bax
        </ButtonLink>
      </div>
    </div>
  )
}

const UNREACHABLE: BuyPromotionResult = { ok: false, error: 'Ödənişə keçmək alınmadı. İnternet bağlantısını yoxlayın.' }

/**
 * DATA_SOURCE=api: the order's summary and «… ödə», which creates the order and sends the browser to the payment
 * provider's page (backend-contract.md 5.1). No card is asked for here: the provider's page takes it.
 */
function ProviderCheckout({
  summary,
  listingTitle,
  amount,
  buy,
  listingHref,
  signInHref,
}: {
  summary: string
  listingTitle: string
  amount: number
  buy: (orderKey: string) => Promise<BuyPromotionResult>
  listingHref: string
  signInHref: string
}) {
  const [orderKey] = useState(newOrderKey)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{ error: string; signedOut?: boolean }>()
  const [paid, setPaid] = useState<PromotionOrder>()

  const pay = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFailure(undefined)
    const result = await buy(orderKey).catch(() => UNREACHABLE)
    if (!result.ok) {
      setBusy(false)
      return setFailure(result)
    }
    if (result.paymentUrl) {
      // The button stays busy while the browser leaves for the provider's page.
      openPaymentPage(result.paymentUrl)
      return
    }
    setBusy(false)
    setPaid(result.order)
  }

  if (paid) return <PaidOrder order={paid} summary={summary} listingTitle={listingTitle} listingHref={listingHref} />

  return (
    <form onSubmit={pay} noValidate className="flex flex-col gap-5">
      <OrderSummary summary={summary} listingTitle={listingTitle} amount={amount} />
      <p className="text-sm leading-[1.55] text-ink-soft">
        Ödəniş təhlükəsiz ödəniş səhifəsində aparılır: kart məlumatını orada yazırsınız, GreenStore onu görmür. Ödənişdən sonra bu sayta qayıdacaqsınız; reklam ödəniş təsdiqlənən kimi işə düşür.
      </p>
      {failure && (
        <Notice tone="danger" title="Ödənişə keçmək alınmadı">
          {failure.error}
          {failure.signedOut && (
            <>
              {' '}
              <Link href={signInHref} className="font-semibold underline underline-offset-2">
                Daxil ol
              </Link>
            </>
          )}
        </Notice>
      )}
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy} icon={<Lock aria-hidden size={16} strokeWidth={2} />}>
        {busy ? 'Ödəniş səhifəsi açılır…' : `${formatPrice(amount)} ödə`}
      </Button>
      <p className="text-center text-xs leading-[1.5] text-muted">
        Ödənişlər bank tərəfindən qorunur. <Link href="/istifade-sertleri" className="underline underline-offset-2">Şərtlər</Link>
      </p>
    </form>
  )
}

function Checkout({
  summary,
  listingTitle,
  amount,
  buy,
  onPaid,
  listingHref,
}: {
  summary: string
  listingTitle: string
  amount: number
  buy: () => Promise<BuyPromotionResult>
  onPaid: () => void
  listingHref: string
}) {
  const { toast } = useToast()
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' })
  const [errors, setErrors] = useState<Partial<Record<'number' | 'expiry' | 'cvc', string>>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [order, setOrder] = useState<PromotionOrder>()

  const pay = async (e: FormEvent) => {
    e.preventDefault()
    const found = cardErrors(card)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`kart-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setBusy(true)
    setFailure(undefined)
    const result = await buy()
    setBusy(false)
    if (!result.ok) return setFailure(result.error)
    onPaid()
    setOrder(result.order)
    toast('Ödəniş qəbul olundu')
  }

  if (order) return <PaidOrder order={order} summary={summary} listingTitle={listingTitle} listingHref={listingHref} />

  return (
    <form onSubmit={pay} noValidate className="flex flex-col gap-5">
      <OrderSummary summary={summary} listingTitle={listingTitle} amount={amount} />
      <TextField
        id="kart-number"
        label="Kart nömrəsi"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="0000 0000 0000 0000"
        value={card.number}
        error={errors.number}
        onChange={(e) => setCard((c) => ({ ...c, number: formatCard(e.target.value) }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="kart-expiry"
          label="Bitmə tarixi"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="AA/İİ"
          value={card.expiry}
          error={errors.expiry}
          onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
        />
        <TextField
          id="kart-cvc"
          label="CVC"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          maxLength={3}
          value={card.cvc}
          error={errors.cvc}
          onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
        />
      </div>
      <TextField label="Kartın üzərindəki ad" optional autoComplete="cc-name" autoCapitalize="characters" spellCheck={false} maxLength={60} value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: nameChars(e.target.value).toUpperCase() }))} />
      <p className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] leading-[1.5] text-ink">
        <span className="font-semibold">Demo:</span> ödəniş alınmır. Sınaq kartı: 4111 1111 1111 1111, istənilən gələcək tarix və CVC.
      </p>
      {failure && (
        <Notice tone="danger" title="Ödəniş alınmadı">
          {failure}
        </Notice>
      )}
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy} icon={<Lock aria-hidden size={16} strokeWidth={2} />}>
        {busy ? 'Ödənilir…' : `${formatPrice(amount)} ödə`}
      </Button>
      <p className="text-center text-xs leading-[1.5] text-muted">
        Ödənişlər bank tərəfindən qorunur. <Link href="/istifade-sertleri" className="underline underline-offset-2">Şərtlər</Link>
      </p>
    </form>
  )
}
