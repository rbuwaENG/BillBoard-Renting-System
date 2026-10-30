import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children?: ReactNode
  confirmLabel: string
  pendingLabel?: string
  cancelLabel?: string
  destructive?: boolean
  pending?: boolean
  confirmDisabled?: boolean
  error?: string | null
  onConfirm: () => void
}

// Small modal used before irreversible renter actions (cancel a booking,
// submit a payment). Stacks above the billboard detail dialog (z-[2100]).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Go back',
  destructive = false,
  pending = false,
  confirmDisabled = false,
  error,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2050] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-[2100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 border border-ink/10 bg-paper p-5 shadow-xl focus:outline-none dark:border-paper/15 dark:bg-ink-soft"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-lg font-semibold tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                title="Close"
                aria-label="Close"
                disabled={pending}
                className="shrink-0 text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {children && (
            <div className="mt-3 space-y-3 text-sm text-ink/70 dark:text-paper/70">
              {children}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs text-brand-error">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              size="sm"
              disabled={pending || confirmDisabled}
              onClick={onConfirm}
            >
              {pending ? (pendingLabel ?? 'Working…') : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
