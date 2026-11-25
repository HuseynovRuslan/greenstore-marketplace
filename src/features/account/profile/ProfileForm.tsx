'use client'

import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { FieldGroup, NameField, PhoneField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { cities } from '@/data/cities'
import type { AccountProfile } from '@/data/user'
import { saveProfile, confirmPhoneChange, type ProfileField } from '@/features/account/actions'
import { requestCode } from '@/features/auth/actions'
import { OtpVerify } from '@/features/auth/OtpVerify'
import { emailError, formatPhone, hasErrors, messages, requiredError, type Errors } from '@/features/auth/validation'
import { orderedKinds } from '@/features/seller/businessKinds'
import { BusinessKindsField } from '@/features/seller/BusinessKindsField'
import { joinFullName, namePartError, splitFullName } from '@/lib/names'
import { phoneFieldError } from '@/lib/phone'
import { useSession } from '@/state/store'
import type { BusinessKind, OtpChallenge } from '@/types'
import { Card, PanelTitle } from '../ui'

type Field = 'company' | 'kinds' | 'firstName' | 'lastName' | 'phone' | 'email'

/** DATA_SOURCE=api: the API's rule for a shop's name (2–80 characters), so it is said before anything is saved. */
function companyNameError(value: string): string | undefined {
  const name = value.trim()
  if (!name) return messages.companyRequired
  if (name.length < 2) return 'Şirkətin adı ən azı 2 simvol olsun.'
  return name.length > 80 ? 'Şirkətin adı ən çox 80 simvol olsun.' : undefined
}

/**
 * The API's field (ProfileField) on this form; the address and «about» errors are said above the button. The API
 * keeps one name (`fullName`, `contactPerson`), so its error goes on «Ad».
 */
const FORM_FIELD: Partial<Record<ProfileField, Field>> = { company: 'company', kinds: 'kinds', contact: 'firstName', email: 'email' }

/**
 * The profile form of /kabinet/profil, in cards: «Şirkət» (name, kinds, about; a business), «Əlaqə» and «Ünvan», with
 * one «Dəyişiklikləri yadda saxla» under them. Saving shows the "Dəyişikliklər saxlanıldı" notice from the components
 * frame. The logo and the cover are not here: ProfileHero saves them on their own.
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
  const name = splitFullName(account.fullName)
  const [values, setValues] = useState({
    company: account.companyName ?? '',
    firstName: name.first,
    lastName: name.last,
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

  const setValue = (key: keyof typeof values) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValue(key)(e.target.value)

  const phoneUnchanged = formatPhone(values.phone) === account.phone
  const phoneVerified = Boolean(account.phoneVerified && account.phone) && phoneUnchanged
  const showPlace = isBusiness || !api

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: Errors<Field> = {
      company: isBusiness ? (api ? companyNameError(values.company) : requiredError(values.company, messages.companyRequired)) : undefined,
      kinds: isBusiness && kinds.length === 0 ? 'Ən azı bir biznes növü seçin.' : undefined,
      firstName: namePartError(values.firstName, 'Adınızı'),
      lastName: namePartError(values.lastName, 'Soyadınızı'),
      // At least one contact is required (registration allows phone-only or e-mail-only accounts).
      phone: phoneFieldError(values.phone, { required: !values.email.trim() }),
      email: emailError(values.email, !values.phone.trim()),
    }
    const fullName = joinFullName(values.firstName, values.lastName)
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
        fullName,
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
      fullName,
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

  // «Ad» and «Soyad»: under the legend «Əlaqə şəxsi» for a business, on their own for a person.
  const nameFields = (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      <NameField
        id="profile-first-name"
        label="Ad"
        name="given-name"
        autoComplete="given-name"
        value={values.firstName}
        onValueChange={setValue('firstName')}
        error={errors.firstName}
      />
      <NameField
        id="profile-last-name"
        label="Soyad"
        name="family-name"
        autoComplete="family-name"
        value={values.lastName}
        onValueChange={setValue('lastName')}
        error={errors.lastName}
      />
    </div>
  )

  return (
    <div className="flex w-full flex-col gap-6">
      <form noValidate onSubmit={submit} aria-label="Profil məlumatları" className="flex w-full flex-col gap-6">
        {isBusiness && (
          <Card role="group" aria-labelledby="profile-company-title" className="w-full gap-5">
            <PanelTitle id="profile-company-title">Şirkət</PanelTitle>
            <TextField
              id="profile-company"
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
            <TextAreaField
              id="profile-about"
              label="Şirkət haqqında"
              name="about"
              value={values.about}
              onChange={set('about')}
              hint="Nə yetişdirirsiniz, nə satırsınız, nə ilə fərqlənirsiniz: alıcı bunu səhifənizdə ilk oxuyur."
              containerClassName="w-full"
            />
          </Card>
        )}
        <Card role="group" aria-labelledby="profile-contact-title" className="w-full gap-5">
          <PanelTitle id="profile-contact-title">{isBusiness ? 'Əlaqə' : 'Əlaqə məlumatları'}</PanelTitle>
          {isBusiness ? (
            <FieldGroup legend="Əlaqə şəxsi" className="w-full">
              {nameFields}
            </FieldGroup>
          ) : (
            nameFields
          )}
          <PhoneField
            id="profile-phone"
            name="phone"
            value={values.phone}
            onValueChange={setValue('phone')}
            hint="Nömrəni dəyişdikdə yenidən təsdiq tələb olunur."
            error={errors.phone}
            containerClassName="w-full"
          />
          {phoneVerified && <Badge tone="success">Telefon təsdiqlənib</Badge>}
          <TextField
            id="profile-email"
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
        </Card>
        {showPlace && (
          <Card role="group" aria-labelledby="profile-place-title" className="w-full gap-5">
            <PanelTitle id="profile-place-title">Ünvan</PanelTitle>
            <SelectField
              label="Şəhər"
              name="city"
              value={values.cityId}
              onChange={set('cityId')}
              options={cities.map((c) => ({ value: c.id, label: c.name }))}
              containerClassName="w-full"
            />
            <TextField
              id="profile-address"
              label="Ünvan"
              name="address"
              autoComplete="street-address"
              value={values.address}
              onChange={set('address')}
              containerClassName="w-full"
            />
          </Card>
        )}
        <Card className="w-full gap-4">
          {formError && (
            <Notice tone="danger" title={formError.title}>
              {formError.text}
            </Notice>
          )}
          {saved && (
            <Notice tone="success" title="Dəyişikliklər saxlanıldı">
              {phoneChange ? 'Yeni nömrəni SMS kodu ilə təsdiqləyin: o vaxta qədər köhnə nömrə qalır.' : 'Profil məlumatlarınız yeniləndi.'}
            </Notice>
          )}
          <Button type="submit" disabled={busy} aria-busy={busy} className="max-sm:w-full">
            {busy ? 'Saxlanılır…' : 'Dəyişiklikləri yadda saxla'}
          </Button>
        </Card>
      </form>
      {phoneChange && (
        <Card className="w-full gap-5">
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
        </Card>
      )}
    </div>
  )
}
