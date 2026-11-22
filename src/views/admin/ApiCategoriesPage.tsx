import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { AdminPage, PanelTitle } from '@/features/admin/AdminUi'
import { CategoryEditor } from '@/features/admin/CategoryEditor'
import {
  categoryHref,
  enabledFilterNames,
  findAdminCategory,
  kindLabels,
  lastUpdated,
  matchesAdminCategory,
  readCategoryParams,
  type CategoryPageState,
} from '@/features/admin/categoriesApi'
import { rowClass } from '@/features/admin/format'
import { staffGate } from '@/features/admin/StaffGate'
import { adminRepository } from '@/services/adminRepository'
import { getRepository } from '@/services/repository'
import { cn, formatFullDate, formatNumber } from '@/lib/format'
import type { AdminCategory } from '@/types'

const BASE = '/idareetme/kateqoriyalar'

function CategoryRow({ row, state }: { row: AdminCategory; state: CategoryPageState }) {
  const selected = row.id === state.item || row.subcategories?.some((s) => s.id === state.item)
  const filters = enabledFilterNames(row)
  return (
    <li>
      <article className={rowClass(Boolean(selected), 'line', 'flex flex-col gap-3 rounded-lg p-[15px]')}>
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-[5px] leading-[1.5]">
            <h3 className="text-[14px] font-semibold break-words text-ink">{row.names.az}</h3>
            <p className="text-[12px] text-muted">
              {[kindLabels[row.kind], `${formatNumber(row.listingCount)} aktiv elan`, !row.names.ru || !row.names.en ? 'tərcümə yoxdur' : undefined].filter(Boolean).join(' · ')}
            </p>
            {filters.length > 0 && <p className="text-[11px] text-muted">Filtrlər: {filters.join(' · ')}</p>}
          </div>
          <div className="flex items-center justify-between gap-4 md:contents">
            <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
            <Link href={categoryHref(state, { item: row.id })} scroll={false} aria-current={row.id === state.item ? 'true' : undefined} aria-label={`Redaktə et: ${row.names.az}`} className={buttonClass('secondary')}>
              Redaktə et
            </Link>
          </div>
        </div>
        <ul aria-label={`${row.names.az}: alt kateqoriyalar`} className="flex flex-wrap gap-2">
          {(row.subcategories ?? []).map((sub) => (
            <li key={sub.id}>
              <Link
                href={categoryHref(state, { item: sub.id })}
                scroll={false}
                aria-current={sub.id === state.item ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-lg border px-2.5 text-[12px] leading-[1.3] transition-colors duration-(--dur-fast)',
                  sub.id === state.item ? 'border-forest bg-mint font-semibold text-forest' : 'border-line bg-surface text-ink hover:border-olive',
                  !sub.isActive && 'text-muted line-through',
                )}
              >
                {sub.names.az} · {formatNumber(sub.listingCount)}
              </Link>
            </li>
          ))}
          <li>
            <Link href={categoryHref(state, { item: 'new', parent: row.id })} scroll={false} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 text-[12px] leading-[1.3] text-forest hover:border-forest">
              <Plus aria-hidden size={14} strokeWidth={2} />
              Alt kateqoriya
            </Link>
          </li>
        </ul>
      </article>
    </li>
  )
}

/**
 * /idareetme/kateqoriyalar with DATA_SOURCE=api (backend-contract.md 3.5): the API's categories, inactive ones too,
 * rendered on the server for an admin; a moderator is told the section is for admins. The search, the row in the edit
 * panel and a new row are links (the address keeps them); the edit panel is the one client island.
 */
export default async function ApiCategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = readCategoryParams(await searchParams)
  const me = await getRepository().getMe()
  const gate = staffGate(me, categoryHref(state), 'admin')
  if (gate || !me) return gate

  const rows = await adminRepository.listCategories()
  const visible = rows.filter((r) => matchesAdminCategory(r, state.q))
  const subcategoryCount = rows.reduce((sum, r) => sum + (r.subcategories?.length ?? 0), 0)
  const updated = lastUpdated(rows)
  const isNew = state.item === 'new'
  const editing = isNew ? undefined : (findAdminCategory(rows, state.item) ?? (state.item ? undefined : visible[0]))
  const parent = isNew ? findAdminCategory(rows, state.parent) : undefined

  return (
    <AdminPage
      title="Kateqoriya idarəetməsi"
      subtitle={`${rows.length} əsas kateqoriya · ${subcategoryCount} alt kateqoriya${updated ? ` · Son yenilənmə: ${formatFullDate(updated)}` : ''}`}
    >
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-end">
        <form action={BASE} role="search" className="flex w-full gap-2 md:flex-1">
          <label htmlFor="category-q" className="sr-only">
            Kateqoriya axtarışı
          </label>
          <input
            id="category-q"
            name="q"
            type="search"
            defaultValue={state.q}
            placeholder="Ad və ya alt kateqoriya"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-forest focus-visible:outline-none"
          />
          <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover">
            <Search aria-hidden size={16} strokeWidth={2} />
            Axtar
          </button>
        </form>
        <Link href={categoryHref(state, { item: 'new', parent: undefined })} scroll={false} className={buttonClass('primary')}>
          <Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />
          Kateqoriya əlavə et
        </Link>
      </div>

      <div className="grid w-full items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="category-list-title" className="flex w-full min-w-0 flex-col gap-2">
          <h2 id="category-list-title" className="sr-only">
            Kateqoriyalar siyahısı
          </h2>
          {visible.length === 0 ? (
            <p className="w-full rounded-lg border border-line bg-surface p-[15px] text-sm leading-[1.5] text-muted">Axtarışa uyğun kateqoriya tapılmadı.</p>
          ) : (
            <ul className="flex w-full flex-col gap-2">
              {visible.map((row) => (
                <CategoryRow key={row.id} row={row} state={state} />
              ))}
            </ul>
          )}
        </section>

        <div className="flex w-full min-w-0 flex-col gap-4">
          {state.saved && editing && (
            <Notice tone="success" title={state.saved === 'created' ? 'Kateqoriya əlavə edildi' : 'Dəyişikliklər yadda saxlanıldı'}>
              “{editing.names.az}” {state.saved === 'created' ? 'siyahıya əlavə olundu' : 'yeniləndi'}. Saytın kataloqu bir neçə saniyəyə yenilənir.
            </Notice>
          )}
          {isNew && state.parent && !parent ? (
            <Panel className="w-full">
              <PanelTitle subtitle="Siyahıdan kateqoriya seçin.">Əsas kateqoriya tapılmadı</PanelTitle>
            </Panel>
          ) : isNew || editing ? (
            <CategoryEditor key={editing ? `${editing.id}:${editing.version}` : `new:${parent?.id ?? ''}`} category={editing} parent={parent} q={state.q} />
          ) : (
            <Panel className="w-full">
              <PanelTitle subtitle="Redaktə etmək üçün siyahıdan kateqoriya seçin.">Kateqoriya seçilməyib</PanelTitle>
            </Panel>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
