'use client'

import { useId, useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { MAX_PHOTO_BYTES, MAX_PHOTOS, type DraftPhoto, type PostAdDraft } from '@/data/postAd'
import { cn } from '@/lib/format'
import { coverPhoto } from './draft'
import { SafeImage } from './components'
import { createPhotoUrl, releasePhotoUrl } from './useDraft'

let photoSeq = 0
const newPhotoId = () => `p-${Date.now().toString(36)}-${(photoSeq++).toString(36)}`

interface PhotoUploaderProps {
  draft: PostAdDraft
  update: (patch: Partial<PostAdDraft>) => void
  /** Validation message for the photo list ("Ən azı bir şəkil əlavə edin.") */
  error?: string
}

/*
 * Figma "Şəkil yükləmə" dropzone (mint, 1 px dashed olive, radius 12, p 24, gap 12) and
 * "Yüklənmiş şəkillər" grid (3 columns, gap 12, 180 px photos + "Örtük şəkli" / "Örtük et · Sil" chips).
 * Upload error → Notice danger from the components frame ("Şəkil yüklənmədi").
 */
export function PhotoUploader({ draft, update, error }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string>()

  const { photos } = draft
  const cover = coverPhoto(draft)
  const full = photos.length >= MAX_PHOTOS

  const addFiles = (files: FileList | File[] | null) => {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    let problem: string | undefined
    let room = MAX_PHOTOS - photos.length
    const added: DraftPhoto[] = []
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        problem ??= 'Yalnız şəkil faylı (JPG, PNG) seçin.'
      } else if (file.size > MAX_PHOTO_BYTES) {
        problem ??= 'Fayl 10 MB-dan böyükdür. Kiçik şəkil seçin.'
      } else if (room <= 0) {
        problem ??= `Ən çoxu ${MAX_PHOTOS} şəkil əlavə edə bilərsiniz.`
      } else {
        added.push({ id: newPhotoId(), url: createPhotoUrl(file), name: file.name })
        room--
      }
    }
    setUploadError(problem)
    if (added.length) {
      const next = [...photos, ...added]
      update({ photos: next, coverId: cover?.id ?? next[0].id })
    }
  }

  const remove = (photo: DraftPhoto) => {
    releasePhotoUrl(photo.url)
    const next = photos.filter((p) => p.id !== photo.id)
    update({ photos: next, coverId: cover && cover.id !== photo.id ? cover.id : (next[0]?.id ?? '') })
  }

  const openPicker = () => {
    if (!full) inputRef.current?.click()
  }

  const onDragOver = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = full ? 'none' : 'copy'
    setDragging(true)
  }
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (full) {
      setUploadError(`Ən çoxu ${MAX_PHOTOS} şəkil əlavə edə bilərsiniz.`)
      return
    }
    addFiles(e.dataTransfer.files)
  }

  const altBase = draft.title.trim() || 'Elan şəkli'

  return (
    <>
      <div
        onClick={openPicker}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-testid="photo-dropzone"
        className={cn(
          'flex min-h-[145px] w-full flex-col items-center gap-3 rounded-xl border border-dashed p-6 transition-colors',
          full ? 'cursor-default' : 'cursor-pointer',
          dragging ? 'border-forest bg-[#dfe8de]' : error ? 'border-danger bg-mint' : 'border-olive bg-mint',
        )}
      >
        <Upload aria-hidden size={28} strokeWidth={1.8} absoluteStrokeWidth className="shrink-0 text-forest" />
        {/* The click bubbles to the dropzone, which opens the file picker. */}
        <Button variant="secondary" disabled={full} aria-describedby={hintId} aria-invalid={error ? true : undefined}>
          Şəkil əlavə et
        </Button>
        <p id={hintId} className="w-full text-[12px] leading-[1.5] text-muted">
          JPG, PNG · hər şəkil maksimum 10 MB · {photos.length}/{MAX_PHOTOS} şəkil əlavə edilib
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {error && (
        <p role="alert" className="-mt-3 w-full text-[12px] leading-[1.5] text-danger">
          {error}
        </p>
      )}
      {uploadError && (
        <Notice tone="danger" title="Şəkil yüklənmədi">
          {uploadError}
        </Notice>
      )}

      {photos.length > 0 && (
        <ul className="grid w-full grid-cols-2 gap-3 md:grid-cols-3" aria-label="Yüklənmiş şəkillər">
          {photos.map((photo, i) => {
            const isCover = photo.id === cover?.id
            return (
              <li key={photo.id} className="flex min-w-0 flex-col items-start gap-2">
                <SafeImage src={photo.url} alt={`${altBase} — şəkil ${i + 1}`} className="h-[120px] w-full rounded-lg md:h-[180px]" />
                {isCover ? (
                  <Badge tone="neutral">Örtük şəkli</Badge>
                ) : (
                  <span className="inline-flex shrink-0 items-start rounded-[5px] bg-mint px-[9px] py-[5px] text-[12px] leading-[normal] font-semibold whitespace-nowrap text-forest">
                    <button
                      type="button"
                      onClick={() => update({ coverId: photo.id })}
                      aria-label={`Şəkil ${i + 1}: örtük et`}
                      className="rounded-sm hover:text-olive hover:underline"
                    >
                      Örtük et
                    </button>
                    <span aria-hidden className="whitespace-pre">
                      {' · '}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(photo)}
                      aria-label={`Şəkil ${i + 1}: sil`}
                      className="rounded-sm hover:text-danger hover:underline"
                    >
                      Sil
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
