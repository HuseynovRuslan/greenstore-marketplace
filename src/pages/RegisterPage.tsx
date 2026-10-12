import { InfoNotice } from '@/components/ui/Notice'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useSession } from '@/app/store'
import { businessTypes, type AccountProfile } from '@/data/user'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { AuthIntro } from '@/features/auth/AuthIntro'
import { Card, Checkbox } from '@/features/account/ui'
import { pillClass } from '@/features/account/pill'
import {
  emailError,
  formatPhone,
  hasErrors,
  messages,
  newPasswordError,
  phoneError,
  requiredError,
  safeNext,
  type Errors,
} from '@/features/auth/validation'
import type { SellerType } from '@/types'

type Method = 'phone' | 'email'
type Field = 'company' | 'name' | 'phone' | 'email' | 'password' | 'repeat' | 'consent'

/* Example values from the Figma frame, shown as (muted) placeholders on an empty form. */
const examples = {
  company: 'Abşeron Tingçilik',
  name: 'Elvin Əliyev',
  phone: '+994 50 555 12 34',
  email: 'info@absheronting.az',
}
const exampleClass = 'placeholder:text-muted'

/**
 * Figma "Qeydiyyat · 1440" (/qeydiyyat).
 * Registration is mocked: a valid form signs in and stores the entered details on the session profile.
 */
