'use client'

import { useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type ReactNode, type Ref } from 'react'
import { BadgeCheck, Camera, ExternalLink, ImagePlus, Loader2, MapPin, Pencil, Sprout, Trash2 } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Popover, type PopoverTriggerProps } from '@/components/ui/Popover'
import type { AccountProfile } from '@/data/user'
import { saveProfilePhoto } from '@/features/account/actions'
import { cn, initials } from '@/lib/format'
import { PhotoCropDialog } from './PhotoCropDialog'
import {
  PROFILE_PHOTO_TYPES,
  fileProblem,
  openImage,
  readAsDataUrl,
  sizeProblem,
  uploadProfilePhoto,
  type OpenedImage,
  type ProfilePhotoSlot,
} from './profilePhotos'

export interface ProfileHeroHandle {
  /** Opens the file picker of the logo or the cover («Profilin tamlığı» → «Əlavə et»). */
  pick: (slot: ProfilePhotoSlot) => void
}

interface ProfileHeroProps {
  ref?: Ref<ProfileHeroHandle>
  name: string
  /** «Tingçilik təsərrüfatı · Bağ mərkəzi» */
  kinds: string
  city?: string
  verified?: boolean
  /** The public page, /saticilar/<slug> */
  publicHref?: string
  logo?: string
  cover?: string
  /** DATA_SOURCE=api: photos go to the API; otherwise they stay in the browser's session. */
  api: boolean
  onSaved: (patch: Partial<AccountProfile>) => void
}

type Busy = 'uploading' | 'removing'

/** DATA_SOURCE=mock: the session field of a slot ("" removes the photo). */
const sessionPatch = (slot: ProfilePhotoSlot, value: string): Partial<AccountProfile> => (slot === 'logo' ? { sellerLogo: value } : { sellerCover: value })

const menuItem =
  'flex min-h-11 w-full items-center gap-2.5 rounded-option px-3 text-left text-sm font-semibold transition-colors duration-(--dur-fast) hover:bg-mint'

const SAVED: Record<ProfilePhotoSlot, string> = { logo: 'Loqo saxlanıldı.', cover: 'Üz şəkli saxlanıldı.' }
const REMOVED: Record<ProfilePhotoSlot, string> = { logo: 'Loqo silindi.', cover: 'Üz şəkli silindi.' }

/**
 * The head of /kabinet/profil for a business, the way its public page looks: a 4:1 cover (3:1 on a phone), the logo
 * over its lower left corner, the name, kinds and city, «İctimai profilə bax». The pencil on the cover and the camera on
 * the logo open «… dəyiş» / «Sil»; without a photo they choose one at once. A chosen picture is checked (type, size),
 * cropped (PhotoCropDialog) and shown at once while it uploads; a removal asks first. A refused upload says why and
 * leaves the old photo.
 */
