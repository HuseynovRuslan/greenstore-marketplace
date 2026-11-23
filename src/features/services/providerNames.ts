import type { MarketplaceRepository } from '@/services/repository'
import type { Service } from '@/types'

/**
 * Who provides each service, for the cards' «Yaşıl Məkan · Bakı, Abşeron» line: `Service` carries only the provider's
 * id, so the page asks for each provider once (cached reads). Server only.
 */
export async function loadProviderNames(repo: MarketplaceRepository, services: Service[]): Promise<Record<string, string>> {
  const ids = [...new Set(services.map((s) => s.providerId))]
  const names = await Promise.all(ids.map(async (id) => [id, (await repo.getServiceProvider(id))?.name ?? ''] as const))
  return Object.fromEntries(names.filter(([, name]) => name))
}
