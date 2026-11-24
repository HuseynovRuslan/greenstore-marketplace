'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Move, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/format'
import { cropWindow, initialCrop, moveCrop, zoomBounds, zoomCrop, type CropState } from './cropGeometry'
import { PHOTO_SPECS, renderCrop, type OpenedImage, type ProfilePhotoSlot } from './profilePhotos'

const TITLE: Record<ProfilePhotoSlot, string> = { logo: 'Loqonu yerləşdirin', cover: 'Üz şəklini yerləşdirin' }

/** One arrow press moves the window by this share of its width (with Shift, five times as far). */
const STEP = 0.02
const ZOOM_STEP = 0.1

/** The stage's width before it is measured (and in jsdom). */
const FALLBACK_WIDTH = 480

interface PhotoCropDialogProps {
  slot: ProfilePhotoSlot
  /** The chosen picture; null: closed */
  image: OpenedImage | null
  onCancel: () => void
  /** The cropped picture, ready to send */
  onConfirm: (blob: Blob) => void
  /** Draws and encodes the crop (canvas); the tests pass their own. */
  render?: typeof renderCrop
}

/**
 * «Loqonu dəyiş» / «Üz şəklini dəyiş»: the chosen picture under the slot's frame (a square, or 4:1). Drag it to move
 * it, zoom with the slider or the buttons; from the keyboard, the arrows move it (Shift: further) and + and − zoom.
 * The frame is exactly what is saved: the logo's rounded corners are drawn on it, and on a cover the dashed lines mark
 * what a phone shows (the page's banner is 3:1 there). «Yadda saxla» draws the crop at its output size (cropGeometry)
 * and hands it over; the picture never leaves the frame and is never smaller than the API takes.
 */
