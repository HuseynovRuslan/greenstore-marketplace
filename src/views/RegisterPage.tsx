'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { CheckboxField, ChoiceCard, FieldGroup, NameField, PasswordField, PhoneField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { useToast } from '@/components/ui/Toast'
import { registerAccount, requestCode } from '@/features/auth/actions'
import { OtpVerify } from '@/features/auth/OtpVerify'
import { AuthShell, FormCard, PasswordRules } from '@/features/auth/ui'
import { emailError, newPasswordError, safeNext } from '@/features/auth/validation'
import { BusinessKindsField } from '@/features/seller/BusinessKindsField'
import { cn } from '@/lib/format'
import { joinFullName, namePartError } from '@/lib/names'
import { phoneFieldError } from '@/lib/phone'
import { useSession } from '@/state/store'
import type { BusinessKind, OtpChallenge, SellerType } from '@/types'

const STEPS = ['Hesab növü', 'Məlumatlar', 'Telefonun təsdiqi'] as const

/**
 * /qeydiyyat — three steps: account type (individual, or a business and its kinds, one or more: nursery, garden
 * centre, landscaping company), details (name, phone, optional e-mail, password with live rules, terms), then the SMS code.
 * Back keeps everything. On success the account is signed in and the visitor goes on to `next` (default: cabinet).
 * DEMO (DATA_SOURCE=mock): the SMS is not sent (the code is on screen) and nothing is stored on a server. With the API
 * the account is created there; a business gets its public page /saticilar/<slug> at once.
 */
