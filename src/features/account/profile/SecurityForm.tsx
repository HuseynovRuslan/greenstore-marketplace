'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { PasswordRules } from '@/features/auth/ui'
import { hasErrors, messages, newPasswordError } from '@/features/auth/validation'
import { Card, PanelTitle } from '../ui'

/**
 * Figma "Təhlükəsizlik" panel — current + new password, "Şifrəni dəyiş". The new password follows the registration rule
 * (8+ characters, a letter and a digit, ticked live) with the same show / hide control. Mocked: no backend.
 */
export function SecurityForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({})
  const [done, setDone] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = { current: current ? undefined : messages.currentPassword, next: newPasswordError(next) }
    setErrors(nextErrors)
    setDone(false)
    if (hasErrors(nextErrors)) return
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
        <Button type="submit" variant="secondary">
          Şifrəni dəyiş
        </Button>
        {done && <Notice tone="success" title="Şifrə dəyişdirildi" />}
      </form>
    </Card>
  )
}
