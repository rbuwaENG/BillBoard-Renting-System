import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// "New" instead of a misleading 0.0 ★ when a billboard has no reviews yet.
export function RatingSummary({
  rating,
  className,
  showCount = true,
}: {
  rating: { avg: number; count: number }
  className?: string
  showCount?: boolean
}) {
  if (rating.count === 0) {
    return (
      <span
        className={cn(
          'font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50',
          className,
        )}
      >
        {showCount ? 'New · no reviews yet' : 'New'}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex items-center gap-1 font-mono text-xs text-ink/60 dark:text-paper/60',
        className,
      )}
    >
      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
      <span>
        {rating.avg.toFixed(1)}
        <span className="sr-only"> out of 5</span>
      </span>
      {showCount && (
        <span className="text-ink/40 dark:text-paper/40">
          ({rating.count} review{rating.count !== 1 ? 's' : ''})
        </span>
      )}
    </span>
  )
}
