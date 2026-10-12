/**
 * schema.org builders. Only facts present in the data are emitted: no ratings, reviews, availability,
 * item condition or opening-hours conversions are invented (see SEO_ARCHITECTURE.md → "Structured data").
 */
import { cityName } from '@/data/cities'
import type { Category, Listing, Seller, Service, ServiceProvider } from '@/types'
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from './site'

type Thing = Record<string, unknown>

export interface Crumb {
  name: string
  /** Omitted for the current page (last item). */
  path?: string
}

/** In-page anchors ("/#saticilar") are not pages of their own, so they are left out of the list. */
export function breadcrumbJsonLd(items: Crumb[]): Thing {
  const pages = items.filter((item) => !item.path?.includes('#'))
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: pages.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  }
}

/** BreadcrumbList from the visible breadcrumb items (`{ label, to }`). */
export function crumbsJsonLd(crumbs: Array<{ label: string; to?: string }>): Thing {
  return breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, path: c.to })))
}

export function websiteJsonLd(): Thing {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: absoluteUrl('/'), description: SITE_DESCRIPTION, inLanguage: 'az' }
}

const place = (locality: string) => ({ '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: locality, addressCountry: 'AZ' } })

/** Product + Offer for a public listing: name, photos, description, category, price in AZN, seller and location. */
export function listingJsonLd(listing: Listing, opts: { images: string[]; category?: Category; seller?: Seller }): Thing {
  const url = absoluteUrl(`/elanlar/${listing.slug}`)
  // Individual sellers are private persons: their names stay out of structured data.
  const business = opts.seller?.type === 'business' ? opts.seller : undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    url,
    image: opts.images.map(absoluteUrl),
    ...(listing.description?.length ? { description: listing.description.join(' ') } : {}),
    ...(opts.category ? { category: [opts.category.name, listing.subcategory].filter(Boolean).join(' > ') } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: listing.price,
      priceCurrency: 'AZN',
      availableAtOrFrom: place(cityName(listing.cityId)),
      ...(business ? { seller: { '@type': 'Organization', name: business.name, url: absoluteUrl(`/saticilar/${business.slug}`) } } : {}),
    },
  }
}

/**
 * Business sellers only (individuals are private persons). LocalBusiness when the profile has an address,
 * Organization otherwise. Working hours stay out: the free-text value is not in schema.org's format.
 */
export function sellerJsonLd(seller: Seller): Thing | undefined {
  if (seller.type !== 'business') return undefined
  return {
    '@context': 'https://schema.org',
    '@type': seller.address ? 'LocalBusiness' : 'Organization',
    name: seller.name,
    url: absoluteUrl(`/saticilar/${seller.slug}`),
    image: absoluteUrl(seller.coverImage ?? seller.image),
    ...(seller.about ? { description: seller.about } : {}),
    ...(seller.phone ? { telephone: seller.phone } : {}),
    ...(seller.email ? { email: seller.email } : {}),
    address: { '@type': 'PostalAddress', addressLocality: seller.address ?? cityName(seller.cityId), addressCountry: 'AZ' },
  }
}

/** Service with its category, service areas and (company) provider. Price labels such as "25 ₼/m²-dən" are not offers. */
export function serviceJsonLd(service: Service, opts: { categoryName?: string; provider?: ServiceProvider }): Thing {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    url: absoluteUrl(`/xidmetler/${service.slug}`),
    image: service.images.map(absoluteUrl),
    ...(service.description?.length ? { description: service.description.join(' ') } : {}),
    ...(opts.categoryName ? { serviceType: opts.categoryName } : {}),
    areaServed: service.areas.map((name) => ({ '@type': 'Place', name })),
    ...(opts.provider?.kind === 'company' ? { provider: { '@type': 'Organization', name: opts.provider.name } } : {}),
  }
}
