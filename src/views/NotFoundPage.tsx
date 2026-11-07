import Link from 'next/link'
import { Search, Sprout } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { productCategories } from '@/data/categories'

/**
 * 404 (Nov 2026): say what happened, then give ways on — a search that goes to the catalogue, the main categories,
 * and the main sections. Server-rendered; the search is a plain GET form.
 */
export default function NotFoundPage() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[880px] flex-col items-center gap-7 py-12 text-center md:py-20">
      <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-mint text-forest">
        <Sprout size={30} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-muted">404</p>
        <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-forest md:text-[34px]">Bu səhifə tapılmadı</h1>
        <p className="mx-auto max-w-[48ch] text-[15px] leading-[1.6] text-ink-soft">Elan satılmış, silinmiş və ya ünvan səhv yazılmış ola bilər. Axtardığınızı buradan tapın:</p>
      </div>

      <form role="search" aria-label="Elan axtarışı" action="/elanlar" method="get" className="flex w-full max-w-[560px] gap-2 rounded-2xl border border-line-strong bg-surface p-2 shadow-search">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3">
          <Search aria-hidden size={20} strokeWidth={2} className="shrink-0 text-muted" />
          <span className="sr-only">Axtarış sözü</span>
          <input type="search" name="q" enterKeyHint="search" maxLength={100} placeholder="Məsələn, tuya" className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted" />
        </label>
        <button type="submit" className="h-12 shrink-0 rounded-xl bg-forest px-6 text-base font-semibold text-white transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-forest-hover active:scale-[0.97] motion-reduce:active:scale-100">
          Axtar
        </button>
      </form>

      <nav aria-label="Kateqoriyalar" className="w-full">
        <ul className="flex flex-wrap justify-center gap-2">
          {productCategories.slice(0, 6).map((c) => (
            <li key={c.id}>
              <Link href={`/kateqoriyalar/${c.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors duration-(--dur-fast) hover:border-forest">
                <CategoryIcon name={c.icon} size={18} />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="flex flex-wrap justify-center gap-x-5 text-sm">
        {[
          { label: 'Ana səhifə', to: '/' },
          { label: 'Bütün elanlar', to: '/elanlar' },
          { label: 'Xidmətlər', to: '/xidmetler' },
          { label: 'Satıcılar', to: '/saticilar' },
          { label: 'Kömək', to: '/komek' },
        ].map((l) => (
          <Link key={l.to} href={l.to} className="inline-flex min-h-11 items-center font-semibold text-forest underline-offset-2 hover:underline">
            {l.label}
          </Link>
        ))}
      </p>
    </div>
  )
}
