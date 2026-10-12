'use client'

import { useCallback, useState } from 'react'
import { ImageViewer } from './ImageViewer'
import { InsetPanel } from './ui'

/** "Tamamlanmış layihələr": 2-column grid of "Məlumat paneli" cards (photo 270 px, title 15 px semibold, text 13 px muted). */
export function Portfolio({ projects }: { projects: Array<{ title: string; description: string; image: string }> }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewerIndex(null), [])
  if (!projects.length) return null
  return (
    <section aria-labelledby="tamamlanmis-layiheler" className="flex w-full flex-col gap-7">
      <h2 id="tamamlanmis-layiheler" className="text-[23px] leading-[1.35] font-normal text-ink md:text-[30px]">
        Tamamlanmış layihələr
      </h2>
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        {projects.map((p, i) => (
          <InsetPanel
            key={p.title}
            className="relative self-start transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-olive"
          >
            <img src={p.image} alt={p.title} loading="lazy" className="h-[200px] w-full rounded-lg object-cover md:h-[270px]" />
            <h3 className="w-full text-[15px] leading-[23px] font-semibold text-ink">
              <button type="button" onClick={() => setViewerIndex(i)} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
                {p.title}
              </button>
            </h3>
            <p className="w-full text-[13px] leading-[20px] text-muted">{p.description}</p>
          </InsetPanel>
        ))}
      </div>
      <ImageViewer
        images={projects.map((p) => ({ src: p.image, alt: p.title, title: p.title, description: p.description }))}
        index={viewerIndex}
        onClose={closeViewer}
        label="Tamamlanmış layihələr"
      />
    </section>
  )
}
