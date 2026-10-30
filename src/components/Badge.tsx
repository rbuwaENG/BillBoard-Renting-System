import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'accent' | 'neutral'
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  accent: 'border-accent/40 text-accent',
  neutral: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
}

export function Badge({
  variant = 'neutral',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] font-medium tracking-widest uppercase',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
