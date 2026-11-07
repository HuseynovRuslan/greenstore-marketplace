'use client'

import { useRef, useState, type DragEvent } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, TriangleAlert } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { loadDomMax, MotionFeatures, useFeaturesReady } from '@/components/motion/MotionFeatures'
import { chipEnter, chipExit, chipLayout } from '@/components/motion/springs'
import { buttonClass } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ordinal } from '@/features/listing/detail'
import { cn } from '@/lib/format'
import { MAX_PHOTO_MB, MAX_PHOTOS, type DraftPhoto } from './draft'
import { ACCEPTED_TYPES, fileError, fitCount, makeCover, movePhoto, newPhotoId, photoStore, processFile } from './photos'
import { cachePhotoUrl, forgetPhotoUrl } from './useDraft'
import type { StepProps } from './steps'
import { fieldDomId } from './validation'

const iconButton =
  'relative flex size-9 shrink-0 items-center justify-center rounded-full bg-surface/95 text-forest shadow-sm transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-surface active:scale-[0.94] disabled:opacity-35 motion-reduce:active:scale-100 ' +
  // 44 px hit area around the 36 px button
  "after:absolute after:-inset-1 after:content-['']"

const rules = [
  'Öz bitkinizin və ya məhsulunuzun şəkli',
  'İşıqlı yerdə, bütün bitki görünsün; ilk şəkil örtük olur',
  'Skrinşot, loqo, yazı və internetdən şəkil olmasın',
]

/**
 * Step 3 — photos. Drop files on the zone or pick them (phones offer the camera). Each file is checked (JPG / PNG /
 * WebP, ≤ 10 MB, ≥ 600 px; HEIC gets its own advice), scaled down and kept in IndexedDB; a problem is listed by file
 * name and the good files still go in. Order: drag a photo onto another with a mouse, or use «Sola» / «Sağa» and
 * «Örtük et» (touch and keyboard — dragging is never the only way, WCAG 2.5.7). The first photo is the cover.
 */
