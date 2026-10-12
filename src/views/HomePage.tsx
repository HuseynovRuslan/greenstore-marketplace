import type { ReactNode } from 'react'
import Link from 'next/link'
import { Eye, MessageCircle, ShieldCheck } from 'lucide-react'
import { categories } from '@/data/categories'
import { ListingCard } from '@/components/cards/ListingCard'
import { CategoryCard } from '@/components/cards/CategoryCard'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { SellerCard } from '@/components/cards/SellerCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ButtonLink } from '@/components/ui/Button'
import { HeroSearchForm } from '@/features/home/HeroSearchForm'
import { cn } from '@/lib/format'
import type { HomeContent } from '@/services/repository'

/** Figma "Axtarış sahəsi" — hero search band (#eaf0e9). The tabs and form are a client island. */
function HeroSearch() {
  return (
    <section className="w-full bg-mint">
      <div className="page-x mx-auto flex w-full max-w-[1440px] items-start gap-7 py-8">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-5">
          <h1 className="w-full text-[30px] leading-[1.15] font-normal text-forest md:text-[40px]">Bağınız üçün doğru seçim.</h1>
          <p className="w-full text-[15px] leading-[1.5] text-muted">Bitkilər, bağ məhsulları və peşəkar xidmətlər — satıcıdan birbaşa.</p>

          <HeroSearchForm />

          <p className="w-full text-xs leading-[1.5] text-muted">
            Populyar:{' '}
            <Link className="hover:text-forest" href={`/elanlar?q=${encodeURIComponent('Zeytun ağacı')}`}>
              Zeytun ağacı
            </Link>{' '}
            ·{' '}
            <Link className="hover:text-forest" href="/xidmetler?kateqoriya=cim-salinmasi">
              Çim
            </Link>{' '}
            ·{' '}
            <Link className="hover:text-forest" href="/xidmetler?kateqoriya=bag-baximi">
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

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('page-x mx-auto flex w-full max-w-[1440px] scroll-mt-24 flex-col items-start gap-6 py-8', className)}>
      {children}
    </section>
  )
}

function MobileMore({ to, label }: { to: string; label: string }) {
  return (
    <ButtonLink href={to} variant="secondary" fullWidth className="md:hidden">
      {label}
    </ButtonLink>
  )
}

const trustTips = [
  { icon: ShieldCheck, title: 'Satıcını tanıyın', text: 'Təsdiqlənmiş satıcı nişanına və profil məlumatlarına diqqət edin.' },
  { icon: Eye, title: 'Məhsulu yoxlayın', text: 'Bitkinin sağlamlığını, ölçüsünü və çatdırılma şərtlərini əvvəlcədən dəqiqləşdirin.' },
  { icon: MessageCircle, title: 'Birbaşa əlaqə saxlayın', text: 'GreenStore alıcı və satıcını birləşdirir. Şübhəli elanları bizə bildirin.' },
]

/** "/" — Figma "Ana səhifə" 1440 / 768 / 390. Server-rendered; the data comes from the repository (route file). */
export default function HomePage({ content }: { content: HomeContent }) {
  const { vip, latest, sellers } = content

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
          {content.services.map(({ service, image }) => (
            <ServiceCard key={service.id} service={service} image={image} />
          ))}
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
