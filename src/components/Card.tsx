import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ticks?: boolean
}

// Corner registration ticks — a print/proof-sheet motif, used sparingly so
// it reads as a deliberate detail rather than decoration-for-its-own-sake.
function CornerTicks() {
  return (
    <>
      <span className="absolute -top-px -left-px h-3 w-px bg-current opacity-40" />
      <span className="absolute -top-px -left-px h-px w-3 bg-current opacity-40" />
      <span className="absolute -right-px -bottom-px h-3 w-px bg-current opacity-40" />
      <span className="absolute -right-px -bottom-px h-px w-3 bg-current opacity-40" />
    </>
  )
}

export function Card({
  className,
  ticks = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'relative border border-ink/12 bg-paper dark:border-paper/15 dark:bg-ink-soft',
        className,
      )}
      {...props}
    >
      {ticks && <CornerTicks />}
      {children}
    </div>
  )
}
