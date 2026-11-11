import Link from 'next/link'
import { ArrowRight, Bell, MessageCircle, ShieldCheck } from 'lucide-react'
import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp } from '@icons-pack/react-simple-icons'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/format'
import { FooterNav } from './FooterNav'
import { footerGroups, legalLinks, socialLinks, type SocialLink, type SocialNetwork } from './footerLinks'

/*
 * Site footer, direction A (docs/design/footer): the sellers' card, the brand block, five link groups and the bottom
 * row (copyright, legal links, social profiles). A server component: only the link groups (phone accordions) are a
 * client island, so the brand icons below cost no JavaScript.
 *
 * Contrast on forest #173f32: links and small text footer-text 8.6:1, headings white 11.7:1, focus outline mint
 * 10.1:1 (the site's olive outline is 2.8:1 here). On the mint card: title forest 10.1:1, eyebrow olive-text 4.9:1,
 * lead muted 4.6:1.
 */

const focusOnForest = 'rounded-sm focus-visible:outline-mint'
const focusOnMint = 'rounded-sm focus-visible:outline-forest'

const brandIcons: Record<SocialNetwork, typeof SiInstagram> = { instagram: SiInstagram, facebook: SiFacebook, tiktok: SiTiktok, whatsapp: SiWhatsapp }

const trustPoints = [
  { icon: ShieldCheck, label: 'Yoxlanılmış satıcılar' },
  { icon: MessageCircle, label: 'Satıcı ilə birbaşa əlaqə' },
  { icon: Bell, label: 'Yeni elan bildirişləri' },
]

/**
 * «Satıcılar üçün» card. Its title is a paragraph, not a heading: a promotion, not a section of the page, so the
 * outline goes h1 (page) → h2 per footer link group.
 */
function SellerCard() {
  return (
    <div className="relative overflow-hidden rounded-panel bg-mint px-5 py-6 md:px-8 lg:flex lg:items-center lg:justify-between lg:gap-10">
      {/* The olive bar along the left edge, clipped by the card's rounded corner. */}
      <span aria-hidden className="absolute top-5 left-0 h-14 w-1.5 rounded-r-sm bg-olive md:bottom-5 md:h-auto" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[11px] leading-4 font-bold tracking-[0.08em] text-olive-text uppercase">Satıcılar üçün</p>
        <p className="max-w-[20ch] text-[22px] leading-[1.3] font-semibold tracking-[-0.015em] text-balance text-forest md:max-w-none md:text-xl">
          Bitki satırsınız? Elanınızı pulsuz yerləşdirin.
        </p>
        <p className="max-w-[26ch] text-[15px] leading-[1.5] text-muted md:max-w-none">Alıcılar sizinlə birbaşa əlaqə saxlayır.</p>
      </div>
      {/* Phones: the button first, the link under it (390 mockup); from 640 px side by side, the button last. */}
      <div className="mt-5 flex shrink-0 flex-col-reverse gap-1 sm:flex-row sm:items-center sm:gap-7 lg:mt-0">
        <Link
          href="/reklam"
          className={cn(
            'inline-flex min-h-11 items-center justify-center gap-1.5 text-[15px] font-medium whitespace-nowrap text-forest underline-offset-4 hover:underline',
            focusOnMint,
          )}
        >
          Tanıtım paketləri
          <ArrowRight aria-hidden size={16} strokeWidth={2} />
        </Link>
        {/* ring-mint: the button's olive focus ring is 2.8:1 on forest; mint reads at 10.1:1. */}
        <ButtonLink href="/elan-yerlesdir" className="focus-visible:ring-mint! sm:min-w-48 sm:px-7">
          Elan yerləşdir
        </ButtonLink>
      </div>
    </div>
  )
}

function BrandBlock() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:justify-between md:gap-8 xl:flex-col xl:justify-start xl:gap-6">
      <div className="flex flex-col gap-4">
        <Logo tone="light" className={cn('self-start', focusOnForest)} />
        <p className="max-w-[12.5rem] text-[15px] leading-6 text-footer-text">Bitki və bağ dünyası üçün elan platforması.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {trustPoints.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-[15px] leading-6 text-footer-text">
            <Icon aria-hidden size={17} strokeWidth={1.8} className="shrink-0" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SocialLinks({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null
  return (
    <ul aria-label="Sosial şəbəkələr" className="flex items-center gap-2.5">
      {links.map(({ network, name, href }) => {
        const Icon = brandIcons[network]
        return (
          <li key={network}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`GreenStore ${name}-da (yeni pəncərədə açılır)`}
              className={cn(
                'flex size-11 items-center justify-center rounded-option border border-mint/30 text-footer-text transition-colors duration-(--dur-fast)',
                'hover:border-mint hover:bg-mint/10 hover:text-white md:size-10',
                focusOnForest,
              )}
            >
              <Icon aria-hidden size={19} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** Full footer (home page). Links: footerLinks.ts; social profiles appear once their env URL is set. */
export function SiteFooter() {
  return (
    <footer className="w-full bg-forest text-footer-text">
      <div className="page-x mx-auto w-full max-w-[1440px] pt-8 pb-8 md:pt-10 md:pb-10 xl:pt-11">
        <SellerCard />
        <div className="mt-9 grid grid-cols-1 gap-y-8 md:mt-12 md:gap-y-10 xl:mt-14 xl:grid-cols-[minmax(0,14.5rem)_minmax(0,1fr)] xl:gap-x-10">
          <BrandBlock />
          <FooterNav groups={footerGroups()} />
        </div>
        <div className="mt-5 flex flex-col gap-4 md:mt-10 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-10 md:border-t md:border-mint/20 md:pt-6 xl:mt-8">
          <p className="text-[13px] leading-5">© {new Date().getFullYear()} GreenStore. Bütün hüquqlar qorunur.</p>
          <nav aria-label="Hüquqi məlumat" className="md:mr-auto xl:mx-auto">
            <ul className="flex flex-wrap gap-x-6 xl:gap-x-20">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={cn('inline-flex min-h-11 items-center text-[13px] leading-5 hover:text-white hover:underline hover:underline-offset-4 md:min-h-6', focusOnForest)}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <SocialLinks links={socialLinks()} />
        </div>
      </div>
    </footer>
  )
}