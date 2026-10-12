import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Eye, MessageCircle, Search, ShieldCheck } from 'lucide-react'
import { categories, productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { latestListingIds, listingsByIds, vipListingIds } from '@/data/listings'
import { homeServices, serviceById, serviceCategories } from '@/data/services'
import { featuredSellerIds, sellerById } from '@/data/sellers'
import { ListingCard } from '@/components/cards/ListingCard'
import { CategoryCard } from '@/components/cards/CategoryCard'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { SellerCard } from '@/components/cards/SellerCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { cn } from '@/lib/format'
import type { Seller } from '@/types'

type Mode = 'products' | 'services'

/** Figma "Axtarış sahəsi" — hero search band (#eaf0e9). */
function HeroSearch() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('products')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [error, setError] = useState<string>()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const minN = min === '' ? undefined : Number(min)
    const maxN = max === '' ? undefined : Number(max)
    if ((minN != null && minN < 0) || (maxN != null && maxN < 0)) return setError('Qiymət sıfırdan az ola bilməz.')
    if (minN != null && maxN != null && minN > maxN) return setError('Minimum qiymət maksimumdan böyük ola bilməz.')
    setError(undefined)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (city) params.set('seher', city)
    if (category) params.set('kateqoriya', category)
    if (minN != null) params.set('min', String(minN))
    if (maxN != null) params.set('max', String(maxN))
    const base = mode === 'products' ? '/elanlar' : '/xidmetler'
    navigate(params.size ? `${base}?${params}` : base)
  }

  const categoryOptions =
    mode === 'products'
      ? productCategories.map((c) => ({ value: c.id, label: c.name }))
      : serviceCategories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <section className="w-full bg-mint">
      <div className="page-x mx-auto flex w-full max-w-[1440px] items-start gap-7 py-8">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-5">
          <h1 className="w-full text-[30px] leading-[1.15] font-normal text-forest md:text-[40px]">Bağınız üçün doğru seçim.</h1>
          <p className="w-full text-[15px] leading-[1.5] text-muted">Bitkilər, bağ məhsulları və peşəkar xidmətlər — satıcıdan birbaşa.</p>

          <div role="tablist" aria-label="Axtarış növü" className="flex flex-wrap items-start gap-2">
            {(
              [
                ['products', 'Məhsullar'],
                ['services', 'Xidmətlər'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={mode === value}
                onClick={() => {
                  setMode(value)
                  setCategory('')
                }}
                className={cn(
                  'min-h-11 rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap text-forest transition-colors',
                  mode === value ? 'bg-forest font-semibold text-white' : 'bg-mint hover:bg-[#dfe8de]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} noValidate className="flex w-full flex-col gap-3.5">
            <div className="flex w-full flex-col gap-3 md:flex-row">
              <TextField
                containerClassName="md:flex-1"
                label="Nə axtarırsınız?"
                placeholder={mode === 'products' ? 'Məsələn, zeytun ağacı' : 'Məsələn, landşaft dizaynı'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <SelectField
                containerClassName="md:flex-1"
                label="Şəhər seçin"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                options={[{ value: '', label: 'Bütün Azərbaycan' }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
            <div className="flex w-full flex-col gap-3 md:flex-row">
              <SelectField
                containerClassName="md:flex-1"
                label="Kateqoriya seçin"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[{ value: '', label: 'Bütün kateqoriyalar' }, ...categoryOptions]}
              />
              <div className="flex w-full gap-2.5 md:flex-1">
                <TextField
                  containerClassName="flex-1"
                  label="Min. qiymət, ₼"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={min}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setMin(e.target.value)}
                />
                <TextField
                  containerClassName="flex-1"
                  label="Maks. qiymət, ₼"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  placeholder="İstənilən"
                  value={max}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setMax(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="-mt-1 text-xs leading-[1.5] text-danger">
                {error}
              </p>
            )}
            <Button type="submit" fullWidth icon={<Search aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
              {mode === 'products' ? 'Elanları tap' : 'Xidmətləri tap'}
            </Button>
          </form>

          <p className="w-full text-xs leading-[1.5] text-muted">
            Populyar:{' '}
            <Link className="hover:text-forest" to={`/elanlar?q=${encodeURIComponent('Zeytun ağacı')}`}>
              Zeytun ağacı
            </Link>{' '}
            ·{' '}
            <Link className="hover:text-forest" to="/xidmetler?kateqoriya=cim-salinmasi">
              Çim
            </Link>{' '}
            ·{' '}
            <Link className="hover:text-forest" to="/xidmetler?kateqoriya=bag-baximi">
              Bağ baxımı
            </Link>
          </p>
        </div>

        {/* "Botanika vitrini" — desktop only (absent from the 768 and 390 frames) */}
        <div className="hidden w-[368px] shrink-0 flex-col gap-4 xl:flex">
          <img src="/images/home/hero-botanika.webp" alt="Bağ mərkəzində dibçəkdə zeytun ağacları" className="h-[302px] w-full rounded-lg object-cover" />
          <dl className="flex items-start gap-7 leading-[1.5] whitespace-nowrap">
            <div className="flex flex-col-reverse">
              <dt className="text-xs text-muted">aktiv elan</dt>
              <dd className="text-[26px] font-semibold text-ink">2 480+</dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-xs text-muted">peşəkar və fərdi satıcı</dt>
              <dd className="text-[26px] font-semibold text-ink">340+</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('page-x mx-auto flex w-full max-w-[1440px] scroll-mt-24 flex-col items-start gap-6 py-8', className)}>
      {children}
    </section>
  )
}

function MobileMore({ to, label }: { to: string; label: string }) {
  return (
    <ButtonLink to={to} variant="secondary" fullWidth className="md:hidden">
      {label}
    </ButtonLink>
  )
}

const trustTips = [
  { icon: ShieldCheck, title: 'Satıcını tanıyın', text: 'Təsdiqlənmiş satıcı nişanına və profil məlumatlarına diqqət edin.' },
  { icon: Eye, title: 'Məhsulu yoxlayın', text: 'Bitkinin sağlamlığını, ölçüsünü və çatdırılma şərtlərini əvvəlcədən dəqiqləşdirin.' },
  { icon: MessageCircle, title: 'Birbaşa əlaqə saxlayın', text: 'GreenStore alıcı və satıcını birləşdirir. Şübhəli elanları bizə bildirin.' },
]

export default function HomePage() {
  const vip = listingsByIds(vipListingIds)
  const latest = listingsByIds(latestListingIds)
  const sellers = featuredSellerIds.map(sellerById).filter((s): s is Seller => Boolean(s))

  return (
    <>
      <HeroSearch />

      <Section id="kateqoriyalar">
        <SectionHeader title="Kateqoriyalar" subtitle="Ağacdan bağ avadanlığına — ehtiyacınız olanı seçin." />
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </Section>

      <Section id="vip-elanlar">
        <SectionHeader title="VIP elanlar" subtitle="Bağınız üçün önə çıxan təkliflər" action={{ label: 'Bütün elanlara bax →', to: '/elanlar?vip=1' }} />
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {vip.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
        <MobileMore to="/elanlar?vip=1" label="Bütün elanlara bax" />
      </Section>

      <Section id="son-elanlar">
        <SectionHeader title="Son elanlar" subtitle="Azərbaycanda yeni yerləşdirilən elanlar" action={{ label: 'Bütün elanlara bax →', to: '/elanlar' }} />
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {latest.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
        <MobileMore to="/elanlar" label="Bütün elanlara bax" />
      </Section>

      <Section id="xidmetler">
        <SectionHeader title="Bağınıza peşəkar toxunuş" subtitle="Landşaft və bağçılıq xidmətləri" action={{ label: 'Bütün xidmətlər →', to: '/xidmetler' }} />
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          {homeServices.map(({ id, image }) => {
            const service = serviceById(id)
            return service ? <ServiceCard key={id} service={service} image={image} /> : null
          })}
        </div>
        <MobileMore to="/xidmetler" label="Bütün xidmətlər" />
      </Section>

      <Section id="saticilar">
        <SectionHeader
          title="Etibar etdiyiniz satıcılar"
          subtitle="Tingçilik təsərrüfatları və peşəkar bağ mərkəzləri"
          action={{ label: 'Bütün satıcılar →', to: '/elanlar?saticiNovu=biznes' }}
        />
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          {sellers.map((s) => (
            <SellerCard key={s.id} seller={s} />
          ))}
        </div>
        <MobileMore to="/elanlar?saticiNovu=biznes" label="Bütün satıcılar" />
      </Section>

      <section className="w-full bg-sand">
        <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 py-10">
          <h2 className="w-full text-[23px] leading-[1.35] font-normal text-ink md:text-[30px]">Daha rahat və təhlükəsiz seçim</h2>
          <div className="flex w-full flex-col gap-7 md:flex-row">
            {trustTips.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
                <Icon aria-hidden size={26} strokeWidth={1.8} absoluteStrokeWidth className="text-forest" />
                <h3 className="w-full text-[15px] leading-[1.5] font-semibold text-ink">{title}</h3>
                <p className="w-full text-sm leading-[1.5] text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
