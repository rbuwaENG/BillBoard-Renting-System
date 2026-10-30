import { useState } from 'react'
import { BillboardMark } from '@/components'
import { cn } from '@/lib/utils'

interface BillboardPhotoProps {
  src: string | null | undefined
  alt: string
  // Sizing/aspect classes for the frame (the image fills it).
  className?: string
  markClassName?: string
  loading?: 'lazy' | 'eager'
}

// A billboard photo that falls back to the brand placeholder when there is
// no image or it fails to load (dead link, removed storage object).
export function BillboardPhoto({
  src,
  alt,
  className,
  markClassName = 'size-10',
  loading = 'lazy',
}: BillboardPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = !!src && failedSrc !== src

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-paper-dim dark:bg-ink',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <BillboardMark
          className={cn('text-ink/10 dark:text-paper/10', markClassName)}
        />
      )}
    </div>
  )
}
