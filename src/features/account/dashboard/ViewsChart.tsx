import { Panel } from '@/components/ui/Panel'
import { weeklyStats } from '@/data/dashboard'
import { cn } from '@/lib/format'

/**
 * Figma "Elan statistikası" panel: 23 px title + 15 px period, 140 px "Baxış qrafiki" of CSS bars
 * (olive, today #173f32, radius 4, 12 px apart, 11 px labels 8 px below), 13 px green summary.
 */
export function ViewsChart({ id }: { id?: string }) {
  const lastIndex = weeklyStats.days.length - 1
  return (
    <Panel id={id} aria-labelledby="stats-title" className="min-w-0 flex-1 scroll-mt-[100px]">
      <div className="w-full text-ink">
        <h2 id="stats-title" className="text-[23px] leading-[1.35] font-normal">
          {weeklyStats.title}
        </h2>
        <p className="text-[15px] leading-[1.6] text-muted">{weeklyStats.period}</p>
      </div>
      <figure className="w-full">
        <div aria-hidden className="flex h-[140px] w-full items-end gap-1.5 sm:gap-3">
          {weeklyStats.days.map((d, i) => (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <div className={cn('w-full rounded', i === lastIndex ? 'bg-forest' : 'bg-olive')} style={{ height: d.value }} />
              <span className="text-[11px] leading-[1.5] whitespace-nowrap text-ink">{d.label}</span>
            </div>
          ))}
        </div>
        <figcaption className="sr-only">
          {weeklyStats.period}: {weeklyStats.summary}
        </figcaption>
      </figure>
      <p className="w-full text-[13px] leading-[1.5] text-success">{weeklyStats.summary}</p>
    </Panel>
  )
}
