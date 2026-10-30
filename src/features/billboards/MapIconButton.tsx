import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface MapIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function MapIconButton({
  active,
  className,
  disabled,
  ...props
}: MapIconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={props['aria-label'] ?? props.title}
      className={cn(
        'flex size-9 items-center justify-center border shadow-md transition-colors',
        disabled
          ? 'cursor-not-allowed border-ink/10 bg-paper/60 text-ink/30 dark:border-paper/10 dark:bg-ink-soft/60 dark:text-paper/30'
          : active
            ? 'border-accent bg-accent text-paper'
            : 'border-ink/10 bg-paper text-ink hover:border-ink/30 dark:border-paper/15 dark:bg-ink-soft dark:text-paper dark:hover:border-paper/30',
        className,
      )}
      {...props}
    />
  )
}