export default function RegisterPage({ next, accountType }: { next?: string; accountType?: SellerType }) {
  const router = useRouter()
  const { signIn } = useSession()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [type, setType] = useState<SellerType | ''>(accountType ?? '')
  const [kinds, setKinds] = useState<BusinessKind[]>([])
  const [company, setCompany] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const name = joinFullName(firstName, lastName)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [challenge, setChallenge] = useState<OtpChallenge>()
  const query = next ? `?next=${encodeURIComponent(next)}` : ''

  const focusFirst = (found: Record<string, string | undefined>) => {
    const first = Object.keys(found).find((k) => found[k])
    if (first) document.getElementById(`q-${first}`)?.focus()
  }

  const submitType = (e: FormEvent) => {
    e.preventDefault()
    const found = {
      type: type ? undefined : 'Fərdi və ya biznes hesabı seçin.',
      kind: type === 'business' && kinds.length === 0 ? 'Ən azı bir biznes növü seçin.' : undefined,
      company: type === 'business' && !company.trim() ? 'Biznesin adını yazın.' : undefined,
    }
    setErrors(found)
    if (Object.values(found).some(Boolean)) return focusFirst(found)
    setStep(1)
  }

  const submitDetails = async (e: FormEvent) => {
    e.preventDefault()
    const found = {
      firstName: namePartError(firstName, 'Adınızı'),
      lastName: namePartError(lastName, 'Soyadınızı'),
      phone: phoneFieldError(phone),
      email: emailError(email, false),
      password: newPasswordError(password) ? 'Şifrə ən azı 8 simvol olmalı, hərf və rəqəm olmalıdır.' : undefined,
      terms: terms ? undefined : 'Davam etmək üçün şərtlərlə razılaşın.',
    }
    setErrors(found)
    if (Object.values(found).some(Boolean)) return focusFirst(found)
    setBusy(true)
    const result = await requestCode(phone, 'register')
    setBusy(false)
    if (!result.ok) return setFormError(result.error)
    setFormError(undefined)
    setChallenge(result)
    setStep(2)
  }

  const finish = async (challengeId: string) => {
    if (type !== 'business' && type !== 'individual') return
    const result = await registerAccount({
      accountType: type,
      businessKinds: type === 'business' ? kinds : undefined,
      companyName: type === 'business' ? company.trim() : undefined,
      fullName: name.trim(),
      phone,
      email: email.trim() || undefined,
      password,
      otpChallengeId: challengeId,
    })
    if (!result.ok) {
      setFormError(result.error)
      setStep(1)
      return
    }
    // DATA_SOURCE=api: the account the API created (a business with its «mağaza», signed in by the session cookie).
    if (result.account) {
      signIn(result.account)
      toast('Hesab yaradıldı. Xoş gəldiniz!')
      router.replace(safeNext(next))
      return
    }
    const business = type === 'business'
    signIn({
      id: result.userId,
      fullName: name.trim(),
      phone,
      email: email.trim(),
      accountType: type,
      // A new account has no seller page or listings yet (the cabinet shows its empty state).
      sellerId: undefined,
      companyName: business ? company.trim() : undefined,
      businessKinds: business ? kinds : undefined,
      cityId: undefined,
      address: undefined,
      about: undefined,
      verified: false,
      phoneVerified: true,
    })
    toast('Hesab yaradıldı. Xoş gəldiniz!')
    router.replace(safeNext(next))
  }

  // «Ad» and «Soyad»: under the legend «Əlaqə şəxsi» for a business, on their own for a person.
  const nameFields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <NameField id="q-firstName" label="Ad" autoComplete="given-name" placeholder="Məsələn: Elvin" value={firstName} error={errors.firstName} onValueChange={setFirstName} />
      <NameField id="q-lastName" label="Soyad" autoComplete="family-name" placeholder="Məsələn: Əliyev" value={lastName} error={errors.lastName} onValueChange={setLastName} />
    </div>
  )

  return (
    <AuthShell title="Hesab yaradın" lead="Bir dəqiqəlik iş: elan yerləşdirin, satıcılarla əlaqə saxlayın, axtarışlarınızı yadda saxlayın." image="/images/auth/register.webp">
      <ol aria-label="Qeydiyyat addımları" className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
            <span aria-hidden className={cn('h-1.5 rounded-full', i <= step ? 'bg-forest' : 'bg-line')} />
            <span className={cn('truncate text-xs leading-[normal]', i === step ? 'font-semibold text-forest' : 'text-muted')}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      <FormCard>
        {formError && (
          <Notice tone="danger" title="Hesab yaradılmadı">
            {formError}
          </Notice>
        )}

        {step === 0 && (
          <form onSubmit={submitType} noValidate className="flex flex-col gap-6">
            <FieldGroup legend="Hesabın növü" error={errors.type}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <ChoiceCard id="q-type" name="type" value="individual" checked={type === 'individual'} onChange={() => setType('individual')} icon={<UserRound size={20} strokeWidth={1.8} />} title="Fərdi şəxs" description="Öz bağınızdan bitki satırsınız və ya alırsınız" />
                <ChoiceCard name="type" value="business" checked={type === 'business'} onChange={() => setType('business')} icon={<Building2 size={20} strokeWidth={1.8} />} title="Biznes" description="Tingçilik, bağ mərkəzi və ya landşaft şirkəti" />
              </div>
            </FieldGroup>
            {type === 'business' && (
              <>
                <BusinessKindsField id="q-kind" value={kinds} onChange={setKinds} error={errors.kind} hint="Bir və ya bir neçəsini seçin. Profil səhifəniz və axtarışdakı filtr buna görə qurulur." />
                <TextField id="q-company" label="Biznesin adı" autoComplete="organization" placeholder="Məsələn: Abşeron Tingçilik" value={company} error={errors.company} maxLength={60} onChange={(e) => setCompany(e.target.value)} />
              </>
            )}
            <Button type="submit" fullWidth>
              Davam et
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={submitDetails} noValidate className="flex flex-col gap-5">
            {type === 'business' ? (
              <FieldGroup legend="Əlaqə şəxsi" hint="Alıcılar zəng edəndə kiminlə danışacaqlarını bilsinlər.">
                {nameFields}
              </FieldGroup>
            ) : (
              nameFields
            )}
            <PhoneField id="q-phone" value={phone} onValueChange={setPhone} error={errors.phone} hint="Bu nömrəni SMS kodu ilə təsdiqləyəcəyik. Alıcılar sizə ona zəng edəcək." />
            <TextField id="q-email" label="E-poçt" optional type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="ad@poct.az" value={email} error={errors.email} hint="Ödəniş qəbzləri və bildirişlər üçün." onChange={(e) => setEmail(e.target.value)} />
            <div className="flex flex-col gap-2">
              <PasswordField id="q-password" autoComplete="new-password" value={password} onValueChange={setPassword} error={errors.password} aria-describedby="sifre-qaydalari" />
              <PasswordRules id="sifre-qaydalari" value={password} />
            </div>
            <CheckboxField
              id="q-terms"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              error={errors.terms}
              label={
                <>
                  <Link href="/istifade-sertleri" className="font-semibold text-forest underline underline-offset-2">İstifadə şərtləri</Link> və{' '}
                  <Link href="/mexfilik" className="font-semibold text-forest underline underline-offset-2">Məxfilik siyasəti</Link> ilə razıyam.
                </>
              }
            />
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={() => setStep(0)} icon={<ArrowLeft aria-hidden size={18} strokeWidth={1.8} />}>
                Geri
              </Button>
              <Button type="submit" disabled={busy} aria-busy={busy} className="flex-1">
                {busy ? 'Kod göndərilir…' : 'Kod göndər'}
              </Button>
            </div>
          </form>
        )}

        {step === 2 && challenge && (
          <OtpVerify challenge={challenge} phone={phone} purpose="register" submitLabel="Təsdiqlə və hesab yarat" onVerified={finish} onChangePhone={() => setStep(1)} />
        )}
      </FormCard>

      <p className="text-center text-[15px] leading-[1.5] text-ink">
        Artıq hesabınız var?{' '}
        <Link href={`/daxil-ol${query}`} className="font-semibold text-forest underline-offset-2 hover:underline">
          Daxil olun
        </Link>
      </p>
    </AuthShell>
  )
}