export function ProfileHero({ ref, name, kinds, city, verified, publicHref, logo, cover, api, onSaved }: ProfileHeroProps) {
  const inputs = { logo: useRef<HTMLInputElement>(null), cover: useRef<HTMLInputElement>(null) }
  const [crop, setCrop] = useState<{ slot: ProfilePhotoSlot; image: OpenedImage } | null>(null)
  const [busy, setBusy] = useState<Partial<Record<ProfilePhotoSlot, Busy>>>({})
  // The cropped picture, shown while it uploads and after (no flash to the API's copy).
  const [local, setLocal] = useState<Partial<Record<ProfilePhotoSlot, string>>>({})
  const [error, setError] = useState<string>()
  const [announce, setAnnounce] = useState('')
  const [menu, setMenu] = useState<ProfilePhotoSlot | null>(null)
  const [removing, setRemoving] = useState<ProfilePhotoSlot | null>(null)

  useImperativeHandle(ref, () => ({ pick: (slot) => inputs[slot].current?.click() }))

  // Object URLs of the shown pictures go when they are replaced or the page is left.
  const localRef = useRef(local)
  useEffect(() => {
    const previous = localRef.current
    for (const slot of ['logo', 'cover'] as const) if (previous[slot] && previous[slot] !== local[slot]) URL.revokeObjectURL(previous[slot])
    localRef.current = local
  }, [local])
  useEffect(() => () => Object.values(localRef.current).forEach((url) => url && URL.revokeObjectURL(url)), [])

  const shown: Record<ProfilePhotoSlot, string | undefined> = { logo: local.logo ?? (logo || undefined), cover: local.cover ?? (cover || undefined) }

  const choose = async (slot: ProfilePhotoSlot, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(undefined)
    const problem = fileProblem(file)
    if (problem) return setError(problem)
    let image: OpenedImage
    try {
      image = await openImage(file)
    } catch {
      return setError('Şəkli aça bilmədik, fayl zədəli ola bilər. Başqa şəkil seçin.')
    }
    const tooSmall = sizeProblem(slot, image.width, image.height)
    if (tooSmall) {
      URL.revokeObjectURL(image.url)
      return setError(tooSmall)
    }
    setCrop({ slot, image })
  }

  const closeCrop = () => {
    if (crop) URL.revokeObjectURL(crop.image.url)
    setCrop(null)
  }

  const save = async (slot: ProfilePhotoSlot, blob: Blob) => {
    closeCrop()
    const preview = URL.createObjectURL(blob)
    const before = local[slot]
    setLocal((prev) => ({ ...prev, [slot]: preview }))
    setBusy((prev) => ({ ...prev, [slot]: 'uploading' }))
    setAnnounce(slot === 'logo' ? 'Loqo yüklənir…' : 'Üz şəkli yüklənir…')
    if (api) {
      const result = await uploadProfilePhoto(slot, blob)
      setBusy((prev) => ({ ...prev, [slot]: undefined }))
      if (!result.ok) {
        setLocal((prev) => ({ ...prev, [slot]: before }))
        setAnnounce('')
        return setError(result.error)
      }
      onSaved(result.account)
    } else {
      try {
        onSaved(sessionPatch(slot, await readAsDataUrl(blob)))
      } catch {
        setLocal((prev) => ({ ...prev, [slot]: before }))
        setBusy((prev) => ({ ...prev, [slot]: undefined }))
        return setError('Şəkli saxlamaq alınmadı. Başqa şəkil seçin.')
      }
      setBusy((prev) => ({ ...prev, [slot]: undefined }))
    }
    setAnnounce(SAVED[slot])
  }

  const remove = async (slot: ProfilePhotoSlot) => {
    setRemoving(null)
    setError(undefined)
    setBusy((prev) => ({ ...prev, [slot]: 'removing' }))
    if (api) {
      const result = await saveProfilePhoto(slot, null)
      setBusy((prev) => ({ ...prev, [slot]: undefined }))
      if (!result.ok) return setError(result.error)
      onSaved(result.account)
    } else {
      onSaved(sessionPatch(slot, ''))
      setBusy((prev) => ({ ...prev, [slot]: undefined }))
    }
    setLocal((prev) => ({ ...prev, [slot]: undefined }))
    setAnnounce(REMOVED[slot])
  }

  const photoMenu = (slot: ProfilePhotoSlot, trigger: (props: PopoverTriggerProps) => ReactNode) => (
    <Popover
      open={menu === slot}
      onOpenChange={(open) => setMenu(open ? slot : null)}
      label={slot === 'logo' ? 'Loqo' : 'Üz şəkli'}
      align="end"
      panelClassName="w-56 p-1.5"
      trigger={trigger}
    >
      {(close) => (
        <div className="flex flex-col">
          <button
            type="button"
            className={cn(menuItem, 'text-forest')}
            onClick={() => {
              close()
              inputs[slot].current?.click()
            }}
          >
            <ImagePlus aria-hidden size={16} strokeWidth={2} />
            {slot === 'logo' ? 'Loqonu dəyiş' : 'Üz şəklini dəyiş'}
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            className={cn(menuItem, 'text-danger hover:bg-danger-soft')}
            onClick={() => {
              close()
              setRemoving(slot)
            }}
          >
            <Trash2 aria-hidden size={16} strokeWidth={2} />
            Sil
          </button>
        </div>
      )}
    </Popover>
  )

  const coverBusy = busy.cover
  const logoBusy = busy.logo

  return (
    <section aria-labelledby="profil-adi" className="relative w-full rounded-2xl border border-line bg-surface">
      {(['logo', 'cover'] as const).map((slot) => (
        <input
          key={slot}
          ref={inputs[slot]}
          type="file"
          accept={PROFILE_PHOTO_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid={`${slot}-input`}
          onChange={(e) => void choose(slot, e)}
        />
      ))}

      {/* The cover */}
      <div className="relative aspect-[3/1] overflow-hidden rounded-t-2xl md:aspect-[4/1]">
        {shown.cover ? (
          <img src={shown.cover} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-[linear-gradient(120deg,var(--color-mint),var(--color-sand))]">
            <Sprout aria-hidden size={160} strokeWidth={1} className="pointer-events-none absolute -right-6 -bottom-10 text-forest/10 max-md:hidden" />
            <button
              type="button"
              onClick={() => inputs.cover.current?.click()}
              disabled={Boolean(coverBusy)}
              className="relative flex flex-col items-center gap-1 rounded-xl px-5 py-3 text-forest transition-colors duration-(--dur-fast) hover:bg-surface/60 focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ImagePlus aria-hidden size={18} strokeWidth={2} />
                Üz şəkli əlavə et
              </span>
              <span className="text-xs text-ink-soft max-sm:hidden">Ən yaxşısı 2400 × 600 piksel, en uzununa</span>
            </button>
          </div>
        )}
        {coverBusy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-forest/45 text-sm font-semibold text-white">
            <Loader2 aria-hidden size={20} className="animate-spin motion-reduce:animate-none" />
            {coverBusy === 'uploading' ? 'Yüklənir…' : 'Silinir…'}
          </div>
        )}
      </div>
      {shown.cover && !coverBusy && (
        <div className="absolute top-3 right-3 md:top-4 md:right-4">
          {photoMenu('cover', (props) => (
            <button
              {...props}
              aria-label="Üz şəklini redaktə et"
              className="flex size-10 items-center justify-center rounded-full bg-surface/90 text-forest shadow-popover backdrop-blur-sm transition-[background-color,scale] duration-(--dur-fast) hover:bg-surface active:scale-[0.95] motion-reduce:active:scale-100"
            >
              <Pencil aria-hidden size={17} strokeWidth={2} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-end md:justify-between md:px-7 md:pb-6">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:gap-5">
          {/* The logo, over the cover's lower left corner */}
          <div className="relative -mt-12 w-fit shrink-0 md:-mt-16">
            <div className="rounded-[24px] bg-surface p-1.5 shadow-card-hover">
              <div className="relative size-24 overflow-hidden rounded-[18px] md:size-32">
                {shown.logo ? (
                  <img src={shown.logo} alt={`${name} loqosu`} className="size-full object-cover" />
                ) : (
                  <span aria-hidden className="flex size-full items-center justify-center bg-mint text-[28px] font-semibold text-forest md:text-[34px]">
                    {initials(name)}
                  </span>
                )}
                {logoBusy && (
                  <span className="absolute inset-0 flex items-center justify-center bg-forest/45 text-white">
                    <Loader2 aria-hidden size={22} className="animate-spin motion-reduce:animate-none" />
                  </span>
                )}
              </div>
            </div>
            <div className="absolute -right-1.5 -bottom-1.5">
              {shown.logo ? (
                photoMenu('logo', (props) => (
                  <button {...props} aria-label="Loqonu redaktə et" disabled={Boolean(logoBusy)} className={cameraClass}>
                    <Camera aria-hidden size={17} strokeWidth={2} />
                  </button>
                ))
              ) : (
                <button type="button" aria-label="Loqo əlavə et" disabled={Boolean(logoBusy)} onClick={() => inputs.logo.current?.click()} className={cameraClass}>
                  <Camera aria-hidden size={17} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 md:pb-1">
            <h2 id="profil-adi" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[22px] leading-[1.2] font-semibold tracking-[-0.02em] break-words text-forest md:text-[26px]">
              {name}
              {verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs leading-[normal] font-semibold tracking-normal text-success">
                  <BadgeCheck aria-hidden size={14} strokeWidth={2.2} />
                  Təsdiqlənib
                </span>
              )}
            </h2>
            {kinds && <p className="text-sm leading-[1.45] text-ink-soft">{kinds}</p>}
            {city && (
              <p className="inline-flex items-center gap-1.5 text-[13px] leading-[1.4] text-muted">
                <MapPin aria-hidden size={14} strokeWidth={1.8} />
                {city}
              </p>
            )}
          </div>
        </div>
        {publicHref && (
          <ButtonLink href={publicHref} variant="secondary" icon={<ExternalLink aria-hidden size={16} strokeWidth={2} />} className="max-md:w-full">
            İctimai profilə bax
          </ButtonLink>
        )}
      </div>

      {error && (
        <div className="px-5 pb-5 md:px-7 md:pb-6">
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] leading-[1.5] font-semibold text-danger">
            {error}
          </p>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <PhotoCropDialog slot={crop?.slot ?? 'logo'} image={crop?.image ?? null} onCancel={closeCrop} onConfirm={(blob) => crop && void save(crop.slot, blob)} />

      <Dialog
        open={removing !== null}
        title={removing === 'cover' ? 'Üz şəklini silək?' : 'Loqonu silək?'}
        onClose={() => setRemoving(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Ləğv et
            </Button>
            <Button variant="danger" onClick={() => removing && void remove(removing)}>
              Sil
            </Button>
          </>
        }
      >
        <p className="text-sm leading-[1.6] text-ink-soft">
          {removing === 'cover' ? 'Üz şəkli' : 'Loqo'} profilinizdən və ictimai səhifənizdən silinəcək. Sonra yenisini əlavə edə bilərsiniz.
        </p>
      </Dialog>
    </section>
  )
}

const cameraClass =
  'flex size-10 items-center justify-center rounded-full bg-forest text-white ring-[3px] ring-surface transition-[background-color,scale] duration-(--dur-fast) hover:bg-forest-hover active:scale-[0.95] disabled:bg-disabled disabled:text-muted motion-reduce:active:scale-100'

