import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, MessageCircle, Rocket, ShieldCheck } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { SellerCard } from '@/components/cards/SellerCard'
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
          {/* Tracking follows Inter's size table: ≈ −0.020em at 25 px, −0.022em at 44 px. */}
          <h1
            id="hero-title"
            className="text-[25px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-forest md:text-[44px] md:leading-[1.12]"
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

/**
 * One rhythm for the home sections: 32 px above and below (64 px between two sections), 16 px (24 px from md) from
 * the heading row to the content. The first section sits closer to the hero on phones.
 */
function Section({ id, labelledBy, children, className }: { id?: string; labelledBy?: string; children: ReactNode; className?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('page-x mx-auto flex w-full max-w-[1440px] scroll-mt-24 flex-col items-start gap-4 py-8 md:gap-6', className)}
    >
      {children}
    </section>
  )
}

interface HomeHeadingProps {
  id?: string
  title: string
  /** Decorative mark before the title (the olive rocket of «Önə çıxan elanlar»). */
  icon?: ReactNode
  subtitle?: string
  /** Section link. With `short`, phones get the short text in the row; otherwise phones get MobileMore below. */
  action?: { label: string; to: string; short?: string; context?: string }
}

/**
 * The heading row of every home section (Variant 2, «Önə çıxan elanlar»): 18 / 22 px semibold forest title, the
 * muted subtitle beside it from md (under it on phones), and the section link with an arrow at the end. Tracking
 * follows Inter's size table (≈ −0.014em at 18 px, −0.018em at 22 px).
 */
function HomeHeading({ id, title, icon, subtitle, action }: HomeHeadingProps) {
  return (
    <div className="flex min-h-11 w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
        <h2 id={id} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px] md:tracking-[-0.015em]">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-[13px] leading-[1.4] text-muted md:text-sm md:leading-[normal]">{subtitle}</p>}
      </div>
      {action && (
        // With `short`: «Hamısı» on phones, the full label from md; the name starts with the visible text of the
        // width, then says which list it opens (label in name, WCAG 2.5.3).
        <Link
          href={action.to}
          className={cn(
            'flex h-11 shrink-0 items-center gap-1.5 text-sm leading-[normal] font-semibold whitespace-nowrap text-forest transition-colors duration-(--dur-fast) hover:text-olive-text',
            !action.short && 'max-md:hidden',
          )}
        >
          {action.short ? (
            <>
              <span className="md:hidden">{action.short}</span>
              <span className="max-md:hidden">{action.label}</span>
              {action.context && <span className="sr-only"> — {action.context}</span>}
            </>
          ) : (
            action.label
          )}
          <ArrowRight aria-hidden size={16} strokeWidth={2} className="max-md:hidden" />
        </Link>
      )}
    </div>
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

      <Section id="one-cixan-elanlar" labelledBy="one-cixan-elanlar-title" className="max-md:pt-3.5">
        <HomeHeading
          id="one-cixan-elanlar-title"
          // Same mark as the header link: these are listings sellers paid to push forward.
          icon={<Rocket aria-hidden size={20} strokeWidth={2} className="mr-2 inline-block text-olive max-md:size-[18px]" />}
          title="Önə çıxan elanlar"
          subtitle="Satıcıların ödənişlə irəli çəkdiyi elanlar"
          action={{ label: 'Hamısına bax', short: 'Hamısı', context: 'Önə çıxan elanlar', to: '/elanlar?vip=1' }}
        />
        <Reveal className="grid w-full grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-5">
          {vip.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </Reveal>
      </Section>

      <Section id="son-elanlar">
        <HomeHeading title="Son elanlar" subtitle="Azərbaycanda yeni yerləşdirilən elanlar" action={{ label: 'Bütün elanlara bax', to: '/elanlar' }} />
        <Reveal className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {latest.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </Reveal>
        <MobileMore to="/elanlar" label="Bütün elanlara bax" />
      </Section>

      <Section id="xidmetler">
        <HomeHeading title="Bağınıza peşəkar toxunuş" subtitle="Landşaft və bağçılıq xidmətləri" action={{ label: 'Bütün xidmətlər', to: '/xidmetler' }} />
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          {content.services.map(({ service, image }) => (
            <ServiceCard key={service.id} service={service} image={image} />
          ))}
        </div>
        <MobileMore to="/xidmetler" label="Bütün xidmətlər" />
      </Section>

      <Section id="saticilar">
        <HomeHeading
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
        <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-4 py-10 md:gap-6">
          <HomeHeading title="Daha rahat və təhlükəsiz seçim" />
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
