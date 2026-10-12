import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { hasErrors, messages, passwordError } from '@/features/auth/validation'
import { Card, PanelTitle } from '../ui'

/** Figma "Təhlükəsizlik" panel — current + new password ("Ən azı 8 simvol."), "Şifrəni dəyiş". Mocked: no backend. */
export function SecurityForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({})
  const [done, setDone] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = { current: current ? undefined : messages.currentPassword, next: passwordError(next) }
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
        <TextField
          label="Cari şifrə"
          name="current-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value)
            setDone(false)
            setErrors((p) => ({ ...p, current: undefined }))
          }}
          error={errors.current}
          containerClassName="w-full"
        />
        <TextField
          label="Yeni şifrə"
          name="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="Yeni şifrənizi daxil edin"
          value={next}
          onChange={(e) => {
            setNext(e.target.value)
            setDone(false)
            setErrors((p) => ({ ...p, next: undefined }))
          }}
          hint="Ən azı 8 simvol."
          error={errors.next}
          containerClassName="w-full"
        />
        <Button type="submit" variant="secondary">
          Şifrəni dəyiş
        </Button>
        {done && <Notice tone="success" title="Şifrə dəyişdirildi" />}
      </form>
    </Card>
  )
}
