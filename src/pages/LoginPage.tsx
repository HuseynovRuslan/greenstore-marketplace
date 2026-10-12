import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useSession } from '@/app/store'
import { currentUser } from '@/data/user'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { AuthIntro } from '@/features/auth/AuthIntro'
import { Checkbox } from '@/features/account/ui'
import { pillClass } from '@/features/account/pill'
import { emailError, formatPhone, hasErrors, passwordError, phoneError, safeNext } from '@/features/auth/validation'

type Method = 'phone' | 'email'

/**
 * Figma "Daxil ol · 1440" (/daxil-ol).
 * There is no backend: any well-formed phone/e-mail + 8-character password signs in the demo account.
 * The form starts with the demo account's remembered credentials ("Məni xatırla" is on), as in the frame.
 */
export default function LoginPage() {
  const { signIn, updateProfile } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')

  const [method, setMethod] = useState<Method>('phone')
  const [phone, setPhone] = useState(currentUser.phone)
  const [email, setEmail] = useState(currentUser.email)
  const [password, setPassword] = useState('greenstore')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ id?: string; password?: string }>({})
  const [forgotOpen, setForgotOpen] = useState(false)

  const failed = hasErrors(errors)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = {
      id: method === 'phone' ? phoneError(phone) : emailError(email),
      password: passwordError(password),
    }
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    if (method === 'email') {
      signIn(email.trim())
    } else {
      signIn()
      updateProfile({ phone: formatPhone(phone) })
    }
    navigate(safeNext(next), { replace: true })
  }

  const switchMethod = (m: Method) => {
    setMethod(m)
    setErrors({})
  }

  const registerHref = next ? `/qeydiyyat?next=${encodeURIComponent(next)}` : '/qeydiyyat'

  return (
    <div className="page-x mx-auto w-full max-w-[1440px] pt-[39px] pb-6 md:pt-[51px] md:pb-9">
      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[580fr_668fr] md:py-12 xl:gap-16">
        <AuthIntro
          image="/images/auth/login.webp"
          imageClassName="aspect-[580/510]"
          title="Bağınız üçün yeni imkanlar"
          lead="Elan yerləşdirin, seçdiyiniz məhsulları saxlayın və satıcılarla birbaşa əlaqə qurun."
        />

        <div className="flex min-w-0 flex-col items-start gap-6">
          <SectionHeader as="h1" title="Yenidən xoş gəldiniz" subtitle="GreenStore hesabınıza daxil olun." />

          <Panel className="w-full">
            <form noValidate onSubmit={submit} className="flex w-full flex-col items-start gap-5">
              <div role="group" aria-label="Daxil olma üsulu" className="flex flex-wrap items-start gap-2">
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
                    onClick={() => switchMethod(value)}
                    className={pillClass(method === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {method === 'phone' ? (
                <TextField
                  key="phone"
                  label="Telefon nömrəsi"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  hint="Azərbaycan nömrənizi daxil edin."
                  error={errors.id}
                  containerClassName="w-full"
                />
              ) : (
                <TextField
                  key="email"
                  label="E-poçt ünvanı"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.id}
                  containerClassName="w-full"
                />
              )}

              <TextField
                label="Şifrə"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                containerClassName="w-full"
              />

              <div className="flex w-full flex-wrap items-start gap-x-4 gap-y-2 text-[13px] leading-[1.5]">
                <Checkbox label="Məni xatırla" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <button
                  type="button"
                  aria-expanded={forgotOpen}
                  onClick={() => setForgotOpen((v) => !v)}
                  className="font-semibold text-forest hover:text-olive"
                >
                  Şifrəni unutmusunuz?
                </button>
              </div>
              {forgotOpen && <Notice tone="warning" title="Şifrə bərpası tezliklə əlavə olunacaq." />}

              <Button type="submit" fullWidth>
                Daxil ol
              </Button>

              {failed && (
                <Notice tone="danger" title="Məlumatları yoxlayın">
                  {method === 'phone'
                    ? 'Telefon nömrəsi və ya şifrə düzgün deyil. Yenidən cəhd edin.'
                    : 'E-poçt ünvanı və ya şifrə düzgün deyil. Yenidən cəhd edin.'}
                </Notice>
              )}

              <p className="w-full text-sm leading-[1.5] text-ink">
                Hesabınız yoxdur?{' '}
                <Link to={registerHref} className="hover:text-olive hover:underline">
                  Qeydiyyatdan keçin →
                </Link>
              </p>
            </form>
          </Panel>

          <p className="w-full text-xs leading-[1.5] text-muted">
            Daxil olmaqla İstifadə şərtləri və Məxfilik siyasəti ilə razılaşırsınız. Məlumatlarınız təhlükəsiz saxlanılır.
          </p>
        </div>
      </div>
    </div>
  )
}
