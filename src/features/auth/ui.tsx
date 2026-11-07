'use client'

import type { ReactNode } from 'react'
import { Check, FlaskConical, MessageCircle, ShieldCheck, Sprout } from 'lucide-react'
import { cn } from '@/lib/format'

const points = [
  { icon: Sprout, text: 'Bitki, fidan və bağ məhsullarınızı pulsuz yerləşdirin' },
  { icon: MessageCircle, text: 'Alıcılar sizə zəng edir və ya WhatsApp-da yazır' },
  { icon: ShieldCheck, text: 'Nömrəniz SMS ilə təsdiqlənir — alıcılar sizə güvənir' },
]

/**
 * Frame of the sign-in, registration and password pages: the form column (max 460 px) and, from 1024 px, a photo
 * panel with what an account gives. Phones get the form only.
 */
export function AuthShell({ title, lead, children, image = '/images/auth/login.webp' }: { title: string; lead?: ReactNode; children: ReactNode; image?: string }) {
  return (
    <div className="page-x mx-auto grid w-full max-w-[1200px] grid-cols-1 items-start gap-10 pt-6 pb-12 md:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16 lg:pt-14">
      <aside aria-hidden className="relative hidden overflow-hidden rounded-2xl lg:block">
        <img src={image} alt="" className="aspect-[5/6] w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-ink/85 via-ink/60 to-transparent p-7 pt-24 text-white">
          {points.map(({ icon: Icon, text }) => (
            <p key={text} className="flex items-center gap-3 text-[15px] leading-[1.4] font-medium">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface/15">
                <Icon size={18} strokeWidth={1.8} />
              </span>
              {text}
            </p>
          ))}
        </div>
      </aside>
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-6 lg:mx-0 lg:order-first lg:max-w-none">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[30px]">{title}</h1>
          {lead && <p className="text-[15px] leading-[1.5] text-ink-soft">{lead}</p>}
        </div>
        {children}
      </div>
    </div>
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

/** A white card around a form. */
export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 md:p-7', className)}>{children}</div>
}