export function PhotoCropDialog({ slot, image, onCancel, onConfirm, render = renderCrop }: PhotoCropDialogProps) {
  const spec = PHOTO_SPECS[slot]
  const hintId = useId()
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const [stageWidth, setStageWidth] = useState(FALLBACK_WIDTH)
  const [state, setState] = useState<CropState>({ zoom: 1, cx: 0, cy: 0 })
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // A new picture starts as the largest window, in the middle.
  const [shown, setShown] = useState<OpenedImage | null>(null)
  if (image !== shown) {
    setShown(image)
    if (image) setState(initialCrop(image.width, image.height))
    setBusy(false)
    setFailed(false)
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!image || !stage || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setStageWidth(entry.contentRect.width)
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [image])

  if (!image) return <Dialog open={false} title={TITLE[slot]} onClose={onCancel}>{null}</Dialog>

  const { width, height } = image
  const bounds = zoomBounds(width, height, spec)
  const crop = cropWindow(state, width, height, spec)
  const scale = stageWidth / crop.width
  const canZoom = bounds.max > bounds.min + 0.001

  const move = (dx: number, dy: number) => setState((s) => moveCrop(s, dx, dy, width, height, spec))
  const zoomTo = (zoom: number) => setState((s) => zoomCrop(s, zoom, width, height, spec))

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const last = drag.current
    if (!last || last.id !== e.pointerId) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    // The picture follows the finger, so the window moves the other way.
    move(-(e.clientX - last.x) / scale, -(e.clientY - last.y) / scale)
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = crop.width * STEP * (e.shiftKey ? 5 : 1)
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(-step, 0),
      ArrowRight: () => move(step, 0),
      ArrowUp: () => move(0, -step),
      ArrowDown: () => move(0, step),
      '+': () => zoomTo(state.zoom + ZOOM_STEP),
      '=': () => zoomTo(state.zoom + ZOOM_STEP),
      '-': () => zoomTo(state.zoom - ZOOM_STEP),
      '0': () => setState(initialCrop(width, height)),
    }
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    run()
  }

  const save = async () => {
    const img = imageRef.current
    if (!img || busy) return
    setBusy(true)
    setFailed(false)
    try {
      onConfirm(await render(img, state, slot))
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title={TITLE[slot]}
      onClose={onCancel}
      className={slot === 'cover' ? 'sm:max-w-[760px]' : 'sm:max-w-[520px]'}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Ləğv et
          </Button>
          <Button onClick={save} disabled={busy} aria-busy={busy}>
            {busy ? 'Hazırlanır…' : 'Yadda saxla'}
          </Button>
        </>
      }
    >
      <div
        ref={stageRef}
        role="group"
        aria-roledescription="şəkil kəsimi"
        aria-label={`${spec.name}: şəklin yeri`}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="crop-stage"
        className={cn(
          'relative w-full touch-none overflow-hidden bg-ink select-none outline-none focus-visible:ring-[3px] focus-visible:ring-olive',
          slot === 'logo' ? 'mx-auto aspect-square max-w-[400px] rounded-xl' : 'aspect-[4/1] rounded-lg',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <img
          ref={imageRef}
          src={image.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
          style={{ width: width * scale, height: height * scale, transform: `translate(${-crop.x * scale}px, ${-crop.y * scale}px)` }}
        />
        {/* Thirds while dragging, to line things up */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 transition-opacity duration-(--dur-fast)', dragging ? 'opacity-100' : 'opacity-0')}>
          <span className="absolute inset-y-0 left-1/3 w-px bg-surface/60" />
          <span className="absolute inset-y-0 left-2/3 w-px bg-surface/60" />
          <span className="absolute inset-x-0 top-1/3 h-px bg-surface/60" />
          <span className="absolute inset-x-0 top-2/3 h-px bg-surface/60" />
        </div>
        {slot === 'logo' ? (
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[18%] ring-2 ring-surface/80 ring-inset" />
        ) : (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[12.5%] right-[12.5%] border-x-2 border-dashed border-surface/70" />
        )}
      </div>

      <p id={hintId} className="flex items-start gap-2 text-[13px] leading-[1.5] text-muted">
        <Move aria-hidden size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" />
        <span>
          Şəkli sürüşdürərək yerini dəyişin. Klaviatura: ox düymələri, böyütmək üçün + və −.
          {slot === 'cover' && ' Qırıq xətlərin arası telefonda görünən hissədir.'}
        </span>
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Kiçilt"
          disabled={!canZoom || state.zoom <= bounds.min}
          onClick={() => zoomTo(state.zoom - ZOOM_STEP)}
          className="flex size-11 shrink-0 items-center justify-center rounded-option text-forest transition-colors duration-(--dur-fast) hover:bg-mint disabled:text-disabled disabled:hover:bg-transparent"
        >
          <ZoomOut aria-hidden size={20} strokeWidth={1.8} />
        </button>
        <input
          type="range"
          aria-label="Böyütmə"
          aria-valuetext={`${Math.round(state.zoom * 100)}%`}
          min={bounds.min}
          max={bounds.max}
          step={0.01}
          value={state.zoom}
          disabled={!canZoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-forest disabled:cursor-not-allowed"
        />
        <button
          type="button"
          aria-label="Böyüt"
          disabled={!canZoom || state.zoom >= bounds.max}
          onClick={() => zoomTo(state.zoom + ZOOM_STEP)}
          className="flex size-11 shrink-0 items-center justify-center rounded-option text-forest transition-colors duration-(--dur-fast) hover:bg-mint disabled:text-disabled disabled:hover:bg-transparent"
        >
          <ZoomIn aria-hidden size={20} strokeWidth={1.8} />
        </button>
      </div>
      {!canZoom && <p className="text-[13px] leading-[1.5] text-muted">Şəkil kiçik olduğu üçün onu böyütmək olmur.</p>}
      {failed && (
        <p role="alert" className="text-[13px] leading-[1.5] font-semibold text-danger">
          Şəkli hazırlamaq alınmadı. Başqa şəkil seçin.
        </p>
      )}
    </Dialog>
  )
}
