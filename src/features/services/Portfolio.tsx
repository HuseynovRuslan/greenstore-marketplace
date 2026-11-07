'use client'

import { useCallback, useState } from 'react'
import { Lightbox } from '@/features/listing/Lightbox'
import { cn } from '@/lib/format'

/** "Tamamlanmış layihələr": 2-column grid of "Məlumat paneli" cards (photo 270 px, title 15 px semibold, text 13 px muted). */
export function Portfolio({ projects }: { projects: Array<{ title: string; description: string; image: string }> }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewerIndex(null), [])
  if (!projects.length) return null
  return (
    <section aria-labelledby="tamamlanmis-layiheler" className="flex w-full flex-col gap-4">
      <h2 id="tamamlanmis-layiheler" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
        Tamamlanmış layihələr
      </h2>
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {projects.map((p, i) => (
          <div
            key={p.title}
            className={cn(
              'relative flex flex-col gap-2 self-start rounded-xl border border-line bg-surface p-[11px] transition-[border-color,box-shadow] duration-(--dur-base) ease-out hover:border-olive hover:shadow-card-hover',
              'has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-olive',
            )}
          >
            <img src={p.image} alt={p.title} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
            <h3 className="w-full px-1 text-[15px] leading-[1.4] font-semibold text-ink">
              <button type="button" onClick={() => setViewerIndex(i)} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
                {p.title}
              </button>
            </h3>
            <p className="w-full px-1 pb-1 text-[13px] leading-[1.5] text-muted">{p.description}</p>
          </div>
        ))}
      </div>
      {viewerIndex !== null && (
        <Lightbox
          images={projects.map((p) => p.image)}
          captions={projects.map((p) => ({ title: p.title, description: p.description }))}
          title="Tamamlanmış layihələr"
          start={viewerIndex}
          onClose={closeViewer}
        />
      )}
    </section>
  )
}
