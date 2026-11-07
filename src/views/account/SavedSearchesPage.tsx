'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Bookmark, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { CharCount, TextField } from '@/components/ui/Field'
import { Switch } from '@/components/ui/FormControls'
import { useToast } from '@/components/ui/Toast'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { useAccount } from '@/features/account/useAccount'
import { CabinetHeader } from '@/features/cabinet/CabinetHeader'
import { searchSummary, useSavedSearches } from '@/features/saved-searches/useSavedSearches'
import { formatDayMonth } from '@/lib/format'
import type { SavedSearch } from '@/types'

const quiet =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-forest transition-[border-color,scale] duration-(--dur-fast) ease-out hover:border-olive active:scale-[0.97] pointer-coarse:h-11 motion-reduce:active:scale-100'

/**
 * /kabinet/axtarislar — «Axtarışlarım»: each saved search with its filters, new matches, the alert switch, «Aç»,
 * «Adını dəyiş» and «Sil» (with confirm). Empty state explains where saving happens.
 */
export default function SavedSearchesPage() {
  const { account } = useAccount()
  const { searches, update, remove } = useSavedSearches(account)
  const { toast } = useToast()
  const [renaming, setRenaming] = useState<SavedSearch | null>(null)
  const [deleting, setDeleting] = useState<SavedSearch | null>(null)
  if (!account) return <SignInPrompt next="/kabinet/axtarislar" />

  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-14 md:pt-8">
      <CabinetHeader active="searches" counts={{ searches: searches.length }} />

      {searches.length === 0 ? (
        <div className="flex justify-center py-4">
          <EmptyState
            icon={<Bookmark aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
            title="Yadda saxlanılan axtarış yoxdur"
            description="Elanlarda filtrləri seçin və «Axtarışı yadda saxla» düyməsinə toxunun: yeni uyğun elan çıxanda xəbər verəcəyik."
            action={
              <ButtonLink href="/elanlar" fullWidth>
                Elanlara keç
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {searches.map((s) => {
            const filters = searchSummary(s.query)
            const href = `/elanlar${s.query ? `?${s.query}` : ''}`
            return (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="text-[16px] leading-[1.35] font-semibold break-words text-ink">
                      <Link href={href} onClick={() => update(s.id, { newCount: 0 })} className="hover:text-forest hover:underline">
                        {s.name}
                      </Link>
                    </h2>
                    <p className="text-[13px] leading-[1.4] text-muted">Yadda saxlanılıb: {formatDayMonth(s.createdAt)}</p>
                  </div>
                  {s.newCount ? (
                    <span className="shrink-0 rounded-full bg-forest px-2.5 py-1 text-xs leading-[normal] font-semibold text-white tabular-nums">{s.newCount} yeni</span>
                  ) : null}
                </div>
                {filters.length > 0 ? (
                  <ul aria-label="Filtrlər" className="flex flex-wrap gap-1.5">
                    {filters.map((label) => (
                      <li key={label} className="rounded-full bg-mint px-2.5 py-1 text-[13px] leading-[normal] font-medium text-forest">
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">Bütün elanlar</p>
                )}
                <div className="rounded-lg bg-cream px-3">
                  <Switch
                    checked={s.alerts}
                    onCheckedChange={(on) => {
                      update(s.id, { alerts: on })
                      toast(on ? 'Bildiriş açıldı' : 'Bildiriş bağlandı')
                    }}
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        {s.alerts ? <Bell aria-hidden size={15} strokeWidth={1.8} /> : <BellOff aria-hidden size={15} strokeWidth={1.8} />}
                        Yeni elan çıxanda xəbər ver
                      </span>
                    }
                  />
                </div>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                  <Link href={href} onClick={() => update(s.id, { newCount: 0 })} className={quiet}>
                    <ExternalLink aria-hidden size={15} strokeWidth={2} />
                    Aç
                  </Link>
                  <button type="button" className={quiet} onClick={() => setRenaming(s)} aria-haspopup="dialog">
                    <Pencil aria-hidden size={15} strokeWidth={2} />
                    Adını dəyiş
                  </button>
                  <button type="button" className={`${quiet} text-danger hover:border-danger`} onClick={() => setDeleting(s)} aria-haspopup="dialog">
                    <Trash2 aria-hidden size={15} strokeWidth={2} />
                    Sil
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} title="Axtarışın adı">
        {renaming && (
          <RenameForm
            initial={renaming.name}
            onSave={(name) => {
              update(renaming.id, { name })
              setRenaming(null)
              toast('Ad dəyişdi')
            }}
          />
        )}
      </Dialog>
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Axtarışı silək?">
        <p className="text-[15px] leading-[1.5] text-ink">«{deleting?.name}» və onun bildirişləri silinəcək.</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Saxla
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting) remove(deleting.id)
              setDeleting(null)
              toast('Axtarış silindi')
            }}
          >
            Sil
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function RenameForm({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string>()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Ad yazın.')
    if (trimmed.length > 60) return setError('Ad 60 simvoldan uzun olmasın.')
    onSave(trimmed)
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField label="Ad" value={name} autoFocus error={error} aside={<CharCount value={name} max={60} />} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" fullWidth>
        Yadda saxla
      </Button>
    </form>
  )
}
