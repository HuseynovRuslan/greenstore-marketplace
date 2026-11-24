'use client'

import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { cities } from '@/data/cities'
import type { AccountProfile } from '@/data/user'
import { saveProfile, confirmPhoneChange, type ProfileField } from '@/features/account/actions'
import { requestCode } from '@/features/auth/actions'
import { OtpVerify } from '@/features/auth/OtpVerify'
import { emailError, formatPhone, hasErrors, messages, phoneError, requiredError, type Errors } from '@/features/auth/validation'
import { orderedKinds } from '@/features/seller/businessKinds'
import { BusinessKindsField } from '@/features/seller/BusinessKindsField'
import { useSession } from '@/state/store'
import type { BusinessKind, OtpChallenge } from '@/types'
import { Card, PanelTitle } from '../ui'

type Field = 'company' | 'kinds' | 'contact' | 'phone' | 'email'

/** DATA_SOURCE=api: the API's rule for a shop's name (2–80 characters), so it is said before anything is saved. */
function companyNameError(value: string): string | undefined {
  const name = value.trim()
  if (!name) return messages.companyRequired
  if (name.length < 2) return 'Şirkətin adı ən azı 2 simvol olsun.'
  return name.length > 80 ? 'Şirkətin adı ən çox 80 simvol olsun.' : undefined
}

/** The API's field (ProfileField) on this form; the address and «about» errors are said above the button. */
const FORM_FIELD: Partial<Record<ProfileField, Field>> = { company: 'company', kinds: 'kinds', contact: 'contact', email: 'email' }

/**
 * Figma "Şirkət və əlaqə məlumatları" panel (Profil məlumatları · 1440).
 * Saving shows the "Dəyişikliklər saxlanıldı" notice from the components frame.
 * - DATA_SOURCE=mock: patches the session profile in the browser (`onSave`).
 * - DATA_SOURCE=api: saves the account (`PATCH /me`) and, for a business, its «mağaza» (`PATCH /me/seller`: name,
 *   kind, city, address, about, and the contact person), which its public page /saticilar/<slug> shows at once; then
 *   `onSave` gets the account as the API has it. A new phone number is confirmed by an SMS code to it first («Nömrəni
 *   dəyişdikdə yenidən təsdiq tələb olunur»). An individual account has no city or address on the API: those fields
 *   are not shown then.
 */
