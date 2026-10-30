import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BillboardPhoto } from './BillboardPhoto'

const SWIPE_THRESHOLD_PX = 40

interface BillboardGalleryProps {
  images: string[]
  title: string
  // Overlays drawn over the main photo (category badge, close button).
  children?: ReactNode
}

// Main photo + thumbnail strip. Prev/next buttons, ←/→ while the gallery has
// focus, and a horizontal swipe on touch screens all wrap around.
export function BillboardGallery({
  images,
  title,
  children,
}: BillboardGalleryProps) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const count = images.length
  const current = Math.min(index, Math.max(count - 1, 0))
  const multiple = count > 1

  function go(delta: number) {
    if (!multiple) return
    setIndex((i) => (((i + delta) % count) + count) % count)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!multiple) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setIndex(count - 1)
    }
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={`Photos of ${title}`}
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className="shrink-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <div
        className="relative"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start === null || end === undefined) return
          const dx = end - start
          if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) go(dx < 0 ? 1 : -1)
        }}
      >
        <BillboardPhoto
          key={images[current] ?? 'none'}
          src={images[current]}
          alt={
            multiple
              ? `${title} — photo ${current + 1} of ${count}`
              : `Photo of ${title}`
          }
          loading="eager"
          className="aspect-[16/9] max-h-64 w-full"
          markClassName="size-14"
        />
        {multiple && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              title="Previous photo"
              className="absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center border border-paper/40 bg-ink/60 text-paper hover:bg-ink/80"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              title="Next photo"
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center border border-paper/40 bg-ink/60 text-paper hover:bg-ink/80"
            >
              <ChevronRight className="size-4" />
            </button>
            <span
              aria-live="polite"
              className="absolute right-3 bottom-3 bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-paper"
            >
              {current + 1} / {count}
            </span>
          </>
        )}
        {children}
      </div>

      {multiple && (
        <div className="flex gap-1.5 overflow-x-auto bg-paper-dim/60 p-1.5 dark:bg-ink/60">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-current={i === current ? 'true' : undefined}
              className={cn(
                'shrink-0 border-2 transition-colors',
                i === current
                  ? 'border-accent'
                  : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <BillboardPhoto
                src={src}
                alt=""
                className="h-10 w-16"
                markClassName="size-4"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
