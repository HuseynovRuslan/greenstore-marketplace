import Link from 'next/link'

const platform = [
  { label: 'Məhsullar', to: '/elanlar' },
  { label: 'Xidmətlər', to: '/xidmetler' },
  { label: 'Satıcılar', to: '/saticilar' },
  { label: 'Elan yerləşdir', to: '/elan-yerlesdir' },
]
const support = [
  { label: 'Kömək', to: '/komek' },
  { label: 'Elan qaydaları', to: '/qaydalar' },
  { label: 'Təhlükəsiz alış', to: '/tehlukesiz-alis' },
  { label: 'Elanı irəli çək', to: '/reklam' },
  { label: 'Bizimlə əlaqə', to: '/elaqe' },
]
const legal = [
  { label: 'İstifadə şərtləri', to: '/istifade-sertleri' },
  { label: 'Məxfilik siyasəti', to: '/mexfilik' },
]

/* Figma "Səhifə sonluğu": #173f32, p 64 (28 @768, 24 @390), gap 32; 3 columns gap 48 (stacked gap 24 on 390). */
export function SiteFooter() {
  return (
    <footer className="w-full bg-forest text-footer-text">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-6 md:p-7 xl:p-16">
        <div className="flex w-full flex-col gap-6 md:flex-row md:gap-12">
          <div className="min-w-0 flex-1 text-sm leading-[1.8]">
            <p className="text-[26px] font-bold text-white">GreenStore</p>
            <p className="mt-[25px]">Azərbaycanda bitkilər, bağ məhsulları və landşaft xidmətləri üçün açıq elan platforması.</p>
            <p className="mt-[25px]">Satıcı ilə birbaşa əlaqə. Daha yaşıl seçimlər.</p>
          </div>
          {[
            { title: 'Platforma', links: platform },
            { title: 'Dəstək', links: support },
          ].map((group) => (
            <nav key={group.title} aria-label={group.title} className="min-w-0 flex-1 text-sm leading-[2]">
              <p className="font-bold text-white">{group.title}</p>
              <ul>
                {group.links.map((l) => (
                  <li key={l.to}>
                    <Link href={l.to} className="inline-flex min-h-8 items-center hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex w-full flex-col gap-1 text-xs leading-[1.8] md:flex-row md:justify-between">
          <p>© 2026 GreenStore. Bütün hüquqlar qorunur.</p>
          <p className="flex flex-wrap gap-x-4">
            {legal.map((l) => (
              <Link key={l.to} href={l.to} className="hover:text-white">
                {l.label}
              </Link>
            ))}
            <span>Azərbaycan dili</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Inner pages: the support and legal links in one row (the full footer lives on the home page). */
export function CompactFooter() {
  return (
    <footer className="w-full bg-forest text-footer-text">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7 xl:px-16">
        <nav aria-label="Dəstək və şərtlər">
          <ul className="flex flex-wrap gap-x-5 text-[13px]">
            {[...support, ...legal].map((l) => (
              <li key={l.to}>
                <Link href={l.to} className="inline-flex min-h-11 items-center hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs">© 2026 GreenStore</p>
      </div>
    </footer>
  )
}
