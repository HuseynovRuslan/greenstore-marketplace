import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, MessageCircle, ShieldCheck } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { SellerCard } from '@/components/cards/SellerCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { HeroSearchCard } from '@/features/home/HeroSearchCard'
import { cn } from '@/lib/format'
import type { HomeContent } from '@/services/repository'

/**
 * Variant 2 hero (docs/design/variant-2): heading on mint, then the search island (card, phone filter row,
 * categories row). The heading is the LCP element, so it is never faded in.
 */
function Hero() {
  return (
    <section aria-labelledby="hero-title" className="w-full bg-mint">
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3.5 pt-[18px] pb-3.5 md:gap-[26px] md:pt-11 lg:pb-[30px]">
        {/* Rises 8 px on first paint but never fades: the heading is the LCP element. */}
        <div className="flex w-full animate-rise flex-col gap-1.5 motion-reduce:animate-none md:items-center md:gap-2.5 md:text-center">
          <h1
            id="hero-title"
            className="text-[25px] leading-[1.15] font-semibold tracking-[-0.015em] text-balance text-forest md:text-[44px] md:leading-[1.12] md:tracking-[-0.02em]"
          >
            Azərbaycanda bitki və bağ elanları
          </h1>
          {/* Phones get the short line of the 390 mockup. */}
          <p className="text-[15px] leading-[1.45] text-ink-soft md:hidden">Satıcı ilə birbaşa əlaqə saxlayın.</p>
          <p className="text-lg leading-[1.5] text-ink-soft max-md:hidden">
            Ağac, gül, tinglər və bağçılıq xidmətləri — satıcı ilə birbaşa əlaqə saxlayın.
          </p>
        </div>
        <HeroSearchCard />
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
      <Hero />

      <section
        id="bag-vitrini"
        aria-labelledby="bag-vitrini-title"
        className="page-x mx-auto flex w-full max-w-[1440px] scroll-mt-24 flex-col gap-1 pt-3.5 pb-5 md:gap-4 md:pt-8 md:pb-12"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 id="bag-vitrini-title" className="text-lg leading-[1.3] font-semibold text-forest md:text-[22px]">
              Bağ vitrini
            </h2>
            <p className="text-sm leading-[normal] text-muted max-md:hidden">Satıcıların önə çıxardığı elanlar</p>
          </div>
          {/* «Hamısı» on phones, «Hamısına bax» from md (Variant 2 mockups); the name says which list it opens. */}
          <Link
            href="/elanlar?vip=1"
            aria-label="Hamısına bax — Bağ vitrini"
            className="flex h-11 shrink-0 items-center gap-1.5 text-sm leading-[normal] font-semibold text-forest hover:text-olive-text"
          >
            <span className="md:hidden">Hamısı</span>
            <span className="max-md:hidden">Hamısına bax</span>
            <ArrowRight aria-hidden size={16} strokeWidth={2} className="max-md:hidden" />
          </Link>
        </div>
        <Reveal className="grid w-full grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-5">
          {vip.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </Reveal>
      </section>

      <Section id="son-elanlar">
        <SectionHeader title="Son elanlar" subtitle="Azərbaycanda yeni yerləşdirilən elanlar" action={{ label: 'Bütün elanlara bax', to: '/elanlar' }} />
        <Reveal className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {latest.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </Reveal>
        <MobileMore to="/elanlar" label="Bütün elanlara bax" />
      </Section>

      <Section id="xidmetler">
        <SectionHeader title="Bağınıza peşəkar toxunuş" subtitle="Landşaft və bağçılıq xidmətləri" action={{ label: 'Bütün xidmətlər', to: '/xidmetler' }} />
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
          action={{ label: 'Biznes satıcıların elanları', to: '/elanlar?saticiNovu=biznes' }}
        />
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          {sellers.map((s) => (
            <SellerCard key={s.id} seller={s} />
          ))}
        </div>
        <MobileMore to="/elanlar?saticiNovu=biznes" label="Biznes satıcıların elanları" />
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
