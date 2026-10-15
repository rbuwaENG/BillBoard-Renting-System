import { TRAFFIC_COLORS, TRAFFIC_LABELS } from './trafficLevel'

export function TrafficLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex items-center gap-3 border border-ink/10 bg-paper/90 px-3 py-1.5 font-mono text-[10px] tracking-wide text-ink/60 uppercase shadow-sm backdrop-blur-sm dark:border-paper/15 dark:bg-ink-soft/90 dark:text-paper/60">
      {(Object.keys(TRAFFIC_COLORS) as (keyof typeof TRAFFIC_COLORS)[]).map(
        (level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: TRAFFIC_COLORS[level] }}
            />
            {TRAFFIC_LABELS[level]}
          </span>
        ),
      )}
    </div>
  )
}
