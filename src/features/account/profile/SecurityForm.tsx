'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { changePassword } from '@/features/account/actions'
import { PasswordRules } from '@/features/auth/ui'
import { hasErrors, messages, newPasswordError } from '@/features/auth/validation'
import { useSession } from '@/state/store'
import { Card, PanelTitle } from '../ui'

/**
 * Figma "Təhlükəsizlik" panel — current + new password, "Şifrəni dəyiş". The new password follows the registration rule
 * (8+ characters, a letter and a digit, ticked live) with the same show / hide control.
 * DATA_SOURCE=mock: nothing checks or stores it. DATA_SOURCE=api: `POST /me/password`; a wrong current password is
 * said under its field (five wrong ones lock the account for a while, like signing in), and the account's other devices
 * are signed out.
 */
export function SecurityForm() {
  const { source } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = { current: current ? undefined : messages.currentPassword, next: newPasswordError(next) }
    setErrors(nextErrors)
    setDone(false)
    if (hasErrors(nextErrors)) return
    if (source === 'api') {
      setBusy(true)
      const result = await changePassword(current, next)
      setBusy(false)
      if (!result.ok) return setErrors(result.field ? { [result.field]: result.error } : { form: result.error })
    }
    setCurrent('')
    setNext('')
    setDone(true)
  }

  return (
    <Card className="w-full">
      <form noValidate onSubmit={submit} aria-labelledby="security-title" className="flex w-full flex-col items-start gap-5">
        <PanelTitle id="security-title">Təhlükəsizlik</PanelTitle>
        <PasswordField
          label="Cari şifrə"
          name="current-password"
          autoComplete="current-password"
          value={current}
          onValueChange={(v) => {
            setCurrent(v)
            setDone(false)
            setErrors((p) => ({ ...p, current: undefined }))
          }}
          error={errors.current}
          containerClassName="w-full"
        />
        <PasswordField
          label="Yeni şifrə"
          name="new-password"
          autoComplete="new-password"
          value={next}
          onValueChange={(v) => {
            setNext(v)
            setDone(false)
            setErrors((p) => ({ ...p, next: undefined }))
          }}
          aria-describedby="new-password-rules"
          error={errors.next}
          containerClassName="w-full"
        />
        <PasswordRules id="new-password-rules" value={next} />
        {errors.form && (
          <Notice tone="danger" title="Şifrə dəyişmədi">
            {errors.form}
          </Notice>
        )}
        <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy}>
          {busy ? 'Dəyişdirilir…' : 'Şifrəni dəyiş'}
        </Button>
        {done && <Notice tone="success" title="Şifrə dəyişdirildi" />}
      </form>
    </Card>
  )
}
