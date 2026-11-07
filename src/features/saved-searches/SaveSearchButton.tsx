'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck, LogIn } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CharCount, TextField } from '@/components/ui/Field'
import { Switch } from '@/components/ui/FormControls'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/format'
import { useSession } from '@/state/store'
import { searchSummary, suggestedName, useSavedSearches } from './useSavedSearches'

const NAME_MAX = 60

/**
 * «Axtarışı yadda saxla» on the catalogue: a name (suggested from the filters) and an alert switch («Yeni elan çıxanda
 * xəbər ver»), then it appears in «Axtarışlarım». Already saved → «Yadda saxlanılıb», a link there. Guests are asked to
 * sign in (alerts need an account) and come back to the same search. Icon-only below 768 px, with the label as its name.
 */
export function SaveSearchButton({ query, className }: { query: string; className?: string }) {
  const { user } = useSession()
  const { save, find } = useSavedSearches(user)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [alerts, setAlerts] = useState(true)
  const [error, setError] = useState<string>()
  const saved = find(query)

  const button = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm leading-[normal] font-semibold text-forest transition-[border-color,scale] duration-(--dur-fast) ease-out hover:border-forest active:scale-[0.97] motion-reduce:active:scale-100 md:px-3.5'

  if (saved) {
    return (
      <Link href="/kabinet/axtarislar" className={cn(button, 'border-forest bg-mint', className)} aria-label="Axtarış yadda saxlanılıb — Axtarışlarım">
        <BookmarkCheck aria-hidden size={18} strokeWidth={1.8} />
        <span className="max-md:hidden">Yadda saxlanılıb</span>
      </Link>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Axtarışa ad verin: siyahıda belə görünəcək.')
    if (trimmed.length > NAME_MAX) return setError(`Ad ${NAME_MAX} simvoldan uzun olmasın.`)
    save({ name: trimmed, query, alerts })
    setOpen(false)
    toast(alerts ? 'Axtarış yadda saxlanıldı. Yeni elan çıxanda xəbər verəcəyik.' : 'Axtarış yadda saxlanıldı')
  }

  const back = `/elanlar${query ? `?${query}` : ''}`
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Axtarışı yadda saxla"
        onClick={() => {
          setName(suggestedName(query))
          setError(undefined)
          setOpen(true)
        }}
        className={cn(button, className)}
      >
        <Bookmark aria-hidden size={18} strokeWidth={1.8} />
        <span className="max-md:hidden">Axtarışı yadda saxla</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Axtarışı yadda saxla">
        {user ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <TextField
              label="Ad"
              value={name}
              autoFocus
              maxLength={NAME_MAX + 10}
              error={error}
              aside={<CharCount value={name} max={NAME_MAX} />}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(undefined)
              }}
            />
            {searchSummary(query).length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] leading-[normal] font-semibold text-ink">Filtrlər</p>
                <ul className="flex flex-wrap gap-1.5">
                  {searchSummary(query).map((label) => (
                    <li key={label} className="rounded-full bg-mint px-2.5 py-1 text-[13px] leading-[normal] font-medium text-forest">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Switch
              checked={alerts}
              onCheckedChange={setAlerts}
              label="Yeni elan çıxanda xəbər ver"
              description="Gündə bir dəfə SMS və ya e-poçt. Demo: bildiriş göndərilmir."
            />
            <Button type="submit" fullWidth>
              Yadda saxla
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-[1.5] text-ink">Axtarışları saxlamaq və yeni elanlar haqqında xəbər almaq üçün hesabınıza daxil olun.</p>
            <ButtonLink href={`/daxil-ol?next=${encodeURIComponent(back)}`} fullWidth icon={<LogIn aria-hidden size={17} strokeWidth={1.8} />}>
              Daxil ol
            </ButtonLink>
            <ButtonLink href={`/qeydiyyat?next=${encodeURIComponent(back)}`} variant="secondary" fullWidth>
              Qeydiyyatdan keç
            </ButtonLink>
          </div>
        )}
      </Dialog>
    </>
  )
}
