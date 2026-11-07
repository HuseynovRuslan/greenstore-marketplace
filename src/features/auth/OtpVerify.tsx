'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { OtpField } from '@/components/ui/FormControls'
import type { OtpChallenge, OtpPurpose } from '@/types'
import { requestCode, verifyCode } from './actions'
import { DemoNote } from './ui'

const errorText = (error: string | undefined, attemptsLeft?: number) => {
  if (error === 'expired') return 'Kodun vaxtı bitib. Yenisini istəyin.'
  if (error === 'too-many-attempts') return 'Çox səhv cəhd oldu. Yeni kod istəyin.'
  return attemptsLeft ? `Kod düzgün deyil. ${attemptsLeft} cəhdiniz qalıb.` : 'Kod düzgün deyil.'
}

interface OtpVerifyProps {
  challenge: OtpChallenge
  phone: string
  purpose: OtpPurpose
  /** The code was accepted: carry on with this challenge id */
  onVerified: (challengeId: string) => void
  /** «Nömrəni dəyiş» */
  onChangePhone: () => void
  submitLabel?: string
}

/**
 * «SMS kodu»: the masked number, one code field (filled from the SMS by the phone's keyboard), «Təsdiqlə», and
 * «Kodu yenidən göndər» once the 60 s wait is over (the countdown is shown, and read only when it ends). A full code
 * is checked at once. Wrong code → attempts left; expired / locked → ask for a new one.
 */
export function OtpVerify({ challenge: initial, phone, purpose, onVerified, onChangePhone, submitLabel = 'Təsdiqlə' }: OtpVerifyProps) {
  const [challenge, setChallenge] = useState(initial)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(initial.resendInSec)
  const fieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fieldRef.current?.focus()
  }, [challenge.challengeId])

  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(t)
  }, [wait])

  const check = async (value: string) => {
    if (value.length < 4) {
      setError('Kodu tam yazın: 4 rəqəm.')
      return
    }
    setBusy(true)
    setError(undefined)
    const result = await verifyCode(challenge.challengeId, value)
    setBusy(false)
    if (result.ok) onVerified(challenge.challengeId)
    else {
      setError(errorText(result.error, result.attemptsLeft))
      setCode('')
      fieldRef.current?.focus()
    }
  }

  const resend = async () => {
    setBusy(true)
    const result = await requestCode(phone, purpose)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setChallenge(result)
    setWait(result.resendInSec)
    setCode('')
    setError(undefined)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void check(code)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="text-[15px] leading-[1.5] text-ink">
        Kodu <span className="font-semibold whitespace-nowrap tabular-nums">{challenge.phoneMasked}</span> nömrəsinə göndərdik.{' '}
        <button type="button" onClick={onChangePhone} className="inline-flex min-h-11 items-center font-semibold text-forest underline-offset-2 hover:underline">
          Nömrəni dəyiş
        </button>
      </p>
      <OtpField
        id="sms-kodu"
        value={code}
        error={error}
        ref={fieldRef}
        onValueChange={(v) => {
          setCode(v)
          if (error) setError(undefined)
          if (v.length === 4 && !busy) void check(v)
        }}
      />
      {challenge.demoCode && <DemoNote>SMS göndərilmir, kod: {challenge.demoCode}</DemoNote>}
      <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
        {busy ? 'Yoxlanılır…' : submitLabel}
      </Button>
      <p className="text-center text-sm leading-[1.5] text-muted">
        {wait > 0 ? (
          <span>
            Kod gəlmədi? <span className="tabular-nums">0:{String(wait).padStart(2, '0')}</span> sonra yenidən göndərə bilərsiniz.
          </span>
        ) : (
          <button type="button" onClick={resend} disabled={busy} className="inline-flex min-h-11 items-center font-semibold text-forest hover:underline">
            Kodu yenidən göndər
          </button>
        )}
      </p>
    </form>
  )
}
