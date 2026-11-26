'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, FlaskConical, MapPin, MessageCircle, Sprout, UserRound, UserRoundPlus } from 'lucide-react'
import { cn } from '@/lib/format'

/** What GreenStore is, on the photo panel (real text, not part of the image; no figures the site cannot back). */
const benefits = [
  { icon: Sprout, title: 'Geniş məhsul seçimi', text: 'Bitkilər, ağaclar, tinglər və bağ məhsulları' },
  { icon: MessageCircle, title: 'Satıcı ilə birbaşa əlaqə', text: 'Zəng edin və ya WhatsApp-da yazın' },
  { icon: MapPin, title: 'Bütün Azərbaycan üzrə', text: 'Sizə ən yaxın elanları tapın' },
]

/**
 * The nursery photograph of the panel at its full 1536 px width: the photo covers a panel up to ~1030 px tall, which
 * draws it about 1536 px wide, so a smaller copy would be stretched and look soft. Its `<source>` is for 1024 px and
 * wider only: below that the panel is hidden and the `<img>` keeps a 1×1 data URI, so a phone downloads no photo.
 */
const PHOTO = '/images/auth/nursery-path-1536.webp'
const NO_PHOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export type AuthTab = 'login' | 'register'

/**
 * The frame of /daxil-ol, /qeydiyyat and /sifreni-berpa-et (Nov 2026 redesign): one rounded container on the page.
 * - Left, from 1024 px: the nursery photograph, its colours kept, and one text block anchored to the bottom left: the
 *   welcome line, what the site is for and three benefits, all real text. The forest shade is directional: it rises
 *   from the bottom and from the left, where the text is, and leaves the sky and the trees on the right as they are;
 *   a taller registration step only shows more of the photo above the text. Hidden from screen readers (an aside:
 *   the form is the page). Phones and tablets get the form alone.
 * - Right: the white form surface. `tab` shows the «Daxil ol» / «Hesab yarat» switch (links to the two routes, `next`
 *   kept); the password reset page has none. Then the page's h1, its lead and the form.
 * No fixed heights: the photo panel stretches with a long registration step or an error message.
 */
