import { cities } from '@/data/cities'
import { phoneValue } from '@/lib/phone'
import type { Listing } from '@/types'
import { PLANT_CATEGORIES, SERVICE_CATEGORY, unitsFor } from './attributes'
import { createDraft, MAX_PHOTOS, type DraftPhoto, type PostingDraft } from './draft'
import { newPhotoId, photoStore } from './photos'

/**
 * «Redaktə et» in «Elanlarım»: a published listing back into the posting draft. Category stays locked (as on
 * turbo.az, the make and model can't change): the seller edits everything else and the listing goes back to review.
 */
export function listingToDraft(listing: Listing, contact: { name?: string; phone?: string }): PostingDraft {
  const base = createDraft(contact)
  const service = listing.categoryId === SERVICE_CATEGORY
  const plant = listing.plant
  const attrs: Record<string, string> = {}
  if (plant && PLANT_CATEGORIES.includes(listing.categoryId)) {
    if (plant.species) attrs.species = plant.species
    if (plant.heightCm) {
      attrs.heightMin = String(plant.heightCm.min)
      if (plant.heightCm.max) attrs.heightMax = String(plant.heightCm.max)
    }
    if (plant.ageYears != null) attrs.age = String(plant.ageYears)
    if (plant.rootSystem) attrs.rootSystem = plant.rootSystem
    if (plant.potLitres) attrs.potLitres = String(plant.potLitres)
    if (plant.sun) attrs.sun = plant.sun
    if (plant.water) attrs.water = plant.water
    if (plant.frostHardinessC != null) attrs.frost = String(plant.frostHardinessC)
    if (plant.foliage) attrs.foliage = plant.foliage
    if (plant.plantingMonths?.length) attrs.plantingMonths = plant.plantingMonths.join(',')
  }
  if (!service) attrs.availability = 'satisda'
  return {
    ...base,
    kind: service ? 'service' : 'product',
    categoryId: listing.categoryId,
    subcategory: listing.subcategory ?? '',
    title: listing.title,
    description: (listing.description ?? []).join('\n\n'),
    attrs,
    priceType: listing.priceType ?? (listing.price ? 'fixed' : 'agreement'),
    price: listing.price ? String(listing.price) : '',
    priceUnit: listing.priceUnit ?? unitsFor(listing.categoryId)[0] ?? '',
    wholesale: Boolean(listing.wholesale),
    wholesalePrice: listing.wholesale ? String(listing.wholesale.price) : '',
    wholesaleMin: listing.wholesale ? String(listing.wholesale.minQuantity) : '',
    quantity: listing.quantityAvailable != null ? String(listing.quantityAvailable) : '',
    cityId: cities.some((c) => c.id === listing.cityId) ? listing.cityId : '',
    area: listing.area ?? '',
    delivery: Boolean(listing.deliveryAvailable || listing.deliveryAreas),
    deliveryAreas: listing.deliveryAreas ?? '',
    planting: Boolean(listing.plantingAvailable),
    contactName: listing.contactName ?? base.contactName,
    phone: listing.contactPhone ? phoneValue(listing.contactPhone) : base.phone,
    whatsapp: listing.whatsapp ?? true,
    hidePhone: Boolean(listing.phoneHidden),
    rulesAccepted: false,
    reachedStep: 6,
    editing: { id: listing.id, number: listing.number, slug: listing.slug },
  }
}

/** Copies a listing's photos into the draft's photo store (so they can be reordered and removed like new ones). */
export async function importPhotos(urls: string[]): Promise<DraftPhoto[]> {
  const photos: DraftPhoto[] = []
  for (const url of urls.slice(0, MAX_PHOTOS)) {
    try {
      const blob = await (await fetch(url)).blob()
      const bitmap = await createImageBitmap(blob)
      const photo = { id: newPhotoId(), name: url.split('/').pop() ?? 'sekil', width: bitmap.width, height: bitmap.height }
      bitmap.close()
      await photoStore.put(photo.id, blob)
      photos.push(photo)
    } catch {
      /* a photo that can't be read is left out; the seller sees the rest */
    }
  }
  return photos
}