export function ProfileForm({ account, onSave }: { account: AccountProfile; onSave: (patch: Partial<AccountProfile>) => void }) {
  const { source } = useSession()
  const api = source === 'api'
  const isBusiness = account.accountType === 'business'
  const [values, setValues] = useState({
    company: account.companyName ?? '',
    contact: account.fullName,
    phone: account.phone,
    email: account.email,
    cityId: account.cityId ?? cities[0].id,
    address: account.address ?? '',
    about: account.about ?? '',
  })
  const [kinds, setKinds] = useState<BusinessKind[]>(orderedKinds(account.businessKinds))
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<{ title: string; text: string }>()
  // DATA_SOURCE=api: the SMS code sent to a new number, until it is confirmed.
  const [phoneChange, setPhoneChange] = useState<{ phone: string; challenge: OtpChallenge }>()

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => {
    const value = e.target.value
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const phoneUnchanged = formatPhone(values.phone) === account.phone
  const phoneVerified = Boolean(account.phoneVerified && account.phone) && phoneUnchanged
  const showPlace = isBusiness || !api

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: Errors<Field> = {
      company: isBusiness ? (api ? companyNameError(values.company) : requiredError(values.company, messages.companyRequired)) : undefined,
      kinds: isBusiness && kinds.length === 0 ? 'Ən azı bir biznes növü seçin.' : undefined,
      contact: requiredError(values.contact, messages.nameRequired),
      // At least one contact is required (registration allows phone-only or e-mail-only accounts).
      phone: phoneError(values.phone, !values.email.trim()),
      email: emailError(values.email, !values.phone.trim()),
    }
    setErrors(nextErrors)
    setFormError(undefined)
    if (hasErrors(nextErrors)) {
      setSaved(false)
      return
    }
    const phone = values.phone.trim() ? formatPhone(values.phone) : ''
    if (!api) {
      onSave({
        companyName: isBusiness ? values.company.trim() : account.companyName,
        businessKinds: isBusiness ? kinds : account.businessKinds,
        fullName: values.contact.trim(),
        phone,
        phoneVerified: phone === account.phone ? account.phoneVerified : false,
        email: values.email.trim(),
        cityId: values.cityId,
        address: values.address.trim(),
        about: values.about.trim(),
      })
      setValues((prev) => ({ ...prev, phone }))
      setSaved(true)
      return
    }

    setBusy(true)
    const result = await saveProfile({
      fullName: values.contact.trim(),
      email: values.email.trim(),
      ...(isBusiness
        ? { companyName: values.company.trim(), businessKinds: kinds, cityId: values.cityId, address: values.address.trim(), about: values.about.trim(), sellerVersion: account.sellerVersion }
        : {}),
    })
    if (!result.ok) {
      setBusy(false)
      // The name and e-mail were saved, the «mağaza» was not.
      if (result.saved) {
        onSave(result.saved)
        setFormError({ title: 'Mağaza məlumatları saxlanılmadı', text: `Ad və e-poçt saxlanıldı. ${result.error}` })
        return
      }
      const field = result.field && FORM_FIELD[result.field]
      if (field) setErrors({ [field]: result.error })
      else setFormError({ title: 'Dəyişikliklər saxlanılmadı', text: result.error })
      return
    }
    onSave(result.account)
    // The account's number changes only with an SMS code sent to the new one.
    if (phone && phone !== account.phone) {
      const code = await requestCode(phone, 'change-phone')
      if (code.ok) setPhoneChange({ phone, challenge: code })
      else setErrors({ phone: code.error })
    }
    setBusy(false)
    setSaved(true)
  }

  const confirmPhone = async (challengeId: string) => {
    const result = await confirmPhoneChange(challengeId)
    setPhoneChange(undefined)
    if (!result.ok) return setErrors((prev) => ({ ...prev, phone: result.error }))
    onSave({ phone: result.phone, phoneVerified: true })
    setValues((prev) => ({ ...prev, phone: result.phone }))
  }

  return (
    <Card className="w-full gap-5">
      <form noValidate onSubmit={submit} aria-labelledby="profile-form-title" className="flex w-full flex-col items-start gap-5">
        <PanelTitle id="profile-form-title">{isBusiness ? 'Şirkət və əlaqə məlumatları' : 'Əlaqə məlumatları'}</PanelTitle>
        {isBusiness && (
          <>
            <TextField
              label="Şirkətin adı"
              name="company"
              autoComplete="organization"
              value={values.company}
              onChange={set('company')}
              error={errors.company}
              containerClassName="w-full"
            />
            <BusinessKindsField
              id="profile-kinds"
              value={kinds}
              onChange={(next) => {
                setKinds(next)
                setSaved(false)
                if (next.length > 0) setErrors((prev) => ({ ...prev, kinds: undefined }))
              }}
              error={errors.kinds}
              className="w-full"
            />
          </>
        )}
        <TextField
          label={isBusiness ? 'Əlaqə şəxsi' : 'Ad və soyad'}
          name="contact"
          autoComplete="name"
          value={values.contact}
          onChange={set('contact')}
          error={errors.contact}
          containerClassName="w-full"
        />
        <TextField
          label="Telefon nömrəsi"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={set('phone')}
          hint="Nömrəni dəyişdikdə yenidən təsdiq tələb olunur."
          error={errors.phone}
          containerClassName="w-full"
        />
        {phoneVerified && <Badge tone="success">Telefon təsdiqlənib</Badge>}
        <TextField
          label="E-poçt ünvanı"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          containerClassName="w-full"
        />
        {showPlace && (
          <>
            <SelectField
              label="Şəhər"
              name="city"
              value={values.cityId}
              onChange={set('cityId')}
              options={cities.map((c) => ({ value: c.id, label: c.name }))}
              containerClassName="w-full"
            />
            <TextField
              label="Ünvan"
              name="address"
              autoComplete="street-address"
              value={values.address}
              onChange={set('address')}
              containerClassName="w-full"
            />
          </>
        )}
        {isBusiness && (
          <TextAreaField label="Şirkət haqqında" name="about" value={values.about} onChange={set('about')} containerClassName="w-full" />
        )}
        {formError && (
          <Notice tone="danger" title={formError.title}>
            {formError.text}
          </Notice>
        )}
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Saxlanılır…' : 'Dəyişiklikləri yadda saxla'}
        </Button>
        {saved && (
          <Notice tone="success" title="Dəyişikliklər saxlanıldı">
            {phoneChange ? 'Yeni nömrəni SMS kodu ilə təsdiqləyin: o vaxta qədər köhnə nömrə qalır.' : 'Profil məlumatlarınız yeniləndi.'}
          </Notice>
        )}
      </form>
      {phoneChange && (
        <div className="w-full border-t border-line pt-5">
          <OtpVerify
            challenge={phoneChange.challenge}
            phone={phoneChange.phone}
            purpose="change-phone"
            submitLabel="Nömrəni təsdiqlə"
            onVerified={confirmPhone}
            onChangePhone={() => {
              setPhoneChange(undefined)
              document.querySelector<HTMLInputElement>('input[name="phone"]')?.focus()
            }}
          />
        </div>
      )}
    </Card>
  )
}
