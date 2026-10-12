import Link from 'next/link'

const platform = [
  { label: 'Məhsullar', to: '/elanlar' },
  { label: 'Xidmətlər', to: '/xidmetler' },
  { label: 'Peşəkar satıcılar', to: '/#saticilar' },
  { label: 'Elan yerləşdir', to: '/elan-yerlesdir' },
]
const support = ['Tez-tez verilən suallar', 'Təhlükəsiz alış məsləhətləri', 'Elan qaydaları', 'Bizimlə əlaqə']

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
          <nav aria-label="Platforma" className="min-w-0 flex-1 text-sm leading-[2]">
            <p className="font-bold text-white">Platforma</p>
            <ul>
              {platform.map((l) => (
                <li key={l.label}>
                  <Link href={l.to} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Dəstək" className="min-w-0 flex-1 text-sm leading-[2]">
            <p className="font-bold text-white">Dəstək</p>
            <ul>
              {/* These help pages are not designed yet, so they are plain text rather than dead "#" links. */}
              {support.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="w-full text-xs leading-[1.8]">
          <p>© 2026 GreenStore. Bütün hüquqlar qorunur.</p>
          <p>İstifadə şərtləri · Məxfilik siyasəti · Azərbaycan dili</p>
        </div>
      </div>
    </footer>
  )
}

/* Figma "Yığcam sonluq": #173f32, p 24, two 12 px white lines (leading 1.8). */
export function CompactFooter() {
  return (
    <footer className="w-full bg-forest text-white">
      <div className="mx-auto w-full max-w-[1440px] p-6 text-xs leading-[1.8]">
        <p>GreenStore · Dəstək · Elan qaydaları · Təhlükəsiz alış</p>
        <p>İstifadə şərtləri · Məxfilik siyasəti · © 2026 GreenStore</p>
      </div>
    </footer>
  )
}