export function PhotoManager({ draft, update, error, urls }: StepProps & { urls: Record<string, string | undefined> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [problems, setProblems] = useState<string[]>([])
  const [dropping, setDropping] = useState(false)
  const { toast } = useToast()
  const photos = draft.photos

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    const issues: string[] = []
    const valid = files.filter((f) => {
      const message = fileError(f)
      if (message) issues.push(message)
      return !message
    })
    const { take, message } = fitCount(photos.length + busy, valid.length)
    if (message) issues.push(message)
    const batch = valid.slice(0, take)
    setProblems(issues)
    setBusy((n) => n + batch.length)
    for (const file of batch) {
      const id = newPhotoId()
      const result = await processFile(file, id)
      setBusy((n) => n - 1)
      if ('error' in result) {
        setProblems((prev) => [...prev, result.error])
        continue
      }
      cachePhotoUrl(id, result.blob)
      await photoStore.put(id, result.blob)
      update((d) => (d.photos.length >= MAX_PHOTOS ? d : { ...d, photos: [...d.photos, result.photo] }))
    }
  }

  const setPhotos = (next: DraftPhoto[]) => update({ photos: next })
  const remove = (index: number) => {
    const photo = photos[index]
    setPhotos(photos.filter((_, i) => i !== index))
    void photoStore.remove([photo.id])
    forgetPhotoUrl(photo.id)
    toast('Şəkil silindi')
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDropping(false)
    void addFiles([...e.dataTransfer.files])
  }

  const room = MAX_PHOTOS - photos.length - busy
  const errorMessage = error('photos')

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes('Files')) {
            e.preventDefault()
            setDropping(true)
          }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors duration-(--dur-fast)',
          dropping ? 'border-forest bg-mint' : errorMessage ? 'border-danger/60 bg-surface' : 'border-line-strong bg-surface',
        )}
      >
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-mint text-forest">
          <ImagePlus size={24} strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] leading-[1.4] font-semibold text-ink">
            <span className="pointer-coarse:hidden">Şəkilləri bura atın və ya seçin</span>
            <span className="hidden pointer-coarse:inline">Şəkil çəkin və ya qalereyadan seçin</span>
          </p>
          <p className="text-[13px] leading-[1.5] text-muted">
            JPG, PNG və ya WebP, hər biri {MAX_PHOTO_MB} MB-a qədər · {photos.length} / {MAX_PHOTOS} şəkil
          </p>
        </div>
        <button
          id={fieldDomId('photos')}
          type="button"
          disabled={room <= 0}
          aria-describedby={errorMessage ? 'photos-error' : undefined}
          onClick={() => inputRef.current?.click()}
          className={buttonClass('primary')}
        >
          <ImagePlus aria-hidden size={18} strokeWidth={1.8} />
          {room <= 0 ? 'Limit dolub' : 'Şəkil seç'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>

      {errorMessage && (
        <p id="photos-error" role="alert" className="text-xs leading-[1.5] text-danger">
          {errorMessage}
        </p>
      )}

      {problems.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-xl bg-warning-soft p-4 text-[13px] leading-[1.5] text-ink">
          <TriangleAlert aria-hidden size={18} strokeWidth={1.8} className="mt-px shrink-0 text-warning" />
          <ul className="flex flex-col gap-1">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {(photos.length > 0 || busy > 0) && (
        <MotionFeatures load={loadDomMax}>
          <PhotoGrid
            photos={photos}
            urls={urls}
            busy={busy}
            onMove={(from, to) => setPhotos(movePhoto(photos, from, to))}
            onCover={(i) => {
              setPhotos(makeCover(photos, i))
              toast('Örtük şəkli dəyişdi')
            }}
            onRemove={remove}
          />
        </MotionFeatures>
      )}

      <ul className="flex flex-col gap-1.5 text-[13px] leading-[1.5] text-ink-soft">
        {rules.map((r) => (
          <li key={r} className="flex gap-2">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-olive" />
            {r}
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {busy > 0 ? `${busy} şəkil hazırlanır` : `${photos.length} şəkil əlavə olunub`}
      </p>
    </div>
  )
}

interface PhotoGridProps {
  photos: DraftPhoto[]
  urls: Record<string, string | undefined>
  busy: number
  onMove: (from: number, to: number) => void
  onCover: (index: number) => void
  onRemove: (index: number) => void
}

/**
 * The photos in gallery order. A photo that moves (drag, «Sola» / «Sağa», «Örtük et») slides to its new place and its
 * neighbours make room, so the eye can follow it; a new photo grows in from .95, a removed one shrinks away and the
 * rest close the gap (Motion layout, the chip springs). Reduced motion: no sliding, opacity only. The native
 * drag-and-drop handlers sit on an inner box: Motion keeps onDragStart / onDragEnd for its own gestures.
 */
function PhotoGrid({ photos, urls, busy, onMove, onCover, onRemove }: PhotoGridProps) {
  const ready = useFeaturesReady()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  return (
    <ol aria-label="Əlavə olunan şəkillər" className="relative grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-4">
      <AnimatePresence initial={false} mode="popLayout">
        {photos.map((photo, i) => (
          <m.li
            key={photo.id}
            layout
            initial={ready ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: chipExit }}
            transition={{ default: chipEnter, layout: chipLayout }}
            className={cn(
              'group relative aspect-[4/3] overflow-hidden rounded-lg border bg-mint transition-[border-color] duration-(--dur-fast)',
              i === 0 ? 'border-forest shadow-[inset_0_0_0_1px_var(--color-forest)]' : 'border-line',
            )}
          >
            <div
              draggable
              onDragStart={(e) => {
                setDragIndex(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault()
              }}
              onDrop={(e) => {
                if (dragIndex === null) return
                e.preventDefault()
                e.stopPropagation()
                onMove(dragIndex, i)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'size-full transition-opacity duration-(--dur-fast)',
                dragIndex === i && 'opacity-40',
                dragIndex !== null && dragIndex !== i && 'cursor-copy',
              )}
            >
              {urls[photo.id] ? (
                <img src={urls[photo.id]} alt={`Şəkil ${i + 1}${i === 0 ? ' (örtük)' : ''}: ${photo.name}`} className="size-full object-cover select-none" draggable={false} />
              ) : (
                <span className="flex size-full animate-pulse items-center justify-center text-xs text-muted">Yüklənir…</span>
              )}
            </div>
            {i === 0 && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-[5px] bg-forest px-2 py-1 text-[11px] leading-[normal] font-semibold text-white">
                <Star aria-hidden size={11} strokeWidth={2.4} fill="currentColor" />
                Örtük
              </span>
            )}
            <button type="button" onClick={() => onRemove(i)} aria-label={`${ordinal(i + 1)} şəkli sil`} className={cn(iconButton, 'absolute top-1.5 right-1.5 text-danger')}>
              <Trash2 aria-hidden size={16} strokeWidth={1.8} />
            </button>
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
              <button type="button" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={`${ordinal(i + 1)} şəkli sola çək`} className={iconButton}>
                <ChevronLeft aria-hidden size={18} strokeWidth={2} />
              </button>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => onCover(i)}
                  aria-label={`${ordinal(i + 1)} şəkli örtük et`}
                  className="relative h-9 rounded-full bg-surface/95 px-2.5 text-xs font-semibold whitespace-nowrap text-forest shadow-sm transition-[scale] duration-(--dur-fast) ease-out active:scale-[0.96] motion-reduce:active:scale-100 after:absolute after:-inset-1 after:content-['']"
                >
                  Örtük et
                </button>
              )}
              <button type="button" disabled={i === photos.length - 1} onClick={() => onMove(i, i + 1)} aria-label={`${ordinal(i + 1)} şəkli sağa çək`} className={iconButton}>
                <ChevronRight aria-hidden size={18} strokeWidth={2} />
              </button>
            </div>
          </m.li>
        ))}
      </AnimatePresence>
      {Array.from({ length: busy }, (_, i) => (
        <li key={`busy-${i}`} aria-label="Şəkil hazırlanır" className="flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg bg-disabled text-xs text-muted">
          Hazırlanır…
        </li>
      ))}
    </ol>
  )
}
