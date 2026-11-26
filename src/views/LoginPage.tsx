'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound, LockKeyhole, LogIn, MessageSquareText, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { CheckboxField, PasswordField, PhoneField } from '@/components/ui/FormControls'
import { useToast } from '@/components/ui/Toast'
import { DEMO_LOGIN_PASSWORD } from '@/config/demo'
import { requestCode, signInWithCode, signInWithPassword } from '@/features/auth/actions'
import { OtpVerify } from '@/features/auth/OtpVerify'
import { AuthShell, AuthSwitch, DemoNote, FormCard } from '@/features/auth/ui'
import { emailError, safeNext } from '@/features/auth/validation'
import { phoneFieldError, phoneValue } from '@/lib/phone'
import { useSession } from '@/state/store'
import type { AccountProfile } from '@/data/user'
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
 * an SMS code: the password form comes first, a button under it switches to the code (and back), focusing the new
 * form's field. «Şifrəni unutmusunuz?» leads to the reset flow. Frame: AuthShell with the «Daxil ol» tab.
 * - DATA_SOURCE=mock (DEMO): any well-formed login and an 8-character password sign in the demo account in the
 *   browser; the SMS code is shown on screen.
 * - DATA_SOURCE=api: the Server Actions sign in with the API and set the session cookie; the page hands the account
 *   they answer with to the store. Refusals (wrong password, lockout, blocked account) are shown above the form.
 */
export default function LoginPage({ next }: { next?: string }) {
  const { signIn, source } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [method, setMethod] = useState<Method>('password')
  // «Məni xatırla», shared by both ways in: unticked, the session's cookies end with the browser (services/session.ts).
  const [remember, setRemember] = useState(true)
  const target = safeNext(next)
  const query = next ? `?next=${encodeURIComponent(next)}` : ''

  const done = (patch: Parameters<typeof signIn>[0]) => {
    signIn(patch)
    toast('Xoş gəldiniz!')
    router.replace(target)
  }
  const api = source === 'api'
  const sms = method === 'sms'

  /** The other way in; its first field takes focus, so a keyboard or screen reader user lands in the new form. */
  const switchMethod = () => {
    setMethod(sms ? 'password' : 'sms')
    requestAnimationFrame(() => document.getElementById(sms ? 'giris' : 'sms-telefon')?.focus())
  }

  return (
    <AuthShell tab="login" next={next} title="Hesabınıza daxil olun" lead="GreenStore hesabınıza daxil olaraq elanlarınızı idarə edin.">
      <FormCard>
        {sms ? <SmsLogin api={api} remember={remember} onRemember={setRemember} onDone={done} /> : <PasswordLogin api={api} remember={remember} onRemember={setRemember} onDone={done} />}
        <Button variant="secondary" fullWidth onClick={switchMethod} icon={sms ? <KeyRound aria-hidden size={18} strokeWidth={1.8} /> : <MessageSquareText aria-hidden size={18} strokeWidth={1.8} />}>
          {sms ? 'Şifrə ilə daxil olun' : 'SMS kodu ilə daxil olun'}
        </Button>
      </FormCard>
      <AuthSwitch question="Hesabınız yoxdur?" href={`/qeydiyyat${query}`} label="Hesab yaradın" />
    </AuthShell>
  )
}

/** A refusal of the API (wrong password, lockout, a spent code), above the form it belongs to. */
function FormError({ message }: { message?: string }) {
  return message ? (
    <Notice tone="danger" title="Daxil olmaq alınmadı">
      {message}
    </Notice>
  ) : null
}

type Done = (patch: Partial<AccountProfile>) => void

interface FormProps {
  api: boolean
  remember: boolean
  onRemember: (remember: boolean) => void
  onDone: Done
}

/** «Məni xatırla»: kept for 30 days when ticked, until the browser is closed when not. */
function RememberMe({ remember, onRemember }: Pick<FormProps, 'remember' | 'onRemember'>) {
  return <CheckboxField label="Məni xatırla" checked={remember} onChange={(e) => onRemember(e.target.checked)} />
}

function PasswordLogin({ api, remember, onRemember, onDone }: FormProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = { login: identifierError(login), password: password.length >= 8 ? undefined : password ? 'Şifrə ən azı 8 simvol olur.' : 'Şifrəni yazın.' }
    setErrors(next)
    if (next.login || next.password) {
      document.getElementById(next.login ? 'giris' : 'sifre')?.focus()
      return
    }
    setBusy(true)
    if (!api) {
      // DEMO: no server checks the password.
      window.setTimeout(() => onDone(looksLikeEmail(login) ? { email: login.trim() } : { phone: phoneValue(login) }), 350)
      return
    }
    const result = await signInWithPassword(looksLikeEmail(login) ? login.trim() : phoneValue(login), password, remember)
    setBusy(false)
    if (!result.ok) {
      setFormError(result.error)
      setPassword('')
      document.getElementById('sifre')?.focus()
      return
    }
    setFormError(undefined)
    onDone(result.account)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <TextField
        id="giris"
        label="Telefon və ya e-poçt"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        icon={<UserRound size={18} strokeWidth={1.8} />}
        placeholder="050 555 12 34 və ya ad@poct.az"
        value={login}
        error={errors.login}
        onChange={(e) => setLogin(e.target.value)}
        onBlur={() => login && setErrors((x) => ({ ...x, login: identifierError(login) }))}
      />
      <PasswordField
        id="sifre"
        autoComplete="current-password"
        icon={<LockKeyhole size={18} strokeWidth={1.8} />}
        placeholder="Şifrənizi yazın"
        value={password}
        error={errors.password}
        onValueChange={setPassword}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <RememberMe remember={remember} onRemember={onRemember} />
        <Link href="/sifreni-berpa-et" className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline-offset-2 hover:underline">
          Şifrəni unutmusunuz?
        </Link>
      </div>
      {!api && <DemoNote>istənilən düzgün nömrə və ya e-poçt, şifrə üçün 8 simvol (məsələn, «{DEMO_LOGIN_PASSWORD}»).</DemoNote>}
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy} icon={busy ? undefined : <LogIn aria-hidden size={18} strokeWidth={1.8} />}>
        {busy ? 'Daxil olunur…' : 'Daxil ol'}
      </Button>
    </form>
  )
}

function SmsLogin({ api, remember, onRemember, onDone }: FormProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<OtpChallenge>()
  const [formError, setFormError] = useState<string>()

  /** The code is right: the demo signs in in the browser; the API opens the session with the verified code. */
  const verified = async (challengeId: string) => {
    if (!api) return onDone({ phone })
    const result = await signInWithCode(challengeId, remember)
    if (result.ok) return onDone(result.account)
    setFormError(result.error)
    setChallenge(undefined)
  }

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
    return <OtpVerify challenge={challenge} phone={phone} purpose="login" submitLabel="Daxil ol" onVerified={verified} onChangePhone={() => setChallenge(undefined)} />
  }
  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <PhoneField id="sms-telefon" value={phone} onValueChange={setPhone} error={error} hint="Hesabınıza bağlı nömrə. Kodu SMS ilə göndərəcəyik." />
      <RememberMe remember={remember} onRemember={onRemember} />
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
        {busy ? 'Göndərilir…' : 'Kod göndər'}
      </Button>
    </form>
  )
}
