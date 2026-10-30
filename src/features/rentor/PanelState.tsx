import { Button } from '@/components'
import { errorMessage } from './errors'

// Shared loading / error placeholders for the owner dashboard panels, so a
// slow or failed query never flashes the "No … yet" empty state.

export function PanelLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p
      role="status"
      className="py-10 text-center text-sm text-ink/40 dark:text-paper/40"
    >
      {label}
    </p>
  )
}

export function PanelError({
  error,
  onRetry,
  label = 'Something went wrong while loading this.',
}: {
  error: unknown
  onRetry?: () => void
  label?: string
}) {
  const message = errorMessage(error, '')
  return (
    <div role="alert" className="py-10 text-center">
      <p className="text-sm text-brand-error">{label}</p>
      {message && (
        <p className="mt-1 font-mono text-[11px] text-ink/50 dark:text-paper/50">
          {message}
        </p>
      )}
      {onRetry && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  )
}
