import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useEffect } from 'react'
import { type ToastItem, type ToastVariant, useToastStore } from '@/lib/toast'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  error: 8000,
  success: 4000,
  info: 5000,
}

const variantClasses: Record<ToastVariant, string> = {
  error: 'border-l-brand-error',
  success: 'border-l-brand-success',
  info: 'border-l-accent',
}

const variantIcons = {
  error: CircleAlert,
  success: CircleCheck,
  info: Info,
} satisfies Record<ToastVariant, unknown>

const variantLabels: Record<ToastVariant, string> = {
  error: 'Error',
  success: 'Success',
  info: 'Notice',
}

function ToastRow({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const Icon = variantIcons[toast.variant]

  useEffect(() => {
    const timer = window.setTimeout(
      () => dismiss(toast.id),
      AUTO_DISMISS_MS[toast.variant],
    )
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.variant, dismiss])

  return (
    <li
      className={cn(
        'pointer-events-auto flex items-start gap-3 border border-l-4 border-ink/12 bg-paper p-3 text-sm shadow-[2px_2px_0_var(--color-ink)] dark:border-paper/15 dark:bg-ink-soft dark:shadow-[2px_2px_0_var(--color-paper)]',
        variantClasses[toast.variant],
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4 shrink-0',
          toast.variant === 'error' && 'text-brand-error',
          toast.variant === 'success' && 'text-brand-success',
          toast.variant === 'info' && 'text-accent',
        )}
      />
      <p className="min-w-0 flex-1 break-words">
        <span className="sr-only">{variantLabels[toast.variant]}: </span>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 p-1 text-ink/50 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none dark:text-paper/50 dark:hover:text-paper"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  )
}

// Mounted once in the root layout. The live region is always in the DOM
// (even when empty) so screen readers pick up toasts as they're added.
// z-[2100] sits above the app's dialogs (overlay 1900, content 2000) so a
// failed save inside a dialog is still visible.
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[2100] flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <ol className="flex w-full flex-col gap-2 sm:w-96">
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} />
        ))}
      </ol>
    </div>
  )
}
