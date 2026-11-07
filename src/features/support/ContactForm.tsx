'use client'

import { useState, type FormEvent } from 'react'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CharCount, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { emailError } from '@/features/auth/validation'
import { phoneFieldError } from '@/lib/phone'
import { useSession } from '@/state/store'
import type { SupportMessageInput } from '@/types'
import { sendSupportMessage } from './actions'

const topics: Array<{ value: SupportMessageInput['topic'] | ''; label: string }> = [
  { value: '', label: 'Seçin' },
  { value: 'listing', label: 'Elanım haqqında' },
  { value: 'account', label: 'Hesab və giriş' },
  { value: 'payment', label: 'Ödəniş və paketlər' },
  { value: 'complaint', label: 'Satıcı və ya alıcıdan şikayət' },
  { value: 'other', label: 'Digər' },
]

/** «Bizimlə əlaqə»: topic, name, phone or e-mail, optional listing number, message → ticket number. */
export function ContactForm() {
  const { user } = useSession()
  const [form, setForm] = useState({ topic: '', name: user?.fullName ?? '', contact: user?.phone ?? '', listing: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [ticket, setTicket] = useState<number>()
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const contact = form.contact.trim()
    const found = {
      topic: form.topic ? undefined : 'Mövzunu seçin.',
      name: form.name.trim() ? undefined : 'Adınızı yazın.',
      contact: !contact ? 'Telefon və ya e-poçt yazın: cavabı ora göndərəcəyik.' : contact.includes('@') ? emailError(contact) : phoneFieldError(contact),
      listing: form.listing && !/^\d{3,8}$/.test(form.listing.trim()) ? 'Elan nömrəsini rəqəmlə yazın, məsələn 10482.' : undefined,
      message: form.message.trim().length >= 10 ? undefined : 'Sualınızı bir-iki cümlə ilə yazın.',
    }
    setErrors(found)
    const first = Object.entries(found).find(([, v]) => v)?.[0]
    if (first) return document.getElementById(`elaqe-${first}`)?.focus()
    setBusy(true)
    setFailure(undefined)
    const result = await sendSupportMessage({
      topic: form.topic as SupportMessageInput['topic'],
      name: form.name.trim(),
      contact,
      message: form.message.trim(),
      listingNumber: form.listing ? Number(form.listing) : undefined,
    })
    setBusy(false)
    if (!result.ok) return setFailure(result.error)
    setTicket(result.ticket)
  }

  if (ticket) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
        <CircleCheck aria-hidden size={40} strokeWidth={1.8} className="text-success" />
        <p className="text-lg font-semibold text-forest">Müraciət № {ticket} qəbul olundu</p>
        <p className="max-w-[44ch] text-sm leading-[1.5] text-ink-soft">İş saatlarında 2 saat ərzində cavab veririk. Demo: müraciət heç yerə göndərilmir.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 md:p-6">
      <SelectField id="elaqe-topic" label="Mövzu" value={form.topic} error={errors.topic} onChange={(e) => set('topic')(e.target.value)} options={topics} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="elaqe-name" label="Adınız" autoComplete="name" value={form.name} error={errors.name} maxLength={60} onChange={(e) => set('name')(e.target.value)} />
        <TextField
          id="elaqe-contact"
          label="Telefon və ya e-poçt"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="050 555 12 34 və ya ad@poct.az"
          value={form.contact}
          error={errors.contact}
          onChange={(e) => set('contact')(e.target.value)}
        />
      </div>
      {(form.topic === 'listing' || form.topic === 'complaint') && (
        <TextField id="elaqe-listing" label="Elan nömrəsi" optional inputMode="numeric" placeholder="10482" hint="Elanın altında «Elan №» yazılıb." value={form.listing} error={errors.listing} onChange={(e) => set('listing')(e.target.value.replace(/\D/g, ''))} />
      )}
      <TextAreaField
        id="elaqe-message"
        label="Mesaj"
        rows={5}
        maxLength={2000}
        value={form.message}
        error={errors.message}
        aside={<CharCount value={form.message} max={2000} />}
        onChange={(e) => set('message')(e.target.value)}
      />
      {failure && (
        <Notice tone="danger" title="Göndərilmədi">
          {failure}
        </Notice>
      )}
      <Button type="submit" disabled={busy} aria-busy={busy} className="self-start max-sm:w-full">
        {busy ? 'Göndərilir…' : 'Göndər'}
      </Button>
    </form>
  )
}
