import * as Dialog from '@radix-ui/react-dialog'
import { Download, Search, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components'
import { toast } from '@/lib/toast'
import { ADMIN_INPUT_CLASSES, getErrorMessage } from './adminUtils'
import { csvFilename, downloadCsv } from './csv'

// Shared building blocks for the admin panels: loading/error states, the
// client-side search box, "Load more", CSV export and a confirm dialog.

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
      {children}
    </span>
  )
}

export function QueryState({
  isLoading,
  error,
  onRetry,
  label = 'Loading…',
}: {
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  label?: string
}) {
  if (isLoading) {
    return (
      <p
        role="status"
        className="py-8 text-center text-sm text-ink/40 dark:text-paper/40"
      >
        {label}
      </p>
    )
  }
  if (error) {
    return (
      <div role="alert" className="py-8 text-center text-sm">
        <p className="text-brand-error">
          Couldn't load: {getErrorMessage(error)}
        </p>
        {onRetry && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </div>
    )
  }
  return null
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-ink/40 dark:text-paper/40">
      {children}
    </p>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="text-xs text-brand-error">
      {getErrorMessage(error)}
    </p>
  )
}

export function SearchBox({
  value,
  onChange,
  label,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-ink/40 dark:text-paper/40"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${ADMIN_INPUT_CLASSES} pl-5`}
      />
    </div>
  )
}

export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  loadedCount,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  loadedCount: number
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <span className="font-mono text-[11px] text-ink/40 dark:text-paper/40">
        {loadedCount} loaded
      </span>
      {hasNextPage && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}

// `build` may be async (e.g. fetching every row, not just the loaded pages);
// the button shows a busy state meanwhile and a toast if it fails.
export function CsvExportButton({
  name,
  build,
  disabled,
}: {
  name: string
  build: () => string | Promise<string>
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      downloadCsv(csvFilename(name), await build())
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't export the CSV"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={() => void handleExport()}
    >
      <Download aria-hidden="true" className="size-3.5" />
      {busy ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  confirmDisabled?: boolean
  // Resolve to close the dialog; reject to keep it open and show the error.
  onConfirm: () => Promise<unknown> | void
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'primary',
  confirmDisabled,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const descriptionId = useId()

  function handleOpenChange(next: boolean) {
    if (busy) return
    if (!next) setError(null)
    onOpenChange(next)
  }

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      setBusy(false)
      onOpenChange(false)
    } catch (err) {
      setBusy(false)
      setError(err)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1900] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-[2000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-ink/10 bg-paper p-5 shadow-xl focus:outline-none dark:border-paper/15 dark:bg-ink-soft"
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-lg font-semibold tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                className="shrink-0 text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          {description && (
            <div
              id={descriptionId}
              className="mt-2 text-sm text-ink/70 dark:text-paper/70"
            >
              {description}
            </div>
          )}
          {children && <div className="mt-4 space-y-3">{children}</div>}
          {error !== null && (
            <div className="mt-3">
              <ErrorText error={error} />
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              variant={variant}
              disabled={busy || confirmDisabled}
              onClick={handleConfirm}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
