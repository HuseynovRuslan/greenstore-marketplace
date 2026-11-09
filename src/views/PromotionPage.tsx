import { ArrowUp, ChevronDown, Rocket } from 'lucide-react'
import { ClientGate } from '@/components/layout/ClientGate'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { PromotionPlanner } from '@/features/promotion/PromotionPlanner'
import { Breadcrumb } from '@/features/seller/ui'
import { cn } from '@/lib/format'
import type { PromotionPackage } from '@/types'

const faq = [
  {
    q: 'Ödəniş nə vaxt alınır?',
    a: 'Elan yerləşdirərkən paket seçsəniz, ödəniş elan yoxlamadan keçəndən sonra alınır. Saytda olan elan üçün paket dərhal işə düşür.',
  },
  { q: 'Elan rədd edilsə, pul geri qayıdır?', a: 'Bəli. Yoxlamadan keçməyən elan üçün ödəniş alınmır; alınıbsa, 3 iş günü ərzində karta qaytarılır.' },
  { q: 'Paketin müddəti elanın müddətindən uzundursa?', a: 'Elan paket bitənə qədər saytda qalır: paket elanın müddətini avtomatik uzadır.' },
  { q: '«İrəli çək» ilə «Önə çıxar» fərqi nədir?', a: '«İrəli çək» elanı «Ən yenilər» siyahısının başına qaldırır, sonra yeni elanlar onu aşağı salır. «Önə çıxar» elanı müddət boyu ana səhifədə və axtarışın başında «Önə çıxan» nişanı ilə saxlayır.' },
]

/** A schematic of where a promoted listing shows (decorative; the text says the same). */
function HowItShows() {
  const row = (label: string, accent?: 'promo' | 'bump') => (
    <div className={cn('flex items-center gap-2.5 rounded-lg border bg-surface p-2', accent === 'promo' ? 'border-olive' : 'border-line')}>
      <span className={cn('h-9 w-12 shrink-0 rounded-md', accent ? 'bg-mint' : 'bg-disabled')} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('h-2 rounded-full', accent ? 'w-3/4 bg-forest/70' : 'w-2/3 bg-line-strong')} />
        <span className="h-2 w-1/3 rounded-full bg-line" />
      </span>
      {accent === 'promo' && (
        <span className="inline-flex items-center gap-1 rounded-[5px] bg-vip px-1.5 py-0.5 text-[10px] font-semibold text-olive-text">
          <Rocket size={10} strokeWidth={2.4} />
          {label}
        </span>
      )}
      {accent === 'bump' && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest">
          <ArrowUp size={12} strokeWidth={2.4} />
          {label}
        </span>
      )}
    </div>
  )
  return (
    <div aria-hidden className="flex flex-col gap-2 rounded-2xl bg-mint/60 p-4">
      <p className="text-xs font-semibold text-ink-soft">Axtarış nəticələri</p>
      {row('Önə çıxan', 'promo')}
      {row('İrəli çəkildi', 'bump')}
      {row('')}
      {row('')}
    </div>
  )
}

/** /reklam — promotion packages («İrəli çək», «Önə çıxar», the bundle) with the mock checkout. */
export default function PromotionPage({ packages }: { packages: PromotionPackage[] }) {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-8 pt-3 pb-14 md:pt-5">
      <Breadcrumb
        items={[
          { label: 'Ana səhifə', to: '/' },
          { label: 'Reklam paketləri' },
        ]}
      />
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-forest md:text-[36px]">Elanınızı daha çox alıcı görsün</h1>
          <p className="max-w-[56ch] text-[15px] leading-[1.6] text-ink-soft md:text-base">
            «İrəli çək» elanı siyahının başına qaldırır, «Önə çıxar» onu ana səhifədə və axtarışın başında «Önə çıxan» nişanı ilə saxlayır. Bitki mövsümündə — yazda və payızda — xüsusilə faydalıdır.
          </p>
        </div>
        <HowItShows />
      </div>

      {/* Each package card has its id as an anchor (/reklam#one-cixar, #ireli-cek — footer links); the skeletons
          carry the same ids, so a link opened in a new tab lands on the right card before the planner mounts. */}
      <ClientGate
        fallback={
          <div aria-busy className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {packages.map((p) => (
              <div key={p.id} id={p.id}>
                <SkeletonBlock className="h-[420px] rounded-2xl" />
              </div>
            ))}
          </div>
        }
      >
        <PromotionPlanner packages={packages} />
      </ClientGate>

      <section aria-labelledby="suallar" className="flex flex-col gap-3">
        <h2 id="suallar" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
          Suallar
        </h2>
        <div className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {faq.map((f) => (
            <details key={f.q} className="group px-5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] leading-[1.4] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden size={18} strokeWidth={2} className="shrink-0 text-muted transition-transform duration-(--dur-base) ease-out group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="max-w-[70ch] pb-4 text-sm leading-[1.6] text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="text-xs leading-[1.5] text-muted">Qiymətlər manatla, ƏDV daxil. Demo: ödəniş alınmır.</p>
      </section>
    </div>
  )
}