export default function RegisterPage() {
  const { signIn, updateProfile } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')

  const [accountType, setAccountType] = useState<SellerType>('business')
  const [businessType, setBusinessType] = useState(businessTypes[0])
  const [company, setCompany] = useState('')
  const [name, setName] = useState('')
  const [method, setMethod] = useState<Method>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Errors<Field>>({})

  const isBusiness = accountType === 'business'

  const validate = (): Errors<Field> => ({
    company: isBusiness ? requiredError(company, messages.companyRequired) : undefined,
    name: requiredError(name, messages.nameRequired),
    phone: phoneError(phone, method === 'phone'),
    email: emailError(email, method === 'email'),
    password: newPasswordError(password),
    repeat: !repeat ? messages.passwordRepeat : repeat !== password ? messages.passwordMismatch : undefined,
    consent: consent ? undefined : messages.consent,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      const first = Object.keys(nextErrors).find((k) => nextErrors[k as Field])
      document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    const profile: Partial<AccountProfile> = {
      fullName: name.trim(),
      accountType,
      phone: phone.trim() ? formatPhone(phone) : '',
      email: email.trim(),
      companyName: isBusiness ? company.trim() : '',
      businessType: isBusiness ? businessType : '',
      verified: false,
      phoneVerified: false,
    }
    signIn(email.trim() || undefined)
    updateProfile(profile)
    navigate(safeNext(next), { replace: true })
  }

  /** Re-validate a field as the user corrects it (only once it has been flagged). */
  const clear = (field: Field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const loginHref = next ? `/daxil-ol?next=${encodeURIComponent(next)}` : '/daxil-ol'

  const phoneField = (
    <TextField
      key="phone"
      label={method === 'phone' ? 'Telefon nömrəsi' : 'Telefon nömrəsi (istəyə bağlı)'}
      name="phone"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={examples.phone}
      className={exampleClass}
      value={phone}
      onChange={(e) => {
        setPhone(e.target.value)
        clear('phone')
      }}
      hint={method === 'phone' ? 'Təsdiq kodu bu nömrəyə göndəriləcək.' : undefined}
      error={errors.phone}
      containerClassName="w-full"
    />
  )
  const emailField = (
    <TextField
      key="email"
      label={method === 'email' ? 'E-poçt ünvanı' : 'E-poçt ünvanı (istəyə bağlı)'}
      name="email"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder={examples.email}
      className={exampleClass}
      value={email}
      onChange={(e) => {
        setEmail(e.target.value)
        clear('email')
      }}
      error={errors.email}
      containerClassName="w-full"
    />
  )

  return (
    <div className="page-x mx-auto w-full max-w-[1440px] pt-[39px] pb-6 md:pt-[51px] md:pb-9">
      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[480fr_768fr] xl:gap-16">
        <AuthIntro
          image="/images/auth/register.webp"
          imageClassName="aspect-square"
          title="Yaşıl bazarın bir hissəsi olun"
          lead="Fərdi satıcılar, tingçilik təsərrüfatları, bağ mərkəzləri və landşaft şirkətləri üçün bir platforma."
        >
          <InfoNotice title="Alıcı ilə birbaşa əlaqə">
            Elanınızı dərc edin. Alıcılar sizinlə telefon və ya WhatsApp vasitəsilə əlaqə saxlasın.
          </InfoNotice>
        </AuthIntro>

        <div className="flex min-w-0 flex-col items-start gap-6">
          <SectionHeader
            as="h1"
            title="Hesab yaradın"
            subtitle="Elan yerləşdirmək və seçilmişləri saxlamaq üçün qeydiyyatdan keçin."
          />

          <Card className="w-full">
            <form noValidate onSubmit={submit} className="flex w-full flex-col items-start gap-5">
              <p id="account-type" className="text-[13px] leading-[1.5] font-semibold text-ink">
                Hesab növü
              </p>
              <div role="group" aria-labelledby="account-type" className="flex flex-wrap items-start gap-2">
                {(
                  [
                    ['individual', 'Fərdi şəxs'],
                    ['business', 'Biznes'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={accountType === value}
                    onClick={() => {
                      setAccountType(value)
                      setErrors((prev) => ({ ...prev, company: undefined }))
                    }}
                    className={pillClass(accountType === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {isBusiness && (
                <>
                  <SelectField
                    label="Biznes növü seçin"
                    name="businessType"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    options={businessTypes.map((t) => ({ value: t, label: t }))}
                    hint="Bağ mərkəzi və ya landşaft şirkəti də seçə bilərsiniz."
                    containerClassName="w-full"
                  />
                  <TextField
                    label="Şirkətin adı"
                    name="company"
                    autoComplete="organization"
                    placeholder={examples.company}
                    className={exampleClass}
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value)
                      clear('company')
                    }}
                    error={errors.company}
                    containerClassName="w-full"
                  />
                </>
              )}

              <TextField
                label={isBusiness ? 'Əlaqələndirici şəxsin adı' : 'Ad və soyad'}
                name="name"
                autoComplete="name"
                placeholder={examples.name}
                className={exampleClass}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  clear('name')
                }}
                error={errors.name}
                containerClassName="w-full"
              />

              <div role="group" aria-label="Əlaqə üsulu" className="flex flex-wrap items-start gap-2">
                {(
                  [
                    ['phone', 'Telefonla'],
                    ['email', 'E-poçtla'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={method === value}
                    onClick={() => {
                      setMethod(value)
                      setErrors((prev) => ({ ...prev, phone: undefined, email: undefined }))
                    }}
                    className={pillClass(method === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {method === 'phone' ? (
                <>
                  {phoneField}
                  {emailField}
                </>
              ) : (
                <>
                  {emailField}
                  {phoneField}
                </>
              )}

              <TextField
                label="Şifrə"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clear('password')
                }}
                hint={messages.passwordRule}
                error={errors.password}
                containerClassName="w-full"
              />
              <TextField
                label="Şifrənin təkrarı"
                name="repeat"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => {
                  setRepeat(e.target.value)
                  clear('repeat')
                }}
                error={errors.repeat}
                containerClassName="w-full"
              />

              <div className="flex w-full flex-col gap-[7px]">
                <Checkbox
                  name="consent"
                  className="text-[13px] leading-[1.5]"
                  label="İstifadə şərtlərini və Məxfilik siyasətini oxudum, şəxsi məlumatlarımın emalına razıyam."
                  checked={consent}
                  aria-invalid={errors.consent ? true : undefined}
                  onChange={(e) => {
                    setConsent(e.target.checked)
                    clear('consent')
                  }}
                />
                {errors.consent && (
                  <p role="alert" className="text-xs leading-[1.5] text-danger">
                    {errors.consent}
                  </p>
                )}
              </div>

              <Button type="submit" fullWidth>
                Qeydiyyatdan keç
              </Button>

              <p className="w-full text-sm leading-[1.5] text-ink">
                Artıq hesabınız var?{' '}
                <Link to={loginHref} className="hover:text-olive hover:underline">
                  Daxil olun →
                </Link>
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
