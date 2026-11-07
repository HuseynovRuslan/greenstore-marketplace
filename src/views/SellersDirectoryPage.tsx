import Link from 'next/link'
import { BadgeCheck, Check, Store } from 'lucide-react'
import { cardFocusClass, stretchedLinkClass } from '@/components/cards/ListingCard'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { UnderlineTabs } from '@/components/ui/UnderlineTabs'
import { cities, cityName } from '@/data/cities'
import { ordinal } from '@/features/listing/detail'
import { SellerAvatar } from '@/features/listing/SellerSummary'
import { offerLabels } from '@/features/seller/hours'
import { Breadcrumb } from '@/features/seller/ui'
import { optionClass } from '@/features/search/filterStyles'
import { cn, formatNumber } from '@/lib/format'
import type { BusinessKind, Seller } from '@/types'

export const kindTabs: Array<{ value: BusinessKind | ''; label: string; param: string }> = [
  { value: '', label: 'Hamısı', param: '' },
  { value: 'nursery', label: 'Tingçiliklər', param: 'tingcilik' },
  { value: 'garden-centre', label: 'Bağ mərkəzləri', param: 'bag-merkezi' },
  { value: 'landscaping', label: 'Landşaft şirkətləri', param: 'landsaft' },
]

export function parseDirectoryQuery(params: URLSearchParams) {
  const kind = kindTabs.find((k) => k.param && k.param === params.get('nov'))?.value ?? ''
  const city = cities.find((c) => c.id === params.get('seher'))?.id ?? ''
  return { kind, city }
}

const hrefFor = (kind: BusinessKind | '', city: string) => {
  const q = new URLSearchParams()
  const param = kindTabs.find((k) => k.value === kind)?.param
  if (param) q.set('nov', param)
  if (city) q.set('seher', city)
  const s = q.toString()
  return s ? `/saticilar?${s}` : '/saticilar'
}

/** A business in the directory: cover, logo, name with the verified mark, kind and city, offers, listing count. */
function SellerTile({ seller }: { seller: Seller }) {
  return (
    <article
      className={cn(
        'group/card relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow,scale] duration-(--dur-base) ease-out hover:border-olive hover:shadow-card-hover has-[a:active]:scale-[0.99] motion-reduce:has-[a:active]:scale-100',
        cardFocusClass,
      )}
    >
      <div className="aspect-[16/7] min-h-0 overflow-hidden bg-mint">
        {(seller.coverImage ?? seller.image) && <img src={seller.coverImage ?? seller.image} alt="" loading="lazy" className="size-full object-cover" />}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="-mt-11 w-fit rounded-[14px] bg-surface p-1">
          <SellerAvatar name={seller.name} logo={seller.logo} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-1.5 text-[17px] leading-[1.3] font-semibold text-ink">
            <Link href={`/saticilar/${seller.slug}`} className={stretchedLinkClass}>
              {seller.name}
            </Link>
            {seller.verified && <BadgeCheck aria-label="Təsdiqlənmiş" role="img" size={17} strokeWidth={2} className="shrink-0 text-success" />}
          </h2>
          <p className="text-[13px] leading-[1.4] text-muted">{[seller.kind, cityName(seller.cityId)].filter(Boolean).join(' · ')}</p>
        </div>
        {seller.offers && seller.offers.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {seller.offers.slice(0, 3).map((o) => (
              <li key={o} className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-xs leading-[normal] font-medium text-forest">
                <Check aria-hidden size={12} strokeWidth={2.6} />
                {offerLabels[o]}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto border-t border-line pt-3 text-[13px] leading-[1.4] text-ink-soft">
          {seller.activeListings > 0 && (
            <>
              <span className="font-semibold text-ink tabular-nums">{formatNumber(seller.activeListings)}</span> aktiv elan
              {seller.memberSince ? ' · ' : ''}
            </>
          )}
          {seller.memberSince ? `${ordinal(seller.memberSince)} ildən GreenStore-da` : ''}
        </p>
      </div>
    </article>
  )
}

/**
 * /saticilar — the businesses on GreenStore (turbo.az's dealer directory, for plants): tabs by kind (nurseries,
 * garden centres, landscaping companies) with counts, city chips, cards linking to each business page. Filters live
 * in the URL (?nov=, ?seher=); server-rendered.
 */
export default function SellersDirectoryPage({ sellers, kind, city }: { sellers: Seller[]; kind: BusinessKind | ''; city: string }) {
  const inCity = sellers.filter((s) => !city || s.cityId === city)
  const shown = inCity.filter((s) => !kind || s.businessKind === kind)
  const countOf = (k: BusinessKind | '') => inCity.filter((s) => !k || s.businessKind === k).length

  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-5 pt-3 pb-14 md:pt-5">
      <Breadcrumb
        items={[
          { label: 'Ana səhifə', to: '/' },
          { label: 'Satıcılar' },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[30px]">Tingçiliklər, bağ mərkəzləri və landşaft şirkətləri</h1>
        <p className="max-w-[62ch] text-[15px] leading-[1.5] text-ink-soft">Bitkini birbaşa yetişdirəndən alın: profil, iş saatları, ünvan və bütün elanları bir səhifədə.</p>
      </div>

      <UnderlineTabs
        label="Biznesin növü"
        tabs={kindTabs.map((k) => ({ key: k.param || 'hamisi', label: k.label, count: countOf(k.value), href: hrefFor(k.value, city), active: k.value === kind }))}
      />

      <nav aria-label="Şəhər" className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {[{ id: '', name: 'Bütün şəhərlər' }, ...cities].map((c) => (
          <Link
            key={c.id || 'hamisi'}
            href={hrefFor(kind, c.id)}
            scroll={false}
            aria-current={c.id === city ? 'page' : undefined}
            className={cn(optionClass(c.id === city), 'inline-flex shrink-0 items-center pointer-coarse:h-11')}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((s) => (
            <li key={s.id}>
              <SellerTile seller={s} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex justify-center py-6">
          <EmptyState
            icon={<Store aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
            title="Bu seçimlə satıcı tapılmadı"
            description="Başqa şəhər və ya növ seçin. Yeni bizneslər hər həftə qoşulur."
            action={
              <ButtonLink href="/saticilar" fullWidth>
                Bütün satıcılar
              </ButtonLink>
            }
          />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-sand p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex flex-col gap-1">
          <p className="text-[17px] leading-[1.3] font-semibold text-forest">Tingçilik və ya bağ mərkəziniz var?</p>
          <p className="text-sm leading-[1.5] text-ink-soft">Biznes hesabı açın: profil səhifəsi, bütün elanlarınız bir yerdə və təsdiq nişanı.</p>
        </div>
        <ButtonLink href="/qeydiyyat" className="shrink-0">
          Biznes hesabı aç
        </ButtonLink>
      </div>
    </div>
  )
}
