import { Search } from 'lucide-react'
import { InfoNotice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { NavButton } from '@/components/ui/NavButton'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { formatNumber } from '@/lib/format'
import { Breadcrumbs, PageContent, PageHeading } from '@/features/services/ui'
import { ServiceListingCard } from '@/features/services/ServiceListingCard'
import { ServiceCategoryToggles, ServiceFilterBar, ServicesSearchForm } from '@/features/services/ServicesControls'
import { platformServiceTotal } from '@/features/services/query'
import type { ServiceSearchResult } from '@/services/repository'

export const servicesCrumbs = [{ label: 'Ana səhifə', to: '/' }, { label: 'Landşaft və bağçılıq xidmətləri' }]

/**
 * Figma "YARPAQ · Xidmətlər · 1440" — services catalogue. Server-rendered from the URL (`query`);
 * the search form, category toggles, tabs and sort are client islands that navigate to a new URL.
 */
export default function ServicesPage({ query, result }: { query: string; result: ServiceSearchResult }) {
  return (
    <PageContent>
      <Breadcrumbs items={servicesCrumbs} />
      <PageHeading
        title="Bağınızın işini peşəkara həvalə edin"
        subtitle={`Dizayndan gündəlik qulluğa — Azərbaycanda ${formatNumber(platformServiceTotal)} xidmət elanı`}
      />

      {/* "Xidmət axtarışı" */}
      <ServicesSearchForm query={query} />

      {/* "Xidmət kateqoriyaları" */}
      <ServiceCategoryToggles query={query} />

      {/* "Xidmət filtrləri" */}
      <ServiceFilterBar query={query} displayTotal={result.displayTotal} />

      {/* "Xidmət elanları" */}
      <div id="xidmet-elanlari" role="tabpanel" className="w-full scroll-mt-28">
        {result.items.length ? (
          <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((s) => (
              <ServiceListingCard key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <EmptyState
              icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
              title="Uyğun elan tapılmadı"
              description="Filtrləri dəyişin və ya başqa açar söz sınayın."
              action={
                <NavButton href="/xidmetler" fullWidth>
                  Filtrləri təmizlə
                </NavButton>
              }
            />
          </div>
        )}
      </div>

      {result.items.length > 0 && (
        <PaginationLinks page={result.page} pageCount={result.pageCount} basePath="/xidmetler" query={query} scrollTargetId="xidmet-elanlari" />
      )}

      <InfoNotice title="Xidmət qiymətləri necə göstərilir?">
        Başlanğıc qiymət işin həcminə görə dəyişə bilər. Dəqiq təklif üçün xidmət göstərənlə birbaşa əlaqə saxlayın.
      </InfoNotice>
    </PageContent>
  )
}