export function AuthShell({ tab, next, title, lead, children }: { tab?: AuthTab; next?: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="page-x py-4 md:py-6">
      <div className="mx-auto grid w-full max-w-[560px] overflow-hidden rounded-3xl border border-line bg-surface shadow-header lg:max-w-[1160px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:shadow-popover">
        <aside aria-hidden className="relative isolate hidden min-h-[560px] flex-col justify-end gap-7 overflow-hidden p-9 text-white lg:flex xl:p-10">
          {/* Out of the column's flow (absolute), so only the text block takes part in the layout. */}
          <picture className="absolute inset-0 -z-10">
            <source media="(min-width: 64rem)" srcSet={`${PHOTO} 1536w`} sizes="1536px" />
            <img src={NO_PHOTO} alt="" fetchPriority="high" decoding="async" className="size-full object-cover object-[58%_42%]" />
          </picture>
          {/* Directional shade: from the bottom (behind the text) and lightly from the left; the top right keeps the photo's own light. */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,color-mix(in_oklab,var(--color-forest)_86%,transparent)_0%,color-mix(in_oklab,var(--color-forest)_62%,transparent)_38%,transparent_70%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-forest)_50%,transparent)_0%,transparent_65%)]" />

          <div className="flex flex-col gap-4">
            <p className="max-w-[13ch] text-[38px] leading-[1.06] font-bold tracking-[-0.03em] text-balance [text-shadow:0_1px_18px_color-mix(in_oklab,var(--color-forest)_45%,transparent)] xl:text-[42px]">GreenStore-a xoş gəlmisiniz!</p>
            <span className="h-1 w-12 rounded-full bg-olive" />
            <p className="max-w-[34ch] text-[15px] leading-[1.55] text-pretty text-footer-text">Bitkilər, ağaclar, tinglər və bağçılıq xidmətləri üçün elan platforması.</p>
          </div>

          <ul className="flex flex-col gap-3.5">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-surface/20 bg-surface/10">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] leading-[1.3] font-semibold">{title}</span>
                  <span className="text-[13px] leading-[1.4] text-footer-text">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-7 lg:px-10 lg:py-8">
          {tab && <AuthTabs active={tab} next={next} />}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[24px] leading-[1.15] font-bold tracking-[-0.025em] text-balance text-ink sm:text-[28px]">{title}</h1>
            {lead && <p className="text-[15px] leading-[1.5] text-pretty text-muted">{lead}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** «Daxil ol» / «Hesab yarat»: two links styled as a segmented control; the current page is marked for screen readers. */
function AuthTabs({ active, next }: { active: AuthTab; next?: string }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : ''
  const tabs = [
    { id: 'login' as const, href: `/daxil-ol${query}`, label: 'Daxil ol', icon: UserRound },
    { id: 'register' as const, href: `/qeydiyyat${query}`, label: 'Hesab yarat', icon: UserRoundPlus },
  ]
  return (
    <nav aria-label="Giriş və qeydiyyat">
      <ul className="grid grid-cols-2 gap-1 rounded-2xl bg-mint p-1">
        {tabs.map(({ id, href, label, icon: Icon }) => (
          <li key={id}>
            <Link
              href={href}
              aria-current={id === active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors duration-(--dur-fast) ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive',
                id === active ? 'bg-forest text-white shadow-card-hover' : 'text-ink-soft hover:bg-surface hover:text-forest',
              )}
            >
              <Icon aria-hidden size={18} strokeWidth={1.8} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Registration steps: a numbered circle per step (it is a real sequence), done steps filled with a tick, the current
 * one ringed, the rest muted. Each step is an equal column with its label centred under the circle; the line from the
 * previous circle fills once this step is reached. Labels wrap under their own circle on narrow phones.
 */
export function AuthSteps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol aria-label="Qeydiyyat addımları" className="flex items-start">
      {steps.map((label, i) => {
        const done = i < current
        const now = i === current
        return (
          <li key={label} aria-current={now ? 'step' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute top-4 right-[calc(50%+22px)] left-[calc(-50%+22px)] h-0.5 -translate-y-1/2 rounded-full transition-colors duration-(--dur-base)', i <= current ? 'bg-forest' : 'bg-line')}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-(--dur-base)',
                done && 'bg-forest text-white',
                now && 'border-2 border-forest bg-mint text-forest',
                !done && !now && 'border border-line-strong bg-surface text-muted',
              )}
            >
              {done ? <Check size={16} strokeWidth={2.6} /> : i + 1}
            </span>
            <span className={cn('max-w-[11ch] text-xs leading-[1.3] font-semibold text-balance', now ? 'text-ink' : done ? 'text-forest' : 'text-muted')}>
              {label}
              <span className="sr-only">{done ? ', tamamlanıb' : now ? ', indiki addım' : ''}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** «Fərdi şəxs» / «Biznes»: a large radio card with an icon tile, its title and what it is for; the tile fills when chosen. */
export function AccountTypeCard({ id, name, value, checked, onChange, icon, title, description }: { id?: string; name: string; value: string; checked: boolean; onChange: () => void; icon: ReactNode; title: string; description: string }) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] duration-(--dur-fast) ease-out sm:p-5',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive',
        checked ? 'border-forest bg-mint shadow-[inset_0_0_0_1px_var(--color-forest)]' : 'border-line bg-surface hover:border-olive',
      )}
    >
      <input id={id} type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span aria-hidden className={cn('flex size-11 items-center justify-center rounded-xl transition-colors duration-(--dur-fast)', checked ? 'bg-forest text-white' : 'bg-mint text-forest')}>
        {icon}
      </span>
      <span className="flex flex-col gap-1 pr-6">
        <span className="text-[15px] leading-[1.3] font-semibold text-ink">{title}</span>
        <span className="text-[13px] leading-[1.45] text-muted">{description}</span>
      </span>
      <span aria-hidden className={cn('absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border transition-colors duration-(--dur-fast)', checked ? 'border-forest bg-forest text-white' : 'border-line-strong bg-surface')}>
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
    </label>
  )
}

/** Two or three options as a segmented control (radios: one Tab stop, arrow keys switch). */
export function Segmented<T extends string>({ legend, name, options, value, onChange }: { legend: string; name: string; options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  return (
    <fieldset className="flex rounded-xl bg-mint p-1">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-sm leading-[normal] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-(--dur-fast) ease-out',
            'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-1 has-[input:focus-visible]:outline-olive',
            value === o.value ? 'bg-surface text-forest shadow-sm' : 'text-ink-soft hover:text-forest',
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

/** Password rules, ticked live as the password is typed (the same rule the form checks). */
export function PasswordRules({ value, id }: { value: string; id?: string }) {
  const rules = [
    { ok: value.length >= 8, text: 'Ən azı 8 simvol' },
    { ok: /\p{L}/u.test(value), text: 'Bir hərf' },
    { ok: /\d/.test(value), text: 'Bir rəqəm' },
  ]
  return (
    <ul id={id} className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-[1.5]">
      {rules.map((r) => (
        <li key={r.text} className={cn('inline-flex items-center gap-1', r.ok ? 'text-success' : 'text-muted')}>
          <Check aria-hidden size={13} strokeWidth={2.6} className={cn(!r.ok && 'opacity-30')} />
          {r.text}
          <span className="sr-only">{r.ok ? ' — var' : ' — yoxdur'}</span>
        </li>
      ))}
    </ul>
  )
}

/** DEMO ONLY note: what the mock accepts (no SMS is sent, nothing is checked by a server). */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] leading-[1.5] text-ink">
      <FlaskConical aria-hidden size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-warning" />
      <span>
        <span className="font-semibold">Demo: </span>
        {children}
      </span>
    </p>
  )
}

/** The form's own column inside AuthShell's white surface (the surface is the card: no second border). */
export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>
}

/** The line under a sign-in form that leads to the other one («Hesabınız yoxdur? Hesab yaradın»), after a rule. */
export function AuthSwitch({ question, href, label }: { question: string; href: string; label: string }) {
  return (
    <p className="border-t border-line pt-5 text-center text-[15px] leading-[1.5] text-ink-soft">
      {question}{' '}
      <Link href={href} className="font-semibold text-forest underline-offset-2 hover:underline">
        {label}
      </Link>
    </p>
  )
}
