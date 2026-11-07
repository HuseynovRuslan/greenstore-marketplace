'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Heart,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Phone,
  Play,
  RefreshCw,
  Rocket,
  Trash2,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Popover } from '@/components/ui/Popover'
import { useToast } from '@/components/ui/Toast'
import { cityName } from '@/data/cities'
import { promotionPackage } from '@/data/promotions'
import { listingPrice } from '@/features/listing/facts'
import { ownerPreviewPath } from '@/features/listing/ownerPreview'
import { STEPS, type PostingDraft } from '@/features/posting/draft'
import { cn, formatDayMonth, formatNumber } from '@/lib/format'
import { useBrokenImage } from '@/lib/useBrokenImage'
import type { Listing, ListingStats } from '@/types'
import { actionsFor, daysLeft, expiryLabel, statusBadges, type CabinetAction } from './model'

const actionClass =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] leading-[normal] font-semibold whitespace-nowrap transition-[background-color,border-color,color,scale] duration-(--dur-fast) ease-out active:scale-[0.97] pointer-coarse:h-11 motion-reduce:active:scale-100'
const quiet = cn(actionClass, 'border-line bg-surface text-forest hover:border-olive')
/** Forest fill only for the action that puts a listing back on the site (fix, renew, activate, continue a draft). */
const strong = cn(actionClass, 'border-forest bg-forest text-white hover:bg-forest-hover')
/** «Önə çıxar» in the «Önə çıxan» badge colours: an offer, not the one thing to do on every row. */
const promote = cn(actionClass, 'border-olive/40 bg-vip text-olive-text hover:border-olive')

/** The row's photo; no photo, or one that fails to load, shows the photo icon on mint. */
function Thumb({ src }: { src?: string }) {
  const { failed, imgProps } = useBrokenImage()
  return (
    <div className="size-[76px] shrink-0 overflow-hidden rounded-lg bg-mint md:h-[84px] md:w-[112px]">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" {...imgProps} className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted">
          <ImageIcon aria-hidden size={22} strokeWidth={1.6} />
        </span>
      )}
    </div>
  )
}

export interface RowHandlers {
  renew: (id: string) => void
  deactivate: (id: string) => void
  activate: (id: string) => void
  remove: (id: string) => void
  startEdit: (listing: Listing) => Promise<void>
}

