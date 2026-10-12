import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { ageYears, heightRange, publicListings } from '@/data/listings'
import { formatFullDate, formatNumber, upperAz } from '@/lib/format'
import { sortListings } from '@/services/marketplace'
import { sortSellerListings } from '@/features/seller/sellerListings'
import type { BadgeTone } from '@/components/ui/Badge'
import type { NoticeTone } from '@/components/ui/Notice'
import type { Listing, ListingStatus, Spec } from '@/types'

/**
 * Detail-page gallery: the cover photo ("Örtük şəkli") followed by the other photos.
 * When Figma has a dedicated detail gallery (`*-gallery-N` files) only those are used, exactly as the frame shows
 * them; otherwise every photo the data attaches to the listing, cover first.
 */
export function listingGallery(listing: Listing): string[] {
  const dedicated = listing.images.filter((src) => /-gallery-\d+\./.test(src))
  if (dedicated.length) return dedicated
  return Array.from(new Set([listing.cover, ...listing.images].filter(Boolean)))
}

/** Azerbaijani ordinal suffix for digits: 1-ci, 3-cü, 6-cı, 9-cu, 10-cu, 40-cı … */
export function ordinal(n: number): string {
  const units = ['', 'ci', 'ci', 'cü', 'cü', 'ci', 'cı', 'ci', 'ci', 'cu']
  const tens = ['', 'cu', 'ci', 'cu', 'cı', 'ci', 'cı', 'ci', 'ci', 'cı']
  const suffix = n % 10 ? units[n % 10] : n % 100 ? tens[(n % 100) / 10] : n % 1000 ? 'cü' : 'ci'
  return `${n}-${suffix}`
}

/** "Zeytun ağacı — Olea europaea" → "Zeytun ağacı" (breadcrumb). */
export function shortTitle(title: string): string {
  return title.split(' — ')[0]
}

/** "Abşeron · 12 oktyabr 2026 · Elan № 10482 · 248 baxış" — parts without data are omitted. */
export function listingMetaLine(listing: Listing): string {
  return [
    cityName(listing.cityId),
    formatFullDate(listing.publishedAt),
    listing.number != null ? `Elan № ${listing.number}` : undefined,
    listing.views != null ? `${formatNumber(listing.views)} baxış` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

const capitalize = (s: string) => upperAz(s.charAt(0)) + s.slice(1)

/**
 * "Xüsusiyyətlər": the listing's own specs when the design provides them (Zeytun ağacı); otherwise only facts that
 * are already in the listing data (category, the height / age / "dibçəkdə" parts of the card attribute line, status).
 */
export function listingSpecs(listing: Listing): Spec[] {
  if (listing.specs?.length) return listing.specs
  const specs: Spec[] = []
  const category = categoryById(listing.categoryId)?.name
  if (category) specs.push({ label: 'Kateqoriya', value: listing.subcategory ? `${category} / ${listing.subcategory}` : category })
  const height = heightRange(listing)
  if (height) specs.push({ label: 'Hündürlük', value: height[0] === height[1] ? `${height[0]} sm` : `${height[0]}–${height[1]} sm` })
  const age = ageYears(listing)
  if (age != null) specs.push({ label: 'Yaş', value: `${age} yaş` })
  const potted = listing.attributes.find((a) => a === 'dibçəkdə')
  if (potted) specs.push({ label: 'Yetişdirmə forması', value: capitalize(potted) })
  if (listing.status === 'active') specs.push({ label: 'Mövcudluq', value: 'Satışda' })
  return specs
}

/** "Satıcının digər elanları" — the seller's other public listings in the seller page order. */
export function otherSellerListings(listing: Listing, limit = 3): Listing[] {
  if (!listing.sellerId) return []
  const own = publicListings.filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id)
  return sortSellerListings(listing.sellerId, own, 'newest').slice(0, limit)
}

/**
 * "Oxşar elanlar" — same category, excluding the listing itself and the cards already shown under
 * "Satıcının digər elanları"; VIP first, then newest (for Zeytun ağacı: Mavi küknar, Yapon ağcaqayını, Limon ağacı, Leyland sərvi).
 */
export function similarListings(listing: Listing, exclude: Listing[] = [], limit = 4): Listing[] {
  const skip = new Set([listing.id, ...exclude.map((l) => l.id)])
  const candidates = publicListings.filter((l) => l.categoryId === listing.categoryId && !skip.has(l.id))
  return sortListings(candidates, 'newest').slice(0, limit)
}

interface StatusInfo {
  badge: { tone: BadgeTone; label: string }
  /** Shown to the owner when the listing is not public */
  notice?: { tone: NoticeTone; title: string; text: string }
}

/* Badge labels follow the components frame ("Aktiv/Satışda", "Yoxlamada", "Rədd edilib", "Müddəti bitib"). */
export function statusInfo(status: ListingStatus): StatusInfo {
  switch (status) {
    case 'pending':
      return {
        badge: { tone: 'warning', label: 'Yoxlamada' },
        notice: { tone: 'warning', title: 'Elan yoxlamadadır', text: 'Yoxlama adətən 24 saat ərzində tamamlanır. Nəticə haqqında məlumat veriləcək.' },
      }
    case 'rejected':
      return {
        badge: { tone: 'danger', label: 'Rədd edilib' },
        notice: { tone: 'danger', title: 'Elan rədd edilib', text: 'Elan alıcılara göstərilmir. Düzəliş edib yenidən göndərə bilərsiniz.' },
      }
    case 'expired':
      return {
        badge: { tone: 'neutral', label: 'Müddəti bitib' },
        notice: { tone: 'warning', title: 'Elanın müddəti bitib', text: 'Elan alıcılara göstərilmir. Şəxsi kabinetdən yeniləyə bilərsiniz.' },
      }
    case 'inactive':
      return {
        badge: { tone: 'neutral', label: 'Deaktiv' },
        notice: { tone: 'warning', title: 'Elan deaktiv edilib', text: 'Elan axtarışdan gizlədilib. İstədiyiniz vaxt yenidən aktiv edə bilərsiniz.' },
      }
    default:
      return { badge: { tone: 'success', label: 'Satışda' } }
  }
}
