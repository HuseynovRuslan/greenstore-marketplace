import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, MessageCircle, Rocket, Search, TriangleAlert } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { ServiceCard } from '@/components/cards/ServiceCard'
import { SellerCard } from '@/components/cards/SellerCard'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import type { HeroCounts } from '@/features/home/heroCounts'
import { HeroSearchCard } from '@/features/home/HeroSearchCard'
import { cn } from '@/lib/format'
import type { HomeContent } from '@/services/repository'

/**
 * Variant 2 hero (docs/design/variant-2): heading on mint, then the search island (card, phone filter row,
 * categories row). The heading is never faded in (it was the LCP element). Compact since November 2026, so that
 * «Önə çıxan elanlar» and the top of its cards show without scrolling from 1280 × 720 up: 28 / 24 px above and below
 * from md, 20 px between heading, card and categories, and a one-line categories row.
 */
function Hero({ counts }: { counts: HeroCounts }) {
  return (
    <section aria-labelledby="hero-title" className="w-full bg-mint">
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-center gap-3 pt-4 pb-4 md:gap-5 md:pt-7 md:pb-6">
        {/* Rises 8 px on first paint but never fades. */}
        <div className="flex w-full animate-rise flex-col gap-1.5 motion-reduce:animate-none md:items-center md:gap-2 md:text-center">
          {/* Tracking follows Inter's size table: ≈ −0.020em at 25 px, −0.022em at 40 px. */}
          <h1
            id="hero-title"
            className="text-[25px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-forest md:text-[40px] md:leading-[1.1]"
          >
            Azərbaycanda bitki və bağ elanları
          </h1>
          {/* Phones get the short line of the 390 mockup. */}
          <p className="text-[15px] leading-[1.45] text-ink-soft md:hidden">Satıcı ilə birbaşa əlaqə saxlayın.</p>
          <p className="text-lg leading-[1.5] text-ink-soft max-md:hidden">
            Ağac, gül, tinglər və bağçılıq xidmətləri — satıcı ilə birbaşa əlaqə saxlayın.
          </p>
        </div>
        <HeroSearchCard counts={counts} />
      </div>
    </section>
  )
}

/**
 * One rhythm for the home sections: 32 px above and below (64 px between two sections), 16 px (24 px from md) from
 * the heading row to the content. The first section sits closer to the hero (14 px on phones, 24 px from md).
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

const buyingSteps = [
  { icon: Search, step: '01', label: 'Tapın', title: 'Uyğun elanı tapın', text: 'Bitki, ağac və ya bağ məhsulunu seçin, elanın məlumatlarına baxın.' },
  { icon: MessageCircle, step: '02', label: 'Dəqiqləşdirin', title: 'Satıcı ilə əlaqə saxlayın', text: 'Ölçü, yaş, dibçək və çatdırılma şərtlərini əvvəlcədən soruşun.' },
  { icon: MapPin, step: '03', label: 'Yoxlayın', title: 'Yerində baxın və razılaşın', text: 'Bitkinin vəziyyətini görün, sonra alış barədə qərar verin.' },
]

const beforeBuying = ['Yarpaqları, kökləri və zərərvericiləri yoxlayın', 'Ölçünü və dibçəyi dəqiqləşdirin', 'Tanımadığınız satıcıya öncədən pul göndərməyin']

/**
 * «GreenStore-da alış necə baş verir?» (docs/design/home/alis-bolmesi.png): three steps as an ordered list, then the
 * «Bitkini almadan əvvəl» notice. No band of its own: it sits on the page's cream, 64 px below the sellers like every
 * home section, and 48 / 64 px above the footer so the two don't read as one block. Three columns from 1024 px;
 * narrower, the cards stack (at 768 px a column is too narrow for «02 · DƏQİQLƏŞDİRİN» beside the icon). The
 * label's capitals come from CSS with lang="az", so «Dəqiqləşdirin» becomes «DƏQİQLƏŞDİRİN» and screen readers
 * get the word, not the letters.
 *
 * Contrast: subtitle muted on cream 5.2:1, step label olive-text on white 5.7:1, card text muted on white 5.4:1,
 * notice title warning on warning-soft 5.0:1, notice text ink on warning-soft 11.7:1, warning icon on its square 4.6:1.
 */
function BuyingGuide() {
  return (
    <section aria-labelledby="alis-title" className="page-x mx-auto w-full max-w-[1440px] pt-8 pb-12 md:pb-16">
      <div className="flex flex-col gap-2 md:gap-3">
        {/* Tracking follows Inter's size table: ≈ −0.019em at 24 px, −0.021em at 32 px. */}
        <h2 id="alis-title" className="text-2xl leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-forest md:text-[32px]">
          GreenStore-da alış necə baş verir?
        </h2>
        <p className="text-[15px] leading-[1.5] text-muted md:text-base">
          Səbət və onlayn ödəniş yoxdur. Alış şərtlərini satıcı ilə özünüz razılaşdırırsınız.
        </p>
      </div>

      <Reveal as="ol" className="mt-7 grid gap-3 md:mt-9 lg:grid-cols-3 lg:gap-5">
        {buyingSteps.map(({ icon: Icon, step, label, title, text }) => (
          <div key={step} className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                <Icon aria-hidden size={22} strokeWidth={1.8} />
              </span>
              <p className="text-right text-[13px] leading-4 font-semibold tracking-[0.06em] text-olive-text uppercase">
                {step} · {label}
              </p>
            </div>
            <h3 className="text-[17px] leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-lg">{title}</h3>
            <p className="text-sm leading-[1.6] text-muted">{text}</p>
          </div>
        ))}
      </Reveal>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warning-line bg-warning-soft p-4 md:gap-4 md:px-6 md:py-[18px]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-option bg-warning-line/50 text-warning">
          <TriangleAlert aria-hidden size={20} strokeWidth={1.8} />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5 xl:gap-1">
          <h3 className="text-[15px] leading-[1.4] font-semibold text-warning">Bitkini almadan əvvəl</h3>
          {/* Below 1280 px one tip per line (the three need ≈ 900 px; at 1024 the third would wrap alone); from 1280 px one row. */}
          <ul className="flex flex-col gap-1.5 text-sm leading-[1.5] text-ink xl:flex-row xl:flex-wrap xl:gap-x-5 xl:gap-y-1">
            {beforeBuying.map((tip) => (
              <li key={tip} className="flex gap-2 before:mt-2 before:size-[5px] before:shrink-0 before:rounded-full before:bg-warning">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** "/" — Figma "Ana səhifə" 1440 / 768 / 390. Server-rendered; the data comes from the repository (route file). */
export default function HomePage({ content, hero }: { content: HomeContent; hero: HeroCounts }) {
  const { vip, latest, sellers } = content

  return (
    <>
      <Hero counts={hero} />

      <Section id="one-cixan-elanlar" labelledBy="one-cixan-elanlar-title" className="pt-3.5 md:pt-6">
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

      <BuyingGuide />
    </>
  )
}
