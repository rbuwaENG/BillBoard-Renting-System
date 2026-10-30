import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ListStateProps {
  isLoading: boolean
  isError: boolean
  error?: unknown
  isEmpty: boolean
  loadingText?: string
  errorText?: string
  emptyText: ReactNode
  onRetry?: () => void
  className?: string
  children: ReactNode
}

// Loading / error / empty / content switch for query-backed lists, so a list
// never claims "No … yet" while it's still loading or after a failed fetch.
export function ListState({
  isLoading,
  isError,
  error,
  isEmpty,
  loadingText = 'Loading…',
  errorText = "Couldn't load this right now.",
  emptyText,
  onRetry,
  className = 'py-8 text-center',
  children,
}: ListStateProps) {
  if (isLoading) {
    return (
      <p
        role="status"
        className={cn('text-sm text-ink/40 dark:text-paper/40', className)}
      >
        {loadingText}
      </p>
    )
  }
  if (isError) {
    const detail = error instanceof Error ? error.message : null
    return (
      <div role="alert" className={cn('text-sm text-brand-error', className)}>
        <p>{errorText}</p>
        {detail && <p className="mt-1 text-xs opacity-80">{detail}</p>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 font-mono text-[11px] tracking-widest text-accent uppercase hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    )
  }
  if (isEmpty) {
    return (
      <p className={cn('text-sm text-ink/40 dark:text-paper/40', className)}>
        {emptyText}
      </p>
    )
  }
  return <>{children}</>
}
