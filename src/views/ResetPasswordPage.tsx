'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { PasswordField, PhoneField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { useToast } from '@/components/ui/Toast'
import { requestCode, resetPasswordWithCode } from '@/features/auth/actions'
import { OtpVerify } from '@/features/auth/OtpVerify'
import { AuthShell, FormCard, PasswordRules } from '@/features/auth/ui'
import { newPasswordError } from '@/features/auth/validation'
import { phoneFieldError } from '@/lib/phone'
import { useSession } from '@/state/store'
import type { OtpChallenge } from '@/types'

type Stage = 'phone' | 'code' | 'password'

const leads: Record<Stage, string> = {
  phone: 'Hesabınıza bağlı nömrəni yazın — təsdiq kodu göndərəcəyik.',
  code: 'SMS-dəki 4 rəqəmli kodu yazın.',
  password: 'Yeni şifrə seçin. Sonra avtomatik daxil olacaqsınız.',
}

/**
 * /sifreni-berpa-et — phone → SMS code → new password → signed in. Each stage keeps what was typed when going back.
 * DEMO: no SMS is sent (the code is on screen) and the new password is not stored anywhere.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const { signIn } = useSession()
  const { toast } = useToast()
  const [stage, setStage] = useState<Stage>('phone')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ phone?: string; password?: string; repeat?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<OtpChallenge>()
  const [verifiedId, setVerifiedId] = useState<string>()

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    const message = phoneFieldError(phone)
    setErrors({ phone: message })
    if (message) return
    setBusy(true)
    const result = await requestCode(phone, 'reset-password')
    setBusy(false)
    if (!result.ok) return setFormError(result.error)
    setFormError(undefined)
    setChallenge(result)
    setStage('code')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const found = {
      password: newPasswordError(password) ? 'Şifrə ən azı 8 simvol olmalı, hərf və rəqəm olmalıdır.' : undefined,
      repeat: !repeat ? 'Şifrəni təkrar yazın.' : repeat !== password ? 'Şifrələr eyni deyil.' : undefined,
    }
    setErrors(found)
    if (found.password || found.repeat) {
      document.getElementById(found.password ? 'yeni-sifre' : 'yeni-sifre-tekrar')?.focus()
      return
    }
    if (!verifiedId) return setStage('phone')
    setBusy(true)
    const result = await resetPasswordWithCode(verifiedId, password)
    setBusy(false)
    if (!result.ok) {
      setFormError(result.error)
      setStage('phone')
      return
    }
    signIn({ phone })
    toast('Şifrə dəyişdi. Xoş gəldiniz!')
    router.replace('/kabinet')
  }

  return (
    <AuthShell title="Şifrəni bərpa edin" lead={leads[stage]}>
      <FormCard>
        {formError && (
          <Notice tone="danger" title="Şifrə bərpa olunmadı">
            {formError}
          </Notice>
        )}
        {stage === 'phone' && (
          <form onSubmit={sendCode} noValidate className="flex flex-col gap-5">
            <PhoneField id="berpa-telefon" value={phone} onValueChange={setPhone} error={errors.phone} />
            <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
              {busy ? 'Göndərilir…' : 'Kod göndər'}
            </Button>
          </form>
        )}
        {stage === 'code' && challenge && (
          <OtpVerify
            challenge={challenge}
            phone={phone}
            purpose="reset-password"
            submitLabel="Davam et"
            onVerified={(id) => {
              setVerifiedId(id)
              setStage('password')
            }}
            onChangePhone={() => setStage('phone')}
          />
        )}
        {stage === 'password' && (
          <form onSubmit={save} noValidate className="flex flex-col gap-5">
            <input type="text" name="username" autoComplete="username" value={phone} readOnly hidden />
            <div className="flex flex-col gap-2">
              <PasswordField id="yeni-sifre" label="Yeni şifrə" autoComplete="new-password" value={password} onValueChange={setPassword} error={errors.password} aria-describedby="berpa-qaydalar" />
              <PasswordRules id="berpa-qaydalar" value={password} />
            </div>
            <PasswordField id="yeni-sifre-tekrar" label="Yeni şifrə bir daha" autoComplete="new-password" value={repeat} onValueChange={setRepeat} error={errors.repeat} />
            <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
              {busy ? 'Saxlanılır…' : 'Şifrəni saxla və daxil ol'}
            </Button>
          </form>
        )}
      </FormCard>
      <p className="text-center text-[15px] leading-[1.5] text-ink">
        Şifrəni xatırladınız?{' '}
        <Link href="/daxil-ol" className="font-semibold text-forest underline-offset-2 hover:underline">
          Daxil olun
        </Link>
      </p>
    </AuthShell>
  )
}
