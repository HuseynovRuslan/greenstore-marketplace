'use client'

import { useState, type FormEvent } from 'react'
import { CircleCheck, Hammer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CharCount, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { PhoneField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'
import { cn } from '@/lib/format'
import { phoneFieldError } from '@/lib/phone'
import { useSession } from '@/state/store'
import { sendServiceRequest } from './actions'

interface RequestProps {
  /** Who receives it: one provider (service page) or every provider of the category (catalogue) */
  provider?: { id: string; name: string }
  serviceId?: string
  categoryId?: string
  label?: string
  variant?: 'primary' | 'secondary'
  className?: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * «Usta çağır»: a short request — what (service type), where (city, area), how big, when, a description and the
 * contact (pre-filled for signed-in users). Sent through a Server Action; the success view gives the request number
 * and what happens next. On phones the dialog is a bottom sheet.
 */
export function RequestButton({ provider, serviceId, categoryId, label = 'Usta çağır', variant = 'primary', className }: RequestProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} aria-haspopup="dialog" icon={<Hammer aria-hidden size={18} strokeWidth={1.8} />} className={className}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={provider ? `Usta çağır: ${provider.name}` : 'Usta çağır'} className="sm:max-w-[520px]">
        <RequestForm provider={provider} serviceId={serviceId} categoryId={categoryId} onClose={() => setOpen(false)} />
      </Dialog>
    </>
  )
}

function RequestForm({ provider, serviceId, categoryId, onClose }: RequestProps & { onClose: () => void }) {
  const { user } = useSession()
  const [form, setForm] = useState({
    categoryId: categoryId ?? '',
    cityId: '',
    area: '',
    size: '',
    date: '',
    description: '',
    name: user?.fullName ?? '',
    phone: user?.phone ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [sent, setSent] = useState<number>()
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found = {
      categoryId: form.categoryId ? undefined : 'Xidmətin növünü seçin.',
      cityId: form.cityId ? undefined : 'Şəhəri seçin.',
      description: form.description.trim().length >= 10 ? undefined : 'Nə etmək lazım olduğunu yazın (ən azı 10 simvol).',
      name: form.name.trim() ? undefined : 'Adınızı yazın.',
      phone: phoneFieldError(form.phone),
      date: form.date && form.date < todayIso() ? 'Bu gündən sonrakı tarixi seçin.' : undefined,
    }
    setErrors(found)
    const first = Object.entries(found).find(([, v]) => v)?.[0]
    if (first) return document.getElementById(`sorgu-${first}`)?.focus()
    setBusy(true)
    setFailure(undefined)
    const result = await sendServiceRequest({
      serviceId,
      providerId: provider?.id,
      categoryId: form.categoryId,
      cityId: form.cityId,
      area: form.area.trim() || undefined,
      size: form.size.trim() || undefined,
      preferredDate: form.date || undefined,
      description: form.description.trim(),
      name: form.name.trim(),
      phone: form.phone,
    })
    setBusy(false)
    if (!result.ok) return setFailure(result.error)
    setSent(result.number)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CircleCheck aria-hidden size={44} strokeWidth={1.8} className="text-success" />
        <div role="status" className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-forest">Sorğu № {sent} göndərildi</p>
          <p className="text-sm leading-[1.5] text-ink-soft">
            {provider ? `${provider.name} adətən 1 saat ərzində zəng edir.` : 'Uyğun ustalar 1–2 saat ərzində sizə zəng edəcək.'} Demo: sorğu heç kimə göndərilmir.
          </p>
        </div>
        <Button variant="secondary" fullWidth onClick={onClose}>
          Bağla
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <SelectField
        id="sorgu-categoryId"
        label="Xidmət"
        value={form.categoryId}
        error={errors.categoryId}
        onChange={(e) => set('categoryId')(e.target.value)}
        options={[{ value: '', label: 'Seçin' }, ...serviceCategories.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="sorgu-cityId"
          label="Şəhər"
          value={form.cityId}
          error={errors.cityId}
          onChange={(e) => set('cityId')(e.target.value)}
          options={[{ value: '', label: 'Seçin' }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <TextField label="Ərazi" optional autoComplete="address-level3" placeholder="Məsələn: Mərdəkan" value={form.area} maxLength={60} onChange={(e) => set('area')(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Sahə" optional placeholder="Məsələn: 120 m²" value={form.size} maxLength={30} onChange={(e) => set('size')(e.target.value)} />
        <TextField id="sorgu-date" label="Nə vaxt" optional type="date" min={todayIso()} value={form.date} error={errors.date} onChange={(e) => set('date')(e.target.value)} />
      </div>
      <TextAreaField
        id="sorgu-description"
        label="Nə etmək lazımdır"
        rows={4}
        placeholder="Məsələn: həyətə çim salmaq, 10 tuya əkmək, damcı suvarma qurmaq."
        value={form.description}
        maxLength={1000}
        error={errors.description}
        aside={<CharCount value={form.description} max={1000} />}
        onChange={(e) => set('description')(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="sorgu-name" label="Adınız" autoComplete="name" value={form.name} error={errors.name} maxLength={60} onChange={(e) => set('name')(e.target.value)} />
        <PhoneField id="sorgu-phone" value={form.phone} error={errors.phone} onValueChange={set('phone')} />
      </div>
      {failure && (
        <Notice tone="danger" title="Göndərilmədi">
          {failure}
        </Notice>
      )}
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy} className={cn(busy && 'opacity-90')}>
        {busy ? 'Göndərilir…' : 'Sorğunu göndər'}
      </Button>
      <p className="text-center text-xs leading-[1.5] text-muted">Nömrəniz yalnız {provider ? 'bu ustaya' : 'uyğun ustalara'} göstərilir.</p>
    </form>
  )
}
