import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-ink text-paper hover:bg-accent dark:bg-paper dark:text-ink dark:hover:bg-accent dark:hover:text-paper',
  secondary:
    'border border-ink/15 text-ink hover:border-ink/40 dark:border-paper/20 dark:text-paper dark:hover:border-paper/50',
  ghost: 'text-ink/60 hover:text-ink dark:text-paper/60 dark:hover:text-paper',
  danger: 'bg-brand-error text-white hover:opacity-90',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
}

export function Button({
  asChild,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-none font-mono font-medium uppercase tracking-wide transition-colors',
        'clip-corner',
        // `clip-corner` (clip-path) clips anything painted outside the box —
        // an outer ring or outline would be invisible — so the focus
        // indicator is an inset outline in the button's own text colour,
        // which contrasts with every variant's background.
        'focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
