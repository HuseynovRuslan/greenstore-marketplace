'use client'

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CharCount, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { NameField, PhoneField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { Segmented } from '@/features/auth/ui'
import { emailError } from '@/features/auth/validation'
import { isPersonName, nameChars } from '@/lib/names'
import { phoneFieldError } from '@/lib/phone'
import { useDataSource, useSession } from '@/state/store'
import type { SupportMessageInput } from '@/types'
import { sendSupportMessage } from './actions'
import { contactTopics, topicFromParam, type ContactTopic } from './contactTopics'

const topics: Array<{ value: ContactTopic | ''; label: string }> = [{ value: '', label: 'Seçin' }, ...contactTopics]

/**
 * «Bizimlə əlaqə»: topic, name (letters only), where the answer goes («Telefon» with the masked number, or «E-poçt»),
 * optional listing number, message → ticket number. `initialTopic` comes from a link that names the subject
 * (?movzu=, see ContactFormFromUrl).
 */
export function ContactForm({ initialTopic }: { initialTopic?: ContactTopic }) {
  const { user } = useSession()
  const demo = useDataSource() === 'mock'
  const [form, setForm] = useState({ topic: initialTopic ?? '', name: nameChars(user?.fullName ?? ''), phone: user?.phone ?? '', email: user?.email ?? '', listing: '', message: '' })
  // Where the answer goes: the phone unless the account has only an e-mail.
  const [channel, setChannel] = useState<'phone' | 'email'>(!user?.phone && user?.email ? 'email' : 'phone')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [ticket, setTicket] = useState<number>()
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const contact = channel === 'phone' ? form.phone : form.email.trim()
    const found = {
      topic: form.topic ? undefined : 'Mövzunu seçin.',
      name: !form.name.trim() ? 'Adınızı yazın.' : isPersonName(form.name) ? undefined : 'Adınızı yalnız hərflərlə yazın.',
      contact: channel === 'phone' ? phoneFieldError(contact) : emailError(contact),
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
    }).catch(() => ({ ok: false as const, error: 'Mesajı göndərmək alınmadı. İnternet bağlantısını yoxlayın.' }))
    setBusy(false)
    if (!result.ok) return setFailure(result.error)
    setTicket(result.ticket)
  }

  if (ticket) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
        <CircleCheck aria-hidden size={40} strokeWidth={1.8} className="text-success" />
        <p className="text-lg font-semibold text-forest">Müraciət № {ticket} qəbul olundu</p>
        <p className="max-w-[44ch] text-sm leading-[1.5] text-ink-soft">
          İş saatlarında 2 saat ərzində cavab veririk.{demo && ' Demo: müraciət heç yerə göndərilmir.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 md:p-6">
      <SelectField id="elaqe-topic" label="Mövzu" value={form.topic} error={errors.topic} onChange={(e) => set('topic')(e.target.value)} options={topics} />
      <NameField id="elaqe-name" label="Adınız" autoComplete="name" value={form.name} error={errors.name} maxLength={60} onValueChange={set('name')} />
      <div className="flex flex-col gap-2.5">
        {/* The same words name the radio group for screen readers (Segmented's legend). */}
        <p aria-hidden className="text-[13px] leading-[normal] font-semibold text-ink">
          Cavabı hara göndərək?
        </p>
        <Segmented
          legend="Cavabı hara göndərək?"
          name="elaqe-kanal"
          value={channel}
          onChange={(next) => {
            setChannel(next)
            setErrors((prev) => ({ ...prev, contact: undefined }))
          }}
          options={[
            { value: 'phone', label: 'Telefon' },
            { value: 'email', label: 'E-poçt' },
          ]}
        />
        {channel === 'phone' ? (
          <PhoneField id="elaqe-contact" labelHidden value={form.phone} error={errors.contact} onValueChange={set('phone')} />
        ) : (
          <TextField
            id="elaqe-contact"
            label="E-poçt ünvanı"
            labelHidden
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ad@poct.az"
            value={form.email}
            error={errors.contact}
            onChange={(e) => set('email')(e.target.value)}
          />
        )}
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
        {busy ? 'Göndərilir…' : 'Mesajı göndər'}
      </Button>
    </form>
  )
}

/**
 * The form on the topic a link chose (/elaqe?movzu=sikayet — the footer's «Problem bildir»). The page keeps its
 * static HTML: wrapped in <Suspense fallback={<ContactForm />}>, this part renders in the browser, where the query
 * is known. `key`: a client-side link to another topic starts the form again on that topic.
 */
export function ContactFormFromUrl() {
  const topic = topicFromParam(useSearchParams().get('movzu'))
  return <ContactForm key={topic ?? ''} initialTopic={topic} />
}
