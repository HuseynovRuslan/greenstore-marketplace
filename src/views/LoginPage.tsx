'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { CheckboxField, PasswordField, PhoneField } from '@/components/ui/FormControls'
import { useToast } from '@/components/ui/Toast'
import { DEMO_LOGIN_PASSWORD } from '@/config/demo'
import { requestCode } from '@/features/auth/actions'
import { OtpVerify } from '@/features/auth/OtpVerify'
import { AuthShell, DemoNote, FormCard, Segmented } from '@/features/auth/ui'
import { emailError, safeNext } from '@/features/auth/validation'
import { phoneFieldError, phoneValue } from '@/lib/phone'
import { useSession } from '@/state/store'
import type { OtpChallenge } from '@/types'

type Method = 'password' | 'sms'

/** "+994 50 …" / "050 …" / digits → phone; anything with "@" → e-mail. */
const looksLikeEmail = (value: string) => value.includes('@')

function identifierError(value: string) {
  const v = value.trim()
  if (!v) return 'Telefon nömrəsini və ya e-poçtu yazın.'
  if (looksLikeEmail(v)) return emailError(v)
  return phoneFieldError(v)
}

/**
 * /daxil-ol — sign in with a password (phone or e-mail in one field, so the browser's saved login fills it) or with
 * an SMS code. «Şifrəni unutmusunuz?» leads to the reset flow. DEMO: any well-formed login and an 8-character
 * password sign in the demo account; the SMS code is shown on screen.
 */
export default function LoginPage({ next }: { next?: string }) {
  const { signIn } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [method, setMethod] = useState<Method>('password')
  const target = safeNext(next)
  const query = next ? `?next=${encodeURIComponent(next)}` : ''

  const done = (patch: Parameters<typeof signIn>[0]) => {
    signIn(patch)
    toast('Xoş gəldiniz!')
    router.replace(target)
  }

  return (
    <AuthShell title="Daxil olun" lead="Elanlarınız, seçilmişləriniz və yadda saxladığınız axtarışlar sizi gözləyir.">
      <FormCard>
        <Segmented
          legend="Daxil olma üsulu"
          name="method"
          value={method}
          onChange={setMethod}
          options={[
            { value: 'password', label: 'Şifrə ilə' },
            { value: 'sms', label: 'SMS kodu ilə' },
          ]}
        />
        {method === 'password' ? <PasswordLogin onDone={done} /> : <SmsLogin onDone={done} />}
      </FormCard>
      <p className="text-center text-[15px] leading-[1.5] text-ink">
        Hesabınız yoxdur?{' '}
        <Link href={`/qeydiyyat${query}`} className="font-semibold text-forest underline-offset-2 hover:underline">
          Qeydiyyatdan keçin
        </Link>
      </p>
    </AuthShell>
  )
}

function PasswordLogin({ onDone }: { onDone: (patch: { email?: string; phone?: string }) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = { login: identifierError(login), password: password.length >= 8 ? undefined : password ? 'Şifrə ən azı 8 simvol olur.' : 'Şifrəni yazın.' }
    setErrors(next)
    if (next.login || next.password) {
      document.getElementById(next.login ? 'giris' : 'sifre')?.focus()
      return
    }
    setBusy(true)
    // DEMO: no server checks the password.
    window.setTimeout(() => onDone(looksLikeEmail(login) ? { email: login.trim() } : { phone: phoneValue(login) }), 350)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        id="giris"
        label="Telefon və ya e-poçt"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="050 555 12 34 və ya ad@poct.az"
        value={login}
        error={errors.login}
        onChange={(e) => setLogin(e.target.value)}
        onBlur={() => login && setErrors((x) => ({ ...x, login: identifierError(login) }))}
      />
      <PasswordField
        id="sifre"
        autoComplete="current-password"
        value={password}
        error={errors.password}
        onValueChange={setPassword}
        aside={
          <Link href="/sifreni-berpa-et" className="-my-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-forest hover:underline">
            Şifrəni unutmusunuz?
          </Link>
        }
      />
      <CheckboxField label="Bu cihazda məni xatırla" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
      <DemoNote>istənilən düzgün nömrə və ya e-poçt, şifrə üçün 8 simvol (məsələn, «{DEMO_LOGIN_PASSWORD}»).</DemoNote>
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
        {busy ? 'Daxil olunur…' : 'Daxil ol'}
      </Button>
    </form>
  )
}

function SmsLogin({ onDone }: { onDone: (patch: { phone: string }) => void }) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<OtpChallenge>()

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const message = phoneFieldError(phone)
    setError(message)
    if (message) return
    setBusy(true)
    const result = await requestCode(phone, 'login')
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setChallenge(result)
  }

  if (challenge) {
    return <OtpVerify challenge={challenge} phone={phone} purpose="login" submitLabel="Daxil ol" onVerified={() => onDone({ phone })} onChangePhone={() => setChallenge(undefined)} />
  }
  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-5">
      <PhoneField id="sms-telefon" value={phone} onValueChange={setPhone} error={error} hint="Hesabınıza bağlı nömrə. Kodu SMS ilə göndərəcəyik." />
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
        {busy ? 'Göndərilir…' : 'Kod göndər'}
      </Button>
    </form>
  )
}
