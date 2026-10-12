import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { cities } from '@/data/cities'
import { businessTypes, type AccountProfile } from '@/data/user'
import { emailError, formatPhone, hasErrors, messages, phoneError, requiredError, type Errors } from '@/features/auth/validation'
import { Card, PanelTitle } from '../ui'

type Field = 'company' | 'contact' | 'phone' | 'email'

/**
 * Figma "Şirkət və əlaqə məlumatları" panel (Profil məlumatları · 1440).
 * Saving patches the session profile and shows the "Dəyişikliklər saxlanıldı" notice from the components frame.
 */
export function ProfileForm({ account, onSave }: { account: AccountProfile; onSave: (patch: Partial<AccountProfile>) => void }) {
  const isBusiness = account.accountType === 'business'
  const [values, setValues] = useState({
    company: account.companyName ?? '',
    businessType: account.businessType || businessTypes[0],
    contact: account.fullName,
    phone: account.phone,
    email: account.email,
    cityId: account.cityId ?? cities[0].id,
    address: account.address ?? '',
    about: account.about ?? '',
  })
  const [errors, setErrors] = useState<Errors<Field>>({})
  const [saved, setSaved] = useState(false)

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => {
    const value = e.target.value
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const phoneUnchanged = formatPhone(values.phone) === account.phone
  const phoneVerified = Boolean(account.phoneVerified && account.phone) && phoneUnchanged

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: Errors<Field> = {
      company: isBusiness ? requiredError(values.company, messages.companyRequired) : undefined,
      contact: requiredError(values.contact, messages.nameRequired),
      // At least one contact is required (registration allows phone-only or e-mail-only accounts).
      phone: phoneError(values.phone, !values.email.trim()),
      email: emailError(values.email, !values.phone.trim()),
    }
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      setSaved(false)
      return
    }
    const phone = values.phone.trim() ? formatPhone(values.phone) : ''
    onSave({
      companyName: isBusiness ? values.company.trim() : account.companyName,
      businessType: isBusiness ? values.businessType : account.businessType,
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
  }

  return (
    <Card className="w-full">
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
            <SelectField
              label="Biznes növü seçin"
              name="businessType"
              value={values.businessType}
              onChange={set('businessType')}
              options={businessTypes.map((t) => ({ value: t, label: t }))}
              containerClassName="w-full"
            />
          </>
        )}
        <TextField
          label={isBusiness ? 'Əlaqələndirici şəxs' : 'Ad və soyad'}
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
        <SelectField
          label="Şəhər seçin"
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
        {isBusiness && (
          <TextAreaField label="Şirkət haqqında" name="about" value={values.about} onChange={set('about')} containerClassName="w-full" />
        )}
        <Button type="submit">Dəyişiklikləri yadda saxla</Button>
        {saved && (
          <Notice tone="success" title="Dəyişikliklər saxlanıldı">
            Profil məlumatlarınız yeniləndi.
          </Notice>
        )}
      </form>
    </Card>
  )
}
