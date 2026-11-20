'use server'

import { parseSearchState } from '@/features/search/searchState'
import { getServiceMatches } from '@/features/search/serviceMatches'
import { getRepository } from '@/services/repository'
import { wordOnlySearch } from './heroSearch'

const CATALOGUE = '/elanlar?'

/**
 * Where «Hamısı» on the home page searches. There is no combined results page, so it opens the product catalogue;
 * but when the word finds no product and does find services («qazon»), it opens /xidmetler instead. Only a word
 * (and a city) can switch: a category, price, height or delivery belongs to the product search. Public and
 * read-only; `url` is the /elanlar URL heroSearchUrl built, and anything else comes back as plain /elanlar.
 */
export async function allTabSearchUrl(url: string): Promise<string> {
  if (typeof url !== 'string' || url.length > 1000 || !url.startsWith(CATALOGUE)) return '/elanlar'
  if (!wordOnlySearch(url)) return url
  const state = parseSearchState(new URLSearchParams(url.slice(CATALOGUE.length)))
  const products = await getRepository().searchListings({ state, sort: 'newest', page: 1, pageSize: 1 })
  if (products.total > 0) return url
  return (await getServiceMatches(state))?.href ?? url
}