/** One of the owner's listings: photo, status and promotion, title, price, meta, expiry or rejection reason, numbers, actions. */
export function ListingRowCard({ listing, stats, now, handlers }: { listing: Listing; stats?: ListingStats; now: number; handlers: RowHandlers }) {
  const router = useRouter()
  const { toast } = useToast()
  const [dialog, setDialog] = useState<'stats' | 'remove' | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const badge = statusBadges[listing.status]
  const price = listingPrice(listing)
  const expiry = listing.status === 'active' ? expiryLabel(daysLeft(listing, now)) : undefined
  const promo = listing.promotion && Date.parse(listing.promotion.until) > now ? listing.promotion : undefined
  const href = listing.status === 'active' ? `/elanlar/${listing.slug}` : ownerPreviewPath(listing.slug)

  const edit = async () => {
    setBusy(true)
    await handlers.startEdit(listing)
    router.push('/elan-yerlesdir/2')
  }

  const buttons: Record<CabinetAction, ReactNode> = {
    promote: (
      <Link key="promote" href={`/reklam?elan=${listing.id}`} className={promote}>
        <Rocket aria-hidden size={15} strokeWidth={2} />
        Önə çıxar
      </Link>
    ),
    renew: (
      <button
        key="renew"
        type="button"
        className={strong}
        onClick={() => {
          handlers.renew(listing.id)
          toast('Elan yeniləndi: daha 30 gün saytda')
        }}
      >
        <RefreshCw aria-hidden size={15} strokeWidth={2} />
        Yenilə (pulsuz)
      </button>
    ),
    fix: (
      <button key="fix" type="button" className={strong} onClick={edit} disabled={busy}>
        <Wrench aria-hidden size={15} strokeWidth={2} />
        {busy ? 'Açılır…' : 'Düzəlt və göndər'}
      </button>
    ),
    activate: (
      <button
        key="activate"
        type="button"
        className={strong}
        onClick={() => {
          handlers.activate(listing.id)
          toast('Elan yenidən saytdadır')
        }}
      >
        <Play aria-hidden size={15} strokeWidth={2} />
        Aktiv et
      </button>
    ),
    preview: (
      <Link key="preview" href={href} className={quiet}>
        <Eye aria-hidden size={15} strokeWidth={2} />
        Önizləmə
      </Link>
    ),
    edit: (
      <button key="edit" type="button" className={quiet} onClick={edit} disabled={busy}>
        <Pencil aria-hidden size={15} strokeWidth={2} />
        {busy ? 'Açılır…' : 'Redaktə et'}
      </button>
    ),
    stats: (
      <button key="stats" type="button" className={quiet} onClick={() => setDialog('stats')} aria-haspopup="dialog">
        <BarChart3 aria-hidden size={15} strokeWidth={2} />
        Statistika
      </button>
    ),
    deactivate: (
      <button
        key="deactivate"
        type="button"
        className={quiet}
        onClick={() => {
          handlers.deactivate(listing.id)
          toast('Elan axtarışdan gizlədildi')
        }}
      >
        <EyeOff aria-hidden size={15} strokeWidth={2} />
        Deaktiv et
      </button>
    ),
    remove: (
      <button key="remove" type="button" className={cn(quiet, 'text-danger hover:border-danger')} onClick={() => setDialog('remove')} aria-haspopup="dialog">
        <Trash2 aria-hidden size={15} strokeWidth={2} />
        Sil
      </button>
    ),
  }

  const actions = actionsFor(listing.status)
  // Four or more actions: the rare and the destructive one («Deaktiv et», «Sil») go under «Daha çox», so a row shows
  // the three things people do most and «Sil» is never one tap away from «Statistika».
  const tucked: CabinetAction[] = actions.length > 3 ? actions.filter((a) => a === 'deactivate' || a === 'remove') : []
  const shown = actions.filter((a) => !tucked.includes(a))
  const menuItem =
    'flex min-h-11 w-full items-center gap-2.5 rounded-option px-3 text-left text-sm font-semibold transition-colors duration-(--dur-fast) hover:bg-mint'

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex gap-3 md:gap-4">
        <Thumb src={listing.thumbnail ?? listing.cover} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {promo && (
              <span className="inline-flex items-center gap-1 rounded-[5px] bg-vip px-2 py-[5px] text-xs leading-[normal] font-semibold whitespace-nowrap text-olive-text">
                <Rocket aria-hidden size={12} strokeWidth={2.2} />
                {promotionPackage(promo.packageId)?.name}
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 text-[15px] leading-[1.35] font-semibold break-words text-ink" title={listing.title}>
            <Link href={href} className="hover:text-forest hover:underline">
              {listing.title}
            </Link>
          </h3>
          <p className="text-[13px] leading-[1.4] text-muted">
            {[listing.number ? `№ ${listing.number}` : undefined, cityName(listing.cityId), formatDayMonth(listing.updatedAt ?? listing.publishedAt)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="shrink-0 text-right text-[17px] leading-[1.25] font-bold text-forest tabular-nums max-md:hidden">
          {price.amount}
          {price.unit && <span className="block text-xs font-normal text-muted">{price.unit}</span>}
        </p>
      </div>

      {listing.status === 'rejected' && (
        <p className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] leading-[1.5] text-ink">
          <CircleAlert aria-hidden size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" />
          <span>
            <span className="font-semibold">Səbəb: </span>
            {listing.rejectionReason ?? 'Elan qaydalara uyğun deyil. Düzəldib yenidən göndərin.'}
          </span>
        </p>
      )}
      {listing.status === 'pending' && (
        <p className="flex items-center gap-2 text-[13px] leading-[1.4] text-warning">
          <Clock3 aria-hidden size={15} strokeWidth={2} />
          Moderator adətən 1 saat ərzində yoxlayır.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-[normal] text-ink-soft">
          <p className="font-bold text-forest tabular-nums md:hidden">
            {price.amount} {price.unit && <span className="font-normal text-muted">{price.unit}</span>}
          </p>
          {stats && (
            <>
              <span className="inline-flex items-center gap-1.5 tabular-nums" title="Baxış">
                <Eye aria-hidden size={14} strokeWidth={1.8} /> {formatNumber(stats.views)} <span className="sr-only">baxış</span>
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums" title="Nömrəyə baxış">
                <Phone aria-hidden size={14} strokeWidth={1.8} /> {formatNumber(stats.phoneReveals)} <span className="sr-only">nömrəyə baxış</span>
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums" title="Seçilmişlərdə">
                <Heart aria-hidden size={14} strokeWidth={1.8} /> {formatNumber(stats.favourites)} <span className="sr-only">seçilmişlərdə</span>
              </span>
            </>
          )}
          {promo && <span className="text-olive-text">Reklam {formatDayMonth(promo.until)}-dək</span>}
          {expiry && <span className={cn('font-medium', expiry.soon ? 'text-warning' : 'text-muted')}>{expiry.text}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {shown.map((a) => buttons[a])}
          {tucked.length > 0 && (
            <Popover
              open={moreOpen}
              onOpenChange={setMoreOpen}
              label={`«${listing.title}»: digər əməliyyatlar`}
              align="end"
              panelClassName="w-56 p-1.5"
              trigger={(props) => (
                <button {...props} className={quiet}>
                  <MoreHorizontal aria-hidden size={15} strokeWidth={2} />
                  Daha çox
                </button>
              )}
            >
              {(close) => (
                <div className="flex flex-col">
                  {tucked.includes('deactivate') && (
                    <button
                      type="button"
                      className={cn(menuItem, 'text-forest')}
                      onClick={() => {
                        close()
                        handlers.deactivate(listing.id)
                        toast('Elan axtarışdan gizlədildi')
                      }}
                    >
                      <EyeOff aria-hidden size={16} strokeWidth={2} />
                      Deaktiv et
                    </button>
                  )}
                  {tucked.includes('remove') && (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      className={cn(menuItem, 'text-danger hover:bg-danger-soft')}
                      onClick={() => {
                        // Focus goes back to «Daha çox» first, so the confirm dialog returns it there.
                        close()
                        setDialog('remove')
                      }}
                    >
                      <Trash2 aria-hidden size={16} strokeWidth={2} />
                      Elanı sil
                    </button>
                  )}
                </div>
              )}
            </Popover>
          )}
        </div>
      </div>

      <Dialog open={dialog === 'stats'} onClose={() => setDialog(null)} title="Elanın statistikası" className="sm:max-w-[520px]">
        {stats ? <StatsBody title={listing.title} stats={stats} /> : <p className="text-sm text-muted">Statistika hələ yoxdur.</p>}
      </Dialog>
      <Dialog open={dialog === 'remove'} onClose={() => setDialog(null)} title="Elanı silək?">
        <p className="text-[15px] leading-[1.5] text-ink">
          «{listing.title}» saytdan götürüləcək. Silinən elanı bərpa etmək olmur; satılıbsa, «Deaktiv et» də kifayətdir.
        </p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Elan qalsın
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              handlers.remove(listing.id)
              setDialog(null)
              toast('Elan silindi')
            }}
          >
            Elanı sil
          </Button>
        </div>
      </Dialog>
    </li>
  )
}

/** Totals and a 14-day views chart (bars with the numbers as text; the chart has a text summary and a table). */
function StatsBody({ title, stats }: { title: string; stats: ListingStats }) {
  const max = Math.max(1, ...stats.viewsByDay.map((d) => d.views))
  const last7 = stats.viewsByDay.slice(-7).reduce((s, d) => s + d.views, 0)
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-[1.5] text-ink-soft">{title}</p>
      <dl className="grid grid-cols-3 gap-2.5">
        {[
          ['Baxış', stats.views],
          ['Nömrəyə baxış', stats.phoneReveals],
          ['Seçilmişlərdə', stats.favourites],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-lg bg-cream p-3">
            <dt className="text-xs leading-[1.3] text-muted">{label}</dt>
            <dd className="text-[22px] leading-[1.1] font-bold text-forest tabular-nums">{formatNumber(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-[13px] leading-[1.4] font-semibold text-ink">Son 14 gündə baxışlar · son 7 gündə {formatNumber(last7)}</figcaption>
        <div aria-hidden className="flex h-28 items-end gap-1">
          {stats.viewsByDay.map((d, i) => (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div
                className={cn('rounded-t-[3px]', i === stats.viewsByDay.length - 1 ? 'bg-forest' : 'bg-olive/70')}
                style={{ height: `${Math.max(3, (d.views / max) * 100)}%` }}
                title={`${formatDayMonth(d.date)}: ${d.views}`}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="flex justify-between text-[11px] text-muted">
          <span>{formatDayMonth(stats.viewsByDay[0].date)}</span>
          <span>bu gün</span>
        </div>
        <table className="sr-only">
          <caption>Günlər üzrə baxışlar</caption>
          <tbody>
            {stats.viewsByDay.map((d) => (
              <tr key={d.date}>
                <th scope="row">{formatDayMonth(d.date)}</th>
                <td>{d.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </div>
  )
}

/** The unsent posting draft, as a row: what step it stopped at, «Davam et», «Sil». */
export function DraftRowCard({ draft, onDiscard }: { draft: PostingDraft; onDiscard: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const step = draft.reachedStep
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-surface p-3 md:p-4">
      <div className="flex gap-3 md:gap-4">
        <Thumb />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Badge tone="neutral" className="self-start">
            {draft.editing ? 'Redaktə · qaralama' : 'Qaralama'}
          </Badge>
          <h3 className="line-clamp-2 text-[15px] leading-[1.35] font-semibold break-words text-ink">{draft.title || 'Adsız elan'}</h3>
          <p className="text-[13px] leading-[1.4] text-muted">
            Addım {step} / {STEPS.length} · {STEPS[step - 1].title}
            {draft.savedAt ? ` · ${formatDayMonth(draft.savedAt)}` : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        <Link href={`/elan-yerlesdir/${step}`} className={strong}>
          <Play aria-hidden size={15} strokeWidth={2} />
          Davam et
        </Link>
        <button type="button" className={cn(quiet, 'text-danger hover:border-danger')} onClick={() => setConfirm(true)} aria-haspopup="dialog">
          <Trash2 aria-hidden size={15} strokeWidth={2} />
          Sil
        </button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Qaralamanı silək?">
        <p className="text-[15px] leading-[1.5] text-ink">Yazdıqlarınız və şəkillər silinəcək.</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Qaralama qalsın
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onDiscard()
              setConfirm(false)
            }}
          >
            Qaralamanı sil
          </Button>
        </div>
      </Dialog>
    </li>
  )
}
